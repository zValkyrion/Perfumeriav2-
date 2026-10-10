import { Resource } from "sst";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { estatusDe, type CambioEstatus } from "../../compartido/pedido";
import { catalogoVigente } from "./catalogo";
import { esCondicionFallida, folioDeRuta, leerMeta, type ContextoTienda, type Salida } from "./pedidos";
import { armarAdmin, historialDe, nombradorDe, type FilaPedido } from "./pedidos-formas";
import type { PagoClip, PedidoTienda } from "./tienda";

/**
 * El cobro con Clip: un enlace de pago por pedido, con el monto exacto, y el
 * aviso de Clip que pasa el pedido a «Pagado».
 *
 * Las claves viven en dos secretos de SST (`Elrey_clip_api`,
 * `Elrey_clip_secreto`). Vacíos, nada de esto existe: el pedido se crea igual y
 * el cobro se acuerda por WhatsApp, como antes.
 *
 * **El aviso de Clip no viene firmado.** Cualquiera puede mandar un POST a
 * `/clip/webhook` diciendo «ya se pagó». Por eso del aviso solo se lee el
 * identificador del cobro, y lo demás —si de verdad se completó, por cuánto y
 * de qué pedido es— se le pregunta a Clip con nuestras claves. Un aviso
 * inventado no mueve nada.
 */

const ESPERA_MS = 6000;
const ID_CLIP = /^[A-Za-z0-9-]{8,80}$/;

const base = () => (process.env.ELREY_CLIP_URL || "https://api.payclip.com").replace(/\/+$/, "");
const sitio = () => (process.env.ELREY_SITIO || "https://devfq5kjop78h.cloudfront.net").replace(/\/+$/, "");

function autorizacion(): string | null {
  const api = Resource.Elrey_clip_api.value.trim();
  const secreto = Resource.Elrey_clip_secreto.value.trim();
  return api && secreto ? `Basic ${Buffer.from(`${api}:${secreto}`).toString("base64")}` : null;
}

export const hayClip = () => autorizacion() !== null;

