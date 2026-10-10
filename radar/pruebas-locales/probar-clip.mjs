// Pruebas sin AWS ni Clip del cobro con Clip: el enlace que se crea con cada
// pedido, el aviso de pago (que no viene firmado y por eso no se le cree nada)
// y la ruta del panel para regenerarlo. La Lambda empaquetada contra DynamoDB
// y un Clip falsos.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { ajustesClip, arrancar, cerrar, cobrosClip, entorno, sembrarCatalogo, tablas } from "./servicios-falsos.mjs";
import { token } from "./datos-prueba.mjs";

const RAIZ = join(import.meta.dirname, "..", "..");
const catalogo = JSON.parse(readFileSync(join(RAIZ, "src", "data", "catalogo.json"), "utf8"));

let fallos = 0;
let pasan = 0;
const ok = (n, c, d = "") => {
  console.log(`${c ? "PASA " : "FALLA"}  ${n}${d !== "" ? ` — ${d}` : ""}`);
  if (c) pasan++;
  else fallos++;
};

await arrancar();
Object.assign(process.env, entorno);
sembrarCatalogo(catalogo);
const T = new Map();
tablas.set("Elrey_proveedores", T);
const meta = (folio) => T.get(`PEDIDO#${folio}#META`)?.pedido;

const { handler } = await import("./.generado/api.mjs");

const ADMIN = token({ sub: "admin-1", email: "admin@prueba.local", email_verified: true, name: "Admin Prueba", "cognito:groups": ["admins"] });
const CLIENTE = token({ sub: "cliente-a", email: "ana@prueba.local", email_verified: true, name: "Ana", "cognito:groups": ["clientes"] });
const HOST = "api.prueba.local";

async function pedir(metodo, ruta, { cuerpo, tok } = {}) {
  const r = await handler({
    requestContext: { http: { method: metodo, path: ruta }, domainName: HOST },
    headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), "accept-encoding": "gzip" },
    queryStringParameters: null,
    body: cuerpo === undefined ? null : JSON.stringify(cuerpo),
  });
  const texto = r.isBase64Encoded ? gunzipSync(Buffer.from(r.body, "base64")).toString("utf8") : r.body;
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* no era JSON */
  }
  return { estado: r.statusCode, json };
}

const vendibles = catalogo.productos.filter((p) => p.visible && !p.agotado);
const ml = (p) => (p.presentaciones.find((v) => v.ml === 100) ?? p.presentaciones[0]).ml;
const ITEMS = [{ productoId: vendibles[0].codigo, ml: ml(vendibles[0]), cantidad: 2 }];
const ITEMS2 = [{ productoId: vendibles[1].codigo, ml: ml(vendibles[1]), cantidad: 5 }];
const CONTACTO = {
  nombre: "Laura Compradora",
  telefono: "55 4444 3333",
  correo: "",
  calle: "Juárez 10",
  colonia: "Centro",
  cp: "72000",
  ciudad: "Puebla",
  estado: "Puebla",
  referencias: "",
};
const comprar = (metodo, extra = {}) =>
  pedir("POST", "/pedidos", { cuerpo: { items: ITEMS, metodo, envio: "estandar", cupon: null, contacto: CONTACTO, ...extra } });
const pagarEnClip = (id) => (cobrosClip.get(id).status = "CHECKOUT_COMPLETED");
const avisar = (id, extra = {}) =>
  pedir("POST", "/clip/webhook", { cuerpo: { payment_request_id: id, resource: "CHECKOUT", resource_status: "COMPLETED", ...extra } });

/* ── El enlace nace con el pedido ─────────────────────────────────────────── */

let r = await comprar("clip", { clave: "clip-clave-0001" });
const folio = r.json?.folio;
const cobro = [...cobrosClip.values()].at(-1);
ok("comprar con Clip: 201 con el enlace de cobro", r.estado === 201 && r.json.urlPago === cobro?.payment_request_url, `${r.estado} ${r.json?.urlPago}`);
ok("…por el total del servidor, en MXN y con el folio de referencia", cobro?.amount === r.json.total && cobro.currency === "MXN" && cobro.metadata?.external_reference === folio, `${cobro?.amount} vs ${r.json?.total}`);
ok("…con el aviso apuntando a esta API y el regreso al rastreo", cobro?.webhook_url === `https://${HOST}/clip/webhook` && cobro.redirection_url.success === `https://tienda.prueba/rastreo/?folio=${folio}`, `${cobro?.webhook_url} ${cobro?.redirection_url?.success}`);
ok("…guardado en el pedido", meta(folio)?.pago?.id === cobro?.payment_request_id && meta(folio).pago.monto === r.json.total);

