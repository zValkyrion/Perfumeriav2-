import {
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  BADGES,
  CONCENTRACIONES,
  FAMILIAS,
  GENEROS,
  OCASIONES,
  type ImagenCatalogo,
} from "../../compartido/catalogo";
import {
  claveRegistro,
  type CatalogoAdmin,
  type EstadoPublicacion,
  type EstadoRegistro,
  type ImagenAutorizada,
  type RegistroGuardado,
} from "../../compartido/catalogo-admin";
import {
  META,
  PARTICIONES,
  catalogoDeFilas,
  iguales,
  type FilaGuardada,
  type Particion,
} from "../../compartido/catalogo-tabla";
import { huellaDe } from "../../compartido/huella";
import {
  PARTICION_DE,
  PATRON_CODIGO,
  quienUsa,
  validarRegistro,
  type TipoRegistro,
} from "../../compartido/validar-catalogo";
import { olvidarCatalogo } from "./catalogo";

/**
 * El catálogo visto desde el panel: completo, con lo oculto y las notas, y
 * escrito fila por fila.
 *
 * Cada guardado lleva la huella de lo que el panel leyó. Si no coincide con la
 * de la tabla, alguien más cambió ese registro mientras se editaba —otro
 * administrador, o una carga del CSV— y se rechaza en vez de pisarlo.
 */

export interface Contexto {
  dynamo: DynamoDBDocumentClient;
  s3: S3Client;
  tabla: string;
  bucket: string;
}

export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; estado: number; cuerpo: Record<string, unknown> };

const falla = (estado: number, error: string, extra: Record<string, unknown> = {}) =>
  ({ ok: false, estado, cuerpo: { error, ...extra } }) as const;

const TIPO_DE: Record<Particion, TipoRegistro> = {
  PRODUCTO: "producto",
  MARCA: "marca",
  SET: "set",
  LOTE: "lote",
};

/** Vino del CSV: tiene `fuente`, o es de antes del panel y nadie la ha editado. */
const vinoDelCsv = (f: FilaGuardada) => f.fuente !== undefined || f.editadoEn === undefined;

async function leerFilas(ctx: Contexto): Promise<FilaGuardada[]> {
  const filas: FilaGuardada[] = [];
  for (const pk of PARTICIONES) {
    let desde: Record<string, unknown> | undefined;
    do {
      const r = await ctx.dynamo.send(
        new QueryCommand({
          TableName: ctx.tabla,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": pk },
          // Lo que se acaba de guardar tiene que verse al recargar el panel.
          ConsistentRead: true,
          ExclusiveStartKey: desde,
        }),
      );
      for (const item of r.Items ?? []) filas.push(item as FilaGuardada);
      desde = r.LastEvaluatedKey;
    } while (desde);
  }
  return filas;
}

/** El catálogo completo, con lo oculto y las notas: lo que exporta el panel. */
export async function catalogoCompleto(ctx: Contexto) {
  return catalogoDeFilas(await leerFilas(ctx), "");
}

export async function catalogoAdmin(
  ctx: Contexto,
  publicacion: EstadoPublicacion,
): Promise<CatalogoAdmin> {
  const filas = await leerFilas(ctx);
  const registros: Record<string, EstadoRegistro> = {};
  for (const f of filas) {
    if (f.borrado) continue;
    registros[claveRegistro(TIPO_DE[f.PK as Particion], f.SK)] = {
      huella: f.huella ?? "",
      ...(f.editadoEn ? { editadoEn: f.editadoEn, editadoPor: f.editadoPor } : {}),
      deCsv: vinoDelCsv(f),
    };
  }
  return {
    catalogo: catalogoDeFilas(filas, publicacion.cambiado ?? ""),
    registros,
    publicacion,
    vocabulario: {
      concentraciones: CONCENTRACIONES,
      generos: GENEROS,
      familias: FAMILIAS,
      ocasiones: OCASIONES,
      badges: BADGES,
    },
  };
}

/** Anota que el catálogo cambió: el panel y la publicación automática lo leen. */
async function marcarCambio(ctx: Contexto, cuando: string, quien: string) {
  await ctx.dynamo.send(
    new UpdateCommand({
      TableName: ctx.tabla,
      Key: META,
      UpdateExpression: "SET generado = :c, editadoEn = :c, editadoPor = :q",
      ExpressionAttributeValues: { ":c": cuando, ":q": quien },
    }),
  );
  olvidarCatalogo();
}

