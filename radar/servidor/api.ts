import { Resource } from "sst";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { firmarToken, pinCorrecto } from "./jwt";
import {
  identificar,
  puedeVerProveedores,
  tieneIdentidadPropia,
  type Identidad,
} from "./identidad";
import { leerLista } from "./precios";
import {
  cuentaDe,
  guardarCarrito,
  guardarDirecciones,
  guardarPedido,
  guardarPedidoTienda,
  leerCarrito,
  leerDirecciones,
  listarPedidos,
  sanearCarrito,
  sanearDirecciones,
  sanearPedido,
  sanearSolicitud,
  siguienteFolio,
} from "./tienda";
// Mismo cálculo y mismos precios que la tienda. Hoy el catálogo viene compilado
// del propio repositorio —las dos cosas se despliegan desde el mismo commit—;
// cuando viva en DynamoDB, solo cambia la fuente.
import { cotizar } from "../../compartido/cotizacion";
import type { PedidoRegistrado } from "../../compartido/pedido";
import { FUENTE_TIENDA } from "../../src/data/fuente-precios";

/**
 * API del Radar de Proveedores.
 *
 * Una sola Lambda que enruta por su cuenta, en vez de una función por endpoint.
 * A este volumen —un equipo de campo, decenas de fichas al día— repartir las
 * rutas en seis Lambdas solo multiplica los arranques en frío y el despliegue,
 * sin ganar nada: el paquete es el mismo y la concurrencia sobra.
 *
 * Modelo en `Elrey_proveedores` (tabla única):
 *   PK = PROV#<id>   SK = META           → la ficha
 *   PK = PROV#<id>   SK = FOTO#<fotoId>  → metadatos de cada foto
 *   GSI1: PROVEEDORES / <actualizadoEn>#<id> → listar todo por fecha
 */

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});

const TABLA = Resource.Elrey_proveedores.name;
const BUCKET = Resource.Elrey_fotos.name;

type Evento = {
  requestContext: { http: { method: string; path: string } };
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  pathParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
};

