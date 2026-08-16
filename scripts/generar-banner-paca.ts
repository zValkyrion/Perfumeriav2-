/**
 * Banner del hero: paca de 50 perfumes.
 *
 * Sustituye al arte promocional del 3x2. Está dibujado aquí y rasterizado con
 * sharp, no traído de fuera, por dos razones: es el elemento LCP de la home
 * —así que conviene controlar exactamente lo que pesa— y el texto se compone
 * como vector, de modo que la cifra se lee nítida en pantallas 2x sin subir la
 * resolución del archivo.
 *
 * El frasco reutiliza la geometría de `generar-imagenes.ts`: mismos degradados
 * apilados y ningún filtro SVG, que librsvg soporta de forma irregular.
 *
 *   npm run banner-paca
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const W = 2400;
const H = 890;

/** Margen inviolable a izquierda y derecha (ver la nota de zona segura). */
const SEGURO = 230;

/** Las cifras del Paquete Super Mayorista, en un solo sitio. */
const PRECIO = "$19,749";
const POR_PIEZA = "$395";

const ORO = { claro: "#E8C766", medio: "#C9A227", oscuro: "#6E570F" };

/** Paletas por familia: dan variedad de color a la fila de frascos. */
const PALETAS = [
  { a: "#8C6F14", b: "#3A2E0A", liquido: "#B98F2E" }, // amaderado
  { a: "#B5651D", b: "#42200A", liquido: "#D08238" }, // oriental
  { a: "#C2708F", b: "#45202F", liquido: "#DE93AE" }, // floral
  { a: "#4A8FA8", b: "#122C36", liquido: "#6FB3CB" }, // acuático
  { a: "#A8453A", b: "#3A1310", liquido: "#C4655A" }, // especiado
  { a: "#5F8A5F", b: "#1C2E1B", liquido: "#7FAE7F" }, // fougère
  { a: "#A9713F", b: "#3A2413", liquido: "#C68F58" }, // gourmand
];

interface Frasco {
  /** Centro horizontal y línea de apoyo. */
  cx: number;
  baseY: number;
  w: number;
  h: number;
  rx: number;
  capW: number;
  capH: number;
  cuello: number;
  paleta: (typeof PALETAS)[number];
}

/** Degradados del frasco `i`. Cada uno lleva sufijo propio para no colisionar. */
function defsFrasco(i: number, p: (typeof PALETAS)[number]) {
  return `
    <radialGradient id="sombra-${i}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pool-${i}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${p.a}" stop-opacity="0.40"/>
      <stop offset="100%" stop-color="${p.a}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vidrio-${i}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18"/>
      <stop offset="42%" stop-color="${p.b}" stop-opacity="0.70"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="liquido-${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.liquido}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${p.b}" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="brillo-${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/>
      <stop offset="28%" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="72%" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="canto-${i}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.36"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.28"/>
    </linearGradient>
    <linearGradient id="tapa-${i}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ORO.oscuro}"/>
      <stop offset="45%" stop-color="${ORO.claro}"/>
      <stop offset="100%" stop-color="${ORO.medio}"/>
    </linearGradient>
    <linearGradient id="metal-${i}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${ORO.oscuro}"/>
      <stop offset="50%" stop-color="${ORO.claro}"/>
      <stop offset="100%" stop-color="${ORO.oscuro}"/>
    </linearGradient>
    <linearGradient id="reflejo-${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.a}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${p.a}" stop-opacity="0.50"/>
    </linearGradient>`;
}

