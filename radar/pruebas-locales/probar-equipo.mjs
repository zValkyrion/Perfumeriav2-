// Pruebas sin AWS de «Equipo y cuentas»: quién es superadmin, las puertas de
// /superadmin/*, pedir entrar al equipo, aceptar y rechazar, invitar por
// correo, dar y quitar grupos y cortar el acceso. La Lambda empaquetada contra
// DynamoDB y Cognito falsos.
import { gunzipSync } from "node:zlib";
import { agregarUsuario, arrancar, cerrar, entorno, tablas, usuarios } from "./servicios-falsos.mjs";
import { token } from "./datos-prueba.mjs";

let fallos = 0;
let pasan = 0;
const ok = (n, c, d = "") => {
  console.log(`${c ? "PASA " : "FALLA"}  ${n}${d !== "" ? ` — ${d}` : ""}`);
  if (c) pasan++;
  else fallos++;
};

await arrancar();
Object.assign(process.env, entorno);
const T = new Map();
tablas.set("Elrey_proveedores", T);
tablas.set("Elrey_catalogo", new Map());
const fila = (PK, SK) => T.get(`${PK}#${SK}`);

const { handler } = await import("./.generado/api.mjs");

/* ── Cuentas ──────────────────────────────────────────────────────────────── */

const CORREO_SUPER = "carlos.acosta12121998@gmail.com";
const SUPER_C = { sub: "super-1", correo: CORREO_SUPER, nombre: "Carlos Dueño", grupos: ["admins"] };
const ADMIN_C = { sub: "admin-1", correo: "admin@prueba.local", nombre: "Admin Prueba", grupos: ["admins"] };
const PROV_C = { sub: "prov-1", correo: "campo@prueba.local", nombre: "Campo Prueba", grupos: ["proveedores"] };
const LAURA_C = { sub: "cliente-laura", correo: "laura@prueba.local", nombre: "Laura Nueva", grupos: ["clientes"] };
const BETO_C = { sub: "cliente-beto", correo: "beto@prueba.local", nombre: "Beto Cliente", grupos: ["clientes"] };
const ANA_C = { sub: "cliente-ana", correo: "ana@prueba.local", nombre: "Ana Cliente", grupos: ["clientes"] };
const LUIS_C = { sub: "cliente-luis", correo: "luis@prueba.local", nombre: "Luis Cliente", grupos: ["clientes"] };
for (const c of [SUPER_C, ADMIN_C, PROV_C, LAURA_C, BETO_C, ANA_C, LUIS_C]) agregarUsuario(c);

const tokenDe = (c, extra = {}) =>
  token({ sub: c.sub, email: c.correo, email_verified: true, name: c.nombre, "cognito:groups": c.grupos, ...extra });
const SUPER = tokenDe(SUPER_C);
const ADMIN = tokenDe(ADMIN_C);
const PROV = tokenDe(PROV_C);
const LAURA = tokenDe(LAURA_C);
const BETO = tokenDe(BETO_C);
const ANA = tokenDe(ANA_C);
// El correo del dueño sin verificar no vale nada.
const SUPER_SIN_VERIFICAR = tokenDe({ ...SUPER_C, grupos: [] }, { email_verified: false });
// El dueño sin el grupo `admins`: sigue siendo admin por ser superadmin.
const SUPER_SIN_GRUPO = tokenDe({ ...SUPER_C, grupos: [] });

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
  return { estado: r.statusCode, json, cabeceras: r.headers };
}

const grupos = (correo) => [...usuarios.get(correo).grupos].sort().join();

/* ── El PIN ya no existe ──────────────────────────────────────────────────── */

let r = await pedir("POST", "/acceso", { cuerpo: { pin: "1234", evaluador: "Campo" } });
ok("POST /acceso (el PIN) ya no existe: sin sesión da 401", r.estado === 401, `${r.estado}`);
r = await pedir("POST", "/acceso", { tok: PROV, cuerpo: { pin: "1234", evaluador: "Campo" } });
ok("…y con sesión, 404", r.estado === 404, `${r.estado}`);

