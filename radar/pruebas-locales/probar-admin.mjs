// Prueba de punta a punta del panel del catálogo sin AWS: la Lambda
// empaquetada contra DynamoDB y S3 falsos, y después `catalogo:subir` contra
// la misma tabla. Se corre con `npm --prefix radar run probar:local`, que
// empaqueta antes (`empaquetar.mjs`).
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { arrancar, cerrar, cuenta, entorno, objetos, sembrarCatalogo } from "./servicios-falsos.mjs";

const RAIZ = join(import.meta.dirname, "..", "..");
const catalogo = JSON.parse(readFileSync(join(RAIZ, "src", "data", "catalogo.json"), "utf8"));

let fallos = 0;
const ok = (n, c, d = "") => {
  console.log(`${c ? "PASA " : "FALLA"}  ${n}${d ? ` — ${d}` : ""}`);
  if (!c) fallos++;
};

await arrancar();
Object.assign(process.env, entorno);

// La tabla como la dejó la carga de la Fase 2: sin `fuente` ni `editadoEn`,
// con las fotos ya publicadas en el bucket.
const t = sembrarCatalogo(catalogo, "2026-09-23T06:00:03.075Z");

const { handler } = await import("./.generado/api.mjs");

const token = (carga) => Buffer.from(JSON.stringify({ falso: true, sub: "sub-1", ...carga })).toString("base64");
const ADMIN = token({ name: "Admin Prueba", "cognito:groups": ["admins"] });
const PROVEEDOR = token({ name: "Campo", "cognito:groups": ["proveedores"] });

async function pedir(metodo, ruta, { cuerpo, tok, query, gzip } = {}) {
  const r = await handler({
    requestContext: { http: { method: metodo, path: ruta } },
    headers: {
      ...(tok ? { authorization: `Bearer ${tok}` } : {}),
      ...(gzip ? { "accept-encoding": "gzip, deflate" } : {}),
    },
    queryStringParameters: query ?? null,
    body: cuerpo === undefined ? null : JSON.stringify(cuerpo),
  });
  const texto = r.isBase64Encoded ? gunzipSync(Buffer.from(r.body, "base64")).toString("utf8") : r.body;
  let json = null;
  try { json = JSON.parse(texto); } catch { /* CSV */ }
  return { estado: r.statusCode, cabeceras: r.headers, json, texto, crudo: r };
}

// ── La puerta ──────────────────────────────────────────────────────────────
let r = await pedir("GET", "/admin/catalogo");
ok("sin sesión: 401", r.estado === 401, `${r.estado}`);
r = await pedir("GET", "/admin/catalogo", { tok: PROVEEDOR });
ok("una cuenta de proveedores no edita el catálogo: 403", r.estado === 403, `${r.estado}`);
r = await pedir("POST", "/acceso", { cuerpo: { pin: "1234", evaluador: "Campo" } });
ok("el PIN compartido ya no existe: POST /acceso sin sesión da 401", r.estado === 401, `${r.estado}`);

// ── Leer ───────────────────────────────────────────────────────────────────
r = await pedir("GET", "/admin/catalogo", { tok: ADMIN, gzip: true });
const admin = r.json;
ok("admin: 200 con el catálogo completo", r.estado === 200 && admin.catalogo.productos.length === catalogo.productos.length, `${admin?.catalogo?.productos?.length}`);
ok("…con los ocultos y sus notas", admin.catalogo.productos.some((p) => !p.visible && p.nota));
ok("…comprimido (gzip)", r.crudo.isBase64Encoded && r.cabeceras["content-encoding"] === "gzip", `${r.crudo.body.length} B en base64 de ${r.texto.length} B`);
ok("…sin caché", r.cabeceras["cache-control"] === "no-store");
ok("…con la huella y el origen de cada registro", admin.registros["producto:0001"]?.huella === "vieja-0001" && admin.registros["producto:0001"].deCsv === true);
ok("…el vocabulario lo pone el servidor", admin.vocabulario.familias.includes("Gourmand"));
ok("…y sin token de GitHub no hay publicación automática", admin.publicacion.automatica === false && admin.publicacion.pendiente === true);

