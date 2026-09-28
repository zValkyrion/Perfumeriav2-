// Pruebas sin AWS de lo que la tienda y el panel hacen con los pedidos:
// crear (con idempotencia y transacción), «Mis pedidos», el detalle, cancelar,
// el rastreo sin cuenta, las solicitudes y todo `/admin` de la tienda
// (pedidos, ventas, clientes y grupos). La Lambda empaquetada contra DynamoDB y
// Cognito falsos; las cifras de ventas se comparan con cuentas hechas a mano.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import {
  agregarUsuario,
  arrancar,
  cerrar,
  cuenta,
  entorno,
  estadisticasCognito,
  sembrarCatalogo,
  tablas,
  usuarios,
} from "./servicios-falsos.mjs";
import { filaMeta, pedidoAMano, token } from "./datos-prueba.mjs";

const RAIZ = join(import.meta.dirname, "..", "..");
const catalogo = JSON.parse(readFileSync(join(RAIZ, "src", "data", "catalogo.json"), "utf8"));

let fallos = 0;
let pasan = 0;
const ok = (n, c, d = "") => {
  console.log(`${c ? "PASA " : "FALLA"}  ${n}${d !== "" ? ` — ${d}` : ""}`);
  if (c) pasan++;
  else fallos++;
};
const igual = (n, obtenido, esperado) => {
  const pasa = JSON.stringify(obtenido) === JSON.stringify(esperado);
  ok(n, pasa, pasa ? "" : `esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(obtenido)}`);
};

await arrancar();
Object.assign(process.env, entorno);
sembrarCatalogo(catalogo);
const T = new Map();
tablas.set("Elrey_proveedores", T);
const fila = (PK, SK) => T.get(`${PK}#${SK}`);
const filas = (prefijo) => [...T.values()].filter((f) => f.PK.startsWith(prefijo));

const { handler } = await import("./.generado/api.mjs");
const puras = await import("./.generado/puras.mjs");

/* ── Cuentas ──────────────────────────────────────────────────────────────── */

const ADMIN_C = { sub: "admin-1", correo: "admin@prueba.local", nombre: "Admin Prueba", grupos: ["admins"] };
const CLI_A = { sub: "cliente-a", correo: "ana@prueba.local", nombre: "Ana Cuenta", telefono: "+525512345678", grupos: ["clientes"] };
const CLI_B = { sub: "cliente-b", correo: "beto@prueba.local", nombre: "Beto Cuenta", grupos: ["clientes"] };
const PROV = { sub: "prov-1", correo: "campo@prueba.local", nombre: "Campo", grupos: ["proveedores"] };
for (const c of [ADMIN_C, CLI_A, CLI_B, PROV]) agregarUsuario({ ...c, creado: new Date("2026-01-15T10:00:00Z") });
// Más de 60 cuentas: ListUsers tiene que paginar y los grupos pedirse con
// concurrencia limitada.
for (let i = 0; i < 66; i++) {
  agregarUsuario({ sub: `extra-${i}`, correo: `extra${i}@prueba.local`, nombre: `Extra ${i}`, grupos: ["clientes"], estado: i === 0 ? "UNCONFIRMED" : "CONFIRMED" });
}

const tokenDe = (c) => token({ sub: c.sub, email: c.correo, name: c.nombre, "cognito:groups": c.grupos });
const ADMIN = tokenDe(ADMIN_C);
const A = tokenDe(CLI_A);
const B = tokenDe(CLI_B);
const PROVEEDOR = tokenDe(PROV);

async function pedir(metodo, ruta, { cuerpo, tok, query } = {}) {
  const r = await handler({
    requestContext: { http: { method: metodo, path: ruta } },
    headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), "accept-encoding": "gzip" },
    queryStringParameters: query ?? null,
    body: cuerpo === undefined ? null : JSON.stringify(cuerpo),
  });
  const texto = r.isBase64Encoded ? gunzipSync(Buffer.from(r.body, "base64")).toString("utf8") : r.body;
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* no era JSON */
  }
  return { estado: r.statusCode, json, cabeceras: r.headers };
}

const PIN = (await pedir("POST", "/acceso", { cuerpo: { pin: "1234", evaluador: "Campo" } })).json.token;
const ANIO = puras.fechaMexico(new Date()).slice(0, 4);
const contador = () => fila("CONTADOR", "PEDIDOS")?.valor;

/* ── Funciones puras ──────────────────────────────────────────────────────── */

igual("un pedido de las 20:00 de México es de ese día, no del siguiente (UTC)", puras.fechaMexico(new Date("2026-03-04T02:00:00Z")), "2026-03-03");
igual("urlRastreo arma la de la paquetería y codifica la guía", puras.urlRastreo("estafeta", " AB 12/3 "), "https://www.estafeta.com/rastrear-envio?guias=AB%2012%2F3");
igual("…acepta el nombre además del id", puras.urlRastreo("DHL", "X1"), "https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=X1");
igual("…y sin página pública o sin guía no inventa enlace", [puras.urlRastreo("redpack", "X"), puras.urlRastreo("estafeta", ""), puras.urlRastreo(null, "X")], [null, null, null]);
igual("un estatus desconocido se lee como Pendiente", [puras.estatusDe("Enviado"), puras.estatusDe(undefined), puras.estatusDe("En preparación")], ["Pendiente", "Pendiente", "En preparación"]);
igual(
  "niveles: 0 Bronce, 12 Plata, 71 Oro (falta 1), 72 Distribuidor",
  [0, 12, 71, 72].map((p) => [puras.nivelDePiezas(p).actual.nombre, puras.nivelDePiezas(p).faltan]),
  [["Bronce", 12], ["Plata", 24], ["Oro", 1], ["Distribuidor", 0]],
);
igual("ESTATUS_VENDIDO son los cuatro que ya se cobraron", puras.ESTATUS_VENDIDO, ["Pagado", "En preparación", "En camino", "Entregado"]);

/* ── Puertas ──────────────────────────────────────────────────────────────── */

const RUTAS_CLIENTE = [
  ["GET", "/pedidos"],
  ["GET", "/pedidos/REY-2026-02000"],
  ["POST", "/pedidos/REY-2026-02000/cancelar"],
];
for (const [m, ruta] of RUTAS_CLIENTE) {
  const sin = await pedir(m, ruta);
  const pin = await pedir(m, ruta, { tok: PIN });
  ok(`${m} ${ruta}: 401 sin token y 403 con el PIN`, sin.estado === 401 && pin.estado === 403, `${sin.estado}/${pin.estado}`);
}

