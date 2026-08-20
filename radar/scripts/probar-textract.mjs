/**
 * Prueba del lector de listas de precios contra producción.
 *
 *   RADAR_PIN=xxxxxxxx node scripts/probar-textract.mjs
 *
 * Genera una hoja como las que cuelgan en un mostrador, la sube y comprueba qué
 * entendió Textract. Cubre los formatos de importe que de verdad aparecen en
 * México: sin separador, con coma de miles y con punto de miles.
 *
 * Crea una ficha de prueba y la borra al terminar.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// sharp vive en la landing; no hace falta duplicarlo aquí solo para esto.
// Apuntar al package.json y no a la carpeta: createRequire resuelve desde un
// archivo, y con una ruta de directorio busca un nivel más arriba de la cuenta.
const require = createRequire(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../package.json"),
);
const sharp = require("sharp");

const API = process.argv[2] ?? "https://qdn0ihicj6.execute-api.us-east-1.amazonaws.com";
const PIN = process.env.RADAR_PIN;
if (!PIN) {
  console.error("Falta el PIN: RADAR_PIN=xxxxxxxx node scripts/probar-textract.mjs");
  process.exit(1);
}

let fallos = 0;
const ok = (n, c, d = "") => {
  console.log(`${c ? "PASA" : "FALLA"}  ${n}${d ? ` — ${d}` : ""}`);
  if (!c) fallos++;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="620">
  <rect width="760" height="620" fill="white"/>
  <text x="40" y="60" font-family="Arial" font-size="30" font-weight="bold">LISTA DE PRECIOS</text>
  <text x="40" y="130" font-family="Arial" font-size="26">Sauvage inspirado 100 ml 450</text>
  <text x="40" y="180" font-family="Arial" font-size="26">One Million 100 ml 430</text>
  <text x="40" y="230" font-family="Arial" font-size="26">Bleu de Chanel 50 ml 260</text>
  <text x="40" y="280" font-family="Arial" font-size="26">Good Girl 30 ml 180</text>
  <text x="40" y="330" font-family="Arial" font-size="26">Esencia a granel 1000 ml 2800</text>
  <text x="40" y="380" font-family="Arial" font-size="26">Lote surtido 24 pzas 1,500.00</text>
  <text x="40" y="430" font-family="Arial" font-size="26">Kit inicio 50 ml 1.250</text>
  <text x="40" y="500" font-family="Arial" font-size="22">Mayoreo desde 12 piezas</text>
</svg>`;

const hoja = await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
console.log(`hoja generada: ${hoja.length} bytes\n`);

const pedir = (ruta, token, op = {}) =>
  fetch(`${API}${ruta}`, {
    ...op,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  });

const acceso = await (
  await fetch(`${API}/acceso`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin: PIN, evaluador: "Prueba Textract" }),
  })
).json();
const token = acceso.token;

const id = `textract-${Date.now()}`;
await pedir(`/proveedores/${id}`, token, {
  method: "PUT",
  body: JSON.stringify({
    id,
    nombre: "Prueba Textract",
    precios: [],
    promociones: [],
    ejes: {},
    banderas: [],
    actualizadoEn: new Date().toISOString(),
  }),
});

const fotoId = "lista-prueba";
const { url } = await (
  await pedir("/fotos", token, {
    method: "POST",
    body: JSON.stringify({
      proveedorId: id,
      fotoId,
      tipo: "lista_precios",
      contentType: "image/jpeg",
      tomadaEn: new Date().toISOString(),
      lat: null,
      lng: null,
    }),
  })
).json();

const subida = await fetch(url, {
  method: "PUT",
  body: hoja,
  headers: { "content-type": "image/jpeg" },
});
ok("la hoja sube a S3", subida.ok, `HTTP ${subida.status}`);

const inicio = Date.now();
const res = await pedir("/precios/leer", token, {
  method: "POST",
  body: JSON.stringify({ proveedorId: id, fotoId }),
});
const lectura = await res.json();
ok("la API responde 200", res.status === 200, `${((Date.now() - inicio) / 1000).toFixed(1)}s`);
ok("devuelve renglones", (lectura.filas?.length ?? 0) > 0, `${lectura.filas?.length} filas`);

console.log("\n--- lo que leyó ---");
for (const f of lectura.filas ?? []) {
  console.log(`  ${String(f.precio ?? "—").padStart(7)}  ${(f.ml ? f.ml + "ml" : "").padStart(6)}  ${f.texto}`);
}
console.log("");

const buscar = (t) => (lectura.filas ?? []).find((f) => f.texto.includes(t));
const comprobar = (etiqueta, texto, precio, ml) => {
  const f = buscar(texto);
  ok(etiqueta, f?.precio === precio && f?.ml === ml, `precio=${f?.precio} ml=${f?.ml}`);
};

// El volumen nunca debe confundirse con el importe.
comprobar("Sauvage: 450, no el 100 del volumen", "Sauvage", 450, 100);
comprobar("Bleu de Chanel: 260 en 50 ml", "Bleu", 260, 50);
// Cuatro cifras sin separador: el caso que antes se leía diez veces más barato.
comprobar("Granel: 2800 y no 280", "granel", 2800, 1000);
// Coma como separador de miles y punto decimal.
comprobar("Lote surtido: 1,500.00 son 1500", "Lote surtido", 1500, null);
// Punto como separador de miles, que es lo común en México escrito a mano.
comprobar("Kit inicio: 1.250 son 1250", "Kit inicio", 1250, 50);

await pedir(`/proveedores/${id}`, token, { method: "DELETE" });
ok("ficha de prueba borrada", true);

console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} PRUEBAS FALLARON`}`);
process.exit(fallos === 0 ? 0 : 1);