/**
 * CORS a mano.
 *
 * API Gateway sabe responder el preflight por su cuenta… salvo cuando existe una
 * ruta `$default`, porque entonces el `OPTIONS` también cae en ella y llega
 * hasta aquí. Con la configuración del gateway sola, el navegador recibía un 404
 * sin cabeceras y bloqueaba cada petición desde el sitio. Curl no lo detectaba:
 * no hace preflight.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-max-age": "86400",
};

const json = (estado: number, cuerpo: unknown) => ({
  statusCode: estado,
  headers: { "content-type": "application/json", ...CORS },
  body: JSON.stringify(cuerpo),
});

function leerCuerpo<T>(evento: Evento): T | null {
  if (!evento.body) return null;
  const crudo = evento.isBase64Encoded
    ? Buffer.from(evento.body, "base64").toString("utf8")
    : evento.body;
  try {
    return JSON.parse(crudo) as T;
  } catch {
    return null;
  }
}

function sesionDe(evento: Evento): Promise<Identidad | null> {
  return identificar(evento.headers.authorization ?? evento.headers.Authorization);
}

export async function handler(evento: Evento) {
  const metodo = evento.requestContext.http.method;
  const ruta = evento.requestContext.http.path;

  // El preflight se contesta antes que nada: no lleva token ni cuerpo.
  if (metodo === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  try {
    if (metodo === "GET" && ruta === "/salud") {
      return json(200, {
        ok: true,
        tabla: TABLA,
        bucket: BUCKET,
        pool: Resource.Elrey_usuarios.id,
        clienteCognito: Resource.Elrey_web.id,
      });
    }

    if (metodo === "POST" && ruta === "/acceso") return acceso(evento);

    // Los pedidos de la tienda llegan con o sin cuenta —casi nadie se registra
    // para comprar—, así que van antes del filtro de sesión. La identidad, si
    // viene, solo sirve para guardar además la copia en «Mis pedidos».
    if (metodo === "POST" && ruta === "/pedidos") return crearPedido(evento);

    // Todo lo demás exige identidad. La app puede capturar sin ella —los datos
    // viven en el teléfono—, pero nada sube sin haber iniciado sesión.
    const sesion = await sesionDe(evento);
    if (!sesion) return json(401, { error: "Sesión inválida o vencida" });

    // Lo de la tienda va antes del filtro por grupo: el carrito y los pedidos
    // son de quien inició sesión, sea cliente o del equipo. Lo que se exige aquí
    // no es un grupo sino una identidad propia — el carrito se guarda bajo el
    // `sub`, y el PIN compartido no identifica a nadie.
    if (ruta === "/carrito" || ruta === "/pedidos" || ruta === "/direcciones") {
      if (!tieneIdentidadPropia(sesion)) {
        return json(403, {
          error: "El carrito necesita una cuenta propia, no el código del equipo",
        });
      }
      if (metodo === "GET" && ruta === "/carrito") return verCarrito(sesion.sub);
      if (metodo === "PUT" && ruta === "/carrito") {
        return ponerCarrito(evento, sesion.sub);
      }
      if (metodo === "GET" && ruta === "/direcciones") {
        return verDirecciones(sesion.sub);
      }
      if (metodo === "PUT" && ruta === "/direcciones") {
        return ponerDirecciones(evento, sesion.sub);
      }
      if (metodo === "GET" && ruta === "/pedidos") return verPedidos(sesion.sub);
      return json(405, { error: `${metodo} no va en ${ruta}` });
    }

    // El grupo es el permiso. Un cliente de la tienda tiene sesión válida y aun
    // así no tiene nada que hacer aquí.
    if (!puedeVerProveedores(sesion)) {
      return json(403, { error: "Tu cuenta no tiene acceso al panel de proveedores" });
    }

    if (metodo === "GET" && ruta === "/proveedores") return listar();
    if (metodo === "PUT" && ruta.startsWith("/proveedores/")) {
      return guardar(evento, sesion);
    }
    if (metodo === "DELETE" && ruta.startsWith("/proveedores/")) {
      return borrar(evento);
    }
    if (metodo === "POST" && ruta === "/fotos") return urlDeSubida(evento);
    if (metodo === "GET" && ruta === "/fotos") return listarFotos(evento);
    if (metodo === "POST" && ruta === "/precios/leer") return leerPrecios(evento);

    return json(404, { error: `Sin ruta para ${metodo} ${ruta}` });
  } catch (e) {
    console.error("fallo no controlado", e);
    return json(500, { error: "Error interno" });
  }
}

// ── Acceso ──────────────────────────────────────────────────────────────────

async function acceso(evento: Evento) {
  const cuerpo = leerCuerpo<{ pin?: string; evaluador?: string }>(evento);
  const pin = cuerpo?.pin ?? "";
  const evaluador = (cuerpo?.evaluador ?? "").trim();

  if (!pinCorrecto(pin, Resource.Elrey_pin.value)) {
    return json(401, { error: "Ese código no es." });
  }
  if (!evaluador) return json(400, { error: "Falta el nombre de quien captura" });

  return json(200, {
    token: firmarToken(evaluador, Resource.Elrey_jwt_secreto.value),
    evaluador,
  });
}

// ── Tienda: carrito y pedidos ───────────────────────────────────────────────

/**
 * El carrito del servidor **no manda sobre el del navegador**: es la copia que
 * permite retomarlo en otro aparato. La app fusiona lo suyo con esto al iniciar
 * sesión y vuelve a subir el resultado; aquí solo se lee y se escribe.
 */
async function verCarrito(sub: string) {
  return json(200, await leerCarrito(dynamo, TABLA, sub));
}

