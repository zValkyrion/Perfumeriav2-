// Pruebas sin AWS de lo que el equipo hace con un pedido desde el panel:
// cotizar sin guardar, capturar un pedido a nombre de un cliente, corregir
// los datos de entrega y cambiar los artículos (que se vuelven a cotizar en el
// servidor). La Lambda empaquetada contra DynamoDB y Cognito falsos.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { arrancar, cerrar, entorno, sembrarCatalogo, tablas } from "./servicios-falsos.mjs";
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
const fila = (PK, SK) => T.get(`${PK}#${SK}`);

const { handler } = await import("./.generado/api.mjs");
const puras = await import("./.generado/puras.mjs");
const fuente = puras.fuenteDeCatalogo(catalogo);

const ADMIN = token({ sub: "admin-1", email: "admin@prueba.local", email_verified: true, name: "Admin Prueba", "cognito:groups": ["admins"] });
const PROV = token({ sub: "prov-1", email: "campo@prueba.local", email_verified: true, name: "Campo", "cognito:groups": ["proveedores"] });
const CLIENTE = token({ sub: "cliente-a", email: "ana@prueba.local", email_verified: true, name: "Ana", "cognito:groups": ["clientes"] });

async function pedir(metodo, ruta, { cuerpo, tok } = {}) {
  const r = await handler({
    requestContext: { http: { method: metodo, path: ruta } },
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
const P1 = vendibles[0];
const P2 = vendibles[1];
const ml = (p) => (p.presentaciones.find((v) => v.ml === 100) ?? p.presentaciones[0]).ml;
const ITEMS = [{ productoId: P1.codigo, ml: ml(P1), cantidad: 2 }];
const CONTACTO = {
  nombre: "Laura Mostrador",
  telefono: "55 4444 3333",
  correo: "",
  calle: "Juárez 10",
  colonia: "Centro",
  cp: "72000",
  ciudad: "Puebla",
  estado: "Puebla",
  referencias: "",
};

/* ── Puertas ──────────────────────────────────────────────────────────────── */

for (const [m, ruta] of [
  ["POST", "/admin/cotizar"],
  ["POST", "/admin/pedidos"],
]) {
  const rs = await Promise.all([
    pedir(m, ruta, { cuerpo: {} }),
    pedir(m, ruta, { tok: PROV, cuerpo: {} }),
    pedir(m, ruta, { tok: CLIENTE, cuerpo: {} }),
  ]);
  ok(`${m} ${ruta}: 401 sin token; 403 a proveedor y cliente`, rs.map((x) => x.estado).join() === "401,403,403", rs.map((x) => x.estado).join("/"));
}

/* ── Cotizar ──────────────────────────────────────────────────────────────── */

let r = await pedir("POST", "/admin/cotizar", { tok: ADMIN, cuerpo: { items: ITEMS, metodo: "transferencia", envio: "estandar", cupon: null } });
const esperado = puras.cotizar(ITEMS, fuente, { metodo: "transferencia", envio: "estandar", cupon: null });
ok("cotizar: 200 con el total de `cotizar`", r.estado === 200 && r.json.cifras.total === esperado.total, `${r.json?.cifras?.total} vs ${esperado.total}`);
ok("…con las líneas nombradas", r.json?.lineas?.[0]?.nombre && r.json.lineas[0].cantidad === 2 && r.json.lineas[0].productoId === P1.codigo);
ok("…sin guardar nada", T.size === 0, `${T.size} filas`);
r = await pedir("POST", "/admin/cotizar", { tok: ADMIN, cuerpo: { items: [{ productoId: "no-existe", ml: 100, cantidad: 1 }, ...ITEMS], metodo: "clip", envio: "estandar" } });
ok("un artículo inexistente se descarta y se cuenta", r.estado === 200 && r.json.descartados === 1 && r.json.lineas.length === 1);
r = await pedir("POST", "/admin/cotizar", { tok: ADMIN, cuerpo: { items: [], metodo: "clip" } });
ok("sin artículos: 422", r.estado === 422);
r = await pedir("POST", "/admin/cotizar", { tok: ADMIN, cuerpo: { items: ITEMS, metodo: "bitcoin" } });
ok("forma de pago inventada: 422", r.estado === 422);

/* ── Capturar un pedido ───────────────────────────────────────────────────── */

r = await pedir("POST", "/admin/pedidos", {
  tok: ADMIN,
  cuerpo: { items: ITEMS, metodo: "transferencia", envio: "estandar", cupon: null, contacto: CONTACTO, clave: "panel-clave-0001", total: 1 },
});
const folio = r.json?.folio;
ok("capturar: 201 con folio del contador y total del servidor", r.estado === 201 && /^REY-\d{4}-\d{5}$/.test(folio ?? "") && r.json.total === esperado.total, `${r.estado} ${folio} ${r.json?.total}`);
const meta = () => fila(`PEDIDO#${folio}`, "META")?.pedido;
ok("…firmado por quien lo capturó, sin cuenta de cliente", meta()?.historial?.[0]?.por === "Admin Prueba" && meta().cliente === null && /panel/.test(meta().historial[0].nota));
r = await pedir("POST", "/admin/pedidos", {
  tok: ADMIN,
  cuerpo: { items: ITEMS, metodo: "transferencia", envio: "estandar", cupon: null, contacto: CONTACTO, clave: "panel-clave-0001" },
});
ok("doble clic (misma clave): el mismo folio, sin otro pedido", r.estado === 200 && r.json.folio === folio);
r = await pedir("POST", "/admin/pedidos", { tok: ADMIN, cuerpo: { items: ITEMS, metodo: "transferencia", contacto: { nombre: "", telefono: "" } } });
ok("sin nombre ni teléfono: 400", r.estado === 400);

let detalle = (await pedir("GET", `/admin/pedidos/${folio}`, { tok: ADMIN })).json;
ok("el detalle lo ve el panel con su historial", detalle?.folio === folio && detalle.historial[0].por === "Admin Prueba");

/* ── Corregir datos de entrega ────────────────────────────────────────────── */

const nuevoContacto = { ...CONTACTO, calle: "Juárez 12", referencias: "Junto a la farmacia" };
r = await pedir("PUT", `/admin/pedidos/${folio}`, { tok: ADMIN, cuerpo: { contacto: nuevoContacto, actualizadoEn: detalle.actualizadoEn } });
ok("corregir dirección: 200 y se guarda", r.estado === 200 && r.json.contacto.calle === "Juárez 12" && r.json.contacto.referencias === "Junto a la farmacia");
ok("…y deja constancia en el historial", /Datos de entrega/.test(r.json.historial.at(-1).nota ?? "") && r.json.historial.at(-1).por === "Admin Prueba");
detalle = r.json;
const malos = await Promise.all([
  pedir("PUT", `/admin/pedidos/${folio}`, { tok: ADMIN, cuerpo: { contacto: { ...CONTACTO, telefono: "55" }, actualizadoEn: detalle.actualizadoEn } }),
  pedir("PUT", `/admin/pedidos/${folio}`, { tok: ADMIN, cuerpo: { contacto: { ...CONTACTO, nombre: "" }, actualizadoEn: detalle.actualizadoEn } }),
  pedir("PUT", `/admin/pedidos/${folio}`, { tok: ADMIN, cuerpo: { contacto: { ...CONTACTO, cp: "720" }, actualizadoEn: detalle.actualizadoEn } }),
  pedir("PUT", `/admin/pedidos/${folio}`, { tok: ADMIN, cuerpo: { contacto: { ...CONTACTO, calle: "x".repeat(201) }, actualizadoEn: detalle.actualizadoEn } }),
]);
ok("teléfono corto, sin nombre, CP raro o calle larguísima: 422 sin tocar nada", malos.every((x) => x.estado === 422) && meta().solicitud.contacto.calle === "Juárez 12", malos.map((x) => x.estado).join("/"));

/* ── Cambiar artículos ────────────────────────────────────────────────────── */

const ITEMS2 = [
  { productoId: P1.codigo, ml: ml(P1), cantidad: 1 },
  { productoId: P2.codigo, ml: ml(P2), cantidad: 3 },
];
const esperado2 = puras.cotizar(ITEMS2, fuente, { metodo: "clip", envio: "express", cupon: null });
r = await pedir("PUT", `/admin/pedidos/${folio}`, {
  tok: ADMIN,
  cuerpo: { articulos: { items: ITEMS2, metodo: "clip", envio: "express", cupon: null }, actualizadoEn: detalle.actualizadoEn },
});
ok("cambiar artículos de un pendiente: 200 con el total recotizado", r.estado === 200 && r.json.cifras.total === esperado2.total && r.json.lineas.length === 2, `${r.json?.cifras?.total} vs ${esperado2.total}`);
ok("…con la nueva forma de pago y envío", r.json?.metodo === esperado2.metodo && r.json.envio === "express");
ok("…y el historial dice de cuánto a cuánto", /Artículos modificados/.test(r.json?.historial?.at(-1)?.nota ?? ""), r.json?.historial?.at(-1)?.nota);
ok("…guardado en la solicitud y en la cuenta", meta().solicitud.items.length === 2 && meta().cuenta.total === esperado2.total);
detalle = r.json;

r = await pedir("PUT", `/admin/pedidos/${folio}`, {
  tok: ADMIN,
  cuerpo: { articulos: { items: ITEMS, metodo: "clip", envio: "estandar", cupon: null }, actualizadoEn: "2000-01-01T00:00:00.000Z" },
});
ok("con un sello viejo: 409 y no cambia nada", r.estado === 409 && meta().cuenta.total === esperado2.total);

r = await pedir("PUT", `/admin/pedidos/${folio}`, {
  tok: ADMIN,
  cuerpo: { articulos: { items: [{ productoId: "no-existe", ml: 100, cantidad: 1 }], metodo: "clip", envio: "estandar" }, actualizadoEn: detalle.actualizadoEn },
});
ok("artículos que no existen: 422", r.estado === 422 && meta().cuenta.total === esperado2.total);

// Se cobra: ya no se cambian los artículos, pero la dirección sí.
r = await pedir("PUT", `/admin/pedidos/${folio}`, { tok: ADMIN, cuerpo: { estatus: "Pagado", actualizadoEn: detalle.actualizadoEn } });
detalle = r.json;
ok("se marca pagado", r.estado === 200 && detalle.estatus === "Pagado");
r = await pedir("PUT", `/admin/pedidos/${folio}`, {
  tok: ADMIN,
  cuerpo: { articulos: { items: ITEMS, metodo: "clip", envio: "estandar", cupon: null }, actualizadoEn: detalle.actualizadoEn },
});
ok("pagado: cambiar artículos da 409 y el total no se mueve", r.estado === 409 && meta().cuenta.total === esperado2.total, r.json?.error);
r = await pedir("PUT", `/admin/pedidos/${folio}`, { tok: ADMIN, cuerpo: { contacto: { ...nuevoContacto, telefono: "55 4444 9999" }, actualizadoEn: detalle.actualizadoEn } });
ok("pagado: la dirección todavía se corrige", r.estado === 200 && r.json.contacto.telefono === "55 4444 9999");
detalle = r.json;

for (const e of ["En preparación", "En camino", "Entregado"]) {
  detalle = (await pedir("PUT", `/admin/pedidos/${folio}`, { tok: ADMIN, cuerpo: { estatus: e, actualizadoEn: detalle.actualizadoEn } })).json;
}
r = await pedir("PUT", `/admin/pedidos/${folio}`, { tok: ADMIN, cuerpo: { contacto: CONTACTO, actualizadoEn: detalle.actualizadoEn } });
ok("entregado: la dirección ya no cambia (409)", r.estado === 409 && meta().solicitud.contacto.telefono === "55 4444 9999");

/* ── La copia de «Mis pedidos» ────────────────────────────────────────────── */

// Un pedido con cuenta: al cambiar artículos, su copia se pone al día.
r = await pedir("POST", "/pedidos", { tok: CLIENTE, cuerpo: { items: ITEMS, metodo: "transferencia", envio: "estandar", contacto: CONTACTO } });
const folioCuenta = r.json?.folio;
const visto = (await pedir("GET", `/admin/pedidos/${folioCuenta}`, { tok: ADMIN })).json;
r = await pedir("PUT", `/admin/pedidos/${folioCuenta}`, {
  tok: ADMIN,
  cuerpo: { articulos: { items: ITEMS2, metodo: "transferencia", envio: "estandar", cupon: null }, actualizadoEn: visto.actualizadoEn },
});
const copia = fila("USER#cliente-a", `PEDIDO#${folioCuenta}`)?.pedido;
ok("con cuenta: la copia de «Mis pedidos» trae los artículos y el total nuevos", r.estado === 200 && copia?.items?.length === 2 && copia.total === r.json.cifras.total, `${copia?.total} vs ${r.json?.cifras?.total}`);
r = await pedir("GET", "/pedidos", { tok: CLIENTE });
ok("…y el cliente lo ve con el total nuevo", r.json?.pedidos?.find((p) => p.folio === folioCuenta)?.total === copia?.total);
r = await pedir("GET", `/pedidos/${folioCuenta}`, { tok: CLIENTE });
ok("…sin ver la nota interna del historial ni quién la cambió", r.json?.historial?.every((h) => !h.nota && (h.por === "cliente" || h.por === "tienda")));

cerrar();
console.log(`\n${pasan} pasan, ${fallos} fallan`);
process.exit(fallos === 0 ? 0 : 1);