const RUTAS_ADMIN = [
  ["GET", "/admin/pedidos"],
  ["GET", "/admin/pedidos/REY-2026-02000"],
  ["PUT", "/admin/pedidos/REY-2026-02000"],
  ["GET", "/admin/ventas"],
  ["GET", "/admin/clientes"],
  ["GET", "/admin/clientes/detalle"],
  ["PUT", "/admin/clientes/grupos"],
  ["GET", "/admin/solicitudes"],
  ["PUT", "/admin/solicitudes/abc12345"],
];
for (const [m, ruta] of RUTAS_ADMIN) {
  const r = await Promise.all([
    pedir(m, ruta, { cuerpo: {} }),
    pedir(m, ruta, { tok: PIN, cuerpo: {} }),
    pedir(m, ruta, { tok: A, cuerpo: {} }),
    pedir(m, ruta, { tok: PROVEEDOR, cuerpo: {} }),
  ]);
  const estados = r.map((x) => x.estado);
  ok(
    `${m} ${ruta}: 401 sin token; 403 con PIN, cliente y proveedor, con mensaje neutro`,
    JSON.stringify(estados) === "[401,403,403,403]" && r.slice(1).every((x) => x.json?.error === "Esta sección es solo para administradores"),
    estados.join("/"),
  );
}

/* ── Crear un pedido ──────────────────────────────────────────────────────── */

const set = catalogo.sets.find((s) => s.visible && !s.agotado);
const ITEMS = [
  { productoId: "0001", ml: 100, cantidad: 2 },
  { productoId: "paquete-inicio", ml: 0, cantidad: 1 },
  { productoId: set.slug, ml: 0, cantidad: 1 },
];
const CONTACTO = {
  nombre: "Ana María López",
  telefono: "+52 55 1234 5678",
  correo: "ana.contacto@prueba.local",
  calle: "Reforma 100",
  colonia: "Centro",
  cp: "72000",
  ciudad: "Puebla",
  estado: "Puebla",
  referencias: "Portón verde",
};
const solicitud = (extra = {}) => ({ items: ITEMS, metodo: "transferencia", envio: "estandar", cupon: "rey10", contacto: CONTACTO, ...extra });
const esperado = puras.cotizar(ITEMS, puras.fuenteDeCatalogo(catalogo), { cupon: "REY10", metodo: "transferencia", envio: "estandar" });

let r = await pedir("POST", "/pedidos", { cuerpo: solicitud({ clave: "clave-sin-cuenta-01", plazo: 3, total: 1, folio: "REY-0000-00001" }) });
const folio1 = r.json?.folio;
ok("sin cuenta: 201 con folio REY- del contador", r.estado === 201 && new RegExp(`^REY-${ANIO}-\\d{5}$`).test(folio1 ?? ""), `${r.estado} ${folio1}`);
ok("el total es el del servidor (cotizar con el catálogo), no el que mandó el navegador", r.json?.total === esperado.total && esperado.total > 1, `${r.json?.total} vs ${esperado.total}`);
const meta1 = fila(`PEDIDO#${folio1}`, "META");
ok("el META nace Pendiente, sin cuenta, con su alta en el historial y el sello", meta1?.pedido.estatus === "Pendiente" && meta1.pedido.cliente === null && meta1.pedido.historial.length === 1 && meta1.pedido.historial[0].por === "cliente" && meta1.pedido.actualizadoEn === meta1.creadoEn && meta1.GSI1PK === "PEDIDOS");
igual(
  "las líneas quedan congeladas con nombre y detalle (perfume, lote y set)",
  meta1?.pedido.cuenta.lineas.map((l) => [l.nombre, l.detalle]),
  [["Lattafa Yara", "100 ml"], ["Paquete Inicio", "Lote · 10 piezas"], [set.nombre, "Set de regalo"]],
);
ok("el cupón REY10 se aplicó (en minúsculas también)", meta1?.pedido.cuenta.cupon === "REY10" && meta1.pedido.cuenta.descuentoCupon >= 0 && esperado.cupon === "REY10");
ok("plazo con transferencia no se guarda (solo Clip tiene meses)", meta1?.pedido.solicitud.plazo === null);
const idem = fila("IDEMPOTENCIA#clave-sin-cuenta-01", "META");
ok("la clave de idempotencia queda guardada, sin GSI1PK", idem?.folio === folio1 && idem.GSI1PK === undefined);
ok("sin cuenta no hay copia en «Mis pedidos»", filas("USER#").length === 0);

const contadorAntes = contador();
const metasAntes = filas("PEDIDO#").length;
r = await pedir("POST", "/pedidos", { cuerpo: solicitud({ clave: "clave-sin-cuenta-01" }) });
ok("mismo intento (misma clave): 200 con el mismo folio", r.estado === 200 && r.json?.folio === folio1, `${r.estado} ${r.json?.folio}`);
ok("…sin gastar folio ni crear otro pedido", contador() === contadorAntes && filas("PEDIDO#").length === metasAntes, `${contador()} / ${filas("PEDIDO#").length}`);
r = await pedir("POST", "/pedidos", { cuerpo: solicitud({ clave: "clave-distinta-02" }) });
ok("otra clave es otro pedido (folio siguiente)", r.estado === 201 && r.json.folio !== folio1 && contador() === contadorAntes + 1);
r = await pedir("POST", "/pedidos", { cuerpo: solicitud({ clave: "mala" }) });
ok("una clave con forma inválida se ignora y el pedido pasa", r.estado === 201 && !fila("IDEMPOTENCIA#mala", "META"));
r = await pedir("POST", "/pedidos", { cuerpo: solicitud({ contacto: { ...CONTACTO, telefono: "" } }) });
ok("sin teléfono: 400", r.estado === 400);

