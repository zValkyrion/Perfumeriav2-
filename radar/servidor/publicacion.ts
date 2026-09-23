import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { CorridaPublicacion, EstadoPublicacion } from "../../compartido/catalogo-admin";
import { META } from "../../compartido/catalogo-tabla";
import { hayPendiente, type MetaCatalogo } from "../../compartido/publicacion";

/**
 * Publicar: volver a compilar la tienda con lo que hay en la tabla.
 *
 * La tienda es estática. Lo que se vende y a cuánto llega solo en un minuto
 * (`GET /disponibilidad`), pero un perfume nuevo, un texto o una foto
 * necesitan que se vuelva a compilar. Eso lo hace el mismo workflow que
 * despliega en cada push (`aws.yml`): aquí solo se le pide a GitHub que corra.
 *
 * Hace falta un token de GitHub con permiso de **Actions: escritura** sobre el
 * repositorio y nada más, guardado como secreto de SST
 * (`Elrey_github_token`). Sin él, el panel sigue editando y lo publica el
 * siguiente push.
 */

const REPOSITORIO = process.env.ELREY_REPOSITORIO ?? "";
const FLUJO = "aws.yml";
const RAMA = "main";

export async function leerMeta(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
): Promise<MetaCatalogo> {
  const r = await dynamo.send(new GetCommand({ TableName: tabla, Key: META, ConsistentRead: true }));
  return (r.Item ?? {}) as MetaCatalogo;
}

export const hayPublicacionAutomatica = (token: string) =>
  token.trim() !== "" && REPOSITORIO !== "";

async function github(token: string, ruta: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(`https://api.github.com/repos/${REPOSITORIO}${ruta}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": "elrey-radar",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
    });
  } finally {
    clearTimeout(corte);
  }
}

export async function ultimaCorrida(token: string): Promise<CorridaPublicacion | null> {
  const r = await github(token, `/actions/workflows/${FLUJO}/runs?branch=${RAMA}&per_page=1`);
  if (!r.ok) throw new Error(`GitHub respondió ${r.status} al consultar el despliegue`);
  const cuerpo = (await r.json()) as {
    workflow_runs?: {
      status: string;
      conclusion: string | null;
      run_started_at?: string;
      created_at: string;
      html_url: string;
    }[];
  };
  const w = cuerpo.workflow_runs?.[0];
  if (!w) return null;
  const terminada = w.status === "completed";
  return {
    estado: terminada ? "terminada" : w.status === "in_progress" ? "en_curso" : "en_cola",
    resultado: !terminada
      ? null
      : w.conclusion === "success"
        ? "exito"
        : w.conclusion === "cancelled"
          ? "cancelada"
          : "fallo",
    iniciada: w.run_started_at ?? w.created_at,
    url: w.html_url,
  };
}

export async function pedirPublicacion(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  token: string,
  quien: string,
): Promise<void> {
  const r = await github(token, `/actions/workflows/${FLUJO}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: RAMA }),
  });
  if (r.status !== 204) {
    // 401/403/404 son casi siempre el token: vencido o sin permiso de Actions.
    throw new Error(
      r.status === 401 || r.status === 403 || r.status === 404
        ? "GitHub rechazó el token de publicación: puede haber vencido o no tener permiso de Actions"
        : `GitHub respondió ${r.status} al pedir la publicación`,
    );
  }
  await dynamo.send(
    new UpdateCommand({
      TableName: tabla,
      Key: META,
      UpdateExpression: "SET pedidaEn = :a, pedidaPor = :q",
      ExpressionAttributeValues: { ":a": new Date().toISOString(), ":q": quien },
    }),
  );
}

export async function estadoPublicacion(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  token: string,
): Promise<EstadoPublicacion> {
  const meta = await leerMeta(dynamo, tabla);
  const automatica = hayPublicacionAutomatica(token);
  // GitHub caído no debe dejar el panel sin cargar: la corrida es un extra.
  const corrida = automatica ? await ultimaCorrida(token).catch(() => null) : null;
  return {
    cambiado: meta.generado ?? null,
    publicado: meta.publicado ?? null,
    publicadoEn: meta.publicadoEn ?? null,
    pendiente: hayPendiente(meta),
    pedidaEn: meta.pedidaEn ?? null,
    pedidaPor: meta.pedidaPor ?? null,
    automatica,
    corrida,
  };
}