function frasco(i: number, f: Frasco) {
  const { cx, baseY, w, h, rx, capW, capH, cuello, paleta } = f;
  const x = -w / 2;
  const yCuerpo = -h;
  const yCuello = yCuerpo - cuello;
  const yTapa = yCuello - capH;
  const nivel = yCuerpo + h * 0.16;

  return `
  <g transform="translate(${cx} ${baseY})">
    <ellipse cx="0" cy="12" rx="${w * 0.8}" ry="${w * 0.14}" fill="url(#sombra-${i})"/>
    <ellipse cx="0" cy="6" rx="${w * 1.05}" ry="${w * 0.18}" fill="url(#pool-${i})"/>

    <g opacity="0.22" transform="scale(1 -0.38)">
      <rect x="${x}" y="${yCuerpo}" width="${w}" height="${h}" rx="${rx}" fill="url(#reflejo-${i})"/>
    </g>

    <rect x="${x}" y="${yCuerpo}" width="${w}" height="${h}" rx="${rx}" fill="url(#vidrio-${i})"/>

    <path d="M ${x + 2} ${nivel} H ${x + w - 2} V ${yCuerpo + h - rx * 0.7}
             a ${rx} ${rx} 0 0 1 ${-rx} ${rx * 0.7} H ${x + rx}
             a ${rx} ${rx} 0 0 1 ${-rx} ${-rx * 0.7} Z"
          fill="url(#liquido-${i})"/>
    <rect x="${x + 2}" y="${nivel - 2}" width="${w - 4}" height="4" rx="2" fill="${paleta.liquido}" opacity="0.55"/>

    <rect x="${x + w * 0.09}" y="${yCuerpo + 10}" width="${w * 0.1}" height="${h - 24}" rx="${w * 0.05}" fill="url(#brillo-${i})"/>
    <rect x="${x}" y="${yCuerpo}" width="${w}" height="${h}" rx="${rx}"
          fill="none" stroke="url(#canto-${i})" stroke-width="1.6"/>

    <rect x="${x + w * 0.2}" y="${yCuerpo + h * 0.46}" width="${w * 0.6}" height="${h * 0.2}" rx="3"
          fill="#0A0A0B" opacity="0.32"/>
    <rect x="${x + w * 0.2}" y="${yCuerpo + h * 0.46}" width="${w * 0.6}" height="${h * 0.2}" rx="3"
          fill="none" stroke="${ORO.medio}" stroke-width="1.2" opacity="0.75"/>
    <rect x="${x + w * 0.28}" y="${yCuerpo + h * 0.525}" width="${w * 0.44}" height="2.4" rx="1.2" fill="${ORO.claro}" opacity="0.85"/>

    <rect x="${-capW * 0.3}" y="${yCuello}" width="${capW * 0.6}" height="${cuello + 6}" fill="url(#metal-${i})"/>
    <rect x="${-capW / 2}" y="${yTapa}" width="${capW}" height="${capH}" rx="4" fill="url(#tapa-${i})"/>
    <rect x="${-capW / 2}" y="${yTapa + capH * 0.72}" width="${capW}" height="5" fill="${ORO.oscuro}" opacity="0.85"/>
    <rect x="${-capW / 2 + capW * 0.12}" y="${yTapa + 4}" width="${capW * 0.16}" height="${capH * 0.62}" rx="3" fill="#FFFFFF" opacity="0.3"/>
  </g>`;
}

/**
 * La fila de frascos.
 *
 * Dos hileras: una atrás, más pequeña y desplazada, y otra delante. Con nueve
 * piezas basta para leer "muchos frascos"; dibujar los cincuenta convertiría el
 * lado derecho en ruido.
 */
const FILA: Frasco[] = [
  // Fila trasera (apoyada más arriba, se lee como fondo)
  { cx: 1560, baseY: 612, w: 118, h: 214, rx: 8, capW: 62, capH: 42, cuello: 18, paleta: PALETAS[3]! },
  { cx: 1720, baseY: 606, w: 104, h: 246, rx: 26, capW: 56, capH: 38, cuello: 16, paleta: PALETAS[5]! },
  { cx: 1878, baseY: 612, w: 126, h: 200, rx: 6, capW: 70, capH: 46, cuello: 16, paleta: PALETAS[1]! },
  { cx: 2038, baseY: 606, w: 100, h: 240, rx: 10, capW: 54, capH: 40, cuello: 18, paleta: PALETAS[2]! },
  { cx: 2192, baseY: 612, w: 112, h: 208, rx: 24, capW: 60, capH: 40, cuello: 16, paleta: PALETAS[6]! },

  // Fila delantera (más grande y más baja: gana el primer plano)
  { cx: 1636, baseY: 742, w: 168, h: 292, rx: 10, capW: 92, capH: 62, cuello: 24, paleta: PALETAS[0]! },
  { cx: 1830, baseY: 742, w: 150, h: 340, rx: 34, capW: 80, capH: 54, cuello: 22, paleta: PALETAS[4]! },
  { cx: 2018, baseY: 742, w: 178, h: 268, rx: 8, capW: 100, capH: 66, cuello: 22, paleta: PALETAS[2]! },
  { cx: 2214, baseY: 742, w: 146, h: 318, rx: 12, capW: 78, capH: 56, cuello: 24, paleta: PALETAS[1]! },
];