// ── Guardar ────────────────────────────────────────────────────────────────
const yara = admin.catalogo.productos.find((p) => p.codigo === "0001");
r = await pedir("PUT", "/admin/catalogo/producto/0001", { tok: ADMIN, cuerpo: { datos: { ...yara, agotado: true }, huella: "vieja-0001" } });
ok("marcar agotado: 200", r.estado === 200 && r.json.sinCambios === false, JSON.stringify(r.json).slice(0, 120));
const huella1 = r.json.huella;
const fila = t.get("PRODUCTO#0001");
ok("la fila guarda el cambio, quién y cuándo", fila.datos.agotado === true && fila.editadoPor === "Admin Prueba" && Boolean(fila.editadoEn));
ok("y anota lo que decía el CSV antes del cambio (fuente)", fila.fuente?.agotado === false && fila.fuente.codigo === "0001");
ok("el catálogo queda con un cambio sin publicar", t.get("META#CATALOGO").generado > "2026-09-23T06:00:03.075Z");

r = await pedir("PUT", "/admin/catalogo/producto/0001", { tok: ADMIN, cuerpo: { datos: { ...yara, nombre: "Otro" }, huella: "vieja-0001" } });
ok("guardar con una huella vieja: 409 (no pisa al otro)", r.estado === 409, r.json?.error);
r = await pedir("PUT", "/admin/catalogo/producto/0001", { tok: ADMIN, cuerpo: { datos: { ...yara, agotado: true }, huella: huella1 } });
ok("guardar lo mismo: sin cambios", r.estado === 200 && r.json.sinCambios === true);
r = await pedir("PUT", "/admin/catalogo/producto/0001", { tok: ADMIN, cuerpo: { datos: { ...yara, familia: "Dulce", presentaciones: [] }, huella: huella1 } });
ok("datos inválidos: 422 con los campos", r.estado === 422 && r.json.errores.some((e) => e.campo === "familia") && r.json.errores.some((e) => e.campo === "presentaciones"), JSON.stringify(r.json?.errores));

// ── La tienda lo ve en el acto ─────────────────────────────────────────────
r = await pedir("GET", "/disponibilidad", { gzip: true });
const disp = r.json;
ok("GET /disponibilidad: 0001 ya sale agotado", disp.productos.find((p) => p.codigo === "0001")?.agotado === true);
ok("…sin ocultos, cacheable 30 s", disp.productos.every((p) => p.visible) && r.cabeceras["cache-control"] === "public, max-age=30");
ok("…y pesa poco", r.texto.length < 60_000, `${Math.round(r.texto.length / 1024)} KB`);
r = await pedir("POST", "/pedidos", { cuerpo: { items: [{ productoId: "0001", ml: 100, cantidad: 1 }], metodo: "clip", envio: "estandar", cupon: null, contacto: { nombre: "Prueba", telefono: "5500000000" } } });
ok("y el servidor ya no lo cobra (422)", r.estado === 422, `${r.estado}`);