/* ── Puertas ──────────────────────────────────────────────────────────────── */

const RUTAS_SUPER = [
  ["GET", "/superadmin/equipo"],
  ["POST", "/superadmin/invitar"],
  ["PUT", "/superadmin/grupo"],
  ["PUT", "/superadmin/acceso"],
  ["PUT", "/superadmin/solicitudes/cliente-laura"],
];
for (const [m, ruta] of RUTAS_SUPER) {
  const rs = await Promise.all([
    pedir(m, ruta, { cuerpo: {} }),
    pedir(m, ruta, { tok: LAURA, cuerpo: {} }),
    pedir(m, ruta, { tok: PROV, cuerpo: {} }),
    pedir(m, ruta, { tok: ADMIN, cuerpo: {} }),
    pedir(m, ruta, { tok: SUPER_SIN_VERIFICAR, cuerpo: {} }),
  ]);
  const estados = rs.map((x) => x.estado);
  ok(
    `${m} ${ruta}: 401 sin token; 403 a cliente, proveedor, admin y al correo del dueño sin verificar`,
    JSON.stringify(estados) === "[401,403,403,403,403]" &&
      rs.slice(1).every((x) => x.json?.error === "Esta sección es solo para el superadministrador"),
    estados.join("/"),
  );
}
ok("nada de eso tocó Cognito", grupos("laura@prueba.local") === "clientes" && grupos("campo@prueba.local") === "proveedores");

r = await pedir("GET", "/admin/pedidos", { tok: SUPER_SIN_GRUPO });
ok("el superadmin sin el grupo admins sigue entrando a /admin: 200", r.estado === 200, `${r.estado}`);
r = await pedir("GET", "/proveedores", { tok: SUPER_SIN_GRUPO });
ok("…y al radar de proveedores: 200", r.estado === 200, `${r.estado}`);
r = await pedir("GET", "/admin/pedidos", { tok: SUPER_SIN_VERIFICAR });
ok("con el correo sin verificar no es nadie: /admin da 403", r.estado === 403, `${r.estado}`);

/* ── La vista ─────────────────────────────────────────────────────────────── */

r = await pedir("GET", "/superadmin/equipo", { tok: SUPER });
const vista = r.json;
ok("GET /superadmin/equipo: 200 con todas las cuentas", r.estado === 200 && vista.cuentas.length === usuarios.size, `${vista?.cuentas?.length}`);
ok("…sin caché", r.cabeceras["cache-control"] === "no-store");
const delDueno = vista.cuentas.find((c) => c.correo === CORREO_SUPER);
ok("…el dueño marcado como superadmin y nadie más", delDueno?.superadmin === true && vista.cuentas.filter((c) => c.superadmin).length === 1);
ok("…con grupos, estado y si puede entrar", vista.cuentas.find((c) => c.sub === "prov-1")?.grupos.join() === "proveedores" && vista.cuentas.every((c) => c.habilitada === true && c.estado === "CONFIRMED"));
ok("…y sin solicitudes todavía", Array.isArray(vista.solicitudes) && vista.solicitudes.length === 0);

/* ── Pedir entrar al equipo ───────────────────────────────────────────────── */

r = await pedir("POST", "/equipo/solicitud", { cuerpo: {} });
ok("pedir entrar sin sesión: 401", r.estado === 401);
r = await pedir("GET", "/equipo/solicitud", { tok: LAURA });
ok("GET /equipo/solicitud sin haber pedido: 200 con null", r.estado === 200 && r.json.solicitud === null);

