import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
// Con extensión `.ts`: `scripts/probar-tienda.ts` corre este archivo con Node
// directo, sin empaquetador, y Node no adivina extensiones. Los `import type`
// desaparecen al quitar los tipos, así que solo el de valores la necesita.
import type { Cotizacion } from "../../compartido/cotizacion.ts";
import type { ContactoPedido, SolicitudPedido } from "../../compartido/pedido.ts";
import { esIdEnvio, esIdPago } from "../../compartido/reglas.ts";

/**
 * Carrito y pedidos de cada cliente de la tienda.
 *
 * Viven en la misma tabla que las fichas de proveedores, con otro prefijo de
 * clave. No es un atajo: son pocas filas, el patrón de acceso es siempre "todo
 * lo de este usuario", y una segunda tabla solo añadiría un recurso más que
 * desplegar y vigilar para el mismo resultado.
 *
 *   PK = USER#<sub>      SK = CARRITO         → el carrito, tal cual lo tiene la app
 *   PK = USER#<sub>      SK = DIRECCIONES     → la libreta de direcciones
 *   PK = USER#<sub>      SK = PEDIDO#<folio>  → copia del pedido en «Mis pedidos»
 *   PK = PEDIDO#<folio>  SK = META            → el pedido de la tienda, con o sin cuenta
 *   PK = CONTADOR        SK = PEDIDOS         → el último número de folio
 *
 * Las filas de usuario **no llevan `GSI1PK`**, así que el índice `porFecha`
 * —que es disperso— no las ve y `GET /proveedores` sigue devolviendo solo
 * fichas. Los pedidos sí lo llevan, pero en su propia partición del índice
 * (`PEDIDOS`), que es la que leerá el panel de administración.
 */

export type ItemCarrito = {
  productoId: string;
  ml: number;
  cantidad: number;
};

export type Carrito = {
  carrito: ItemCarrito[];
  /** "Guardado para después": mismo tipo de dato, misma fila. */
  guardados: ItemCarrito[];
  favoritos: string[];
  actualizadoEn: string;
};

export type Direccion = {
  id: string;
  alias: string;
  nombre: string;
  calle: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  telefono: string;
  predeterminada: boolean;
};

export type Pedido = {
  folio: string;
  fecha: string;
  estatus: string;
  total: number;
  piezas: number;
  items: ItemCarrito[];
  guia?: string;
  paqueteria?: string;
};

/* ── Saneado ────────────────────────────────────────────────────────────────
   Todo lo que llega aquí lo escribió el navegador de alguien. Se recorta a la
   forma esperada antes de guardarlo: no por miedo a un ataque —cada quien solo
   puede escribir su propia partición— sino porque un objeto arbitrario acabaría
   pintándose en la pantalla de otro dispositivo del mismo dueño, y porque una
   fila de DynamoDB no puede pasar de 400 KB. */

const MAX_ITEMS = 200;
const MAX_FAVORITOS = 500;
const MAX_CANTIDAD = 999;

const texto = (v: unknown, largo: number): string =>
  typeof v === "string" ? v.slice(0, largo) : "";

const entero = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r < min || r > max ? null : r;
};

function sanearItems(v: unknown): ItemCarrito[] {
  if (!Array.isArray(v)) return [];
  const items: ItemCarrito[] = [];
  for (const bruto of v.slice(0, MAX_ITEMS)) {
    if (typeof bruto !== "object" || bruto === null) continue;
    const i = bruto as Record<string, unknown>;
    const productoId = texto(i.productoId, 120);
    // `ml: 0` no es un error: es la marca que usa la tienda para los paquetes
    // (lotes y sets), que viajan en la misma estructura con el slug del paquete
    // en `productoId`. Exigir un volumen positivo los borraría del carrito.
    const ml = entero(i.ml, 0, 100000);
    const cantidad = entero(i.cantidad, 1, MAX_CANTIDAD);
    // Una línea sin producto o sin cantidad no es un dato incompleto que
    // convenga conservar: es basura que rompería el carrito del otro aparato.
    if (!productoId || ml === null || cantidad === null) continue;
    items.push({ productoId, ml, cantidad });
  }
  return items;
}

