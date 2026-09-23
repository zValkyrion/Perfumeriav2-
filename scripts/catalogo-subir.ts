/**
 * Carga el catálogo a AWS: `catalogo/*.csv` + fotos → DynamoDB + S3.
 *
 *   npm run catalogo:subir                  carga de verdad
 *   npm run catalogo:subir -- --simular     dice qué haría, sin escribir nada
 *   npm run catalogo:subir -- --si-existe   si la tabla aún no existe, sale sin error
 *
 * Necesita los nombres reales de la tabla y del bucket, que pone `sst shell`:
 *
 *   cd radar && npx sst shell --stage produccion -- npm --prefix .. run catalogo:subir
 *
 * Es idempotente: sube solo las fotos que faltan, reescribe solo las filas que
 * cambiaron y borra las que ya no están en el CSV. Correrla dos veces seguidas
 * no hace nada la segunda. El orden importa: **primero las fotos y después la
 * tabla**, para que ningún producto publicado apunte a una imagen que todavía
 * no existe.
 *
 * En la CI escribe `cambios=true|false` en `$GITHUB_OUTPUT`.
 */
import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { Catalogo } from "../compartido/catalogo";
import {
  META,
  PARTICIONES,
  catalogoDeFilas,
  filasDe,
  type FilaCatalogo,
} from "../compartido/catalogo-tabla";
import { datosDeFoto, leerCatalogo, sinFecha } from "./catalogo/leer";

const simular = process.argv.includes("--simular");
const siExiste = process.argv.includes("--si-existe");

/** Lo que `sst shell` expone de un recurso enlazado. */
function recurso(nombre: string): { name: string } | undefined {
  const bruto = process.env[`SST_RESOURCE_${nombre}`];
  if (!bruto) return undefined;
  try {
    return JSON.parse(bruto) as { name: string };
  } catch {
    return undefined;
  }
}

const huella = (valor: unknown) =>
  createHash("sha1").update(JSON.stringify(valor)).digest("hex");

async function leerTabla(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
): Promise<{ filas: FilaCatalogo[]; generado: string }> {
  const filas: FilaCatalogo[] = [];
  for (const pk of PARTICIONES) {
    let desde: Record<string, unknown> | undefined;
    do {
      const r = await dynamo.send(
        new QueryCommand({
          TableName: tabla,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": pk },
          ExclusiveStartKey: desde,
        }),
      );
      for (const item of r.Items ?? []) filas.push(item as FilaCatalogo);
      desde = r.LastEvaluatedKey;
    } while (desde);
  }
  const meta = await dynamo.send(
    new QueryCommand({
      TableName: tabla,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: { ":pk": META.PK, ":sk": META.SK },
    }),
  );
  return { filas, generado: String(meta.Items?.[0]?.generado ?? "") };
}

/** BatchWrite de 25 en 25, reintentando lo que DynamoDB devuelva sin procesar. */
async function escribirLotes(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  peticiones: Record<string, unknown>[],
) {
  for (let i = 0; i < peticiones.length; i += 25) {
    let pendientes: Record<string, unknown>[] = peticiones.slice(i, i + 25);
    for (let intento = 0; pendientes.length > 0; intento++) {
      if (intento > 0) await new Promise((r) => setTimeout(r, 200 * 2 ** intento));
      if (intento > 6) throw new Error("DynamoDB no aceptó el lote después de varios intentos");
      const r = await dynamo.send(
        new BatchWriteCommand({ RequestItems: { [tabla]: pendientes as never } }),
      );
      pendientes = (r.UnprocessedItems?.[tabla] ?? []) as Record<string, unknown>[];
    }
  }
}