// Con cuenta: queda ligado a ella y aparece en «Mis pedidos».
r = await pedir("POST", "/pedidos", { tok: A, cuerpo: solicitud({ metodo: "clip", plazo: 6, cupon: "AURA10", clave: "clave-cuenta-a-01" }) });
const folioA = r.json?.folio;
const metaA = fila(`PEDIDO#${folioA}`, "META");
ok("con cuenta: 201 y el META guarda quién compró (sub y correo de la cuenta)", r.estado === 201 && metaA?.pedido.cliente?.sub === "cliente-a" && metaA.pedido.cliente.correo === "ana@prueba.local");
ok("…Clip a 6 meses se guarda; AURA10 sigue valiendo", metaA?.pedido.solicitud.plazo === 6 && metaA.pedido.cuenta.cupon === "AURA10");
const copiaA = fila("USER#cliente-a", `PEDIDO#${folioA}`);
ok("…y la copia en USER# (índice de «Mis pedidos»), sin GSI1PK", copiaA?.pedido.folio === folioA && copiaA.GSI1PK === undefined);
r = await pedir("POST", "/pedidos", { tok: A, cuerpo: solicitud({ metodo: "clip", plazo: 5 }) });
const folioA2 = r.json?.folio;
ok("un plazo que Clip no ofrece se guarda como null", fila(`PEDIDO#${folioA2}`, "META")?.pedido.solicitud.plazo === null);

// La transacción: si el META choca (el contador se reinició), no queda nada suelto.
const siguiente = `REY-${ANIO}-${String(contador() + 1).padStart(5, "0")}`;
T.set(`PEDIDO#${siguiente}#META`, filaMeta(pedidoAMano({ folio: siguiente, fecha: "2026-01-01", total: 1, piezas: 1, lineas: [] }), "2026-01-01T12:00:00.000Z"));
console.log("  (el «fallo no controlado … TransactionCanceledException» que sigue es el esperado)");
r = await pedir("POST", "/pedidos", { tok: A, cuerpo: solicitud({ clave: "clave-choque-0001" }) });
ok("si el META ya existía la transacción entera se cancela (500, nada pisado)", r.estado === 500 && fila(`PEDIDO#${siguiente}`, "META").pedido.cuenta.total === 1, `${r.estado}`);
ok("…sin clave de idempotencia ni copia huérfanas", !fila("IDEMPOTENCIA#clave-choque-0001", "META") && !fila("USER#cliente-a", `PEDIDO#${siguiente}`));
r = await pedir("POST", "/pedidos", { tok: A, cuerpo: solicitud({ clave: "clave-choque-0001" }) });
ok("…y el reintento con la misma clave entra con el folio siguiente", r.estado === 201 && r.json.folio !== siguiente && fila("IDEMPOTENCIA#clave-choque-0001", "META")?.folio === r.json.folio);
T.delete(`PEDIDO#${siguiente}#META`);
const folioA3 = r.json.folio;

/* ── Camino antiguo ───────────────────────────────────────────────────────── */

r = await pedir("POST", "/pedidos", { cuerpo: { folio: "AUR-2025-00900", total: 10, items: [] } });
ok("camino antiguo sin sesión: 401", r.estado === 401);
r = await pedir("POST", "/pedidos", { tok: B, cuerpo: { folio: "AUR-2025-00900", fecha: "2025-12-01", estatus: "Entregado", guia: "FALSA", paqueteria: "DHL", total: 123, piezas: 1, items: [{ productoId: "0001", ml: 100, cantidad: 1 }] } });
let copiaVieja = fila("USER#cliente-b", "PEDIDO#AUR-2025-00900");
ok("camino antiguo: 200 y la copia nace Pendiente, sin guía ni paquetería", r.estado === 200 && copiaVieja?.pedido.estatus === "Pendiente" && copiaVieja.pedido.guia === undefined && copiaVieja.pedido.paqueteria === undefined);
r = await pedir("POST", "/pedidos", { tok: B, cuerpo: { folio: "AUR-2025-00900", estatus: "Entregado", total: 0, items: [] } });
copiaVieja = fila("USER#cliente-b", "PEDIDO#AUR-2025-00900");
ok("…y no pisa una copia que ya existe", r.estado === 200 && copiaVieja.pedido.total === 123 && copiaVieja.pedido.estatus === "Pendiente");
r = await pedir("POST", "/pedidos", { tok: B, cuerpo: { folio: folioA, total: 0, items: [] } });
ok("…ni se puede apuntar al folio de un pedido registrado (409)", r.estado === 409 && !fila("USER#cliente-b", `PEDIDO#${folioA}`));
r = await pedir("GET", "/proveedores", { tok: PROVEEDOR });
ok("nada de la tienda (USER#, IDEMPOTENCIA#, pedidos) se cuela en GET /proveedores", r.estado === 200 && r.json.proveedores.length === 0);

/* ── Pedidos sembrados: heredados y de ventas ─────────────────────────────── */

// Un META de antes de este cambio (sin cliente, historial ni sello) cuya
// copia está en «Mis pedidos» de B; y una copia plantada en A con otro total.
const HEREDADO = "AUR-2026-02005";
T.set(`PEDIDO#${HEREDADO}#META`, filaMeta(
  pedidoAMano({ folio: HEREDADO, fecha: "2026-09-01", estatus: "Pagado", total: 800, piezas: 2, contacto: { nombre: "Beto Viejo", telefono: "5577777777" }, lineas: [{ productoId: "0001", ml: 100, cantidad: 2, unitario: 400, subtotal: 800 }] }),
  "2026-09-01T17:00:00.000Z",
));
delete fila(`PEDIDO#${HEREDADO}`, "META").pedido.historial;
T.set(`USER#cliente-b#PEDIDO#${HEREDADO}`, { PK: "USER#cliente-b", SK: `PEDIDO#${HEREDADO}`, creadoEn: "2026-09-01T17:00:00.000Z", pedido: { folio: HEREDADO, fecha: "2026-09-01", estatus: "Pendiente", total: 800, piezas: 2, items: [] } });
T.set(`USER#cliente-a#PEDIDO#${HEREDADO}`, { PK: "USER#cliente-a", SK: `PEDIDO#${HEREDADO}`, creadoEn: "2026-09-01T17:00:00.000Z", pedido: { folio: HEREDADO, fecha: "2026-09-01", estatus: "Pendiente", total: 1, piezas: 1, items: [] } });
// Un folio de la fórmula vieja sin META: solo existe como copia.
T.set("USER#cliente-a#PEDIDO#1000", { PK: "USER#cliente-a", SK: "PEDIDO#1000", creadoEn: "2025-10-01T12:00:00.000Z", pedido: { folio: "1000", fecha: "2025-10-01", estatus: "Entregado", total: 900, piezas: 2, items: [{ productoId: "0002", ml: 100, cantidad: 2 }] } });

