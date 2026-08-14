/**
 * Generador de arte de producto.
 *
 * El §4.1 admite "SVGs generados localmente" como alternativa a Unsplash, y es
 * la que elegimos: el hotlink a Unsplash produce imágenes rotas, penaliza
 * Lighthouse y hace que dos productos distintos compartan foto. Aquí cada
 * fragancia recibe un flacón determinista construido a partir de su familia
 * olfativa y su concentración, rasterizado a WebP con sharp.
 *
 *   npm run imagenes
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";

import { PRODUCTOS } from "../src/data/productos";
import { LOTES } from "../src/data/lotes";
import { MODELOS_DE_SET, SETS } from "../src/data/sets";
import { CATEGORIAS } from "../src/data/taxonomia";
import type { Concentracion, FamiliaOlfativa } from "../src/types";

const raiz = join(process.cwd());
const publico = join(raiz, "public");

/* ── Utilidades deterministas (espejo de src/lib/rand.ts) ─────────────── */

function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const rand01 = (s: string) => hash(s) / 0x100000000;
const rango = (s: string, min: number, max: number) =>
  min + rand01(s) * (max - min);

/* ── Paleta por familia olfativa ──────────────────────────────────────── */

interface Paleta {
  a: string;
  b: string;
  liquido: string;
}

const FAMILIAS: Record<FamiliaOlfativa, Paleta> = {
  Amaderado: { a: "#8C6F14", b: "#3A2E0A", liquido: "#B98F2E" },
  Oriental: { a: "#B5651D", b: "#42200A", liquido: "#D08238" },
  Floral: { a: "#C2708F", b: "#45202F", liquido: "#DE93AE" },
  Cítrico: { a: "#B7BF3A", b: "#3D4212", liquido: "#D6DE63" },
  Fougère: { a: "#5F8A5F", b: "#1C2E1B", liquido: "#7FAE7F" },
  Chipre: { a: "#7A6A4F", b: "#2A2418", liquido: "#9C8A69" },
  Gourmand: { a: "#A9713F", b: "#3A2413", liquido: "#C68F58" },
  Acuático: { a: "#4A8FA8", b: "#122C36", liquido: "#6FB3CB" },
  Especiado: { a: "#A8453A", b: "#3A1310", liquido: "#C4655A" },
};

const PALETAS = Object.values(FAMILIAS);

interface Forma {
  w: number;
  h: number;
  rx: number;
  capW: number;
  capH: number;
  cuello: number;
}

/** Geometría del frasco según la concentración. */
const FORMAS: Record<Concentracion, Forma> = {
  Parfum: { w: 360, h: 420, rx: 10, capW: 200, capH: 118, cuello: 40 },
  "Eau de Parfum": { w: 306, h: 520, rx: 14, capW: 156, capH: 100, cuello: 44 },
  "Eau de Toilette": { w: 286, h: 540, rx: 46, capW: 138, capH: 94, cuello: 40 },
  "Eau de Cologne": { w: 252, h: 576, rx: 22, capW: 116, capH: 88, cuello: 38 },
  "Body Mist": { w: 214, h: 620, rx: 104, capW: 128, capH: 104, cuello: 30 },
};

const ORO = { claro: "#E8C766", medio: "#C9A227", oscuro: "#6E570F" };

interface OpcionesFlacon {
  id: string;
  forma: Forma;
  fam: Paleta;
  cx: number;
  baseY: number;
  escala?: number;
}

/**
 * Dibuja el frasco completo, con su base en (cx, baseY). Sin filtros SVG:
 * librsvg los soporta de forma irregular, así que los brillos y las sombras se
 * construyen apilando degradados.
 */