async function ponerCarrito(evento: Evento, sub: string) {
  const cuerpo = leerCuerpo<unknown>(evento);
  if (cuerpo === null) return json(400, { error: "Carrito inválido" });
  return json(200, await guardarCarrito(dynamo, TABLA, sub, sanearCarrito(cuerpo)));
}

/**
 * La libreta de direcciones. Se guarda entera de una vez y no dirección por
 * dirección: son pocas, siempre se editan mirando la lista completa, y así la
 * regla de «una sola predeterminada» se resuelve en un único sitio.
 */
async function verDirecciones(sub: string) {
  return json(200, { direcciones: await leerDirecciones(dynamo, TABLA, sub) });
}

async function ponerDirecciones(evento: Evento, sub: string) {
  const cuerpo = leerCuerpo<unknown>(evento);
  if (cuerpo === null) return json(400, { error: "Direcciones inválidas" });
  const direcciones = sanearDirecciones(cuerpo);
  await guardarDirecciones(dynamo, TABLA, sub, direcciones);
  return json(200, { direcciones });
}

async function verPedidos(sub: string) {
  return json(200, { pedidos: await listarPedidos(dynamo, TABLA, sub) });
}

/** Fecha de calendario en México: un pedido de las 8 pm no es de mañana. */
function fechaMexico(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(ahora);
}

/**
 * Registra un pedido de la tienda.
 *
 * **El total se calcula aquí**, con `cotizar` y los precios del catálogo. Lo que
 * el navegador creyó que costaba no se lee: cualquiera puede editar su propio
 * JavaScript y mandar un cero. El folio también sale de aquí, de un contador.
 */
async function crearPedido(evento: Evento) {
  const cuerpo = leerCuerpo<unknown>(evento);
  const sesion = await sesionDe(evento).catch(() => null);
  const sub = sesion && tieneIdentidadPropia(sesion) ? sesion.sub : null;

  // Camino antiguo: una pestaña abierta con el JavaScript de antes todavía
  // manda su propio folio y su total para «Mis pedidos». Se acepta como antes
  // —solo con cuenta— para que esa compra no falle, pero no crea un pedido de
  // la tienda: ese navegador ya le enseñó al comprador su propio folio. Se
  // reconoce por no traer `contacto`, que el contrato nuevo siempre lleva: un
  // `folio` metido a mano en una solicitud nueva se ignora, no la desvía aquí.
  const bruto = (cuerpo ?? {}) as { folio?: unknown; contacto?: unknown };
  if (typeof bruto.folio === "string" && bruto.contacto === undefined) {
    if (!sub) return json(401, { error: "Sesión inválida o vencida" });
    const copia = sanearPedido(cuerpo);
    if (!copia) return json(400, { error: "Falta el folio del pedido" });
    await guardarPedido(dynamo, TABLA, sub, copia);
    return json(200, { ok: true, folio: copia.folio });
  }

  const solicitud = sanearSolicitud(cuerpo);
  if (!solicitud) {
    return json(400, {
      error: "Pedido inválido: faltan artículos, forma de pago o nombre y teléfono",
    });
  }

  const cotizacion = cotizar(solicitud.items, FUENTE_TIENDA, {
    cupon: solicitud.cupon,
    metodo: solicitud.metodo,
    envio: solicitud.envio,
  });
  if (cotizacion.lineas.length === 0) {
    return json(422, { error: "Ningún artículo del pedido existe en el catálogo" });
  }

  const fecha = fechaMexico(new Date());
  const folio = await siguienteFolio(dynamo, TABLA, fecha.slice(0, 4));

  await guardarPedidoTienda(dynamo, TABLA, {
    folio,
    fecha,
    estatus: "Pendiente",
    solicitud,
    cuenta: cuentaDe(cotizacion),
  });

  if (sub) {
    await guardarPedido(dynamo, TABLA, sub, {
      folio,
      fecha,
      estatus: "Pendiente",
      total: cotizacion.total,
      piezas: cotizacion.piezasTotales,
      items: solicitud.items,
    });
  }

  const registrado: PedidoRegistrado = {
    folio,
    fecha,
    total: cotizacion.total,
    comision: cotizacion.comision,
    descuentoTransferencia: cotizacion.descuentoTransferencia,
    metodo: cotizacion.metodo ?? solicitud.metodo,
  };
  return json(201, registrado);
}

