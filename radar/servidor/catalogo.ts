import { QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Catalogo } from "../../compartido/catalogo";
import { META, PARTICIONES, catalogoDeFilas } from "../../compartido/catalogo-tabla";
import semilla from "../../src/data/catalogo.json";

/**
 * El catálogo vigente, leído de `Elrey_catalogo`.
 *
 * Se guarda en memoria un minuto. Son unas cuantas consultas por lectura, y
 * entre dos pedidos seguidos el catálogo no cambia: sin la caché, cada pedido
 * pagaría cuatro consultas por nada. Un minuto es también lo que tarda como
 * mucho un cambio del panel en llegar a lo que se cobra: la instancia que
 * guardó el cambio olvida su copia en el acto (`olvidarCatalogo`), las demás
 * al vencer la suya.
 *
 * **Si la tabla está vacía** —el primer despliegue, antes de que corra
 * `catalogo:subir`— se cobra con la copia versionada del repositorio, la misma
 * con la que se compiló la tienda. Así el checkout no se cae en esa ventana.
 * Un error de DynamoDB, en cambio, no cae a la copia: cobrar con precios
 * posiblemente viejos es peor que rechazar el pedido, que el navegador todavía
 * puede cerrar por WhatsApp.
 */
const VIDA_MS = 60_000;
let enMemoria: { catalogo: Catalogo; hasta: number } | null = null;

export function olvidarCatalogo() {
  enMemoria = null;
}

export async function catalogoVigente(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
): Promise<Catalogo> {
  if (enMemoria && enMemoria.hasta > Date.now()) return enMemoria.catalogo;

  const filas: { PK: string; SK: string; datos: unknown; borrado?: boolean }[] = [];
  for (const pk of PARTICIONES) {
    let desde: Record<string, unknown> | undefined;
    do {
      const r = await dynamo.send(
        new QueryCommand({
          TableName: tabla,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": pk },
          // Sin `fuente` (la copia de lo que dijo el CSV, que solo le sirve a
          // la carga): sería leer el doble de bytes para nada.
          ProjectionExpression: "PK, SK, #d, borrado",
          ExpressionAttributeNames: { "#d": "datos" },
          ExclusiveStartKey: desde,
        }),
      );
      for (const item of r.Items ?? []) {
        filas.push(item as { PK: string; SK: string; datos: unknown; borrado?: boolean });
      }
      desde = r.LastEvaluatedKey;
    } while (desde);
  }

  let catalogo: Catalogo;
  if (filas.some((f) => f.PK === "PRODUCTO" && !f.borrado)) {
    const meta = await dynamo.send(
      new QueryCommand({
        TableName: tabla,
        KeyConditionExpression: "PK = :pk AND SK = :sk",
        ExpressionAttributeValues: { ":pk": META.PK, ":sk": META.SK },
      }),
    );
    catalogo = catalogoDeFilas(filas, String(meta.Items?.[0]?.generado ?? ""));
  } else {
    catalogo = semilla as unknown as Catalogo;
  }

  enMemoria = { catalogo, hasta: Date.now() + VIDA_MS };
  return catalogo;
}