// Ventas de marzo con cifras conocidas (ver las cuentas abajo).
const L = (productoId, cantidad, unitario) => ({ productoId, ml: 100, cantidad, unitario, subtotal: cantidad * unitario });
const LUIS = { nombre: "Luis Prueba", telefono: "5511111111", ciudad: "León" };
const MARTA = { nombre: "Marta Prueba", telefono: "55 2222 2222", ciudad: "Toluca" };
const PEDRO = { nombre: "Pedro Prueba", telefono: "5533333333", ciudad: "Oaxaca" };
const VENTAS = [
  // [folio, fecha, creadoEn (UTC), datos]
  ["V-01", "2026-03-01", "2026-03-01T18:00:00.000Z", { estatus: "Pagado", total: 1000, piezas: 2, metodo: "transferencia", escalon: "Menudeo", lineas: [L("0001", 2, 500)], descuentoTransferencia: 100, contacto: LUIS }],
  ["V-07", "2026-03-02", "2026-03-02T16:00:00.000Z", { estatus: "Pagado", total: 300, piezas: 1, metodo: "contra", escalon: "Menudeo", lineas: [L("0003", 1, 300)], contacto: MARTA }],
  // 20:00 del 3 de marzo en México = 02:00 del 4 en UTC: es venta del día 3.
  ["V-02", "2026-03-03", "2026-03-04T02:00:00.000Z", { estatus: "Entregado", total: 2600, piezas: 5, metodo: "clip", envio: "express", escalon: "Mayoreo", lineas: [L("0002", 5, 520)], ahorroVolumen: 300, contacto: PEDRO }],
  ["V-03", "2026-03-03", "2026-03-03T15:00:00.000Z", { estatus: "Pendiente", total: 700, piezas: 1, lineas: [L("0004", 1, 700)], contacto: { nombre: "Pendiente Prueba", telefono: "5599999999" } }],
  ["V-04", "2026-03-05", "2026-03-05T15:00:00.000Z", { estatus: "Cancelado", total: 400, piezas: 1, lineas: [L("0004", 1, 400)], contacto: { nombre: "Cancela Prueba", telefono: "5588888888" } }],
  ["V-05", "2026-03-07", "2026-03-08T05:30:00.000Z", { estatus: "En camino", total: 1500, piezas: 3, metodo: "transferencia", escalon: "Menudeo", lineas: [L("0001", 3, 500)], descuentoCupon: 150, contacto: { ...LUIS, telefono: "+52 55 1111 1111" } }],
  // Fuera del rango aunque caen en el margen de ±1 día de la consulta.
  ["V-06", "2026-02-28", "2026-03-01T03:00:00.000Z", { estatus: "Pagado", total: 999, piezas: 1, metodo: "transferencia", lineas: [L("0005", 1, 999)], contacto: MARTA }],
  ["V-08", "2026-03-08", "2026-03-08T07:00:00.000Z", { estatus: "Pagado", total: 5000, piezas: 10, metodo: "clip", lineas: [L("0005", 10, 500)], contacto: { nombre: "Rosa Prueba", telefono: "5544444444" } }],
  // Un mayorista de enero: 80 piezas vendidas (Distribuidor) y 100 pendientes que no cuentan.
  ["V-09", "2026-01-10", "2026-01-10T18:00:00.000Z", { estatus: "Entregado", total: 30000, piezas: 80, metodo: "transferencia", lineas: [L("0006", 80, 375)], contacto: { nombre: "Mayorista Prueba", telefono: "5566666666", ciudad: "Mérida" } }],
  ["V-10", "2026-01-11", "2026-01-11T18:00:00.000Z", { estatus: "Pendiente", total: 37500, piezas: 100, lineas: [L("0006", 100, 375)], contacto: { nombre: "Mayorista Prueba", telefono: "5566666666", ciudad: "Mérida" } }],
];
for (const [folio, fecha, creadoEn, datos] of VENTAS) {
  T.set(`PEDIDO#${folio}#META`, filaMeta(pedidoAMano({ folio, fecha, cliente: null, ...datos, extra: { historial: [{ estatus: "Pendiente", en: creadoEn, por: "cliente" }], actualizadoEn: creadoEn } }), creadoEn));
}
// 45 pedidos de una misma cuenta: «Mis pedidos» pagina la Query y reintenta el BatchGet.
for (let i = 0; i < 45; i++) {
  const folio = `M-${String(i).padStart(3, "0")}`;
  const creadoEn = new Date(Date.UTC(2026, 4, 1 + (i % 28), 12, i)).toISOString();
  T.set(`PEDIDO#${folio}#META`, filaMeta(pedidoAMano({ folio, fecha: creadoEn.slice(0, 10), estatus: "Entregado", total: 100 + i, piezas: 1, lineas: [L("0007", 1, 100 + i)], contacto: { nombre: "Muchos Pedidos", telefono: "5500000045" }, cliente: { sub: "cliente-muchos", correo: null } }), creadoEn));
  T.set(`USER#cliente-muchos#PEDIDO#${folio}`, { PK: "USER#cliente-muchos", SK: `PEDIDO#${folio}`, creadoEn, pedido: { folio, fecha: creadoEn.slice(0, 10), estatus: "Pendiente", total: 100 + i, piezas: 1, items: [] } });
}

/* ── «Mis pedidos» ────────────────────────────────────────────────────────── */

r = await pedir("GET", "/pedidos", { tok: A });
const deA = r.json?.pedidos ?? [];
ok("GET /pedidos: 200 con los de la cuenta, del más nuevo al más viejo", r.estado === 200 && deA[0]?.folio === folioA3 && deA.at(-1)?.folio === "1000", deA.map((p) => p.folio).join(", "));
const resumenA = deA.find((p) => p.folio === folioA);
ok("…armados desde el META (contacto, ciudad, total del servidor, items para volver a pedir)", resumenA?.nombre === "Ana María López" && resumenA.ciudad === "Puebla" && resumenA.conCuenta === true && resumenA.items.length === 3 && resumenA.total === metaA.pedido.cuenta.total);
const plantada = deA.find((p) => p.folio === HEREDADO);
ok("una copia plantada con el folio de otro no abre su META (sale solo la copia)", plantada && plantada.nombre === "" && plantada.total === 1);
ok("el folio heredado sin META sale como se guardó", deA.find((p) => p.folio === "1000")?.estatus === "Entregado");
const muchos = await pedir("GET", "/pedidos", { tok: token({ sub: "cliente-muchos", "cognito:groups": ["clientes"] }) });
ok("45 pedidos: la Query pagina y el BatchGet reintenta lo no procesado", muchos.json?.pedidos.length === 45 && muchos.json.pedidos.every((p) => p.estatus === "Entregado"), `${muchos.json?.pedidos.length}`);