// ── Proveedores ─────────────────────────────────────────────────────────────

async function listar() {
  const salida = await dynamo.send(
    new QueryCommand({
      TableName: TABLA,
      IndexName: "porFecha",
      KeyConditionExpression: "GSI1PK = :p",
      ExpressionAttributeValues: { ":p": "PROVEEDORES" },
      ScanIndexForward: false,
    }),
  );
  const proveedores = (salida.Items ?? []).map((item) => item.ficha);
  return json(200, { proveedores });
}

async function guardar(evento: Evento, sesion: Identidad) {
  const id = evento.pathParameters?.id ?? evento.requestContext.http.path.split("/")[2];
  const ficha = leerCuerpo<Record<string, unknown>>(evento);
  if (!ficha || !id) return json(400, { error: "Ficha inválida" });

  const actualizadoEn = String(ficha.actualizadoEn ?? new Date().toISOString());

  await dynamo.send(
    new PutCommand({
      TableName: TABLA,
      Item: {
        PK: `PROV#${id}`,
        SK: "META",
        GSI1PK: "PROVEEDORES",
        GSI1SK: `${actualizadoEn}#${id}`,
        // La ficha se guarda entera tal como la envía el cliente y se le sella
        // el estado: si el servidor la devolviera como "pendiente", el teléfono
        // volvería a subirla en el siguiente ciclo, para siempre.
        ficha: { ...ficha, estado: "sincronizado", subidoPor: sesion.evaluador },
        actualizadoEn,
      },
    }),
  );

  return json(200, { ok: true, id });
}

async function borrar(evento: Evento) {
  const id = evento.pathParameters?.id ?? evento.requestContext.http.path.split("/")[2];
  if (!id) return json(400, { error: "Falta el id" });

  // Las fotos comparten partición con la ficha: se van con ella.
  const fotos = await dynamo.send(
    new QueryCommand({
      TableName: TABLA,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": `PROV#${id}`, ":sk": "FOTO#" },
    }),
  );

  const claves = (fotos.Items ?? [])
    .map((f) => String(f.clave ?? ""))
    .filter((c) => c !== "");

  // Los objetos de S3 se borran primero. Si solo se limpiaran los registros de
  // DynamoDB, las imágenes quedarían huérfanas en el bucket: nadie sabría que
  // están ahí y seguirían costando dinero para siempre.
  if (claves.length > 0) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: claves.map((Key) => ({ Key })) },
      }),
    );
  }

  await Promise.all([
    ...(fotos.Items ?? []).map((f) =>
      dynamo.send(
        new DeleteCommand({ TableName: TABLA, Key: { PK: f.PK, SK: f.SK } }),
      ),
    ),
    dynamo.send(
      new DeleteCommand({ TableName: TABLA, Key: { PK: `PROV#${id}`, SK: "META" } }),
    ),
  ]);

  return json(200, { ok: true, fotosBorradas: claves.length });
}


/**
 * Lee la lista de precios de una foto ya subida a S3.
 *
 * La foto tiene que estar arriba antes de llamar aquí: Textract lee del bucket,
 * no del teléfono. Mandar la imagen por API Gateway habría sido pagar dos veces
 * la misma transferencia y chocar con su límite de 6 MB.
 */