const antes = cobrosClip.size;
r = await comprar("clip", { clave: "clip-clave-0001" });
ok("reintento con la misma clave: mismo folio, mismo enlace, sin pedir otro a Clip", r.estado === 200 && r.json.folio === folio && r.json.urlPago === cobro.payment_request_url && cobrosClip.size === antes);

r = await comprar("transferencia");
ok("por transferencia no se crea enlace", r.estado === 201 && !r.json.urlPago && cobrosClip.size === antes && !meta(r.json.folio).pago);

ajustesClip.caido = true;
r = await comprar("clip");
ajustesClip.caido = false;
const folioSinCobro = r.json?.folio;
ok("con Clip caído el pedido se crea igual, sin enlace", r.estado === 201 && /^REY-/.test(folioSinCobro ?? "") && !r.json.urlPago && meta(folioSinCobro)?.estatus === "Pendiente");

/* ── Quién ve el enlace ───────────────────────────────────────────────────── */

r = await pedir("POST", "/pedidos/consulta", { cuerpo: { folio, telefono: CONTACTO.telefono } });
ok("el rastreo sin cuenta trae el enlace para pagar", r.estado === 200 && r.json.cobro?.url === cobro.payment_request_url && r.json.cobro.monto === cobro.amount);
r = await pedir("GET", `/admin/pedidos/${folio}`, { tok: ADMIN });
ok("el panel también", r.json?.cobro?.url === cobro.payment_request_url);
let visto = r.json;

/* ── Avisos falsos ────────────────────────────────────────────────────────── */

r = await avisar(cobro.payment_request_id);
ok("aviso de «pagado» sin que Clip lo confirme: 200 y el pedido sigue pendiente", r.estado === 200 && meta(folio).estatus === "Pendiente");
r = await avisar("id-inventado-123456");
ok("aviso con un id que Clip no conoce: 200 y nada cambia", r.estado === 200 && meta(folio).estatus === "Pendiente");
const raros = await Promise.all([
  pedir("POST", "/clip/webhook", { cuerpo: {} }),
  pedir("POST", "/clip/webhook", {}),
  pedir("POST", "/clip/webhook", { cuerpo: { payment_request_id: "../../admin" } }),
  pedir("POST", "/clip/webhook", { cuerpo: { payment_request_id: 42 } }),
]);
ok("avisos vacíos o con basura: 200 sin tocar nada", raros.every((x) => x.estado === 200) && meta(folio).estatus === "Pendiente", raros.map((x) => x.estado).join("/"));

ajustesClip.caido = true;
r = await avisar(cobro.payment_request_id);
ajustesClip.caido = false;
ok("si no se puede preguntar a Clip: 503 para que reintente", r.estado === 503 && meta(folio).estatus === "Pendiente");

/* ── El pago de verdad ────────────────────────────────────────────────────── */

pagarEnClip(cobro.payment_request_id);
r = await avisar(cobro.payment_request_id);
ok("pago confirmado por Clip: el pedido pasa a «Pagado»", r.estado === 200 && meta(folio).estatus === "Pagado", meta(folio).estatus);
ok("…firmado por Clip en el historial y con la hora del pago", meta(folio).historial.at(-1).por === "Clip" && meta(folio).historial.at(-1).estatus === "Pagado" && Boolean(meta(folio).pago.pagadoEn));
ok("…y el sello cambia, para que el panel recargue", meta(folio).actualizadoEn !== visto.actualizadoEn);
const largo = meta(folio).historial.length;
r = await avisar(cobro.payment_request_id);
ok("el mismo aviso otra vez no repite nada", r.estado === 200 && meta(folio).historial.length === largo && meta(folio).estatus === "Pagado");
r = await pedir("POST", "/pedidos/consulta", { cuerpo: { folio, telefono: CONTACTO.telefono } });
ok("el cliente lo ve pagado, sin enlace y sin el nombre de quién lo movió", r.json?.estatus === "Pagado" && !r.json.cobro && r.json.historial.at(-1).por === "tienda" && !r.json.historial.at(-1).nota);

/* ── El total cambió después de mandar el enlace ──────────────────────────── */