/* ── Detalle del dueño ────────────────────────────────────────────────────── */

r = await pedir("GET", `/pedidos/${folioA}`, { tok: A });
const detA = r.json;
ok("GET /pedidos/{folio} del dueño: 200 con líneas, cifras, contacto y cancelable", r.estado === 200 && detA.lineas.length === 3 && detA.cifras.total === metaA.pedido.cuenta.total && detA.contacto.calle === "Reforma 100" && detA.cancelable === true && detA.plazo === 6 && detA.heredado === false);
ok("…sin lo del equipo (nota interna, cuenta con que se compró)", !("notaInterna" in detA) && !("cliente" in detA));
const noEsSuyo = await pedir("GET", `/pedidos/${folioA}`, { tok: B });
const noExiste = await pedir("GET", "/pedidos/REY-1999-99999", { tok: B });
ok("a quien no es el dueño: 404 igual que un folio que no existe", noEsSuyo.estado === 404 && noExiste.estado === 404 && noEsSuyo.json.error === noExiste.json.error);
r = await pedir("GET", `/pedidos/${folio1}`, { tok: A });
ok("un pedido sin cuenta tampoco se abre con otra cuenta (404)", r.estado === 404);
r = await pedir("GET", `/pedidos/${HEREDADO}`, { tok: B });
ok("META de antes sin `cliente`: el dueño se reconoce por su copia (misma fecha y total)", r.estado === 200 && r.json.estatus === "Pagado" && r.json.historial.length === 1);
r = await pedir("GET", `/pedidos/${HEREDADO}`, { tok: A });
ok("…y una copia que no cuadra no abre el pedido (404)", r.estado === 404);
r = await pedir("GET", "/pedidos/1000", { tok: A });
ok("folio heredado sin META: 200 con lo que hay, marcado heredado y sin inventar precios", r.estado === 200 && r.json.heredado === true && r.json.lineas[0]?.nombre === "Lattafa Asad" && r.json.lineas[0].unitario === 0 && r.json.cancelable === false);
r = await pedir("GET", "/pedidos/..%2F..%2Fetc", { tok: A });
ok("un folio con caracteres raros: 404", r.estado === 404);

/* ── Cancelar ─────────────────────────────────────────────────────────────── */

r = await pedir("POST", `/pedidos/${folioA2}/cancelar`, { tok: B });
ok("cancelar un pedido ajeno: 404", r.estado === 404 && fila(`PEDIDO#${folioA2}`, "META").pedido.estatus === "Pendiente");
r = await pedir("POST", `/pedidos/${folioA2}/cancelar`, { tok: A });
const hCancel = r.json?.historial?.at(-1);
ok("el dueño cancela un Pendiente: 200, Cancelado y en el historial por «cliente»", r.estado === 200 && r.json.estatus === "Cancelado" && r.json.cancelable === false && hCancel?.estatus === "Cancelado" && hCancel.por === "cliente");
r = await pedir("POST", `/pedidos/${folioA2}/cancelar`, { tok: A });
ok("cancelar otra vez: 409", r.estado === 409, r.json?.error);
r = await pedir("POST", `/pedidos/${HEREDADO}/cancelar`, { tok: B });
ok("cancelar uno que ya está Pagado: 409 que lo explica", r.estado === 409 && r.json.error.includes("Pagado"), r.json?.error);

/* ── Rastreo sin cuenta ───────────────────────────────────────────────────── */

r = await pedir("POST", "/pedidos/consulta", { cuerpo: { folio: folio1.toLowerCase(), telefono: "(55) 1234-5678" } });
ok("POST /pedidos/consulta con folio y teléfono (cualquier formato): 200", r.estado === 200 && r.json.folio === folio1);
ok("…con solo el primer nombre y sin dirección, teléfono ni correo", r.json?.nombre === "Ana" && r.json.ciudad === "Puebla" && !("contacto" in r.json) && !JSON.stringify(r.json).includes("Reforma") && !JSON.stringify(r.json).includes("5678"));
const telMal = await pedir("POST", "/pedidos/consulta", { cuerpo: { folio: folio1, telefono: "5500000000" } });
const folioMal = await pedir("POST", "/pedidos/consulta", { cuerpo: { folio: "REY-1999-99999", telefono: "5512345678" } });
ok("teléfono equivocado y folio inexistente: el mismo 404", telMal.estado === 404 && folioMal.estado === 404 && telMal.json.error === folioMal.json.error && telMal.json.error === "No encontramos un pedido con ese folio y teléfono");
r = await pedir("POST", "/pedidos/consulta", { cuerpo: { folio: folio1 } });
ok("sin teléfono: 400", r.estado === 400);

/* ── Panel: pedidos ───────────────────────────────────────────────────────── */

const totalMetas = filas("PEDIDO#").length;
r = await pedir("GET", "/admin/pedidos", { tok: ADMIN });
const lista = r.json?.pedidos ?? [];
ok("GET /admin/pedidos: todos (paginando el índice), del más nuevo al más viejo", r.estado === 200 && lista.length === totalMetas && r.json.truncado === false && lista.every((p, i) => i === 0 || lista[i - 1].creadoEn >= p.creadoEn), `${lista.length} de ${totalMetas}`);
ok("…con la cabecera no-store (datos personales)", r.cabeceras["cache-control"] === "no-store");
r = await pedir("GET", "/admin/pedidos", { tok: ADMIN, query: { desde: "2026-03-03", hasta: "2026-03-03" } });
igual("rango de un día: entra el de las 20:00 (02:00 UTC del día siguiente)", r.json?.pedidos.map((p) => p.folio).sort(), ["V-02", "V-03"]);
r = await pedir("GET", "/admin/pedidos", { tok: ADMIN, query: { desde: "2026-03-01", hasta: "2026-03-07" } });
igual("rango de una semana: sin los del margen de ±1 día", r.json?.pedidos.map((p) => p.folio).sort(), ["V-01", "V-02", "V-03", "V-04", "V-05", "V-07"]);
r = await pedir("GET", "/admin/pedidos", { tok: ADMIN, query: { desde: "2026-02-31" } });
const alReves = await pedir("GET", "/admin/pedidos", { tok: ADMIN, query: { desde: "2026-03-05", hasta: "2026-03-01" } });
ok("fecha que no existe o rango al revés: 400", r.estado === 400 && alReves.estado === 400);