function flacon({ id, forma, fam, cx, baseY, escala = 1 }: OpcionesFlacon) {
  const { w, h, rx, capW, capH, cuello } = forma;
  const x = -w / 2;
  const yCuerpo = -h;
  const yCuello = yCuerpo - cuello;
  const yTapa = yCuello - capH;
  const nivel = yCuerpo + h * 0.16;

  return `
  <g transform="translate(${cx} ${baseY}) scale(${escala})">
    <ellipse cx="0" cy="14" rx="${w * 0.72}" ry="${w * 0.13}" fill="url(#sombra-${id})"/>
    <ellipse cx="0" cy="8" rx="${w * 0.95}" ry="${w * 0.17}" fill="url(#pool-${id})"/>

    <g opacity="0.26" transform="scale(1 -0.42)">
      <rect x="${x}" y="${yCuerpo}" width="${w}" height="${h}" rx="${rx}" fill="url(#reflejo-${id})"/>
    </g>

    <rect x="${x}" y="${yCuerpo}" width="${w}" height="${h}" rx="${rx}" fill="url(#vidrio-${id})"/>

    <path d="M ${x + 3} ${nivel} H ${x + w - 3} V ${yCuerpo + h - rx * 0.7}
             a ${rx} ${rx} 0 0 1 ${-rx} ${rx * 0.7} H ${x + rx}
             a ${rx} ${rx} 0 0 1 ${-rx} ${-rx * 0.7} Z"
          fill="url(#liquido-${id})"/>
    <rect x="${x + 3}" y="${nivel - 3}" width="${w - 6}" height="6" rx="3" fill="${fam.liquido}" opacity="0.55"/>

    <rect x="${x + w * 0.09}" y="${yCuerpo + 14}" width="${w * 0.1}" height="${h - 34}" rx="${w * 0.05}" fill="url(#brillo-${id})"/>
    <rect x="${x + w * 0.78}" y="${yCuerpo + 26}" width="${w * 0.055}" height="${h - 62}" rx="${w * 0.03}" fill="url(#brillo-${id})" opacity="0.5"/>

    <rect x="${x}" y="${yCuerpo}" width="${w}" height="${h}" rx="${rx}"
          fill="none" stroke="url(#canto-${id})" stroke-width="2"/>

    <rect x="${x + w * 0.2}" y="${yCuerpo + h * 0.46}" width="${w * 0.6}" height="${h * 0.2}" rx="4"
          fill="#0A0A0B" opacity="0.30"/>
    <rect x="${x + w * 0.2}" y="${yCuerpo + h * 0.46}" width="${w * 0.6}" height="${h * 0.2}" rx="4"
          fill="none" stroke="${ORO.medio}" stroke-width="1.4" opacity="0.75"/>
    <rect x="${x + w * 0.28}" y="${yCuerpo + h * 0.525}" width="${w * 0.44}" height="3" rx="1.5" fill="${ORO.claro}" opacity="0.85"/>
    <rect x="${x + w * 0.34}" y="${yCuerpo + h * 0.575}" width="${w * 0.32}" height="2" rx="1" fill="${ORO.claro}" opacity="0.5"/>

    <rect x="${-capW * 0.3}" y="${yCuello}" width="${capW * 0.6}" height="${cuello + 8}" fill="url(#metal-${id})"/>
    <rect x="${-capW / 2}" y="${yTapa}" width="${capW}" height="${capH}" rx="6" fill="url(#tapa-${id})"/>
    <rect x="${-capW / 2}" y="${yTapa + capH * 0.72}" width="${capW}" height="7" fill="${ORO.oscuro}" opacity="0.85"/>
    <rect x="${-capW / 2 + capW * 0.12}" y="${yTapa + 6}" width="${capW * 0.16}" height="${capH * 0.62}" rx="4" fill="#FFFFFF" opacity="0.3"/>
  </g>`;
}

