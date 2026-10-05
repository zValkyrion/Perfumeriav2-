/**
 * Prueba de humo de la API en producción.
 *
 *   RADAR_CORREO=... RADAR_CONTRASENA=... node scripts/probar-api.mjs [url-de-la-api]
 *
 * Verifica siempre los rechazos —sin token, con un token inventado, el PIN
 * retirado y cada puerta de /admin y /superadmin— y, si hay cuenta de prueba
 * (`token-cognito.mjs`), recorre además cada ruta del radar con datos reales,
 * incluida la subida de una foto a S3. La ficha de prueba se borra al
 * terminar, así que se puede correr contra producción sin dejar basura.
 *
 * Se ejecuta después de cada `sst deploy`. Compilar no es funcionar.
 */
import { tokenDePrueba } from "./token-cognito.mjs";

const API = process.argv[2] ?? "https://qdn0ihicj6.execute-api.us-east-1.amazonaws.com";

let fallos = 0;
const ok = (nombre, cond, detalle = "") => {
  console.log(`${cond ? "PASA" : "FALLA"}  ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

const pedir = async (ruta, opciones = {}) => {
  const res = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: { "content-type": "application/json", ...(opciones.headers ?? {}) },
  });
  let cuerpo = null;
  try {
    cuerpo = await res.json();
  } catch {}
  return { estado: res.status, cuerpo };
};

// ── Salud ───────────────────────────────────────────────────────────────────
const salud = await pedir("/salud");
ok("GET /salud responde 200", salud.estado === 200, JSON.stringify(salud.cuerpo));
ok("apunta a la tabla Elrey_proveedores", salud.cuerpo?.tabla === "Elrey_proveedores");

ok("publica el cliente de Cognito (lo usan las pruebas)", typeof salud.cuerpo?.clienteCognito === "string" && salud.cuerpo.clienteCognito !== "");

// ── CORS: el preflight tiene que pasar o el sitio no puede hablar con la API ──
const preflight = await fetch(`${API}/proveedores`, {
  method: "OPTIONS",
  headers: {
    origin: "https://devfq5kjop78h.cloudfront.net",
    "access-control-request-method": "GET",
    "access-control-request-headers": "authorization",
  },
});
ok(
  "el preflight CORS pasa",
  preflight.ok && !!preflight.headers.get("access-control-allow-origin"),
  `HTTP ${preflight.status}`,
);

// ── Acceso ──────────────────────────────────────────────────────────────────
// El PIN compartido se retiró: `POST /acceso` ya no da token a nadie.
const pin = await pedir("/acceso", {
  method: "POST",
  body: JSON.stringify({ pin: "00000000", evaluador: "Prueba" }),
});
ok("el PIN retirado ya no da token (401)", pin.estado === 401 && !pin.cuerpo?.token, `HTTP ${pin.estado}`);

ok("GET /proveedores sin token da 401", (await pedir("/proveedores")).estado === 401);
ok(
  "token inventado da 401",
  (await pedir("/proveedores", { headers: { authorization: "Bearer no.es.valido" } }))
    .estado === 401,
);

let token = null;
try {
  token = await tokenDePrueba(API);
} catch (e) {
  ok("la cuenta de prueba entra a Cognito", false, e.message);
}
const auth = token ? { authorization: `Bearer ${token}` } : null;
if (!token) {
  console.log(
    "\nOMITIDA  el recorrido con sesión (ficha, foto, borrado y el 403 de cada puerta): " +
      "faltan RADAR_CORREO y RADAR_CONTRASENA de la cuenta de prueba.\n",
  );
}

if (auth) {
// ── Ficha ───────────────────────────────────────────────────────────────────
const id = `prueba-${Date.now()}`;
const guardado = await pedir(`/proveedores/${id}`, {
  method: "PUT",
  headers: auth,
  body: JSON.stringify({
    id,
    nombre: "Proveedor de Prueba",
    telefono: "33 0000 0000",
    lada: "+52",
    ciudad: "Guadalajara",
    pais: "México",
    precios: [{ presentacion: "100ml", precio: 45, moq: 12 }],
    promociones: [
      { id: "pr1", desde: 2, unidad: "piezas", tipo: "gratis", valor: 1, nota: "3x2" },
    ],
    ejes: { similitud: 5, trato: 4 },
    banderas: [],
    estado: "pendiente",
    evaluador: "Prueba Automática",
    actualizadoEn: new Date().toISOString(),
  }),
});
ok("PUT /proveedores guarda", guardado.estado === 200, JSON.stringify(guardado.cuerpo));

const lista = await pedir("/proveedores", { headers: auth });
const encontrada = lista.cuerpo?.proveedores?.find((p) => p.id === id);
ok("GET /proveedores devuelve la ficha", !!encontrada);
ok("el servidor la marca como sincronizado", encontrada?.estado === "sincronizado");
ok("conserva las promociones", encontrada?.promociones?.[0]?.tipo === "gratis");
ok("firma quién la subió (el nombre de la cuenta)", typeof encontrada?.subidoPor === "string" && encontrada.subidoPor !== "");

// ── Foto: URL prefirmada, subida real y lectura ─────────────────────────────
const urlFoto = await pedir("/fotos", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    proveedorId: id,
    fotoId: "foto-prueba",
    tipo: "fachada",
    contentType: "image/webp",
    tomadaEn: new Date().toISOString(),
    lat: 20.67,
    lng: -103.35,
  }),
});
ok("POST /fotos da URL prefirmada", urlFoto.estado === 200 && !!urlFoto.cuerpo?.url);

const webp = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  "base64",
);
const subida = await fetch(urlFoto.cuerpo.url, {
  method: "PUT",
  body: webp,
  headers: { "content-type": "image/webp" },
});
ok("la foto sube directo a S3", subida.ok, `HTTP ${subida.status}`);

const fotos = await pedir(`/fotos?proveedorId=${id}`, { headers: auth });
ok("GET /fotos lista la foto", fotos.cuerpo?.fotos?.length === 1);
const urlLectura = fotos.cuerpo?.fotos?.[0]?.url;
const descarga = await fetch(urlLectura);
ok(
  "la foto se descarga igual que se subió",
  descarga.ok && (await descarga.arrayBuffer()).byteLength === webp.length,
);

// ── Borrado en cascada, incluido S3 ─────────────────────────────────────────
const borrado = await pedir(`/proveedores/${id}`, { method: "DELETE", headers: auth });
ok("DELETE /proveedores responde 200", borrado.estado === 200);
ok(
  "reporta la foto borrada de S3",
  borrado.cuerpo?.fotosBorradas === 1,
  JSON.stringify(borrado.cuerpo),
);
const huerfana = await fetch(urlLectura);
ok(
  "la foto ya no existe en S3",
  huerfana.status === 403 || huerfana.status === 404,
  `HTTP ${huerfana.status}`,
);

const tras = await pedir("/proveedores", { headers: auth });
ok("la ficha ya no está", !tras.cuerpo?.proveedores?.find((p) => p.id === id));
ok(
  "sus fotos se fueron con ella",
  (await pedir(`/fotos?proveedorId=${id}`, { headers: auth })).cuerpo?.fotos?.length === 0,
);

ok("ruta inexistente da 404", (await pedir("/no-existe", { headers: auth })).estado === 404);
}

// ── Tienda: carrito y pedidos ───────────────────────────────────────────────
// El carrito se guarda bajo el `sub` de Cognito. Aquí solo se prueba que la
// puerta esté cerrada sin sesión: el camino feliz escribiría en el carrito de
// la cuenta de prueba, y lo cubre `npm run probar:local` antes del despliegue.
for (const [metodo, ruta] of [
  ["GET", "/carrito"],
  ["PUT", "/carrito"],
  ["GET", "/direcciones"],
  ["PUT", "/direcciones"],
  ["GET", "/pedidos"],
  ["GET", "/pedidos/REY-1999-00001"],
  ["POST", "/pedidos/REY-1999-00001/cancelar"],
  ["GET", "/equipo/solicitud"],
]) {
  const sinToken = await pedir(ruta, {
    method: metodo,
    body: metodo === "GET" ? undefined : "{}",
  });
  ok(
    `${metodo} ${ruta} sin token da 401`,
    sinToken.estado === 401,
    `HTTP ${sinToken.estado}`,
  );
}

// ── Pedidos de la tienda: públicos, pero sin fiarse del navegador ───────────
// `POST /pedidos` no pide sesión —casi nadie se registra para comprar— y el
// total lo calcula el servidor. Aquí solo se prueban los rechazos: el camino
// feliz crearía un pedido real y gastaría un folio en producción. Ese camino lo
// cubren `npm run probar:precios` y la prueba local de la Lambda empaquetada.
const contacto = { nombre: "Prueba", telefono: "5500000000" };
const vacio = await pedir("/pedidos", { method: "POST", body: "{}" });
ok("POST /pedidos no pide sesión (un cuerpo vacío da 400, no 401)", vacio.estado === 400, `HTTP ${vacio.estado}`);

const inventado = await pedir("/pedidos", {
  method: "POST",
  body: JSON.stringify({
    items: [{ productoId: "no-existe-en-el-catalogo", ml: 100, cantidad: 3 }],
    metodo: "clip",
    envio: "estandar",
    contacto,
  }),
});
ok("POST /pedidos rechaza artículos que no existen con 422", inventado.estado === 422, `HTTP ${inventado.estado}`);

const sinTelefono = await pedir("/pedidos", {
  method: "POST",
  body: JSON.stringify({
    items: [{ productoId: "p001", ml: 100, cantidad: 1 }],
    metodo: "clip",
    contacto: { nombre: "Prueba" },
  }),
});
ok("POST /pedidos exige teléfono (400)", sinTelefono.estado === 400, `HTTP ${sinTelefono.estado}`);

const viejoSinSesion = await pedir("/pedidos", {
  method: "POST",
  body: JSON.stringify({ folio: "AUR-2026-00001", total: 0, items: [] }),
});
ok("el contrato viejo (folio y total del navegador) sin sesión da 401", viejoSinSesion.estado === 401, `HTTP ${viejoSinSesion.estado}`);

// El rastreo sin cuenta es público. Un folio que no existe responde lo mismo
// que un teléfono equivocado, sin decir cuál de los dos falló. No escribe nada.
const consulta = await pedir("/pedidos/consulta", {
  method: "POST",
  body: JSON.stringify({ folio: "REY-1999-00001", telefono: "5500000000" }),
});
ok(
  "POST /pedidos/consulta con un folio que no existe da 404",
  consulta.estado === 404 && consulta.cuerpo?.error === "No encontramos un pedido con ese folio y teléfono",
  `HTTP ${consulta.estado}`,
);

// ── Administración y equipo: la puerta ──────────────────────────────────────
// Pedidos, ventas, clientes y solicitudes son del grupo `admins`; «Equipo y
// cuentas», solo del superadmin. Aquí se prueba que la puerta esté cerrada
// —401 sin token y, con la cuenta de prueba (del equipo, no admin), 403—: el
// camino feliz lo cubre `npm run probar:local`, antes del despliegue, sin
// tocar AWS. Nada de esto escribe: el 403 sale antes de leer el cuerpo.
for (const [metodo, ruta] of [
  ["GET", "/admin/pedidos"],
  ["GET", "/admin/pedidos/REY-1999-00001"],
  ["PUT", "/admin/pedidos/REY-1999-00001"],
  ["GET", "/admin/ventas"],
  ["GET", "/admin/clientes"],
  ["GET", "/admin/clientes/detalle?clave=tel:5500000000"],
  ["GET", "/admin/solicitudes"],
  ["PUT", "/admin/solicitudes/prueba-00000000"],
  ["GET", "/superadmin/equipo"],
  ["POST", "/superadmin/invitar"],
  ["PUT", "/superadmin/grupo"],
  ["PUT", "/superadmin/acceso"],
  ["PUT", "/superadmin/solicitudes/prueba-00000000"],
]) {
  const cuerpo = metodo === "GET" ? undefined : "{}";
  const sinToken = await pedir(ruta, { method: metodo, body: cuerpo });
  if (!auth) {
    ok(`${metodo} ${ruta}: 401 sin token`, sinToken.estado === 401, `HTTP ${sinToken.estado}`);
    continue;
  }
  const conCuenta = await pedir(ruta, { method: metodo, headers: auth, body: cuerpo });
  ok(
    `${metodo} ${ruta}: 401 sin token y 403 con la cuenta del equipo`,
    sinToken.estado === 401 && conCuenta.estado === 403,
    `HTTP ${sinToken.estado}/${conCuenta.estado}`,
  );
}

console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} PRUEBAS FALLARON`}`);
process.exit(fallos === 0 ? 0 : 1);
