/**
 * Prueba de humo de la API en producción.
 *
 *   node scripts/probar-api.mjs [url-de-la-api] [pin]
 *
 * Recorre cada ruta con datos reales —incluida la subida de una foto a S3— y
 * verifica también los rechazos: un PIN equivocado, un token inventado y una
 * ruta inexistente. Crea una ficha de prueba y la borra al terminar, así que se
 * puede correr contra producción sin dejar basura.
 *
 * Se ejecuta después de cada `sst deploy`. Compilar no es funcionar.
 */
const API = process.argv[2] ?? "https://qdn0ihicj6.execute-api.us-east-1.amazonaws.com";

/**
 * El PIN nunca se escribe aquí.
 *
 * Este archivo vive en el repositorio; dejarlo con un valor por defecto sería
 * repetir el error que ya se corrigió en el cliente — sacamos el PIN del
 * JavaScript de la app precisamente para que no lo pudiera leer cualquiera, y
 * dejarlo en un script de pruebas lo devolvería al mismo sitio.
 *
 *   RADAR_PIN=xxxxxxxx node scripts/probar-api.mjs
 */
const PIN = process.argv[3] ?? process.env.RADAR_PIN;
if (!PIN) {
  console.error(
    "Falta el PIN. Pásalo como RADAR_PIN=... o como segundo argumento.\n" +
      "  RADAR_PIN=xxxxxxxx node scripts/probar-api.mjs",
  );
  process.exit(1);
}

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

// ── CORS: el preflight tiene que pasar o el sitio no puede hablar con la API ──
const preflight = await fetch(`${API}/acceso`, {
  method: "OPTIONS",
  headers: {
    origin: "https://devfq5kjop78h.cloudfront.net",
    "access-control-request-method": "POST",
    "access-control-request-headers": "content-type",
  },
});
ok(
  "el preflight CORS pasa",
  preflight.ok && !!preflight.headers.get("access-control-allow-origin"),
  `HTTP ${preflight.status}`,
);

// ── Acceso ──────────────────────────────────────────────────────────────────
const malo = await pedir("/acceso", {
  method: "POST",
  body: JSON.stringify({ pin: "00000000", evaluador: "Prueba" }),
});
ok("PIN incorrecto rechazado con 401", malo.estado === 401, malo.cuerpo?.error);

const sinNombre = await pedir("/acceso", {
  method: "POST",
  body: JSON.stringify({ pin: PIN, evaluador: "" }),
});
ok("acceso sin nombre rechazado con 400", sinNombre.estado === 400);

const bueno = await pedir("/acceso", {
  method: "POST",
  body: JSON.stringify({ pin: PIN, evaluador: "Prueba Automática" }),
});
ok("PIN correcto devuelve token", bueno.estado === 200 && !!bueno.cuerpo?.token);
const auth = { authorization: `Bearer ${bueno.cuerpo?.token}` };

ok("GET /proveedores sin token da 401", (await pedir("/proveedores")).estado === 401);
ok(
  "token inventado da 401",
  (await pedir("/proveedores", { headers: { authorization: "Bearer no.es.valido" } }))
    .estado === 401,
);

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
ok("firma quién la subió", encontrada?.subidoPor === "Prueba Automática");

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

// ── Tienda: carrito y pedidos ───────────────────────────────────────────────
// El carrito se guarda bajo el `sub` de Cognito, así que exige una cuenta
// propia. El PIN es el mismo token para todo el equipo: un carrito guardado con
// él sería el carrito de todos a la vez, y por eso se rechaza aunque el token
// sea válido. Probar el camino feliz pediría la contraseña de una cuenta real,
// que no vive en este repositorio; lo que sí se puede comprobar aquí —y es lo
// que protege— es que la puerta esté cerrada.
for (const [metodo, ruta] of [
  ["GET", "/carrito"],
  ["PUT", "/carrito"],
  ["GET", "/pedidos"],
  ["POST", "/pedidos"],
]) {
  const conPin = await pedir(ruta, {
    method: metodo,
    headers: auth,
    body: metodo === "GET" ? undefined : "{}",
  });
  ok(
    `${metodo} ${ruta} rechaza el token del PIN con 403`,
    conPin.estado === 403,
    `HTTP ${conPin.estado}`,
  );

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

console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} PRUEBAS FALLARON`}`);
process.exit(fallos === 0 ? 0 : 1);