r = await pedir("POST", "/equipo/solicitud", {
  tok: LAURA,
  cuerpo: { mensaje: `  Soy Laura,   de compras  ${"x".repeat(700)}`, nombre: "Otra Persona", correo: "falso@x.com", estado: "aceptada" },
});
const sLaura = r.json?.solicitud;
ok("una cliente pide entrar: 201 pendiente", r.estado === 201 && sLaura?.estado === "pendiente");
ok("…nombre y correo salen del token, no del cuerpo", sLaura?.nombre === "Laura Nueva" && sLaura.correo === "laura@prueba.local");
ok("…el mensaje se limpia y se corta a 500", sLaura?.mensaje.startsWith("Soy Laura, de compras x") && sLaura.mensaje.length === 500);
ok("…se guarda en su partición con su índice", fila("EQUIPO#cliente-laura", "SOLICITUD")?.GSI1PK === "EQUIPO");
ok("…y pedir no le da ningún grupo", grupos("laura@prueba.local") === "clientes");

r = await pedir("POST", "/equipo/solicitud", { tok: LAURA, cuerpo: { mensaje: "otra vez" } });
ok("volver a pedir con una pendiente: 200 con la misma, sin pisarla", r.estado === 200 && r.json.solicitud.creadaEn === sLaura.creadaEn && r.json.solicitud.mensaje === sLaura.mensaje);
r = await pedir("GET", "/equipo/solicitud", { tok: LAURA });
ok("…y GET la devuelve", r.json?.solicitud?.estado === "pendiente");

r = await pedir("POST", "/equipo/solicitud", { tok: PROV, cuerpo: {} });
ok("quien ya es del equipo no pide: 409", r.estado === 409, `${r.estado}`);

// Un respiro entre una y otra: el orden sale de la hora en milisegundos.
const respiro = () => new Promise((res) => setTimeout(res, 5));
await respiro();
await pedir("POST", "/equipo/solicitud", { tok: BETO, cuerpo: {} });
await respiro();
await pedir("POST", "/equipo/solicitud", { tok: ANA, cuerpo: {} });
r = await pedir("GET", "/superadmin/equipo", { tok: SUPER });
ok("el superadmin ve las tres pendientes, la más nueva primero", r.json.solicitudes.length === 3 && r.json.solicitudes[0].sub === "cliente-ana" && r.json.solicitudes.every((s) => s.estado === "pendiente"));

/* ── Aceptar y rechazar ───────────────────────────────────────────────────── */

r = await pedir("PUT", "/superadmin/solicitudes/cliente-laura", { tok: SUPER, cuerpo: { decision: "quizas" } });
ok("decisión inventada: 400", r.estado === 400);
r = await pedir("PUT", "/superadmin/solicitudes/cliente-laura", { tok: SUPER, cuerpo: { decision: "aceptar", grupo: "superadmin" } });
ok("aceptar con un grupo que no se reparte: 400 y nada cambia", r.estado === 400 && grupos("laura@prueba.local") === "clientes" && fila("EQUIPO#cliente-laura", "SOLICITUD").solicitud.estado === "pendiente");
r = await pedir("PUT", "/superadmin/solicitudes/no-existe", { tok: SUPER, cuerpo: { decision: "aceptar" } });
ok("solicitud que no existe: 404", r.estado === 404);

r = await pedir("PUT", "/superadmin/solicitudes/cliente-laura", { tok: SUPER, cuerpo: { decision: "aceptar" } });
ok("aceptar sin grupo la mete al equipo de proveedores", r.estado === 200 && grupos("laura@prueba.local") === "clientes,proveedores" && r.json.grupos.join() === "clientes,proveedores");
ok("…y cierra la solicitud con quién y con qué", r.json.solicitud?.estado === "aceptada" && r.json.solicitud.grupo === "proveedores" && r.json.solicitud.resueltaPor === "Carlos Dueño" && !!r.json.solicitud.resueltaEn);
r = await pedir("PUT", "/superadmin/solicitudes/cliente-laura", { tok: SUPER, cuerpo: { decision: "rechazar" } });
ok("resolverla otra vez: 409 y sigue aceptada", r.estado === 409 && fila("EQUIPO#cliente-laura", "SOLICITUD").solicitud.estado === "aceptada");
r = await pedir("GET", "/equipo/solicitud", { tok: LAURA });
ok("Laura ve que la aceptaron", r.json?.solicitud?.estado === "aceptada");