/** Degradados, con identificador único por imagen para que no colisionen. */
function defs(id: string, fam: Paleta, semilla: string) {
  const giro = Math.round(rango(`${semilla}-giro`, -12, 12));
  return `
    <radialGradient id="fondo-${id}" cx="50%" cy="38%" r="78%">
      <stop offset="0%" stop-color="${fam.b}" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#101014"/>
      <stop offset="100%" stop-color="#08080A"/>
    </radialGradient>
    <radialGradient id="halo-${id}" cx="50%" cy="34%" r="46%">
      <stop offset="0%" stop-color="${fam.a}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${fam.a}" stop-opacity="0"/>
    </radialGradient>
    <!-- Sombra neutra: se lee como apoyo tanto sobre fondo claro como oscuro,
         a diferencia de un charco de color que solo funciona en oscuro. -->
    <radialGradient id="sombra-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pool-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${fam.a}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${fam.a}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vidrio-${id}" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${giro} 0.5 0.5)">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.16"/>
      <stop offset="42%" stop-color="${fam.b}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
    </linearGradient>
    <linearGradient id="liquido-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${fam.liquido}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${fam.b}" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="brillo-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="28%" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="72%" stop-color="#FFFFFF" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="canto-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.34"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.26"/>
    </linearGradient>
    <linearGradient id="tapa-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ORO.oscuro}"/>
      <stop offset="45%" stop-color="${ORO.claro}"/>
      <stop offset="100%" stop-color="${ORO.medio}"/>
    </linearGradient>
    <linearGradient id="metal-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${ORO.oscuro}"/>
      <stop offset="50%" stop-color="${ORO.claro}"/>
      <stop offset="100%" stop-color="${ORO.oscuro}"/>
    </linearGradient>
    <linearGradient id="reflejo-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${fam.a}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${fam.a}" stop-opacity="0.55"/>
    </linearGradient>
    <radialGradient id="vineta-${id}" cx="50%" cy="45%" r="72%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.72"/>
    </radialGradient>`;
}

const W = 900;
const H = 1200;

interface SujetoProducto {
  slug: string;
  familia: FamiliaOlfativa;
  concentracion: Concentracion;
}