r = await comprar("clip");
const folioB = r.json.folio;
const cobroB = cobrosClip.get(meta(folioB).pago.id);
visto = (await pedir("GET", `/admin/pedidos/${folioB}`, { tok: ADMIN })).json;
r = await pedir("PUT", `/admin/pedidos/${folioB}`, {
  tok: ADMIN,
  cuerpo: { articulos: { items: ITEMS2, metodo: "clip", envio: "estandar", cupon: null }, actualizadoEn: visto.actualizadoEn },
});
ok("al cambiar los artículos el enlace viejo deja de enseñarse", r.estado === 200 && r.json.cifras.total !== cobroB.amount && r.json.cobro === null, `${r.json?.cifras?.total} vs ${cobroB.amount}`);
pagarEnClip(cobroB.payment_request_id);
r = await avisar(cobroB.payment_request_id);
ok("si aun así pagan el enlace viejo: no se marca pagado", r.estado === 200 && meta(folioB).estatus === "Pendiente");
ok("…y queda una nota en el historial para el equipo", /Clip recibió un pago/.test(meta(folioB).historial.at(-1).nota ?? ""), meta(folioB).historial.at(-1).nota);
const largoB = meta(folioB).historial.length;
await avisar(cobroB.payment_request_id);
ok("…una sola vez por pago", meta(folioB).historial.length === largoB);

/* ── El panel genera el enlace ────────────────────────────────────────────── */

r = await pedir("POST", `/admin/pedidos/${folioB}/cobro`, {});
const sinToken = r.estado;
r = await pedir("POST", `/admin/pedidos/${folioB}/cobro`, { tok: CLIENTE });
ok("generar cobro: 401 sin token y 403 a un cliente", sinToken === 401 && r.estado === 403, `${sinToken}/${r.estado}`);
r = await pedir("POST", `/admin/pedidos/${folioB}/cobro`, { tok: ADMIN });
const cobroB2 = cobrosClip.get(meta(folioB).pago.id);
ok("regenerar: enlace nuevo por el total de ahora", r.estado === 200 && r.json.cobro?.url === cobroB2.payment_request_url && cobroB2.amount === r.json.cifras.total && cobroB2.payment_request_id !== cobroB.payment_request_id);
pagarEnClip(cobroB2.payment_request_id);
r = await avisar(cobroB2.payment_request_id);
ok("…y al pagarlo, el pedido sí pasa a «Pagado»", meta(folioB).estatus === "Pagado");

r = await pedir("POST", `/admin/pedidos/${folioSinCobro}/cobro`, { tok: ADMIN });
ok("el pedido que se quedó sin enlace lo recibe desde el panel", r.estado === 200 && Boolean(r.json.cobro?.url));
r = await pedir("POST", `/admin/pedidos/${folio}/cobro`, { tok: ADMIN });
ok("un pedido ya pagado no se vuelve a cobrar (409)", r.estado === 409);
r = await comprar("transferencia");
r = await pedir("POST", `/admin/pedidos/${r.json.folio}/cobro`, { tok: ADMIN });
ok("uno por transferencia tampoco (409)", r.estado === 409, r.json?.error);
r = await pedir("POST", "/admin/pedidos/REY-2026-99999/cobro", { tok: ADMIN });
ok("folio que no existe: 404", r.estado === 404);

/* ── Pago que llega tarde ─────────────────────────────────────────────────── */

r = await pedir("POST", "/pedidos", { tok: CLIENTE, cuerpo: { items: ITEMS, metodo: "clip", envio: "estandar", contacto: CONTACTO } });
const folioC = r.json.folio;
const cobroC = cobrosClip.get(meta(folioC).pago.id);
r = await pedir("POST", `/pedidos/${folioC}/cancelar`, { tok: CLIENTE });
pagarEnClip(cobroC.payment_request_id);
r = await avisar(cobroC.payment_request_id);
ok("pago de un pedido ya cancelado: sigue cancelado y queda avisado", meta(folioC).estatus === "Cancelado" && /ya estaba «Cancelado»/.test(meta(folioC).historial.at(-1).nota ?? ""), meta(folioC).historial.at(-1).nota);

// Sin claves de Clip (como está producción hasta que el dueño las ponga) se
// prueba en `probar-clip-sin-claves.mjs`: SST lee sus recursos al cargar la
// Lambda, así que hace falta otro proceso.

cerrar();
console.log(`\n${pasan} pasan, ${fallos} fallan`);
process.exit(fallos === 0 ? 0 : 1);
