/**
 * Anota en `Elrey_catalogo` qué catálogo quedó publicado.
 *
 *   cd radar && npx sst shell --stage produccion -- npm --prefix .. run catalogo:publicado
 *
 * Corre en la CI después de desplegar. El build de la tienda dejó en
 * `src/data/catalogo.json` el catálogo que compiló —el de `GET /catalogo`—, y
 * su `generado` es lo que se anota. El panel compara esa fecha con la del
 * último cambio para saber si hay algo sin publicar, y la publicación
 * automática para saber si tiene que volver a compilar.
 *
 * Si el build no pudo leer la API y compiló con la copia del repositorio, la
 * fecha que se anota es vieja y el panel dirá que hay cambios pendientes: que
 * es la verdad.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { META } from "../compartido/catalogo-tabla";

async function main() {
  const bruto = process.env.SST_RESOURCE_Elrey_catalogo;
  const tabla = bruto ? (JSON.parse(bruto) as { name: string }).name : "";
  if (!tabla) throw new Error("Corre esto dentro de `sst shell`: falta la tabla del catálogo.");

  const { generado } = JSON.parse(
    await readFile(join(process.cwd(), "src", "data", "catalogo.json"), "utf8"),
  ) as { generado?: string };
  if (!generado) throw new Error("src/data/catalogo.json no dice cuándo se generó.");

  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  await dynamo.send(
    new UpdateCommand({
      TableName: tabla,
      Key: META,
      UpdateExpression: "SET publicado = :g, publicadoEn = :ahora",
      ExpressionAttributeValues: { ":g": generado, ":ahora": new Date().toISOString() },
    }),
  );
  console.log(`✓ Publicado el catálogo del ${generado}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