r = await pedir("PUT", "/superadmin/solicitudes/cliente-beto", { tok: SUPER, cuerpo: { decision: "rechazar" } });
ok("rechazar: 200, rechazada y sin grupo nuevo", r.estado === 200 && r.json.solicitud.estado === "rechazada" && grupos("beto@prueba.local") === "clientes");
r = await pedir("POST", "/equipo/solicitud", { tok: BETO, cuerpo: { mensaje: "Me equivoqué de cuenta" } });
ok("el rechazado puede volver a pedir: 201 pendiente", r.estado === 201 && r.json.solicitud.estado === "pendiente" && r.json.solicitud.resueltaPor === null);

r = await pedir("PUT", "/superadmin/solicitudes/cliente-beto", { tok: SUPER, cuerpo: { decision: "aceptar", grupo: "admins" } });
ok("aceptar como administrador", r.estado === 200 && grupos("beto@prueba.local") === "admins,clientes" && r.json.solicitud.grupo === "admins");

/* ── Grupos ───────────────────────────────────────────────────────────────── */

r = await pedir("PUT", "/superadmin/grupo", { tok: SUPER, cuerpo: { sub: "cliente-ana", grupo: "proveedores", accion: "agregar" } });
ok("dar un grupo directo: 200 con los grupos que quedan", r.estado === 200 && r.json.grupos.join() === "clientes,proveedores");
ok("…y cierra su solicitud pendiente como aceptada", fila("EQUIPO#cliente-ana", "SOLICITUD").solicitud.estado === "aceptada" && fila("EQUIPO#cliente-ana", "SOLICITUD").solicitud.grupo === "proveedores");
r = await pedir("PUT", "/superadmin/grupo", { tok: SUPER, cuerpo: { sub: "cliente-ana", grupo: "proveedores", accion: "quitar" } });
ok("quitarlo: 200", r.estado === 200 && grupos("ana@prueba.local") === "clientes");
r = await pedir("PUT", "/superadmin/grupo", { tok: SUPER, cuerpo: { sub: "cliente-luis", grupo: "admins", accion: "agregar" } });
ok("a quien nunca pidió también se le puede dar (sin crear solicitud)", r.estado === 200 && grupos("luis@prueba.local") === "admins,clientes" && !fila("EQUIPO#cliente-luis", "SOLICITUD"));

const malos = await Promise.all([
  pedir("PUT", "/superadmin/grupo", { tok: SUPER, cuerpo: { sub: "cliente-ana", grupo: "clientes", accion: "quitar" } }),
  pedir("PUT", "/superadmin/grupo", { tok: SUPER, cuerpo: { sub: "cliente-ana", grupo: "superadmin", accion: "agregar" } }),
  pedir("PUT", "/superadmin/grupo", { tok: SUPER, cuerpo: { sub: "cliente-ana", grupo: "admins", accion: "borrar" } }),
  pedir("PUT", "/superadmin/grupo", { tok: SUPER, cuerpo: { grupo: "admins", accion: "agregar" } }),
]);
ok("clientes, superadmin, acción inventada o sin sub: 400", malos.every((x) => x.estado === 400), malos.map((x) => x.estado).join("/"));
r = await pedir("PUT", "/superadmin/grupo", { tok: SUPER, cuerpo: { sub: "no-existe", grupo: "admins", accion: "agregar" } });
ok("cuenta que no existe: 404", r.estado === 404);
r = await pedir("PUT", "/superadmin/grupo", { tok: SUPER, cuerpo: { sub: "super-1", grupo: "admins", accion: "quitar" } });
ok("el superadmin no se cambia a sí mismo: 400 y sigue en admins", r.estado === 400 && grupos(CORREO_SUPER) === "admins", r.json?.error);

// Otra cuenta con el correo del dueño no puede existir en Cognito, pero si la
// lista dijera que una cuenta es superadmin (p. ej. otro superadmin), tampoco
// se toca. Se simula con un token de otro sub y el mismo correo.
const OTRO_SUPER = tokenDe({ ...SUPER_C, sub: "super-2" });
r = await pedir("PUT", "/superadmin/grupo", { tok: OTRO_SUPER, cuerpo: { sub: "super-1", grupo: "admins", accion: "quitar" } });
ok("a la cuenta superadmin no la cambia nadie desde el panel: 400", r.estado === 400 && grupos(CORREO_SUPER) === "admins", r.json?.error);