function sanearFavoritos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [
    ...new Set(
      v
        .slice(0, MAX_FAVORITOS)
        .map((x) => texto(x, 120))
        .filter((x) => x !== ""),
    ),
  ];
}

export function sanearCarrito(cuerpo: unknown): Omit<Carrito, "actualizadoEn"> {
  const c = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<
    string,
    unknown
  >;
  return {
    carrito: sanearItems(c.carrito),
    guardados: sanearItems(c.guardados),
    favoritos: sanearFavoritos(c.favoritos),
  };
}

const MAX_DIRECCIONES = 20;

/**
 * Sanea la libreta de direcciones.
 *
 * **Una sola predeterminada, o ninguna.** Es lo único que el checkout no puede
 * resolver por su cuenta: con dos marcadas elegiría la primera que encuentre y
 * el paquete saldría a la dirección equivocada sin que nadie lo note hasta que
 * no llega. Si vienen varias, gana la primera; si no viene ninguna y hay
 * direcciones, se marca la primera.
 *
 * Los campos se recortan pero **no se exigen**: alguien puede guardar media
 * dirección y volver luego a completarla, y perderle lo escrito por no haber
 * puesto la colonia sería peor que guardar un hueco.
 */
export function sanearDirecciones(cuerpo: unknown): Direccion[] {
  const lista = Array.isArray(cuerpo)
    ? cuerpo
    : Array.isArray((cuerpo as { direcciones?: unknown })?.direcciones)
      ? (cuerpo as { direcciones: unknown[] }).direcciones
      : [];

  const salida: Direccion[] = [];
  for (const bruto of lista.slice(0, MAX_DIRECCIONES)) {
    if (typeof bruto !== "object" || bruto === null) continue;
    const d = bruto as Record<string, unknown>;
    const id = texto(d.id, 60).trim();
    if (!id) continue;
    salida.push({
      id,
      alias: texto(d.alias, 40),
      nombre: texto(d.nombre, 120),
      calle: texto(d.calle, 200),
      colonia: texto(d.colonia, 120),
      cp: texto(d.cp, 10),
      ciudad: texto(d.ciudad, 120),
      estado: texto(d.estado, 120),
      telefono: texto(d.telefono, 40),
      predeterminada: d.predeterminada === true,
    });
  }

  const primera = salida.findIndex((d) => d.predeterminada);
  return salida.map((d, i) => ({
    ...d,
    predeterminada: primera === -1 ? i === 0 : i === primera,
  }));
}

const ESTATUS = new Set([
  "Pendiente",
  "Pagado",
  "En camino",
  "Entregado",
  "Cancelado",
]);

/**
 * Sanea la copia de un pedido para «Mis pedidos».
 *
 * Solo la usa el camino antiguo, el de las tiendas que siguen abiertas en algún
 * navegador con el JavaScript de antes: mandaban su propio folio y su propio
 * total. Los pedidos nuevos pasan por `sanearSolicitud`, donde el total ni
 * siquiera se lee — lo calcula el servidor.
 */
export function sanearPedido(cuerpo: unknown): Pedido | null {
  const p = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<
    string,
    unknown
  >;
  const folio = texto(p.folio, 60).trim();
  if (!folio) return null;

  const items = sanearItems(p.items);
  const estatus = texto(p.estatus, 20);
  const total = Number(p.total);
  const piezas = entero(p.piezas, 0, MAX_ITEMS * MAX_CANTIDAD);

  const pedido: Pedido = {
    folio,
    fecha: texto(p.fecha, 30) || new Date().toISOString().slice(0, 10),
    estatus: ESTATUS.has(estatus) ? estatus : "Pendiente",
    total: Number.isFinite(total) && total >= 0 ? Math.round(total * 100) / 100 : 0,
    piezas: piezas ?? items.reduce((n, i) => n + i.cantidad, 0),
    items,
  };
  const guia = texto(p.guia, 60);
  const paqueteria = texto(p.paqueteria, 60);
  if (guia) pedido.guia = guia;
  if (paqueteria) pedido.paqueteria = paqueteria;
  return pedido;
}