// ── Alta con foto ──────────────────────────────────────────────────────────
const nuevo = {
  ...yara, codigo: "0999", slug: "lattafa-prueba", nombre: "Prueba", agotado: false, codigosAlternos: [],
  imagenes: [{ clave: "productos/0999/0123456789abcdef.webp", ancho: 600, alto: 800, blur: "data:image/webp;base64,UklGRg==" }],
};
r = await pedir("PUT", "/admin/catalogo/producto/0999", { tok: ADMIN, cuerpo: { datos: nuevo, huella: null } });
ok("alta con una foto que no se subió: 422 en imagenes", r.estado === 422 && r.json.errores[0]?.campo === "imagenes", JSON.stringify(r.json));
r = await pedir("POST", "/admin/imagenes", { tok: ADMIN, cuerpo: { tipo: "producto", codigo: "0999", sha256: "0123456789abcdef".repeat(4), formato: "webp" } });
ok("pedir dónde subir la foto: clave con su huella", r.estado === 200 && r.json.clave === "productos/0999/0123456789abcdef.webp", r.json?.clave);
ok("la URL no trae la suma de un cuerpo vacío", !new URL(r.json.url).searchParams.has("x-amz-checksum-crc32"), r.json.url.split("?")[1]?.slice(0, 80));
ok("y se sube con tipo y caché de un año", r.json.cabeceras["content-type"] === "image/webp" && r.json.cabeceras["cache-control"].includes("immutable"));
const subida = await fetch(r.json.url, { method: "PUT", headers: r.json.cabeceras, body: "una foto webp de verdad" });
ok("subir la foto por la URL prefirmada funciona", subida.ok && objetos.get(r.json.clave)?.cache?.includes("immutable"), `HTTP ${subida.status}`);
r = await pedir("PUT", "/admin/catalogo/producto/0999", { tok: ADMIN, cuerpo: { datos: nuevo, huella: null } });
ok("con la foto arriba, el alta pasa", r.estado === 200, JSON.stringify(r.json).slice(0, 150));
ok("un alta del panel no lleva fuente (no vino del CSV)", t.get("PRODUCTO#0999")?.fuente === undefined && t.get("PRODUCTO#0999")?.editadoEn);
r = await pedir("PUT", "/admin/catalogo/producto/0002", { tok: ADMIN, cuerpo: { datos: { ...nuevo, codigo: "0002", slug: "otra-cosa" }, huella: null } });
ok("dar de alta un código que ya existe: 409", r.estado === 409, r.json?.error);
r = await pedir("POST", "/admin/imagenes", { tok: ADMIN, cuerpo: { tipo: "producto", codigo: "../x", sha256: "a".repeat(64), formato: "webp" } });
ok("una ruta inventada para la foto: 400", r.estado === 400);

// ── Borrar ─────────────────────────────────────────────────────────────────
const marcaUsada = yara.marca;
r = await pedir("DELETE", `/admin/catalogo/marca/${marcaUsada}`, { tok: ADMIN, query: { huella: `vieja-${marcaUsada}` } });
ok("una marca con perfumes no se borra: 409", r.estado === 409 && r.json.usos.length > 0, r.json?.error);
const h999 = t.get("PRODUCTO#0999").huella;
r = await pedir("DELETE", "/admin/catalogo/producto/0999", { tok: ADMIN, query: { huella: h999 } });
ok("lo creado en el panel se borra de verdad", r.estado === 200 && !t.has("PRODUCTO#0999"));
const enLote = new Set(catalogo.lotes.flatMap((l) => l.modelos));
const borrable = catalogo.productos.find((p) => p.visible && !enLote.has(p.codigo) && p.codigo !== "0001");
r = await pedir("DELETE", `/admin/catalogo/producto/${borrable.codigo}`, { tok: ADMIN, query: { huella: `vieja-${borrable.codigo}` } });
ok(`lo que vino del CSV (${borrable.codigo}) queda como marca de borrado`, r.estado === 200 && t.get(`PRODUCTO#${borrable.codigo}`)?.borrado === true);
r = await pedir("GET", "/catalogo", { gzip: true });
ok("…y ya no se publica", !r.json.productos.some((p) => p.codigo === borrable.codigo));

// ── Exportar ───────────────────────────────────────────────────────────────
r = await pedir("GET", "/admin/exportar", { tok: ADMIN, query: { archivo: "productos" } });
const lineas = r.texto.split("\r\n");
ok("exportar productos.csv: con BOM y la cabecera del CSV", r.estado === 200 && r.texto.startsWith("﻿codigo,codigos_alternos,slug"), r.cabeceras["content-type"]);
ok("…con lo del panel (0001 agotado)", lineas.some((l) => l.startsWith("0001,") && l.includes(",si,si,")));

// ── Publicar ───────────────────────────────────────────────────────────────
r = await pedir("POST", "/admin/publicar", { tok: ADMIN });
ok("publicar sin token de GitHub: 503 que lo explica", r.estado === 503 && r.json.error.includes("próximo despliegue"));

// ── La carga del CSV respeta el panel ──────────────────────────────────────
const correr = (script, args = [], cwd = RAIZ) =>
  new Promise((resolver) => {
    const hijo = spawn(process.execPath, [join(RAIZ, "node_modules", "tsx", "dist", "cli.mjs"), join(RAIZ, "scripts", script), ...args], {
      env: { ...process.env, ...entorno },
      cwd,
    });
    let salida = "";
    hijo.stdout.on("data", (c) => (salida += c));
    hijo.stderr.on("data", (c) => (salida += c));
    hijo.on("close", (codigo) => resolver({ codigo, salida: salida.trim() }));
  });