async function leerPrecios(evento: Evento) {
  const cuerpo = leerCuerpo<{ proveedorId?: string; fotoId?: string }>(evento);
  if (!cuerpo?.proveedorId || !cuerpo.fotoId) {
    return json(400, { error: "Faltan proveedorId o fotoId" });
  }

  // La clave se consulta en DynamoDB en vez de reconstruirla: la extensión
  // depende del formato con que se tomó la foto, y adivinarla ya falló una vez.
  const guardado = await dynamo.send(
    new QueryCommand({
      TableName: TABLA,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ":pk": `PROV#${cuerpo.proveedorId}`,
        ":sk": `FOTO#${cuerpo.fotoId}`,
      },
    }),
  );
  const clave = String(guardado.Items?.[0]?.clave ?? "");
  if (!clave) {
    return json(409, { error: "La foto todavía no está subida. Sincroniza y reintenta." });
  }

  try {
    const lectura = await leerLista(BUCKET, clave);
    return json(200, lectura);
  } catch (e) {
    console.error("textract falló", e);
    const motivo = e instanceof Error ? e.message : String(e);
    // Que la foto no esté en S3 es el error más probable y tiene arreglo desde
    // la app; el resto son problemas del servicio y no ayuda disfrazarlos.
    if (motivo.includes("NoSuchKey") || motivo.includes("InvalidS3Object")) {
      return json(409, { error: "La foto todavía no está subida. Sincroniza y reintenta." });
    }
    if (motivo.includes("UnsupportedDocument")) {
      return json(415, {
        error: "Esa foto se tomó en un formato que el lector no entiende. Tómala de nuevo.",
      });
    }
    return json(502, { error: "No se pudo leer la lista de precios" });
  }
}

// ── Fotos ───────────────────────────────────────────────────────────────────

/**
 * URL prefirmada para que el teléfono suba **directo a S3**.
 *
 * La foto no pasa por la Lambda a propósito: con roaming malo, mandar 300 KB a
 * través de API Gateway es pagar dos veces la misma transferencia y arriesgarse
 * al límite de 6 MB de payload.
 */
async function urlDeSubida(evento: Evento) {
  const cuerpo = leerCuerpo<{
    proveedorId?: string;
    fotoId?: string;
    tipo?: string;
    contentType?: string;
    tomadaEn?: string;
    lat?: number | null;
    lng?: number | null;
  }>(evento);

  if (!cuerpo?.proveedorId || !cuerpo.fotoId) {
    return json(400, { error: "Faltan proveedorId o fotoId" });
  }

  // La extensión sigue al tipo real: la lista de precios llega en JPEG para que
  // Textract pueda leerla —no admite WebP— y el resto sigue en WebP, que pesa
  // la mitad y se sube con datos de roaming.
  const tipoMime = cuerpo.contentType ?? "image/webp";
  const extension = tipoMime.includes("jpeg") ? "jpg" : "webp";
  const clave = `${cuerpo.proveedorId}/${cuerpo.fotoId}.${extension}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: clave,
      ContentType: tipoMime,
    }),
    { expiresIn: 900 },
  );

  await dynamo.send(
    new PutCommand({
      TableName: TABLA,
      Item: {
        PK: `PROV#${cuerpo.proveedorId}`,
        SK: `FOTO#${cuerpo.fotoId}`,
        clave,
        tipo: cuerpo.tipo ?? "producto",
        tomadaEn: cuerpo.tomadaEn ?? new Date().toISOString(),
        lat: cuerpo.lat ?? null,
        lng: cuerpo.lng ?? null,
      },
    }),
  );

  return json(200, { url, clave });
}

async function listarFotos(evento: Evento) {
  const proveedorId = evento.queryStringParameters?.proveedorId;
  if (!proveedorId) return json(400, { error: "Falta proveedorId" });

  const salida = await dynamo.send(
    new QueryCommand({
      TableName: TABLA,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": `PROV#${proveedorId}`, ":sk": "FOTO#" },
    }),
  );

  const fotos = await Promise.all(
    (salida.Items ?? []).map(async (f) => ({
      id: String(f.SK).replace("FOTO#", ""),
      tipo: f.tipo,
      tomadaEn: f.tomadaEn,
      url: await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: f.clave }),
        { expiresIn: 3600 },
      ),
    })),
  );

  return json(200, { fotos });
}