function svg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A0A0B"/>
      <stop offset="55%" stop-color="#131215"/>
      <stop offset="100%" stop-color="#08080A"/>
    </linearGradient>
    <radialGradient id="halo" cx="72%" cy="46%" r="58%">
      <stop offset="0%" stop-color="${ORO.medio}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${ORO.medio}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#08080A" stop-opacity="0.94"/>
      <stop offset="46%" stop-color="#08080A" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#08080A" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="suelo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="oro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F3DFA0"/>
      <stop offset="48%" stop-color="${ORO.claro}"/>
      <stop offset="100%" stop-color="${ORO.medio}"/>
    </linearGradient>
    <radialGradient id="vineta" cx="50%" cy="45%" r="74%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.52"/>
    </radialGradient>
    ${FILA.map((f, i) => defsFrasco(i, f.paleta)).join("")}
  </defs>

  <rect width="${W}" height="${H}" fill="url(#fondo)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>

  <!-- Suelo de estudio: una banda clara bajo los frascos que los apoya -->
  <rect x="1180" y="600" width="${W - 1180}" height="290" fill="url(#suelo)"/>
  <rect x="1180" y="742" width="${W - 1180}" height="1.6" fill="#FFFFFF" opacity="0.10"/>

  <!-- La fila entera se corre a la izquierda para que el frasco del extremo no
       toque la zona que el recorte de móvil se lleva. -->
  <g transform="translate(-130 0)">${FILA.map((f, i) => frasco(i, f)).join("")}</g>

  <!-- El velo va por delante de los frascos: garantiza el contraste del texto
       pase lo que pase con la fila de la derecha. -->
  <rect x="0" y="0" width="1560" height="${H}" fill="url(#scrim)"/>

  <!-- Filo dorado superior e inferior, como el resto de franjas del sitio -->
  <rect x="0" y="0" width="${W}" height="4" fill="url(#oro)" opacity="0.85"/>
  <rect x="0" y="${H - 4}" width="${W}" height="4" fill="url(#oro)" opacity="0.85"/>

  <!-- Zona segura: en móvil el hero recorta a 21/9 con object-cover, lo que se
       come un 7% por cada lado. Nada legible baja de x=${SEGURO} ni pasa de
       x=${W - SEGURO}. -->
  <g font-family="'Arial Black', 'Arial Bold', Arial, sans-serif">
    <text x="${SEGURO}" y="212" font-family="Arial, Helvetica, sans-serif" font-size="34"
          font-weight="700" letter-spacing="10" fill="${ORO.claro}">PACA DE MAYOREO</text>

    <text x="${SEGURO}" y="380" font-size="152" font-weight="900" letter-spacing="-2"
          fill="#F7F5F1">50 PERFUMES</text>

    <text x="${SEGURO}" y="560" font-size="176" font-weight="900" letter-spacing="-4"
          fill="url(#oro)">${PRECIO}</text>
    <text x="${SEGURO + 740}" y="560" font-family="Arial, Helvetica, sans-serif" font-size="52"
          font-weight="700" fill="${ORO.medio}">MXN</text>

    <rect x="${SEGURO + 2}" y="626" width="640" height="2" fill="#FFFFFF" opacity="0.22"/>

    <text x="${SEGURO}" y="702" font-family="Arial, Helvetica, sans-serif" font-size="34"
          font-weight="700" letter-spacing="2" fill="#D9D5CE">ENVÍO GRATIS · ENTREGA INMEDIATA · CALIDAD 1:1</text>

    <text x="${SEGURO}" y="772" font-family="Arial, Helvetica, sans-serif" font-size="30"
          font-weight="700" letter-spacing="4" fill="${ORO.claro}">SOLO ${POR_PIEZA} POR PIEZA · 10 MODELOS QUE ROTAN</text>
  </g>

  <rect width="${W}" height="${H}" fill="url(#vineta)"/>
