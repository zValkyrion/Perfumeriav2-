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
 * **La tabla manda; el CSV propone.** Desde que existe el panel, la tabla
 * tiene cambios que el CSV no conoce. La carga no reemplaza filas: aplica solo
 * los campos que cambiaron **en el CSV** desde la carga anterior
 * (`planDeCarga`). Un perfume marcado agotado en el panel sigue agotado aunque
 * el Excel le suba el precio. Si los dos cambiaron el mismo campo gana el CSV
 * y se avisa.
 *
 * Es idempotente: correrla dos veces seguidas no hace nada la segunda. Primero
 * suben las fotos y después se escribe la tabla, para que ningún producto
 * apunte a una imagen que todavía no existe.
 *
 * En la CI escribe `cambios=true|false` en `$GITHUB_OUTPUT`.
 */
import { appendFile } from "node:fs/promises";
import { join } from "node:path";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import {
  META,
  PARTICIONES,
  catalogoDeFilas,
  filasDe,
  filasTrasPlan,
  iguales,
  planDeCarga,
  type Escritura,
  type FilaGuardada,
} from "../compartido/catalogo-tabla";
import { huellaDe } from "../compartido/huella";
import { incoherencias } from "../compartido/validar-catalogo";
import { datosDeFoto, leerCatalogo } from "./catalogo/leer";

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