/**
 * Sanea la solicitud de un pedido nuevo.
 *
 * Lo que no se acepta es tan deliberado como lo que sí: si el cuerpo trae
 * `folio` o `total`, se ignoran. El folio sale del contador y el total de
 * `cotizar`. Se exige nombre y teléfono porque sin ellos el pedido no se puede
 * confirmar por WhatsApp, que es como se cierra el cobro.
 */
export function sanearSolicitud(cuerpo: unknown): SolicitudPedido | null {
  const s = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<
    string,
    unknown
  >;
  const items = sanearItems(s.items);
  if (items.length === 0 || !esIdPago(s.metodo)) return null;

  const c = (typeof s.contacto === "object" && s.contacto !== null
    ? s.contacto
    : {}) as Record<string, unknown>;
  const contacto: ContactoPedido = {
    correo: texto(c.correo, 160).trim(),
    nombre: texto(c.nombre, 120).trim(),
    telefono: texto(c.telefono, 40).trim(),
    calle: texto(c.calle, 200),
    colonia: texto(c.colonia, 120),
    cp: texto(c.cp, 10),
    ciudad: texto(c.ciudad, 120),
    estado: texto(c.estado, 120),
    referencias: texto(c.referencias, 300),
  };
  if (!contacto.nombre || !contacto.telefono) return null;

  const cupon = texto(s.cupon, 30).trim().toUpperCase();
  return {
    items,
    cupon: cupon || null,
    metodo: s.metodo,
    envio: esIdEnvio(s.envio) ? s.envio : "estandar",
    contacto,
  };
}

/**
 * El siguiente folio, con un contador atómico en DynamoDB.
 *
 * El folio lo ponía el navegador con una fórmula sobre el número de piezas, y
 * dos pedidos con las mismas piezas salían con el mismo folio. Aquí lo asigna un
 * `ADD` que DynamoDB serializa: dos pedidos simultáneos nunca reciben el mismo.
 *
 * Arranca en 2000 para no chocar con los folios que ya repartió la fórmula
 * vieja (del 847 al 1346) y que viven en «Mis pedidos» de algunas cuentas.
 */
export async function siguienteFolio(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  /** El año del folio, en la hora de México y no en la del servidor. */
  anio: string,
): Promise<string> {
  const salida = await dynamo.send(
    new UpdateCommand({
      TableName: tabla,
      Key: { PK: "CONTADOR", SK: "PEDIDOS" },
      UpdateExpression: "SET valor = if_not_exists(valor, :base) + :uno",
      ExpressionAttributeValues: { ":base": 1999, ":uno": 1 },
      ReturnValues: "UPDATED_NEW",
    }),
  );
  const n = Number(salida.Attributes?.valor);
  return `AUR-${anio}-${String(n).padStart(5, "0")}`;
}

export type PedidoTienda = {
  folio: string;
  fecha: string;
  estatus: string;
  solicitud: SolicitudPedido;
  /** Las cifras tal como las calculó el servidor al recibirlo. */
  cuenta: Omit<Cotizacion, "lineas" | "descartados" | "escalon"> & {
    escalon: string;
    /** Artículos que llegaron pero no existen en el catálogo: no se cobraron. */
    descartados: number;
    lineas: {
      productoId: string;
      ml: number;
      cantidad: number;
      unitario: number;
      subtotal: number;
    }[];
  };
};

