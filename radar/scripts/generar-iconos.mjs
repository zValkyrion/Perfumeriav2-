// Genera los iconos de la app desde un SVG. Se corre a mano cuando cambia el
// arte: `node scripts/generar-iconos.mjs`. Usa el sharp que ya vive en la
// landing, para no sumar una dependencia a esta app por tres archivos PNG.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../"));
const sharp = require("sharp");

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="rojo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#EF372B"/>
      <stop offset="1" stop-color="#D21D13"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#12151A"/>
  <path d="M136 336 L118 182 L190 242 L256 152 L322 242 L394 182 L376 336 Z" fill="url(#rojo)"/>
  <rect x="136" y="352" width="240" height="44" rx="12" fill="url(#rojo)"/>
  <circle cx="256" cy="268" r="20" fill="#12151A"/>
</svg>`;

writeFileSync(join(raiz, "public/icono.svg"), svg);

for (const tamano of [180, 192, 512]) {
  await sharp(Buffer.from(svg))
    .resize(tamano, tamano)
    .png()
    .toFile(join(raiz, `public/icono-${tamano}.png`));
  console.log(`public/icono-${tamano}.png`);
}
