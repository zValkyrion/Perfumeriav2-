import { Resource } from "sst";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { porQueNoPublicar } from "../../compartido/publicacion";
import {
  hayPublicacionAutomatica,
  leerMeta,
  pedirPublicacion,
  ultimaCorrida,
} from "./publicacion";

/**
 * Publicación automática: cada diez minutos mira si hay cambios del panel sin
 * publicar y, si los hay y ya nadie está editando, pide el despliegue. Las
 * reglas viven en `compartido/publicacion.ts`, donde se prueban.
 */
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler() {
  const token = Resource.Elrey_github_token.value;
  const tabla = Resource.Elrey_catalogo.name;
  if (!hayPublicacionAutomatica(token)) return { omitida: "sin token de GitHub" };

  const meta = await leerMeta(dynamo, tabla);
  // Primero lo que no cuesta nada; a GitHub solo se le pregunta si hace falta.
  const antes = porQueNoPublicar(meta, Date.now());
  if (antes) return { omitida: antes };
  const despues = porQueNoPublicar(meta, Date.now(), await ultimaCorrida(token));
  if (despues) return { omitida: despues };

  await pedirPublicacion(dynamo, tabla, token, "automática");
  console.log(`Publicación pedida: cambios del ${meta.generado}, publicado ${meta.publicado ?? "nunca"}`);
  return { pedida: true };
}