/** Lo que se guarda de la cotización: las cifras, sin estructuras de más. */
export function cuentaDe(c: Cotizacion): PedidoTienda["cuenta"] {
  const { lineas, descartados, escalon, ...cifras } = c;
  return {
    ...cifras,
    escalon: escalon.nombre,
    descartados: descartados.length,
    lineas: lineas.map((l) => ({
      productoId: l.item.productoId,
      ml: l.item.ml,
      cantidad: l.item.cantidad,
      unitario: l.unitario,
      subtotal: l.subtotal,
    })),
  };
}

/**
 * Guarda el pedido de la tienda, con o sin cuenta.
 *
 * Va en su propia partición (`PEDIDO#<folio>`) y en la partición `PEDIDOS` del
 * índice por fecha, que es la que listará el panel de administración. La
 * condición impide pisar un pedido existente si algún día el contador se
 * reiniciara por error.
 */
export async function guardarPedidoTienda(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  pedido: PedidoTienda,
): Promise<void> {
  const creadoEn = new Date().toISOString();
  await dynamo.send(
    new PutCommand({
      TableName: tabla,
      Item: {
        PK: `PEDIDO#${pedido.folio}`,
        SK: "META",
        GSI1PK: "PEDIDOS",
        GSI1SK: `${creadoEn}#${pedido.folio}`,
        pedido,
        creadoEn,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );
}

/* ── Acceso a datos ─────────────────────────────────────────────────────── */

const VACIO: Carrito = {
  carrito: [],
  guardados: [],
  favoritos: [],
  actualizadoEn: "",
};

export async function leerCarrito(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
): Promise<Carrito> {
  const salida = await dynamo.send(
    new QueryCommand({
      TableName: tabla,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: { ":pk": `USER#${sub}`, ":sk": "CARRITO" },
    }),
  );
  const fila = salida.Items?.[0];
  if (!fila) return VACIO;
  return {
    carrito: sanearItems(fila.carrito),
    guardados: sanearItems(fila.guardados),
    favoritos: sanearFavoritos(fila.favoritos),
    actualizadoEn: String(fila.actualizadoEn ?? ""),
  };
}

export async function guardarCarrito(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
  contenido: Omit<Carrito, "actualizadoEn">,
): Promise<Carrito> {
  const actualizadoEn = new Date().toISOString();
  await dynamo.send(
    new PutCommand({
      TableName: tabla,
      Item: { PK: `USER#${sub}`, SK: "CARRITO", ...contenido, actualizadoEn },
    }),
  );
  return { ...contenido, actualizadoEn };
}

export async function leerDirecciones(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
): Promise<Direccion[]> {
  const salida = await dynamo.send(
    new QueryCommand({
      TableName: tabla,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: { ":pk": `USER#${sub}`, ":sk": "DIRECCIONES" },
    }),
  );
  return sanearDirecciones(salida.Items?.[0]?.direcciones ?? []);
}

export async function guardarDirecciones(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
  direcciones: Direccion[],
): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: tabla,
      Item: {
        PK: `USER#${sub}`,
        SK: "DIRECCIONES",
        direcciones,
        actualizadoEn: new Date().toISOString(),
      },
    }),
  );
}

export async function listarPedidos(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
): Promise<Pedido[]> {
  const salida = await dynamo.send(
    new QueryCommand({
      TableName: tabla,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": `USER#${sub}`, ":sk": "PEDIDO#" },
    }),
  );
  return (salida.Items ?? [])
    .map((f) => f.pedido as Pedido)
    .filter((p): p is Pedido => Boolean(p?.folio))
    // Del más reciente al más viejo, que es como se lee la lista de pedidos.
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.folio.localeCompare(a.folio));
}

export async function guardarPedido(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
  pedido: Pedido,
): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: tabla,
      Item: {
        PK: `USER#${sub}`,
        SK: `PEDIDO#${pedido.folio}`,
        pedido,
        creadoEn: new Date().toISOString(),
      },
    }),
  );
}
