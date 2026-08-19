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
import { firmarToken, pinCorrecto, verificarToken, type Sesion } from "./jwt";

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

function sesionDe(evento: Evento): Sesion | null {
  const cabecera = evento.headers.authorization ?? evento.headers.Authorization;
  if (!cabecera?.startsWith("Bearer ")) return null;
  return verificarToken(cabecera.slice(7), Resource.Elrey_jwt_secreto.value);
}

export async function handler(evento: Evento) {
  const metodo = evento.requestContext.http.method;
  const ruta = evento.requestContext.http.path;

  // El preflight se contesta antes que nada: no lleva token ni cuerpo.
  if (metodo === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  try {
    if (metodo === "GET" && ruta === "/salud") {
      return json(200, { ok: true, tabla: TABLA, bucket: BUCKET });
    }

    if (metodo === "POST" && ruta === "/acceso") return acceso(evento);

    // Todo lo demás exige token. La app puede capturar sin él —los datos viven
    // en el teléfono—, pero nada sube sin haber pasado por el PIN.
    const sesion = sesionDe(evento);
    if (!sesion) return json(401, { error: "Sesión inválida o vencida" });

    if (metodo === "GET" && ruta === "/proveedores") return listar();
    if (metodo === "PUT" && ruta.startsWith("/proveedores/")) {
      return guardar(evento, sesion);
    }
    if (metodo === "DELETE" && ruta.startsWith("/proveedores/")) {
      return borrar(evento);
    }
    if (metodo === "POST" && ruta === "/fotos") return urlDeSubida(evento);
    if (metodo === "GET" && ruta === "/fotos") return listarFotos(evento);

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

async function guardar(evento: Evento, sesion: Sesion) {
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

  const clave = `${cuerpo.proveedorId}/${cuerpo.fotoId}.webp`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: clave,
      ContentType: cuerpo.contentType ?? "image/webp",
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