r = await pedir("GET", `/admin/pedidos/${folioA}`, { tok: ADMIN });
const adm = r.json;
ok("GET /admin/pedidos/{folio}: todo, con la cuenta y la nota interna", r.estado === 200 && adm.cliente.sub === "cliente-a" && adm.cliente.correoCuenta === "ana@prueba.local" && adm.notaInterna === null && adm.actualizadoEn === metaA.creadoEn);
r = await pedir("GET", "/admin/pedidos/NO-EXISTE", { tok: ADMIN });
ok("…404 si no existe", r.estado === 404);

r = await pedir("PUT", `/admin/pedidos/${folioA}`, { tok: ADMIN, cuerpo: { estatus: "Pagado", nota: "Pagó con Clip", notaInterna: "Revisar dirección", actualizadoEn: adm.actualizadoEn } });
const tras = r.json;
const ultimo = tras?.historial?.at(-1);
ok("PUT: cambia el estatus y firma el historial con quién, cuándo y la nota", r.estado === 200 && tras.estatus === "Pagado" && ultimo?.estatus === "Pagado" && ultimo.por === "Admin Prueba" && ultimo.nota === "Pagó con Clip" && tras.notaInterna === "Revisar dirección");
ok("…y renueva el sello", tras?.actualizadoEn > adm.actualizadoEn);
r = await pedir("PUT", `/admin/pedidos/${folioA}`, { tok: ADMIN, cuerpo: { estatus: "Cancelado", actualizadoEn: adm.actualizadoEn } });
ok("PUT con lo que se vio antes (otro ya lo cambió): 409 con el mensaje", r.estado === 409 && r.json.error === "Alguien más cambió este pedido. Recarga para ver lo último." && fila(`PEDIDO#${folioA}`, "META").pedido.estatus === "Pagado");
for (const [nombre, cuerpo] of [
  ["guía de más de 60", { guia: "X".repeat(61) }],
  ["paquetería que no está en la lista", { paqueteria: "Correos de Marte" }],
  ["estatus inventado", { estatus: "Enviado" }],
  ["nota de más de 1000", { notaCliente: "x".repeat(1001) }],
]) {
  r = await pedir("PUT", `/admin/pedidos/${folioA}`, { tok: ADMIN, cuerpo: { ...cuerpo, actualizadoEn: tras.actualizadoEn } });
  ok(`PUT con ${nombre}: 422 con el motivo`, r.estado === 422 && typeof r.json.error === "string", r.json?.error);
}
r = await pedir("PUT", `/admin/pedidos/${folioA}`, { tok: ADMIN, cuerpo: { estatus: "Pagado" } });
ok("PUT sin actualizadoEn: 422", r.estado === 422);
r = await pedir("PUT", `/admin/pedidos/${folioA}`, { tok: ADMIN, cuerpo: { estatus: "En camino", guia: "  GUIA 123  ", paqueteria: "Estafeta", notaCliente: "Sale hoy", actualizadoEn: tras.actualizadoEn } });
const enCamino = r.json;
ok("PUT guía + paquetería por nombre: se guarda el id y sale el enlace de rastreo", r.estado === 200 && enCamino.guia === "GUIA 123" && enCamino.paqueteria === "estafeta" && enCamino.urlRastreo === "https://www.estafeta.com/rastrear-envio?guias=GUIA%20123");
r = await pedir("PUT", `/admin/pedidos/${folio1}`, { tok: ADMIN, cuerpo: { estatus: "En camino", actualizadoEn: fila(`PEDIDO#${folio1}`, "META").pedido.actualizadoEn } });
ok("«En camino» sin guía está permitido (entrega propia)", r.estado === 200 && r.json.estatus === "En camino" && r.json.guia === null);

r = await pedir("GET", `/pedidos/${folioA}`, { tok: A });
const visto = r.json;
ok("el cliente lo ve en el acto: estatus, guía, enlace y nota para él", visto.estatus === "En camino" && visto.urlRastreo?.includes("GUIA%20123") && visto.notaCliente === "Sale hoy" && visto.cancelable === false);
ok("…con el historial firmado como «tienda» y sin las notas del equipo", visto.historial.slice(1).every((c) => c.por === "tienda" && c.nota === undefined) && !JSON.stringify(visto).includes("Revisar dirección"));
r = await pedir("GET", "/pedidos", { tok: A });
ok("…y en «Mis pedidos» (lee el META, no la copia)", r.json.pedidos.find((p) => p.folio === folioA)?.estatus === "En camino");

// Un META de antes, sin sello: vale su creadoEn mientras nadie lo toque.
r = await pedir("GET", `/admin/pedidos/${HEREDADO}`, { tok: ADMIN });
const selloViejo = r.json.actualizadoEn;
ok("pedido de antes sin sello: actualizadoEn = creadoEn", selloViejo === "2026-09-01T17:00:00.000Z");
r = await pedir("PUT", `/admin/pedidos/${HEREDADO}`, { tok: ADMIN, cuerpo: { estatus: "En preparación", actualizadoEn: selloViejo } });
ok("…se puede cambiar, y el historial empieza por su alta", r.estado === 200 && r.json.historial.map((c) => c.estatus).join(",") === "Pendiente,En preparación");
r = await pedir("PUT", `/admin/pedidos/${HEREDADO}`, { tok: ADMIN, cuerpo: { estatus: "Entregado", actualizadoEn: selloViejo } });
ok("…y con el sello viejo otra vez: 409", r.estado === 409);

/* ── Panel: ventas ────────────────────────────────────────────────────────── */