/** Cuatro encuadres distintos, para que el hover y la galería aporten algo. */
function svgProducto(
  producto: SujetoProducto,
  variante: number,
  /** Solo el hero lleva fondo: es una imagen a pantalla completa. */
  conFondo = false,
) {
  const fam = FAMILIAS[producto.familia];
  const forma = FORMAS[producto.concentracion];
  const id = hash(producto.slug + variante).toString(36);
  const semilla = `${producto.slug}-${variante}`;

  // Los cinco tipos de frasco tienen alturas muy distintas. Normalizamos para
  // que todos ocupen lo mismo en el encuadre: en una cuadrícula de catálogo,
  // frascos de tamaños dispares se leen como un error de maquetación.
  const alto = forma.h + forma.cuello + forma.capH;
  const base = 720 / alto;

  let cuerpo: string;

  if (variante === 1) {
    cuerpo = flacon({ id, forma, fam, cx: 450, baseY: 985, escala: base });
  } else if (variante === 2) {
    cuerpo = `
      <g opacity="0.3">${flacon({ id: `${id}b`, forma, fam, cx: 648, baseY: 902, escala: base * 0.72 })}</g>
      ${flacon({ id, forma, fam, cx: 372, baseY: 1010, escala: base * 1.12 })}`;
  } else if (variante === 3) {
    // Detalle de tapa, hombro y placa: se amplía y se recorta por abajo,
    // nunca por arriba — cortar la tapa deja una mancha de color sin lectura.
    const escala = base * 2.05;
    const baseFinal = 90 + alto * escala;
    const tx = 450 - 450 * escala;
    const ty = baseFinal - 940 * escala;
    cuerpo = `<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${escala.toFixed(3)})">
        ${flacon({ id, forma, fam, cx: 450, baseY: 940 })}
      </g>`;
  } else {
    const bw = 430;
    const bh = 660;
    cuerpo = `
      <g transform="translate(520 950)">
        <rect x="${-bw / 2}" y="${-bh}" width="${bw}" height="${bh}" rx="8" fill="url(#vidrio-${id}b)"/>
        <rect x="${-bw / 2}" y="${-bh}" width="${bw}" height="${bh}" rx="8" fill="none" stroke="${ORO.medio}" stroke-width="2" opacity="0.6"/>
        <rect x="${-bw / 2 + 30}" y="${-bh + 46}" width="${bw - 60}" height="3" fill="${ORO.claro}" opacity="0.75"/>
        <rect x="${-bw / 2 + 74}" y="${-bh * 0.52}" width="${bw - 148}" height="2" fill="${ORO.claro}" opacity="0.45"/>
        <rect x="${-bw / 2 + 96}" y="${-bh * 0.46}" width="${bw - 192}" height="2" fill="${ORO.claro}" opacity="0.3"/>
      </g>
      ${flacon({ id, forma, fam, cx: 330, baseY: 995, escala: base * 0.86 })}`;
  }

  // Fondo transparente a propósito: el color lo pone el contenedor, así que la
  // misma imagen sirve para el tema oscuro y para el claro sin regenerar nada.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${defs(id, fam, semilla)}
    ${defs(`${id}b`, fam, `${semilla}b`)}
  </defs>
  ${conFondo ? `<rect width="${W}" height="${H}" fill="url(#fondo-${id})"/>` : ""}
  <ellipse cx="450" cy="430" rx="430" ry="430" fill="url(#halo-${id})"/>
  ${cuerpo}
  ${conFondo ? `<rect width="${W}" height="${H}" fill="url(#vineta-${id})"/>` : ""}
</svg>`;
}

interface OpcionesConjunto {
  slug: string;
  familia: FamiliaOlfativa;
  concentracion: Concentracion;
  piezas?: number;
  w?: number;
  h?: number;
}

/** Varios frascos en fila: lotes, sets y portadas de categoría. */
function svgConjunto({
  slug,
  familia,
  concentracion,
  piezas = 5,
  w = 1200,
  h = 900,
}: OpcionesConjunto) {
  const fam = FAMILIAS[familia];
  const forma = FORMAS[concentracion];
  const id = hash(slug).toString(36);
  const n = Math.max(3, Math.min(piezas, 7));
  const paso = w / (n + 1);

  const paletaDe = (i: number) => PALETAS[hash(`${slug}-${i}`) % PALETAS.length];

  const altoFrasco = forma.h + forma.cuello + forma.capH;
  const normal = 720 / altoFrasco;

  const frascos = Array.from({ length: n }, (_, i) => {
    const orden = Math.abs(i - (n - 1) / 2);
    const escala = (h / 1200) * normal * (0.86 - orden * 0.07);
    return `<g opacity="${(1 - orden * 0.1).toFixed(2)}">${flacon({
      id: `${id}-${i}`,
      forma,
      fam: paletaDe(i),
      cx: paso * (i + 1),
      baseY: h * 0.88 + orden * 16,
      escala,
    })}</g>`;
  }).join("\n");

  const defsPorFrasco = Array.from({ length: n }, (_, i) =>
    defs(`${id}-${i}`, paletaDe(i), `${slug}-${i}`),
  ).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    ${defs(id, fam, slug)}
    ${defsPorFrasco}
  </defs>
  <ellipse cx="${w / 2}" cy="${h * 0.42}" rx="${w * 0.52}" ry="${h * 0.5}" fill="url(#halo-${id})"/>
  ${frascos}
</svg>`;
}

/* ── Escritura ────────────────────────────────────────────────────────── */

async function escribir(svg: string, destino: string, ancho: number) {
  await mkdir(dirname(destino), { recursive: true });
  await sharp(Buffer.from(svg), { density: 150 })
    .resize(ancho)
    .webp({ quality: 82, effort: 4 })
    .toFile(destino);
}