</svg>`;
}

/**
 * Variante 4:3 para el bloque de la paca en la home.
 *
 * Mismo arte, otra composición: en un marco casi cuadrado el texto no cabe al
 * lado de los frascos, así que va encima y la fila se apoya abajo. Los frascos
 * se reaprovechan tal cual con una sola transformación, en vez de recolocar
 * nueve piezas a mano.
 */
const WC = 1200;
const HC = 900;

function svgCuadrado() {
  const mitad = WC / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WC}" height="${HC}" viewBox="0 0 ${WC} ${HC}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A0A0B"/>
      <stop offset="55%" stop-color="#131215"/>
      <stop offset="100%" stop-color="#08080A"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="62%" r="62%">
      <stop offset="0%" stop-color="${ORO.medio}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${ORO.medio}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="suelo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="oro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F3DFA0"/>
      <stop offset="48%" stop-color="${ORO.claro}"/>
      <stop offset="100%" stop-color="${ORO.medio}"/>
    </linearGradient>
    <radialGradient id="vineta" cx="50%" cy="45%" r="76%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
    ${FILA.map((f, i) => defsFrasco(i, f.paleta)).join("")}
  </defs>

  <rect width="${WC}" height="${HC}" fill="url(#fondo)"/>
  <rect width="${WC}" height="${HC}" fill="url(#halo)"/>

  <rect x="0" y="640" width="${WC}" height="180" fill="url(#suelo)"/>

  <g transform="translate(-900 154) scale(0.82)">
    ${FILA.map((f, i) => frasco(i, f)).join("")}
  </g>

  <rect x="0" y="0" width="${WC}" height="3" fill="url(#oro)" opacity="0.85"/>
  <rect x="0" y="${HC - 3}" width="${WC}" height="3" fill="url(#oro)" opacity="0.85"/>

  <g text-anchor="middle" font-family="'Arial Black', 'Arial Bold', Arial, sans-serif">
    <text x="${mitad}" y="108" font-family="Arial, Helvetica, sans-serif" font-size="34"
          font-weight="700" letter-spacing="12" fill="${ORO.claro}">PACA DE MAYOREO</text>

    <text x="${mitad}" y="248" font-size="126" font-weight="900" letter-spacing="-2"
          fill="#F7F5F1">50 PIEZAS</text>

    <text x="${mitad - 52}" y="368" font-size="104" font-weight="900" letter-spacing="-3"
          fill="url(#oro)">${PRECIO}</text>
    <text x="${mitad + 232}" y="368" font-family="Arial, Helvetica, sans-serif" font-size="34"
          font-weight="700" fill="${ORO.medio}">MXN</text>

    <text x="${mitad}" y="838" font-family="Arial, Helvetica, sans-serif" font-size="32"
          font-weight="700" letter-spacing="1" fill="#F0EDE7">CON LO MÁS VENDIDO · DUPLICA TU INVERSIÓN</text>
    <text x="${mitad}" y="880" font-family="Arial, Helvetica, sans-serif" font-size="26"
          font-weight="700" letter-spacing="3" fill="${ORO.claro}">ENVÍO GRATIS · ENTREGA INMEDIATA</text>
  </g>

  <rect width="${WC}" height="${HC}" fill="url(#vineta)"/>
</svg>`;
}

async function main() {
  const publico = join(process.cwd(), "public");

  // El 1:1 ya no se emite: `public/paca-50-piezas.webp` es arte definitivo y
  // este script lo pisaría. La función `svgCuadrado` se queda por si hace falta
  // volver a generarlo —cambiar el nombre de salida basta—.
  const salidas: [string, string, number, number][] = [
    ["banner-paca-50.webp", svg(), W, H],
  ];

  for (const [archivo, fuente, ancho, alto] of salidas) {
    // Calidad alta: el banner lleva texto y el WebP agresivo lo ensucia.
    const salida = await sharp(Buffer.from(fuente))
      .webp({ quality: 88 })
      .toBuffer();
    await writeFile(join(publico, archivo), salida);
    console.log(
      `${archivo.padEnd(22)} ${ancho}×${alto}  ${Math.round(salida.length / 1024)} kB`,
    );
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