r = await pedir("GET", "/admin/ventas", { tok: ADMIN, query: { desde: "2026-03-01", hasta: "2026-03-07" } });
const v = r.json;
ok("GET /admin/ventas: 200", r.estado === 200, `${r.estado}`);
// Las cuentas hechas a mano (V-01, V-07, V-02, V-05 vendidos; V-03 pendiente; V-04 cancelado):
igual("pedidos / vendidos / pendientes / cancelados", [v.pedidos, v.vendidos, v.pendientes, v.cancelados], [6, 4, 1, 1]);
igual("ingresos 1000+300+2600+1500, por cobrar 700, ticket 5400/4, piezas 2+1+5+3", [v.ingresos, v.porCobrar, v.ticketPromedio, v.piezas], [5400, 700, 1350, 11]);
igual(
  "por día: los 7 días, también los que quedaron en cero",
  v.porDia.map((d) => [d.fecha.slice(5), d.pedidos, d.vendidos, d.ingresos, d.piezas]),
  [["03-01", 1, 1, 1000, 2], ["03-02", 1, 1, 300, 1], ["03-03", 2, 1, 2600, 5], ["03-04", 0, 0, 0, 0], ["03-05", 1, 0, 0, 0], ["03-06", 0, 0, 0, 0], ["03-07", 1, 1, 1500, 3]],
);
igual(
  "por estatus: los seis, en orden",
  v.porEstatus.map((e) => [e.estatus, e.pedidos, e.total]),
  [["Pendiente", 1, 700], ["Pagado", 2, 1300], ["En preparación", 0, 0], ["En camino", 1, 1500], ["Entregado", 1, 2600], ["Cancelado", 1, 400]],
);
igual("por método (solo vendidos)", v.porMetodo.map((m) => [m.clave, m.pedidos, m.ingresos]), [["clip", 1, 2600], ["transferencia", 2, 2500], ["contra", 1, 300]]);
igual("por envío", v.porEnvio.map((m) => [m.clave, m.pedidos, m.ingresos]), [["estandar", 3, 2800], ["express", 1, 2600], ["mismo-dia", 0, 0]]);
igual("por escalón (de más a menos ingresos)", v.porEscalon.filter((m) => m.pedidos).map((m) => [m.clave, m.pedidos, m.ingresos]), [["Menudeo", 3, 2800], ["Mayoreo", 1, 2600]]);
const nombre = puras.nombradorDe(catalogo);
igual(
  "top de productos por ingresos, con su nombre",
  v.topProductos.map((p) => [p.productoId, p.nombre, p.piezas, p.ingresos]),
  [["0002", nombre("0002", 100).nombre, 5, 2600], ["0001", nombre("0001", 100).nombre, 5, 2500], ["0003", nombre("0003", 100).nombre, 1, 300]],
);
igual(
  "top de clientes (el mismo teléfono escrito distinto es la misma persona)",
  v.topClientes.map((c) => [c.clave, c.pedidos, c.ingresos]),
  [["tel:5533333333", 1, 2600], ["tel:5511111111", 2, 2500], ["tel:5522222222", 1, 300]],
);
igual("descuentos concedidos en lo vendido", v.descuentos, { volumen: 300, transferencia: 100, cupon: 150, tresPorDos: 0 });
igual("clientes nuevos / recurrentes (Luis y Marta tienen 2 vendidos en el histórico)", [v.clientesNuevos, v.clientesRecurrentes], [1, 2]);
r = await pedir("GET", "/admin/ventas", { tok: ADMIN });
ok("sin rango: los últimos 30 días, hasta hoy", r.estado === 200 && r.json.porDia.length === 30 && r.json.hasta === puras.fechaMexico(new Date()));
r = await pedir("GET", "/admin/ventas", { tok: ADMIN, query: { desde: "2025-01-01", hasta: "2026-03-01" } });
ok("más de 400 días: 400", r.estado === 400, r.json?.error);

/* ── Panel: clientes ──────────────────────────────────────────────────────── */

estadisticasCognito.maxSimultaneas = 0;
r = await pedir("GET", "/admin/clientes", { tok: ADMIN });
const clientes = r.json?.clientes ?? [];
const porClave = new Map(clientes.map((c) => [c.clave, c]));
ok("GET /admin/clientes: 200 con las 70 cuentas (ListUsers paginado) y los compradores sin cuenta", r.estado === 200 && [...usuarios.values()].every((u) => porClave.has(u.sub)) && porClave.has("tel:5511111111") && r.json.aviso === null, `${clientes.length}`);
ok("…los grupos se piden con 5 a la vez como mucho", estadisticasCognito.maxSimultaneas <= 5 && estadisticasCognito.maxSimultaneas >= 2, `${estadisticasCognito.maxSimultaneas}`);
const ana = porClave.get("cliente-a");
ok("una cuenta: grupos, alta, estado y sus pedidos", ana?.grupos.join() === "clientes" && ana.registradoEn === "2026-01-15T10:00:00.000Z" && ana.estadoCuenta === "CONFIRMED" && ana.pedidos === 3 && ana.pedidosVendidos === 1 && ana.correo === "ana@prueba.local");
const luis = porClave.get("tel:5511111111");
igual("un comprador sin cuenta: clave por teléfono, cifras de lo vendido", [luis?.sub, luis?.pedidos, luis?.pedidosVendidos, luis?.piezas, luis?.ingresos, luis?.ultimoPedido, luis?.ciudad], [null, 2, 2, 5, 2500, "2026-03-07", "León"]);
const mayorista = porClave.get("tel:5566666666");
igual("el nivel cuenta solo piezas vendidas (80, no 180): Distribuidor", [mayorista?.piezas, mayorista?.nivel, mayorista?.pedidos], [80, "Distribuidor", 2]);
igual("una cuenta sin confirmar lo dice", porClave.get("extra-0")?.estadoCuenta, "UNCONFIRMED");

r = await pedir("GET", "/admin/clientes/detalle", { tok: ADMIN, query: { clave: "tel:5511111111" } });
ok("detalle por teléfono: la ficha y sus 2 pedidos", r.estado === 200 && r.json.cliente.clave === "tel:5511111111" && r.json.pedidos.map((p) => p.folio).sort().join() === "V-01,V-05");
r = await pedir("GET", "/admin/clientes/detalle", { tok: ADMIN, query: { clave: "cliente-a" } });
ok("detalle de una cuenta: con grupos y sus pedidos del META", r.estado === 200 && r.json.cliente.grupos.includes("clientes") && r.json.pedidos.length === 3 && r.json.pedidos.some((p) => p.folio === folioA && p.estatus === "En camino"));
r = await pedir("GET", "/admin/clientes/detalle", { tok: ADMIN, query: { clave: "extra-5" } });
ok("detalle de una cuenta sin compras: 200 con 0 pedidos", r.estado === 200 && r.json.cliente.pedidos === 0 && r.json.pedidos.length === 0);
r = await pedir("GET", "/admin/clientes/detalle", { tok: ADMIN, query: { clave: "tel:5500001234" } });
const sinClave = await pedir("GET", "/admin/clientes/detalle", { tok: ADMIN });
ok("detalle de alguien que no existe: 404; sin clave: 400", r.estado === 404 && sinClave.estado === 400);