/* ── Acceso ───────────────────────────────────────────────────────────────── */

r = await pedir("PUT", "/superadmin/acceso", { tok: SUPER, cuerpo: { sub: "prov-1", habilitada: false } });
const campo = usuarios.get("campo@prueba.local");
ok("cortar el acceso: 200, deshabilitada", r.estado === 200 && r.json.habilitada === false && campo.habilitada === false);
ok("…y antes se le cerraron las sesiones (el refresco deja de servir)", campo.sesionesCerradas === 1);
r = await pedir("GET", "/superadmin/equipo", { tok: SUPER });
ok("…la vista la enseña sin acceso", r.json.cuentas.find((c) => c.sub === "prov-1")?.habilitada === false);
r = await pedir("PUT", "/superadmin/acceso", { tok: SUPER, cuerpo: { sub: "prov-1", habilitada: true } });
ok("devolverlo: 200 y habilitada", r.estado === 200 && campo.habilitada === true && campo.sesionesCerradas === 1);
r = await pedir("PUT", "/superadmin/acceso", { tok: SUPER, cuerpo: { sub: "prov-1" } });
ok("sin decir si queda habilitada: 400", r.estado === 400);
r = await pedir("PUT", "/superadmin/acceso", { tok: SUPER, cuerpo: { sub: "super-1", habilitada: false } });
ok("el superadmin no se corta el acceso: 400", r.estado === 400 && usuarios.get(CORREO_SUPER).habilitada === true);

/* ── Invitar ──────────────────────────────────────────────────────────────── */

r = await pedir("POST", "/superadmin/invitar", { tok: SUPER, cuerpo: { correo: "  Nuevo.Equipo@Prueba.Local ", nombre: "  Nuevo   Integrante ", grupo: "proveedores" } });
const nuevo = usuarios.get("nuevo.equipo@prueba.local");
ok("invitar: 201 y la cuenta existe con contraseña temporal", r.estado === 201 && nuevo?.estado === "FORCE_CHANGE_PASSWORD" && nuevo.invitado === true, `${r.estado} ${r.json?.error ?? ""}`);
ok("…correo en minúsculas y nombre limpio", r.json?.cuenta?.correo === "nuevo.equipo@prueba.local" && nuevo?.nombre === "Nuevo Integrante");
ok("…ya en su grupo", grupos("nuevo.equipo@prueba.local") === "proveedores" && r.json.cuenta.grupos.join() === "proveedores");
r = await pedir("POST", "/superadmin/invitar", { tok: SUPER, cuerpo: { correo: "laura@prueba.local", nombre: "Laura", grupo: "admins" } });
ok("invitar a quien ya tiene cuenta: 409 y no le cambia nada", r.estado === 409 && grupos("laura@prueba.local") === "clientes,proveedores");
const invMalas = await Promise.all([
  pedir("POST", "/superadmin/invitar", { tok: SUPER, cuerpo: { correo: "no-es-correo", nombre: "Alguien", grupo: "proveedores" } }),
  pedir("POST", "/superadmin/invitar", { tok: SUPER, cuerpo: { correo: "otro@prueba.local", nombre: " A ", grupo: "proveedores" } }),
  pedir("POST", "/superadmin/invitar", { tok: SUPER, cuerpo: { correo: "otro@prueba.local", nombre: "Alguien", grupo: "clientes" } }),
]);
ok("correo inválido, nombre corto o grupo que no se reparte: 422 y nada creado", invMalas.every((x) => x.estado === 422) && !usuarios.has("otro@prueba.local"), invMalas.map((x) => x.estado).join("/"));

cerrar();
console.log(`\n${pasan} pasan, ${fallos} fallan`);
process.exit(fallos === 0 ? 0 : 1);
