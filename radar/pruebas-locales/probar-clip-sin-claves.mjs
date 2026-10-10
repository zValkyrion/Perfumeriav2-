// Sin las claves de Clip —como está producción hasta que el dueño las ponga—
// nada del cobro existe: el pedido se crea igual, sin enlace, y a Clip ni se le
// habla. Va en su propio proceso porque SST lee los secretos al cargar la Lambda.
import { readFileSync } from "node:fs";
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
Object.assign(process.env, entorno, {
  SST_RESOURCE_Elrey_clip_api: JSON.stringify({ value: "" }),
  SST_RESOURCE_Elrey_clip_secreto: JSON.stringify({ value: "" }),
});
sembrarCatalogo(catalogo);
const T = new Map();
tablas.set("Elrey_proveedores", T);

const { handler } = await import("./.generado/api.mjs");
const ADMIN = token({ sub: "admin-1", email: "admin@prueba.local", email_verified: true, name: "Admin Prueba", "cognito:groups": ["admins"] });

async function pedir(metodo, ruta, { cuerpo, tok } = {}) {
  const r = await handler({
    requestContext: { http: { method: metodo, path: ruta }, domainName: "api.prueba.local" },
    headers: tok ? { authorization: `Bearer ${tok}` } : {},
    queryStringParameters: null,
    body: cuerpo === undefined ? null : JSON.stringify(cuerpo),
  });
  return { estado: r.statusCode, json: JSON.parse(r.body) };
}

const p = catalogo.productos.find((x) => x.visible && !x.agotado);
const ml = (p.presentaciones.find((v) => v.ml === 100) ?? p.presentaciones[0]).ml;

let r = await pedir("POST", "/pedidos", {
  cuerpo: {
    items: [{ productoId: p.codigo, ml, cantidad: 2 }],
    metodo: "clip",
    envio: "estandar",
    cupon: null,
    contacto: { nombre: "Laura", telefono: "55 4444 3333" },
  },
});
const folio = r.json?.folio;
ok("sin claves: el pedido con Clip se crea igual, sin enlace", r.estado === 201 && /^REY-/.test(folio ?? "") && !r.json.urlPago, `${r.estado}`);
ok("…y no guarda ningún cobro", !T.get(`PEDIDO#${folio}#META`)?.pedido?.pago);
r = await pedir("POST", `/admin/pedidos/${folio}/cobro`, { tok: ADMIN });
ok("el panel dice que Clip no está configurado (503)", r.estado === 503, r.json?.error);
r = await pedir("POST", "/clip/webhook", { cuerpo: { payment_request_id: "cobro-falso-0001" } });
ok("un aviso se contesta 200 sin hacer nada", r.estado === 200 && T.get(`PEDIDO#${folio}#META`).pedido.estatus === "Pendiente");
ok("a Clip no se le llamó ni una vez", ajustesClip.llamadas === 0 && cobrosClip.size === 0, `${ajustesClip.llamadas} llamadas`);

cerrar();
console.log(`\n${pasan} pasan, ${fallos} fallan`);
process.exit(fallos === 0 ? 0 : 1);