r = await pedir("PUT", "/admin/clientes/grupos", { tok: ADMIN, cuerpo: { sub: "cliente-b", grupo: "proveedores", accion: "agregar" } });
ok("agregar a proveedores: 200 con los grupos que quedan (y en Cognito)", r.estado === 200 && r.json.grupos.join() === "clientes,proveedores" && usuarios.get("beto@prueba.local").grupos.has("proveedores"));
r = await pedir("PUT", "/admin/clientes/grupos", { tok: ADMIN, cuerpo: { sub: "cliente-b", grupo: "proveedores", accion: "quitar" } });
ok("quitarlo: 200", r.estado === 200 && r.json.grupos.join() === "clientes");
r = await pedir("PUT", "/admin/clientes/grupos", { tok: ADMIN, cuerpo: { sub: "admin-1", grupo: "admins", accion: "quitar" } });
ok("un admin no se quita a sí mismo de admins: 400 y sigue siendo admin", r.estado === 400 && usuarios.get("admin@prueba.local").grupos.has("admins"), r.json?.error);
r = await pedir("PUT", "/admin/clientes/grupos", { tok: ADMIN, cuerpo: { sub: "cliente-b", grupo: "root", accion: "agregar" } });
const accionMala = await pedir("PUT", "/admin/clientes/grupos", { tok: ADMIN, cuerpo: { sub: "cliente-b", grupo: "admins", accion: "borrar" } });
const noHay = await pedir("PUT", "/admin/clientes/grupos", { tok: ADMIN, cuerpo: { sub: "no-existe", grupo: "admins", accion: "agregar" } });
ok("grupo o acción inventados: 400; cuenta que no existe: 404", r.estado === 400 && accionMala.estado === 400 && noHay.estado === 404);

/* ── Solicitudes ──────────────────────────────────────────────────────────── */

r = await pedir("POST", "/solicitudes", { cuerpo: { tipo: "distribuidor", nombre: "  Dist Prueba ", telefono: "55 1010 1010", ciudad: "Puebla", volumen: "50 piezas", mensaje: "m".repeat(3000), admin: true, estado: "cerrada" } });
const idDist = r.json?.id;
const guardada = fila(`SOLICITUD#${idDist}`, "META");
ok("POST /solicitudes sin sesión: 201 con id", r.estado === 201 && r.json.ok === true && typeof idDist === "string");
ok("…saneada: recortes, sin campos ajenos, nace «nueva» y en su partición del índice", guardada?.solicitud.nombre === "Dist Prueba" && guardada.solicitud.mensaje.length === 2000 && !("admin" in guardada.solicitud) && guardada.solicitud.estado === "nueva" && guardada.solicitud.sub === null && guardada.GSI1PK === "SOLICITUDES");
r = await pedir("POST", "/solicitudes", { tok: A, cuerpo: { tipo: "factura", nombre: "Ana", telefono: "5512345678", folio: folioA, rfc: "xaxx010101000", razonSocial: "Ana SA", cpFiscal: "72000", usoCfdi: "G03" } });
ok("factura con sesión: 201 y guarda el sub", r.estado === 201 && fila(`SOLICITUD#${r.json.id}`, "META")?.solicitud.sub === "cliente-a" && fila(`SOLICITUD#${r.json.id}`, "META").solicitud.rfc === "XAXX010101000");
r = await pedir("POST", "/solicitudes", { cuerpo: { tipo: "contacto", nombre: "Contacto Prueba", telefono: "5520202020", mensaje: "Hola" } });
ok("contacto: 201", r.estado === 201);
const sinNombre = await pedir("POST", "/solicitudes", { cuerpo: { tipo: "contacto", telefono: "5520202020" } });
const sinTel = await pedir("POST", "/solicitudes", { cuerpo: { tipo: "contacto", nombre: "X", telefono: "55" } });
ok("sin nombre o sin teléfono: 400 con mensaje claro", sinNombre.estado === 400 && sinNombre.json.error === "Falta tu nombre" && sinTel.estado === 400 && sinTel.json.error.includes("teléfono"));
const rfcMalo = await pedir("POST", "/solicitudes", { cuerpo: { tipo: "factura", nombre: "X", telefono: "5520202020", folio: "REY-1", rfc: "NO-ES-RFC", razonSocial: "X" } });
const tipoMalo = await pedir("POST", "/solicitudes", { cuerpo: { tipo: "queja", nombre: "X", telefono: "5520202020" } });
ok("factura con RFC inválido y tipo inventado: 400", rfcMalo.estado === 400 && tipoMalo.estado === 400, `${rfcMalo.json?.error} / ${tipoMalo.json?.error}`);

r = await pedir("GET", "/admin/solicitudes", { tok: ADMIN });
const sol = r.json?.solicitudes ?? [];
ok("GET /admin/solicitudes: las 3, de la más nueva a la más vieja", r.estado === 200 && sol.length === 3 && sol[0].tipo === "contacto" && sol.at(-1).tipo === "distribuidor");
r = await pedir("PUT", `/admin/solicitudes/${idDist}`, { tok: ADMIN, cuerpo: { estado: "en proceso", nota: "Le llamé", actualizadaEn: guardada.solicitud.actualizadaEn } });
ok("PUT solicitud: cambia estado y nota, renueva el sello", r.estado === 200 && r.json.estado === "en proceso" && r.json.nota === "Le llamé" && r.json.actualizadaEn > guardada.solicitud.actualizadaEn);
const vieja = await pedir("PUT", `/admin/solicitudes/${idDist}`, { tok: ADMIN, cuerpo: { estado: "cerrada", actualizadaEn: guardada.solicitud.actualizadaEn } });
const estadoMalo = await pedir("PUT", `/admin/solicitudes/${idDist}`, { tok: ADMIN, cuerpo: { estado: "archivada", actualizadaEn: r.json.actualizadaEn } });
const noExisteSol = await pedir("PUT", "/admin/solicitudes/no-existe-123", { tok: ADMIN, cuerpo: { estado: "cerrada", actualizadaEn: "x" } });
ok("PUT solicitud con sello viejo 409, estado inventado 422, id que no existe 404", vieja.estado === 409 && estadoMalo.estado === 422 && noExisteSol.estado === 404, `${vieja.estado}/${estadoMalo.estado}/${noExisteSol.estado}`);
r = await pedir("GET", "/proveedores", { tok: PROVEEDOR });
ok("las solicitudes tampoco se cuelan en GET /proveedores", r.json.proveedores.length === 0);

console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} PRUEBAS FALLARON`}  (${pasan} pasan; ${cuenta.escrituras} escrituras, ${cuenta.transacciones} transacciones)`);
cerrar();
process.exit(fallos ? 1 : 0);