async function main() {
  const tabla = recurso("Elrey_catalogo")?.name;
  const bucket = recurso("Elrey_imagenes")?.name;
  if (!tabla || !bucket) {
    const motivo =
      "No encuentro la tabla ni el bucket del catálogo. Corre esto dentro de `sst shell`:\n" +
      "  cd radar && npx sst shell --stage produccion -- npm --prefix .. run catalogo:subir";
    if (siExiste) {
      console.log(`· Todavía no hay catálogo en AWS (primer despliegue): no se carga nada.`);
      return;
    }
    throw new Error(motivo);
  }

  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  // Con un S3 de pruebas (`AWS_ENDPOINT_URL_S3`) el bucket va en la ruta y no
  // en el subdominio, que un servidor local no puede resolver.
  const s3 = new S3Client({ forcePathStyle: Boolean(process.env.AWS_ENDPOINT_URL_S3) });

  /* 1. Lo que hay ahora, para no rehacer fotos ni reescribir filas iguales. */
  const actual = await leerTabla(dynamo, tabla);
  const previo: Catalogo = catalogoDeFilas(actual.filas, actual.generado);

  /* 2. Lo que dice el CSV. */
  const { catalogo, fotos, problemas, avisos } = await leerCatalogo({
    carpeta: join(process.cwd(), "catalogo"),
    previo,
  });
  for (const a of avisos) console.log(`· ${a}`);
  if (problemas.length > 0) {
    console.error(`\n✗ ${problemas.length} problema(s) en el CSV. No se cargó nada.\n`);
    for (const p of problemas.slice(0, 40)) {
      console.error(`  ${p.archivo} fila ${p.fila} · ${p.columna}: ${p.mensaje}`);
    }
    process.exit(1);
  }

  /* 3. Fotos: solo las que no están ya publicadas. */
  const publicadas = new Set(
    [...previo.productos, ...previo.sets].flatMap((x) => (x.imagenes ?? []).map((i) => i.clave)),
  );
  let subidas = 0;
  for (const f of fotos) {
    if (publicadas.has(f.clave)) continue;
    const existe = await s3
      .send(new HeadObjectCommand({ Bucket: bucket, Key: f.clave }))
      .then(() => true)
      .catch(() => false);
    if (existe) continue;
    subidas++;
    if (simular) continue;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: f.clave,
        Body: await datosDeFoto(f),
        ContentType: "image/webp",
        // La clave lleva la huella del contenido: un archivo nunca cambia, así
        // que se puede guardar un año en CloudFront y en el navegador.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  /* 4. Tabla: poner lo que cambió, borrar lo que ya no está. */
  const existentes = new Map(actual.filas.map((f) => [`${f.PK}#${f.SK}`, f]));
  const deseadas = filasDe(catalogo).map((f) => ({ ...f, huella: huella(f.datos) }));
  const claves = new Set(deseadas.map((f) => `${f.PK}#${f.SK}`));

  const poner = deseadas.filter((f) => existentes.get(`${f.PK}#${f.SK}`)?.huella !== f.huella);
  const borrar = actual.filas.filter((f) => !claves.has(`${f.PK}#${f.SK}`));

  const cambios = poner.length + borrar.length > 0;
  if (!simular && cambios) {
    await escribirLotes(dynamo, tabla, [
      ...poner.map((f) => ({ PutRequest: { Item: f } })),
      ...borrar.map((f) => ({ DeleteRequest: { Key: { PK: f.PK, SK: f.SK } } })),
    ]);
    await dynamo.send(
      new PutCommand({
        TableName: tabla,
        Item: {
          ...META,
          generado: catalogo.generado,
          huella: huella(sinFecha(catalogo)),
          productos: catalogo.productos.length,
          sets: catalogo.sets.length,
          lotes: catalogo.lotes.length,
          marcas: catalogo.marcas.length,
        },
      }),
    );
  }

  const verbo = simular ? "se subirían" : "subidas";
  console.log(
    `${simular ? "SIMULACIÓN · " : "✓ "}${subidas} foto(s) ${verbo}; ` +
      `${poner.length} fila(s) ${simular ? "por escribir" : "escritas"}, ` +
      `${borrar.length} ${simular ? "por borrar" : "borradas"} ` +
      `(${catalogo.productos.length} productos, ${catalogo.sets.length} sets, ` +
      `${catalogo.lotes.length} lotes, ${catalogo.marcas.length} marcas)`,
  );

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `cambios=${cambios && !simular}\n`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