const esCondicionFallida = (e: unknown) =>
  e instanceof Error && e.name === "ConditionalCheckFailedException";

const OTRO_LO_CAMBIO =
  "Alguien más cambió este registro mientras lo editabas. Recarga para ver la versión actual.";

async function existeEnBucket(ctx: Contexto, clave: string): Promise<boolean> {
  return ctx.s3
    .send(new HeadObjectCommand({ Bucket: ctx.bucket, Key: clave }))
    .then(() => true)
    .catch(() => false);
}

export async function guardarRegistro(
  ctx: Contexto,
  tipo: TipoRegistro,
  id: string,
  cuerpo: unknown,
  quien: string,
): Promise<Resultado<RegistroGuardado>> {
  const { datos, huella } = (cuerpo ?? {}) as { datos?: unknown; huella?: unknown };
  if (huella !== null && typeof huella !== "string") {
    return falla(400, "Falta la huella del registro (o null para darlo de alta)");
  }

  const filas = await leerFilas(ctx);
  const pk = PARTICION_DE[tipo];
  const fila = filas.find((f) => f.PK === pk && f.SK === id);
  const vivo = fila && !fila.borrado ? fila : undefined;

  if (huella === null && vivo) return falla(409, "Ya existe un registro con ese código");
  if (huella !== null && !vivo) return falla(409, "Ese registro ya no existe: alguien lo borró");
  if (vivo && vivo.huella !== huella) return falla(409, OTRO_LO_CAMBIO);

  const catalogo = catalogoDeFilas(filas, "");
  const v = validarRegistro(tipo, datos, catalogo, id);
  if (!v.ok) return falla(422, "Revisa los campos marcados", { errores: v.errores });

  if (vivo && iguales(vivo.datos, v.valor)) {
    return {
      ok: true,
      valor: {
        huella: vivo.huella ?? "",
        sinCambios: true,
        datos: vivo.datos,
        editadoEn: vivo.editadoEn,
        editadoPor: vivo.editadoPor,
      },
    };
  }

  // Una foto nueva tiene que estar ya en el bucket: un producto publicado no
  // puede apuntar a una imagen que no existe.
  if ("imagenes" in v.valor) {
    const antes = new Set(
      ((vivo?.datos as { imagenes?: ImagenCatalogo[] } | undefined)?.imagenes ?? []).map(
        (i) => i.clave,
      ),
    );
    for (const i of v.valor.imagenes) {
      if (antes.has(i.clave)) continue;
      if (!(await existeEnBucket(ctx, i.clave))) {
        return falla(422, "Revisa los campos marcados", {
          errores: [{ campo: "imagenes", mensaje: "la foto no terminó de subirse: vuelve a elegirla" }],
        });
      }
    }
  }

  const ahora = new Date().toISOString();
  const nueva = huellaDe(v.valor);
  // Una fila del CSV de antes del panel todavía no tiene `fuente`. Lo que
  // tiene ahora es justo lo último que dijo el CSV: se anota antes de que el
  // panel lo cambie, para que la próxima carga sepa qué fusionar.
  const anotarFuente = fila !== undefined && fila.fuente === undefined && fila.editadoEn === undefined;

  try {
    await ctx.dynamo.send(
      new UpdateCommand({
        TableName: ctx.tabla,
        Key: { PK: pk, SK: id },
        UpdateExpression:
          "SET datos = :d, huella = :h, editadoEn = :e, editadoPor = :q" +
          (anotarFuente ? ", fuente = :f" : "") +
          (fila?.borrado ? " REMOVE borrado" : ""),
        ConditionExpression: vivo
          ? "huella = :previa"
          : fila
            ? "borrado = :si"
            : "attribute_not_exists(PK)",
        ExpressionAttributeValues: {
          ":d": v.valor,
          ":h": nueva,
          ":e": ahora,
          ":q": quien,
          ...(anotarFuente ? { ":f": fila.datos } : {}),
          ...(vivo ? { ":previa": vivo.huella } : fila ? { ":si": true } : {}),
        },
      }),
    );
  } catch (e) {
    if (esCondicionFallida(e)) return falla(409, OTRO_LO_CAMBIO);
    throw e;
  }

  await marcarCambio(ctx, ahora, quien);
  return {
    ok: true,
    valor: { huella: nueva, sinCambios: false, datos: v.valor, editadoEn: ahora, editadoPor: quien },
  };
}