async function llamarClip(ruta: string, cuerpo?: unknown): Promise<Record<string, unknown>> {
  const auth = autorizacion();
  if (!auth) throw new Error("Clip no está configurado");
  const r = await fetch(`${base()}${ruta}`, {
    method: cuerpo === undefined ? "GET" : "POST",
    headers: { authorization: auth, accept: "application/json", "content-type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Clip respondió ${r.status}: ${texto.slice(0, 300)}`);
  return JSON.parse(texto) as Record<string, unknown>;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const centavos = (n: number) => Math.round(n * 100);

/** Pide a Clip un enlace de cobro por el total del pedido. */
async function crearEnlace(p: PedidoTienda, host: string | null): Promise<PagoClip> {
  const regreso = `${sitio()}/rastreo/?folio=${encodeURIComponent(p.folio)}`;
  const monto = p.cuenta.total;
  const r = await llamarClip("/v2/checkout", {
    amount: monto,
    currency: "MXN",
    purchase_description: `Pedido ${p.folio} · El Rey de los Perfumes`,
    redirection_url: { success: regreso, error: regreso, default: regreso },
    // Con esto Clip nos dice de qué pedido es el cobro cuando se le pregunta.
    metadata: { external_reference: p.folio },
    ...(host ? { webhook_url: `https://${host}/clip/webhook` } : {}),
  });
  const id = texto(r.payment_request_id);
  const url = texto(r.payment_request_url);
  if (!id || !url) throw new Error("Clip no devolvió el enlace de cobro");
  return {
    proveedor: "clip",
    id,
    url,
    monto,
    creadoEn: new Date().toISOString(),
    expiraEn: texto(r.expires_at),
  };
}

/**
 * Crea el enlace de un pedido «Pendiente» que se paga con Clip y lo guarda en
 * él. Devuelve el pedido como quedó, o `null` si no aplica o Clip falló: quien
 * llama decide si eso es un error (el panel) o no (la compra, que sigue).
 */
export async function generarCobro(
  ctx: ContextoTienda,
  p: PedidoTienda,
  host: string | null,
): Promise<FilaPedido | null> {
  if (!hayClip() || estatusDe(p.estatus) !== "Pendiente" || p.cuenta?.metodo !== "clip") return null;
  if (!(p.cuenta.total > 0)) return null;
  const pago = await crearEnlace(p, host);
  try {
    const r = await ctx.dynamo.send(
      new UpdateCommand({
        TableName: ctx.tabla,
        Key: { PK: `PEDIDO#${p.folio}`, SK: "META" },
        // El sello (`actualizadoEn`) no se toca: el enlace no es algo que el
        // panel edite, y moverlo le daría un 409 a quien tiene el pedido abierto.
        UpdateExpression: "SET #p.#pago = :pago",
        ConditionExpression: "#p.#est = :pendiente",
        ExpressionAttributeNames: { "#p": "pedido", "#pago": "pago", "#est": "estatus" },
        ExpressionAttributeValues: { ":pago": pago, ":pendiente": "Pendiente" },
        ReturnValues: "ALL_NEW",
      }),
    );
    return r.Attributes as FilaPedido;
  } catch (e) {
    if (esCondicionFallida(e)) return null;
    throw e;
  }
}

/** `POST /admin/pedidos/{folio}/cobro`: el equipo genera (o regenera) el enlace. */
export async function generarCobroAdmin(ctx: ContextoTienda, folio: string, host: string | null): Promise<Salida> {
  const meta = await leerMeta(ctx, folio);
  if (!meta) return { estado: 404, cuerpo: { error: `No existe el pedido ${folio}` } };
  if (!hayClip()) {
    return { estado: 503, cuerpo: { error: "Clip todavía no está configurado: faltan sus claves en el servidor." } };
  }
  const estatus = estatusDe(meta.pedido.estatus);
  if (estatus !== "Pendiente") {
    return { estado: 409, cuerpo: { error: `Solo se cobra un pedido «Pendiente»; este está «${estatus}».` } };
  }
  if (meta.pedido.cuenta?.metodo !== "clip") {
    return {
      estado: 409,
      cuerpo: { error: "Este pedido no se paga con Clip. Cambia su forma de pago a Clip y vuelve a intentarlo." },
    };
  }
  let fila: FilaPedido | null;
  try {
    fila = await generarCobro(ctx, meta.pedido, host);
  } catch (e) {
    console.error("clip: no se pudo crear el enlace de", folio, e);
    return { estado: 502, cuerpo: { error: "Clip no respondió. Vuelve a intentarlo en un momento." } };
  }
  if (!fila) return { estado: 409, cuerpo: { error: "El pedido cambió mientras se generaba el cobro. Recarga." } };
  const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
  return { estado: 200, cuerpo: armarAdmin(fila, nombradorDe(catalogo)) };
}

/* ── El aviso de Clip ─────────────────────────────────────────────────── */

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

/**
 * `POST /clip/webhook`. Siempre contesta 200 —Clip reintenta lo que no— salvo
 * que no hayamos podido preguntarle a Clip: entonces 503, para que reintente.
 */
export async function avisoClip(ctx: ContextoTienda, cuerpo: unknown): Promise<Salida> {
  const LISTO: Salida = { estado: 200, cuerpo: { ok: true } };
  const c = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>;
  const id = texto(c.payment_request_id) ?? texto(c.id);
  if (!id || !ID_CLIP.test(id) || !hayClip()) return LISTO;

  // Lo único que se cree es lo que diga Clip.
  let cobro: Record<string, unknown>;
  try {
    cobro = await llamarClip(`/v2/checkout/${encodeURIComponent(id)}`);
  } catch (e) {
    // Un id que Clip no conoce no se va a arreglar reintentando. Un 401 sí
    // (claves mal puestas): ese se deja reintentar.
    if (e instanceof Error && /respondió 40[04]/.test(e.message)) return LISTO;
    console.error("clip: no se pudo consultar el cobro", id, e);
    return { estado: 503, cuerpo: { error: "No se pudo confirmar con Clip" } };
  }
  if (!/COMPLETED$/.test(String(cobro.status ?? ""))) return LISTO;

  const referencia = (cobro.metadata as { external_reference?: unknown } | null | undefined)?.external_reference;
  const folio = typeof referencia === "string" ? folioDeRuta(referencia) : null;
  const meta = folio ? await leerMeta(ctx, folio) : null;
  if (!folio || !meta) {
    console.error("clip: pago completado sin pedido", id, referencia);
    return LISTO;
  }

  const p = meta.pedido;
  const monto = typeof cobro.amount === "number" ? cobro.amount : Number(cobro.amount);
  const estatus = estatusDe(p.estatus);
  const cuadra = Number.isFinite(monto) && centavos(monto) === centavos(p.cuenta?.total ?? -1);
  const ahora = new Date().toISOString();

  if (estatus === "Pendiente" && cuadra) {
    const cambio: CambioEstatus = { estatus: "Pagado", en: ahora, por: "Clip", nota: "Pago confirmado por Clip." };
    const pago: PagoClip = {
      ...(p.pago ?? { proveedor: "clip", url: "", creadoEn: ahora, expiraEn: null }),
      id,
      monto,
      pagadoEn: ahora,
    };
    try {
      await ctx.dynamo.send(
        new UpdateCommand({
          TableName: ctx.tabla,
          Key: { PK: `PEDIDO#${folio}`, SK: "META" },
          UpdateExpression:
            "SET #p.#est = :pagado, #p.#hist = list_append(if_not_exists(#p.#hist, :base), :cambio), #p.#act = :en, #p.#pago = :pago",
          // Si el cliente lo canceló o el panel lo movió en este instante, no se pisa.
          ConditionExpression: "#p.#est = :pendiente",
          ExpressionAttributeNames: {
            "#p": "pedido",
            "#est": "estatus",
            "#hist": "historial",
            "#act": "actualizadoEn",
            "#pago": "pago",
          },
          ExpressionAttributeValues: {
            ":pagado": "Pagado",
            ":pendiente": "Pendiente",
            ":cambio": [cambio],
            ":base": historialDe({ ...p, historial: undefined }, meta.creadoEn),
            ":en": ahora,
            ":pago": pago,
          },
        }),
      );
      console.log("pedido", folio, "de Pendiente a Pagado por Clip", id);
    } catch (e) {
      if (!esCondicionFallida(e)) throw e;
    }
    return LISTO;
  }

  // El mismo aviso otra vez (Clip repite) sobre un pedido que ya cobró este pago.
  if (p.pago?.pagadoEn && p.pago.id === id) return LISTO;
  // Se pagó, pero no se puede dar por bueno solo: otro monto (el pedido cambió
  // después de mandar el enlace) o un pedido que ya no estaba pendiente. Queda
  // escrito en el historial para que el equipo lo resuelva; una vez por pago.
  if (p.avisosClip?.includes(id)) return LISTO;
  const nota = cuadra
    ? `Clip recibió un pago de ${pesos(monto)} cuando el pedido ya estaba «${estatus}». Revisar.`
    : `Clip recibió un pago de ${pesos(monto)}, pero el total del pedido es ${pesos(p.cuenta?.total ?? 0)}. Revisar.`;
  await ctx.dynamo.send(
    new UpdateCommand({
      TableName: ctx.tabla,
      Key: { PK: `PEDIDO#${folio}`, SK: "META" },
      UpdateExpression:
        "SET #p.#hist = list_append(if_not_exists(#p.#hist, :base), :cambio), #p.#avisos = list_append(if_not_exists(#p.#avisos, :vacio), :id), #p.#act = :en",
      ExpressionAttributeNames: { "#p": "pedido", "#hist": "historial", "#avisos": "avisosClip", "#act": "actualizadoEn" },
      ExpressionAttributeValues: {
        ":cambio": [{ estatus, en: ahora, por: "Clip", nota } satisfies CambioEstatus],
        ":base": historialDe({ ...p, historial: undefined }, meta.creadoEn),
        ":vacio": [],
        ":id": [id],
        ":en": ahora,
      },
    }),
  );
  console.error("clip: pago que no cuadra", folio, id, monto, estatus);
  return LISTO;
}