async function leerTabla(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
): Promise<{ filas: FilaGuardada[]; generado: string }> {
  const filas: FilaGuardada[] = [];
  for (const pk of PARTICIONES) {
    let desde: Record<string, unknown> | undefined;
    do {
      const r = await dynamo.send(
        new QueryCommand({
          TableName: tabla,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": pk },
          ExclusiveStartKey: desde,
          ConsistentRead: true,
        }),
      );
      for (const item of r.Items ?? []) filas.push(item as FilaGuardada);
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

/** De diez en diez: rápido sin pasarse de la capacidad de la tabla. */
async function enTandas<T>(lista: readonly T[], fn: (x: T) => Promise<void>) {
  for (let i = 0; i < lista.length; i += 10) {
    await Promise.all(lista.slice(i, i + 10).map(fn));
  }
}

const esCondicionFallida = (e: unknown) =>
  e instanceof Error && e.name === "ConditionalCheckFailedException";

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

  /* 1. Lo que hay ahora: para fusionar y para no rehacer fotos. */
  const actual = await leerTabla(dynamo, tabla);
  const previo = catalogoDeFilas(actual.filas, actual.generado);

  /* 2. Lo que dice el CSV. */
  const { catalogo, fotos, problemas, avisos, informativos, clavesPorComprobar } =
    await leerCatalogo({ carpeta: join(process.cwd(), "catalogo"), previo });
  for (const a of [...avisos, ...informativos]) console.log(`· ${a}`);

  // Una clave de la columna `foto` que la tabla no conoce tiene que estar ya
  // en el bucket: un producto no puede publicarse apuntando a una foto que no
  // existe.
  for (const clave of clavesPorComprobar) {
    const existe = await s3
      .send(new HeadObjectCommand({ Bucket: bucket, Key: clave }))
      .then(() => true)
      .catch(() => false);
    if (!existe) {
      problemas.push({ archivo: "-", fila: 0, columna: "foto", mensaje: `«${clave}» no está en el bucket` });
    }
  }
  if (problemas.length > 0) {
    console.error(`\n✗ ${problemas.length} problema(s) en el CSV. No se cargó nada.\n`);
    for (const p of problemas.slice(0, 40)) {
      console.error(`  ${p.archivo} fila ${p.fila} · ${p.columna}: ${p.mensaje}`);
    }
    process.exit(1);
  }

  /* 3. El plan, y cómo quedaría el catálogo con él. */
  const plan = planDeCarga(actual.filas, filasDe(catalogo));
  // El CSV se revisó contra sí mismo; aquí se revisa mezclado con lo del
  // panel. Solo detiene lo que esta carga rompería: lo que ya estaba mal se
  // arregla aparte y no debe bloquear cada despliegue.
  const yaEstaban = new Set(incoherencias(previo));
  const rotas = incoherencias(catalogoDeFilas(filasTrasPlan(actual.filas, plan), "")).filter(
    (r) => !yaEstaban.has(r),
  );
  if (rotas.length > 0) {
    console.error(`\n✗ Con lo que hay en el panel, esta carga dejaría el catálogo incoherente. No se cargó nada.\n`);
    for (const r of rotas.slice(0, 40)) console.error(`  ${r}`);
    process.exit(1);
  }

  /* 4. Fotos: solo las que no están ya publicadas. */
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

  /* 5. Tabla: fusionar lo que el CSV cambió, borrar lo que quitó. */
  const cambiaDatos = (e: Escritura) => !e.previa || !iguales(e.datos, e.previa.datos);
  const conCambios = plan.escribir.filter(cambiaDatos);
  const ahora = new Date().toISOString();
  const saltadas: string[] = [];

  if (!simular) {
    await enTandas(plan.escribir, async (e) => {
      const previa = e.previa;
      try {
        await dynamo.send(
          new PutCommand({
            TableName: tabla,
            Item: {
              PK: e.PK,
              SK: e.SK,
              datos: e.datos,
              huella: huellaDe(e.datos),
              fuente: e.fuente,
              cargadoEn: ahora,
              ...(previa?.editadoEn
                ? { editadoEn: previa.editadoEn, editadoPor: previa.editadoPor }
                : {}),
              ...(previa?.borrado ? { borrado: true } : {}),
            },
            // Solo si nadie tocó la fila desde que se leyó: el panel puede
            // estar guardando en este mismo momento.
            ConditionExpression: !previa
              ? "attribute_not_exists(PK)"
              : previa.huella
                ? "huella = :h"
                : "attribute_not_exists(huella)",
            ExpressionAttributeValues: previa?.huella ? { ":h": previa.huella } : undefined,
          }),
        );
      } catch (err) {
        // La fusión se rehace en la próxima carga con lo que haya entonces.
        if (esCondicionFallida(err)) saltadas.push(`${e.PK}#${e.SK}`);
        else throw err;
      }
    });

    await enTandas(plan.borrar, async (f) => {
      await dynamo.send(new DeleteCommand({ TableName: tabla, Key: { PK: f.PK, SK: f.SK } }));
    });
  }

  // `generado` es «cuándo cambió lo que se publica»: solo se mueve si cambió
  // algún dato. Anotar la `fuente` de las filas viejas no cambia la tienda.
  const cambios = conCambios.length + plan.borrar.length > 0;
  if (!simular && cambios) {
    await dynamo.send(
      new UpdateCommand({
        TableName: tabla,
        Key: META,
        UpdateExpression: "SET generado = :g, cargadoEn = :g",
        ExpressionAttributeValues: { ":g": ahora },
      }),
    );
  }

  const s = simular;
  console.log(
    `${s ? "SIMULACIÓN · " : "✓ "}${subidas} foto(s) ${s ? "se subirían" : "subidas"}; ` +
      `${conCambios.length} fila(s) con cambios ${s ? "por escribir" : "escritas"}, ` +
      `${plan.borrar.length} ${s ? "por borrar" : "borradas"}` +
      (plan.escribir.length > conCambios.length
        ? `; ${plan.escribir.length - conCambios.length} anotada(s) con su origen en el CSV`
        : "") +
      ` (${catalogo.productos.length} productos, ${catalogo.sets.length} sets, ` +
      `${catalogo.lotes.length} lotes, ${catalogo.marcas.length} marcas en el CSV)`,
  );
  if (plan.respetadas.length > 0) {
    console.log(`· ${plan.respetadas.length} fila(s) conservan cambios hechos en el panel.`);
  }
  for (const c of plan.conflictos.slice(0, 30)) {
    console.log(`! ${c.clave}: el CSV y el panel cambiaron ${c.campos.join(", ")}. Quedó lo del CSV.`);
  }
  for (const clave of plan.borradasEnPanel) {
    console.log(`! ${clave} se borró en el panel pero sigue en el CSV: quítalo del CSV o restáuralo.`);
  }
  for (const clave of saltadas) {
    console.log(`! ${clave} cambió mientras se cargaba: se fusiona en la próxima carga.`);
  }

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `cambios=${cambios && !simular}\n`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