/** Miniatura de 12px en base64 para el placeholder blur de next/image. */
async function blurDataURL(svg: string) {
  const salida = await sharp(Buffer.from(svg), { density: 60 })
    .resize(12)
    .webp({ quality: 30 })
    .toBuffer();
  return `data:image/webp;base64,${salida.toString("base64")}`;
}

/** Ambientación de cada portada de categoría. */
const AMBIENTE_CATEGORIA: Record<
  string,
  { familia: FamiliaOlfativa; concentracion: Concentracion }
> = {
  hombre: { familia: "Amaderado", concentracion: "Eau de Parfum" },
  mujer: { familia: "Floral", concentracion: "Parfum" },
  unisex: { familia: "Chipre", concentracion: "Eau de Parfum" },
  arabes: { familia: "Oriental", concentracion: "Parfum" },
  nicho: { familia: "Especiado", concentracion: "Eau de Parfum" },
  inspirados: { familia: "Gourmand", concentracion: "Eau de Toilette" },
  "body-mist": { familia: "Cítrico", concentracion: "Body Mist" },
};

async function main() {
  const blurs: Record<string, string> = {};
  let n = 0;

  for (const p of PRODUCTOS) {
    for (const v of [1, 2, 3, 4]) {
      const svg = svgProducto(p, v);
      await escribir(svg, join(publico, "productos", `${p.slug}-${v}.webp`), 900);
      if (v === 1) blurs[`/productos/${p.slug}-1.webp`] = await blurDataURL(svg);
      n++;
    }
  }

  for (const l of LOTES) {
    const svg = svgConjunto({
      slug: l.slug,
      familia: "Amaderado",
      concentracion: "Eau de Parfum",
      piezas: Math.round(l.piezas / 6) + 2,
      w: 1200,
      h: 900,
    });
    await escribir(svg, join(publico, "lotes", `${l.slug}.webp`), 1200);
    blurs[`/lotes/${l.slug}.webp`] = await blurDataURL(svg);
    n++;
  }

  for (const s of SETS) {
    const svg = svgConjunto({
      slug: s.slug,
      familia: "Floral",
      concentracion: "Parfum",
      piezas: MODELOS_DE_SET.get(s.slug)?.length ?? 3,
      w: 1200,
      h: 900,
    });
    await escribir(svg, join(publico, "sets", `${s.slug}.webp`), 1200);
    blurs[`/sets/${s.slug}.webp`] = await blurDataURL(svg);
    n++;
  }

  for (const c of CATEGORIAS) {
    const amb = AMBIENTE_CATEGORIA[c.slug] ?? {
      familia: "Amaderado" as const,
      concentracion: "Eau de Parfum" as const,
    };
    const svg = svgConjunto({
      slug: `cat-${c.slug}`,
      familia: amb.familia,
      concentracion: amb.concentracion,
      piezas: 3,
      w: 900,
      h: 1100,
    });
    await escribir(svg, join(publico, "categorias", `${c.slug}.webp`), 900);
    blurs[`/categorias/${c.slug}.webp`] = await blurDataURL(svg);
    n++;
  }

  const hero = svgProducto(
    { slug: "hero-aura", familia: "Amaderado", concentracion: "Parfum" },
    1,
    true,
  );
  await escribir(hero, join(publico, "hero.webp"), 1400);
  blurs["/hero.webp"] = await blurDataURL(hero);
  n++;

  const ts = `/* Generado por scripts/generar-imagenes.ts — no editar a mano. */
export const BLUR: Record<string, string> = ${JSON.stringify(blurs, null, 2)};

/** Placeholder blur de una imagen; \`undefined\` si no se generó. */
export function blurDe(src: string): string | undefined {
  return BLUR[src];
}
`;
  await writeFile(join(raiz, "src", "data", "blur.ts"), ts, "utf8");

  console.log(
    `Listo: ${n} imágenes y ${Object.keys(blurs).length} placeholders.`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