export async function borrarRegistro(
  ctx: Contexto,
  tipo: TipoRegistro,
  id: string,
  huella: string,
  quien: string,
): Promise<Resultado<{ borrado: true }>> {
  const filas = await leerFilas(ctx);
  const fila = filas.find((f) => f.PK === PARTICION_DE[tipo] && f.SK === id && !f.borrado);
  if (!fila) return falla(404, "Ese registro ya no existe");
  if (fila.huella !== huella) return falla(409, OTRO_LO_CAMBIO);

  const usos = quienUsa(tipo, id, catalogoDeFilas(filas, ""));
  if (usos.length > 0) {
    const lista = usos.slice(0, 5).join(", ") + (usos.length > 5 ? ` y ${usos.length - 5} más` : "");
    return falla(409, `No se puede borrar: lo usan ${lista}`, { usos });
  }

  const ahora = new Date().toISOString();
  try {
    if (vinoDelCsv(fila)) {
      // Lo que vino del CSV se queda como marca de borrado: si se quitara la
      // fila, la próxima carga del CSV lo daría de alta otra vez.
      const anotarFuente = fila.fuente === undefined;
      await ctx.dynamo.send(
        new UpdateCommand({
          TableName: ctx.tabla,
          Key: { PK: fila.PK, SK: fila.SK },
          UpdateExpression:
            "SET borrado = :si, huella = :h, editadoEn = :e, editadoPor = :q" +
            (anotarFuente ? ", fuente = :f" : ""),
          ConditionExpression: "huella = :previa",
          ExpressionAttributeValues: {
            ":si": true,
            ":h": huellaDe({ borrado: ahora }),
            ":e": ahora,
            ":q": quien,
            ":previa": huella,
            ...(anotarFuente ? { ":f": fila.datos } : {}),
          },
        }),
      );
    } else {
      await ctx.dynamo.send(
        new DeleteCommand({
          TableName: ctx.tabla,
          Key: { PK: fila.PK, SK: fila.SK },
          ConditionExpression: "huella = :previa",
          ExpressionAttributeValues: { ":previa": huella },
        }),
      );
    }
  } catch (e) {
    if (esCondicionFallida(e)) return falla(409, OTRO_LO_CAMBIO);
    throw e;
  }

  await marcarCambio(ctx, ahora, quien);
  return { ok: true, valor: { borrado: true } };
}

/**
 * Dónde subir una foto ya procesada en el navegador.
 *
 * El nombre del archivo es su huella SHA-256: la misma foto cae en la misma
 * clave, una distinta estrena clave y por eso se puede servir con caché de un
 * año sin invalidar nada, igual que las que sube la carga del CSV.
 */
export async function autorizarImagen(
  ctx: Contexto,
  cuerpo: unknown,
): Promise<Resultado<ImagenAutorizada>> {
  const s = (cuerpo ?? {}) as Record<string, unknown>;
  const tipo = s.tipo === "producto" || s.tipo === "set" ? s.tipo : null;
  const formato = s.formato === "webp" || s.formato === "jpeg" ? s.formato : null;
  const codigo = typeof s.codigo === "string" ? s.codigo : "";
  const sha = typeof s.sha256 === "string" ? s.sha256.toLowerCase() : "";
  if (!tipo || !formato || !PATRON_CODIGO.test(codigo) || !/^[0-9a-f]{64}$/.test(sha)) {
    return falla(400, "Solicitud de foto inválida");
  }

  const carpeta = tipo === "producto" ? "productos" : "sets";
  const clave = `${carpeta}/${codigo}/${sha.slice(0, 16)}.${formato === "webp" ? "webp" : "jpg"}`;
  const cabeceras = {
    "content-type": `image/${formato}`,
    "cache-control": "public, max-age=31536000, immutable",
  };
  const url = await getSignedUrl(
    ctx.s3,
    new PutObjectCommand({
      Bucket: ctx.bucket,
      Key: clave,
      ContentType: cabeceras["content-type"],
      CacheControl: cabeceras["cache-control"],
    }),
    { expiresIn: 600 },
  );
  return { ok: true, valor: { url, clave, cabeceras } };
}
