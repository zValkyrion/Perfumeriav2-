/**
 * Generador de la imagen Open Graph del sitio.
 *
 * La exportación estática no puede usar `opengraph-image.tsx` con
 * `ImageResponse`: esa API compone la imagen en tiempo de petición y aquí no
 * hay servidor. Así que el arte se genera una vez, se commitea en `public/og/`
 * y las páginas lo referencian como cualquier otro asset.
 *
 * Misma técnica que scripts/generar-imagenes.ts: SVG rasterizado con sharp.
 *
 *   npx tsx scripts/generar-og.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ANCHO = 1200;
const ALTO = 630;

const publico = join(process.cwd(), "public", "og");

/** Tokens del §6.1, los mismos que globals.css. */
const ORO = "#c9a227";
const ORO_CLARO = "#e8c766";
const ORO_HONDO = "#8c6f14";
const FONDO = "#0a0a0b";

/**
 * Frasco de perfume estilizado, el mismo lenguaje visual que el arte de
 * producto: silueta simple, líquido con degradado, tapón sólido.
 */
function frasco(x: number, y: number, escala: number, opacidad: number): string {
  const w = 150 * escala;
  const h = 210 * escala;
  const cuelloW = w * 0.3;
  const cuelloH = h * 0.12;
  const taponH = h * 0.1;

  return `
    <g transform="translate(${x} ${y})" opacity="${opacidad}">
      <rect x="${-cuelloW / 2}" y="${-cuelloH - taponH}" width="${cuelloW}" height="${taponH}" rx="${taponH * 0.25}" fill="url(#oro)"/>
      <rect x="${-cuelloW / 2.6}" y="${-cuelloH}" width="${cuelloW / 1.3}" height="${cuelloH}" fill="${ORO_HONDO}" opacity="0.85"/>
      <rect x="${-w / 2}" y="0" width="${w}" height="${h}" rx="${w * 0.1}" fill="url(#vidrio)" stroke="url(#oro)" stroke-width="${1.5 * escala}"/>
      <rect x="${-w / 2 + w * 0.09}" y="${h * 0.34}" width="${w - w * 0.18}" height="${h * 0.58}" rx="${w * 0.06}" fill="url(#liquido)"/>
    </g>`;
}

function svg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <defs>
    <linearGradient id="oro" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ORO_HONDO}"/>
      <stop offset="45%" stop-color="${ORO_CLARO}"/>
      <stop offset="100%" stop-color="${ORO}"/>
    </linearGradient>
    <linearGradient id="liquido" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${ORO_CLARO}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${ORO_HONDO}" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="vidrio" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.72" cy="0.5" r="0.55">
      <stop offset="0%" stop-color="${ORO}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${ORO}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}"/>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#halo)"/>

  <!-- Tres frascos escalonados a la derecha: menudeo, mayoreo, volumen. -->
  ${frasco(1035, 265, 0.85, 0.45)}
  ${frasco(900, 240, 1.05, 0.75)}
  ${frasco(752, 210, 1.25, 1)}

  <!-- Filete superior de oro, la misma firma del header del sitio. -->
  <rect x="0" y="0" width="${ANCHO}" height="6" fill="url(#oro)"/>

  <g transform="translate(80 236)">
    <text x="0" y="0" font-family="Georgia, 'Times New Roman', serif" font-size="66" font-weight="700" fill="#f5f3ef" letter-spacing="1">EL REY DE LOS</text>
    <text x="0" y="82" font-family="Georgia, 'Times New Roman', serif" font-size="66" font-weight="700" fill="url(#oro)" letter-spacing="1">PERFUMES</text>
    <rect x="2" y="122" width="86" height="3" fill="url(#oro)"/>
    <text x="0" y="176" font-family="Arial, Helvetica, sans-serif" font-size="27" fill="#b8b4ac">Perfumería fina al mayoreo y menudeo</text>
    <text x="0" y="216" font-family="Arial, Helvetica, sans-serif" font-size="27" fill="#b8b4ac">Envío gratis a todo México desde 3 piezas</text>
  </g>
</svg>`;
}

async function main() {
  await mkdir(publico, { recursive: true });

  // JPEG y no WebP: Facebook y WhatsApp siguen siendo irregulares con WebP en
  // las tarjetas de enlace, y aquí el peso no es crítico.
  const jpg = await sharp(Buffer.from(svg()))
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  await writeFile(join(publico, "portada.jpg"), jpg);
  console.log(`Listo: public/og/portada.jpg (${ANCHO}×${ALTO}, ${Math.round(jpg.length / 1024)} kB)`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