const generadoAntes = t.get("META#CATALOGO").generado;
let s = await correr("catalogo-subir.ts");
console.log("▸ primera carga:", s.salida.split("\n").filter((l) => !l.startsWith("·")).join(" | "));
ok("la carga termina bien", s.codigo === 0);
ok("0001 sigue agotado: la carga no pisó el panel", t.get("PRODUCTO#0001").datos.agotado === true);
ok("lo borrado en el panel no resucita", t.get(`PRODUCTO#${borrable.codigo}`)?.borrado === true);
ok("todas las filas quedan con su fuente", [...t.values()].filter((f) => f.PK !== "META" && f.SK !== "0999").every((f) => f.fuente));
ok("anotar la fuente no cuenta como cambio (no recompila)", t.get("META#CATALOGO").generado === generadoAntes);
s = await correr("catalogo-subir.ts");
ok("la segunda carga no escribe nada", /0 fila\(s\) con cambios escritas, 0 borradas/.test(s.salida) && !/anotada/.test(s.salida), s.salida.split("\n").find((l) => l.startsWith("✓")));

// El CSV «anterior» decía 111 y ahora dice lo del repositorio: el precio
// cambió en el CSV, el agotado en el panel. Se quedan los dos.
const f1 = t.get("PRODUCTO#0001");
f1.fuente = { ...f1.fuente, presentaciones: [{ ml: 100, precio: 111 }] };
f1.datos = { ...f1.datos, presentaciones: [{ ml: 100, precio: 111 }] };
s = await correr("catalogo-subir.ts");
const final = t.get("PRODUCTO#0001").datos;
ok("CSV cambia el precio y el panel el agotado: quedan los dos", final.agotado === true && final.presentaciones[0].precio === yara.presentaciones[0].precio, `${final.presentaciones[0].precio}, agotado ${final.agotado}`);
ok("y ese cambio sí mueve la fecha (hay que publicar)", t.get("META#CATALOGO").generado > generadoAntes);

// Un CSV exportado del panel trae la foto como clave (columna `foto`). Si esa
// clave no está en el bucket, la carga se detiene sin escribir nada.
const { ARCHIVOS_CSV, escribirCSV, filasCsv } = await import("./.generado/puras.mjs");
const carpetaCsv = await mkdtemp(join(tmpdir(), "catalogo-"));
await mkdir(join(carpetaCsv, "catalogo"));
const claveNueva = "productos/0998/fedcba9876543210.webp";
const exportado = {
  ...catalogo,
  productos: [...catalogo.productos, { ...yara, codigo: "0998", slug: "lattafa-exportado", nombre: "Exportado", codigosAlternos: [], imagenes: [{ clave: claveNueva, ancho: 600, alto: 800, blur: "" }] }],
};
for (const a of ARCHIVOS_CSV) await writeFile(join(carpetaCsv, "catalogo", `${a}.csv`), escribirCSV(filasCsv(exportado, a)), "utf8");
s = await correr("catalogo-subir.ts", [], carpetaCsv);
ok("una clave de la columna foto que no está en el bucket detiene la carga", s.codigo !== 0 && s.salida.includes("no está en el bucket") && !t.has("PRODUCTO#0998"), s.salida.split("\n").filter((x) => x.includes("bucket")).join(" | "));
objetos.set(claveNueva, {});
s = await correr("catalogo-subir.ts", [], carpetaCsv);
ok("con la foto en el bucket, el alta carga con su foto y sin tocar lo demás", s.codigo === 0 && t.get("PRODUCTO#0998")?.datos.imagenes[0]?.clave === claveNueva && t.get("PRODUCTO#0001").datos.agotado === true, s.salida.split("\n").find((x) => x.startsWith("✓")));
await rm(carpetaCsv, { recursive: true, force: true });

s = await correr("catalogo-publicado.ts");
ok("catalogo:publicado anota el catálogo compilado", s.codigo === 0 && t.get("META#CATALOGO").publicado === catalogo.generado, s.salida);

console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} PRUEBAS FALLARON`}  (${cuenta.escrituras} escrituras, ${cuenta.borrados} borrados)`);
cerrar();
process.exit(fallos ? 1 : 0);
