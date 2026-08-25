/**
 * Carga y descarga del catálogo.
 *
 *   npm run catalogo:exportar   catálogo actual  →  catalogo/*.csv
 *   npm run catalogo            catalogo/*.csv   →  src/data/*.ts
 *
 * Existe para que la lista de precios real entre a la tienda sin que nadie
 * tenga que escribir TypeScript. El catálogo son 52 fichas con notas, textos y
 * precios: llevar eso a mano a un archivo `.ts` es media tarde de trabajo y una
 * errata de comilla que tumba la compilación.
 *
 * **El CSV es la fuente y `src/data/semillas.ts` la salida.** Si alguien edita
 * el `.ts` a mano, la siguiente carga se lo lleva por delante. Por eso el
 * archivo generado lo dice en su primera línea, y por eso `catalogo:exportar`
 * existe: para recuperar en CSV lo que hoy hay en el código antes de tocarlo.
 *
 * Ninguna de las dos direcciones inventa nada. Al cargar, una fila a la que le
 * falte un dato obligatorio **no se escribe con un valor por defecto**: el
 * script se detiene y dice qué fila y qué columna. Un catálogo con la familia
 * olfativa rellenada a ojo manda perfumes a la página de categoría equivocada y
 * nadie se entera hasta que un cliente lo dice.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { SEMILLAS, type Semilla } from "../src/data/semillas";
import { MARCAS } from "../src/data/marcas";
import type {
  Badge,
  Concentracion,
  FamiliaOlfativa,
  Genero,
  Intensidad,
  Marca,
  Ocasion,
} from "../src/types";

const raiz = process.cwd();
const carpeta = join(raiz, "catalogo");
const CSV_PRODUCTOS = join(carpeta, "productos.csv");
const CSV_MARCAS = join(carpeta, "marcas.csv");
const SALIDA_SEMILLAS = join(raiz, "src", "data", "semillas.ts");
const SALIDA_MARCAS = join(raiz, "src", "data", "marcas.ts");

/* ── Vocabularios ─────────────────────────────────────────────────────── */

const CONCENTRACIONES: Concentracion[] = [
  "Parfum",
  "Eau de Parfum",
  "Eau de Toilette",
  "Eau de Cologne",
  "Body Mist",
];
const GENEROS: Genero[] = ["Hombre", "Mujer", "Unisex"];
const FAMILIAS: FamiliaOlfativa[] = [
  "Amaderado",
  "Oriental",
  "Floral",
  "Cítrico",
  "Fougère",
  "Chipre",
  "Gourmand",
  "Acuático",
  "Especiado",
];
const OCASIONES: Ocasion[] = [
  "Diario",
  "Noche",
  "Oficina",
  "Cita",
  "Evento",
  "Verano",
  "Invierno",
];
const BADGES: Badge[] = [
  "Nuevo",
  "Más vendido",
  "Últimas piezas",
  "Edición limitada",
  "Importado",
  "3x2",
  "Exclusivo",
];

/* ── CSV ──────────────────────────────────────────────────────────────── */

/**
 * Lector de CSV con comillas, saltos de línea dentro de celda y separador
 * variable.
 *
 * Se escribe aquí en vez de traer una dependencia porque son cuarenta líneas y
 * el formato no va a cambiar. Lo que sí cambia es lo que escupe Excel: en
 * español guarda con punto y coma, y a veces con BOM delante. Las dos cosas se
 * detectan solas más abajo — pedirle a alguien que reconfigure Excel antes de
 * mandar su lista de precios es una forma segura de no recibirla nunca.
 */
function leerCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const sep = detectarSeparador(limpio);

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]!;

    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        celda += c;
      }
      continue;
    }

    if (c === '"') {
      entreComillas = true;
    } else if (c === sep) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n") {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else if (c !== "\r") {
      celda += c;
    }
  }

  if (celda !== "" || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }

  // Una fila totalmente vacía es la línea en blanco del final, no un producto.
  return filas.filter((f) => f.some((c) => c.trim() !== ""));
}

/** Coma o punto y coma, según cuál aparezca más en la cabecera. */
function detectarSeparador(texto: string): string {
  const cabecera = texto.slice(0, texto.indexOf("\n") + 1 || texto.length);
  const comas = (cabecera.match(/,/g) ?? []).length;
  const puntoYComa = (cabecera.match(/;/g) ?? []).length;
  return puntoYComa > comas ? ";" : ",";
}

function celdaCSV(valor: string): string {
  return /["\n\r,;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/**
 * Escribe el CSV con BOM y separado por comas.
 *
 * El BOM no es decorativo: sin él, Excel abre el archivo en la codificación del
 * sistema y cada acento se convierte en un símbolo raro. «Héliotrope» llega como
 * «HÃ©liotrope» y hay que reescribir el catálogo entero a mano.
 */
function escribirCSV(filas: string[][]): string {
  return "﻿" + filas.map((f) => f.map(celdaCSV).join(",")).join("\r\n") + "\r\n";
}

/* ── Columnas ─────────────────────────────────────────────────────────── */

const COLUMNAS_PRODUCTO = [
  "slug",
  "nombre",
  "marca",
  "linea",
  "concentracion",
  "genero",
  "familia",
  "precio_100ml",
  "precios",
  "rebaja",
  "mls",
  "salida",
  "corazon",
  "fondo",
  "corta",
  "larga",
  "badges",
  "duracion",
  "estela",
  "ocasion",
  "destacado",
  "anio",
  "origen",
] as const;

const COLUMNAS_MARCA = [
  "slug",
  "nombre",
  "pais",
  "fundada",
  "firma",
  "descripcion",
] as const;

/* ── Exportar: código → CSV ───────────────────────────────────────────── */

/** `{30: 390, 100: 790}` → `"30:390|100:790"`. */
function serializarPrecios(precios: Record<number, number> | undefined): string {
  if (!precios) return "";
  return Object.entries(precios)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([ml, precio]) => `${ml}:${precio}`)
    .join("|");
}

async function exportar() {
  await mkdir(carpeta, { recursive: true });

  const productos: string[][] = [
    [...COLUMNAS_PRODUCTO],
    ...SEMILLAS.map((s) => [
      s.slug,
      s.nombre,
      s.marca,
      s.linea ?? "",
      s.concentracion,
      s.genero,
      s.familia,
      String(s.base),
      serializarPrecios(s.precios),
      s.rebaja ? String(s.rebaja) : "",
      s.mls.join("|"),
      s.salida.join("|"),
      s.corazon.join("|"),
      s.fondo.join("|"),
      s.corta,
      s.larga,
      s.badges.join("|"),
      String(s.duracion),
      String(s.estela),
      s.ocasion.join("|"),
      s.destacado ? "si" : "",
      String(s.anio),
      s.origen,
    ]),
  ];

  const marcas: string[][] = [
    [...COLUMNAS_MARCA],
    ...MARCAS.map((m) => [
      m.slug,
      m.nombre,
      m.pais,
      String(m.fundada),
      m.firma,
      m.descripcion,
    ]),
  ];

  await writeFile(CSV_PRODUCTOS, escribirCSV(productos), "utf8");
  await writeFile(CSV_MARCAS, escribirCSV(marcas), "utf8");

  console.log(`✓ ${SEMILLAS.length} productos → catalogo/productos.csv`);
  console.log(`✓ ${MARCAS.length} marcas → catalogo/marcas.csv`);
  console.log("\nÁbrelos con Excel o Google Sheets, edítalos y luego:");
  console.log("  npm run catalogo");
}

/* ── Importar: CSV → código ───────────────────────────────────────────── */

/** Un problema concreto, con su fila y su columna. */
interface Problema {
  fila: number;
  columna: string;
  mensaje: string;
}

class Lector {
  private readonly indice: Map<string, number>;

  constructor(
    cabecera: string[],
    private readonly problemas: Problema[],
    private readonly archivo: string,
  ) {
    this.indice = new Map(
      cabecera.map((c, i) => [c.trim().toLowerCase(), i] as const),
    );
  }

  /** Columnas que trae el archivo pero que nadie va a leer. Suele ser una errata. */
  columnasDesconocidas(conocidas: readonly string[]): string[] {
    return [...this.indice.keys()].filter(
      (c) => c !== "" && !conocidas.includes(c),
    );
  }

  faltantes(obligatorias: readonly string[]): string[] {
    return obligatorias.filter((c) => !this.indice.has(c));
  }

  private crudo(fila: string[], columna: string): string {
    const i = this.indice.get(columna);
    return i === undefined ? "" : (fila[i] ?? "").trim();
  }

  texto(fila: string[], columna: string, nFila: number, obligatorio = false): string {
    const valor = this.crudo(fila, columna);
    if (obligatorio && valor === "") {
      this.problemas.push({
        fila: nFila,
        columna,
        mensaje: `${this.archivo}: falta un dato obligatorio`,
      });
    }
    return valor;
  }

  numero(
    fila: string[],
    columna: string,
    nFila: number,
    opciones: { obligatorio?: boolean; min?: number; max?: number } = {},
  ): number | undefined {
    // Una lista de precios trae «$ 1,290.00» tal cual sale del sistema de quien
    // la manda. Exigir el número pelado obligaría a limpiar el archivo a mano
    // antes de cada carga.
    const bruto = this.crudo(fila, columna).replace(/[$\s,]/g, "");
    if (bruto === "") {
      if (opciones.obligatorio) {
        this.problemas.push({
          fila: nFila,
          columna,
          mensaje: `${this.archivo}: falta un dato obligatorio`,
        });
      }
      return undefined;
    }

    const n = Number(bruto);
    if (!Number.isFinite(n)) {
      this.problemas.push({
        fila: nFila,
        columna,
        mensaje: `${this.archivo}: «${this.crudo(fila, columna)}» no es un número`,
      });
      return undefined;
    }
    if (opciones.min !== undefined && n < opciones.min) {
      this.problemas.push({
        fila: nFila,
        columna,
        mensaje: `${this.archivo}: ${n} es menor que el mínimo (${opciones.min})`,
      });
      return undefined;
    }
    if (opciones.max !== undefined && n > opciones.max) {
      this.problemas.push({
        fila: nFila,
        columna,
        mensaje: `${this.archivo}: ${n} pasa del máximo (${opciones.max})`,
      });
      return undefined;
    }
    return n;
  }

  /** Lista separada por `|`, sin huecos. */
  lista(fila: string[], columna: string): string[] {
    return this.crudo(fila, columna)
      .split("|")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  /**
   * Valor de un vocabulario cerrado.
   *
   * No adivina ni corrige: «amaderado» sí pasa —solo cambia la caja— pero
   * «Amaderada» se detiene y enseña las opciones válidas. Aceptar parecidos es
   * cómo un catálogo acaba con dos familias que son la misma escrita distinto.
   */
  opcion<T extends string>(
    fila: string[],
    columna: string,
    nFila: number,
    validos: readonly T[],
    obligatorio = true,
  ): T | undefined {
    const valor = this.crudo(fila, columna);
    if (valor === "") {
      if (obligatorio) {
        this.problemas.push({
          fila: nFila,
          columna,
          mensaje: `${this.archivo}: falta. Opciones: ${validos.join(", ")}`,
        });
      }
      return undefined;
    }
    const encontrado = validos.find(
      (v) => v.toLowerCase() === valor.toLowerCase(),
    );
    if (!encontrado) {
      this.problemas.push({
        fila: nFila,
        columna,
        mensaje: `${this.archivo}: «${valor}» no existe. Opciones: ${validos.join(", ")}`,
      });
    }
    return encontrado;
  }

  opciones<T extends string>(
    fila: string[],
    columna: string,
    nFila: number,
    validos: readonly T[],
  ): T[] {
    const salida: T[] = [];
    for (const valor of this.lista(fila, columna)) {
      const encontrado = validos.find(
        (v) => v.toLowerCase() === valor.toLowerCase(),
      );
      if (encontrado) salida.push(encontrado);
      else
        this.problemas.push({
          fila: nFila,
          columna,
          mensaje: `${this.archivo}: «${valor}» no existe. Opciones: ${validos.join(", ")}`,
        });
    }
    return salida;
  }

  siNo(fila: string[], columna: string): boolean {
    return /^(s[íi]|si|x|1|true|verdadero)$/i.test(this.crudo(fila, columna));
  }
}

/**
 * `Héliotrope 7` → `heliotrope-7`.
 *
 * Solo se usa cuando la columna `slug` viene vacía. El slug es la dirección
 * pública del producto —`/producto/heliotrope-7/`— y una vez publicada no se
 * cambia sin romper enlaces y perder el posicionamiento acumulado. Por eso el
 * exportador siempre lo escribe: para que al reeditar el archivo se conserve.
 */
function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `"30:390|100:790"` → `{30: 390, 100: 790}`. */
function leerPrecios(
  bruto: string,
  nFila: number,
  problemas: Problema[],
): Record<number, number> | undefined {
  if (bruto.trim() === "") return undefined;
  const precios: Record<number, number> = {};

  for (const par of bruto.split("|")) {
    const [ml, precio] = par.split(":").map((v) => v.trim());
    const nMl = Number(ml);
    const nPrecio = Number((precio ?? "").replace(/[$\s,]/g, ""));
    if (!Number.isFinite(nMl) || !Number.isFinite(nPrecio) || nPrecio <= 0) {
      problemas.push({
        fila: nFila,
        columna: "precios",
        mensaje: `productos.csv: «${par}» no tiene la forma 100:1290`,
      });
      continue;
    }
    precios[nMl] = nPrecio;
  }

  return Object.keys(precios).length > 0 ? precios : undefined;
}

function literal(valor: string): string {
  return JSON.stringify(valor);
}

/* ── Generadores de TypeScript ────────────────────────────────────────── */

const AVISO = `/**
 * ARCHIVO GENERADO — no lo edites a mano.
 *
 * Sale de \`catalogo/%ARCHIVO%\` a través de \`npm run catalogo\`, y la siguiente
 * carga se lleva por delante cualquier cambio hecho aquí. Para modificar el
 * catálogo, edita el CSV. Si lo que hay aquí es más nuevo que el CSV, recupéralo
 * primero con \`npm run catalogo:exportar\`.
 */`;

function generarSemillas(semillas: Semilla[]): string {
  const cuerpo = semillas
    .map((s) => {
      const campos: string[] = [
        `    slug: ${literal(s.slug)},`,
        `    nombre: ${literal(s.nombre)},`,
        `    marca: ${literal(s.marca)},`,
      ];
      if (s.linea) campos.push(`    linea: ${literal(s.linea)},`);
      campos.push(
        `    concentracion: ${literal(s.concentracion)},`,
        `    genero: ${literal(s.genero)},`,
        `    familia: ${literal(s.familia)},`,
        `    salida: [${s.salida.map(literal).join(", ")}],`,
        `    corazon: [${s.corazon.map(literal).join(", ")}],`,
        `    fondo: [${s.fondo.map(literal).join(", ")}],`,
        `    corta: ${literal(s.corta)},`,
        `    larga: ${literal(s.larga)},`,
        `    base: ${s.base},`,
      );
      if (s.precios) {
        const pares = Object.entries(s.precios)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([ml, precio]) => `${ml}: ${precio}`)
          .join(", ");
        campos.push(`    precios: { ${pares} },`);
      }
      if (s.rebaja) campos.push(`    rebaja: ${s.rebaja},`);
      campos.push(
        `    mls: [${s.mls.join(", ")}],`,
        `    badges: [${s.badges.map(literal).join(", ")}],`,
        `    duracion: ${s.duracion},`,
        `    estela: ${s.estela},`,
        `    ocasion: [${s.ocasion.map(literal).join(", ")}],`,
      );
      if (s.destacado) campos.push(`    destacado: true,`);
      campos.push(`    anio: ${s.anio},`, `    origen: ${literal(s.origen)},`);
      return `  {\n${campos.join("\n")}\n  },`;
    })
    .join("\n");

  return `${AVISO.replace("%ARCHIVO%", "productos.csv")}
import type {
  Badge,
  Concentracion,
  FamiliaOlfativa,
  Genero,
  Intensidad,
  Ocasion,
} from "@/types";

/**
 * Semilla de producto: solo el contenido de autor. Todo lo derivable
 * —stock, SKU, rating, espectadores, y el precio de las presentaciones que no
 * traigan el suyo— lo calcula \`construirProducto\` de forma determinista a
 * partir del slug (ver productos.ts).
 */
export interface Semilla {
  slug: string;
  nombre: string;
  marca: string;
  linea?: string;
  concentracion: Concentracion;
  genero: Genero;
  familia: FamiliaOlfativa;
  salida: string[];
  corazon: string[];
  fondo: string[];
  corta: string;
  larga: string;
  /** Precio de menudeo de la presentación de 100 ml. */
  base: number;
  /** Rebaja vigente: 0.25 pinta el precio anterior tachado y el -25%. */
  rebaja?: number;
  mls: number[];
  /**
   * Precio de menudeo por presentación, cuando lo hay.
   *
   * Sin esto, el precio de cada tamaño se deduce del de 100 ml con la curva de
   * \`RATIO_ML\` — que es una aproximación razonable, pero solo eso. Una lista de
   * precios real trae la cifra exacta de cada frasco, y esa manda: deducirla
   * cuando existe cambiaría el precio al que se vende.
   *
   * Las presentaciones que no aparezcan aquí siguen deduciéndose.
   */
  precios?: Record<number, number>;
  badges: Badge[];
  duracion: Intensidad;
  estela: Intensidad;
  ocasion: Ocasion[];
  destacado?: boolean;
  anio: number;
  origen: string;
}

export const SEMILLAS: readonly Semilla[] = [
${cuerpo}
] as const;
`;
}

function generarMarcas(marcas: Marca[]): string {
  const cuerpo = marcas
    .map(
      (m) => `  {
    slug: ${literal(m.slug)},
    nombre: ${literal(m.nombre)},
    pais: ${literal(m.pais)},
    fundada: ${m.fundada},
    firma: ${literal(m.firma)},
    descripcion: ${literal(m.descripcion)},
  },`,
    )
    .join("\n");

  return `${AVISO.replace("%ARCHIVO%", "marcas.csv")}
import type { Marca } from "@/types";

/** Las casas del catálogo. Cada producto apunta a una por su \`slug\`. */
export const MARCAS: readonly Marca[] = [
${cuerpo}
] as const;

export const MARCAS_POR_SLUG = new Map(MARCAS.map((m) => [m.slug, m]));

export function getMarca(slug: string): Marca | undefined {
  return MARCAS_POR_SLUG.get(slug);
}
`;
}

/* ── Importar ─────────────────────────────────────────────────────────── */

async function importar() {
  const problemas: Problema[] = [];

  if (!existsSync(CSV_PRODUCTOS)) {
    console.error(`No encuentro catalogo/productos.csv.`);
    console.error(`Créalo con:  npm run catalogo:exportar`);
    process.exit(1);
  }

  /* Marcas primero: los productos apuntan a ellas y hay que poder comprobarlo. */
  let marcas: Marca[] = [...MARCAS];
  if (existsSync(CSV_MARCAS)) {
    marcas = leerMarcas(await readFile(CSV_MARCAS, "utf8"), problemas);
  } else {
    console.log("· Sin catalogo/marcas.csv: se conservan las marcas actuales.");
  }

  const semillas = leerProductos(
    await readFile(CSV_PRODUCTOS, "utf8"),
    new Set(marcas.map((m) => m.slug)),
    problemas,
  );

  if (problemas.length > 0) {
    console.error(`\n✗ ${problemas.length} problema(s). No se escribió nada.\n`);
    for (const p of problemas.slice(0, 40)) {
      console.error(`  fila ${p.fila} · ${p.columna}: ${p.mensaje}`);
    }
    if (problemas.length > 40) {
      console.error(`  … y ${problemas.length - 40} más.`);
    }
    console.error(
      "\nCorrige el CSV y vuelve a ejecutar. No se escribe un catálogo a medias:",
    );
    console.error(
      "medio catálogo cargado es peor que ninguno, porque parece que funcionó.",
    );
    process.exit(1);
  }

  await writeFile(SALIDA_SEMILLAS, generarSemillas(semillas), "utf8");
  if (existsSync(CSV_MARCAS)) {
    await writeFile(SALIDA_MARCAS, generarMarcas(marcas), "utf8");
  }

  console.log(`✓ ${semillas.length} productos → src/data/semillas.ts`);
  if (existsSync(CSV_MARCAS)) {
    console.log(`✓ ${marcas.length} marcas → src/data/marcas.ts`);
  }

  const sinArte = semillas.filter(
    (s) => !existsSync(join(raiz, "public", "productos", `${s.slug}-1.webp`)),
  );
  if (sinArte.length > 0) {
    console.log(
      `\n· ${sinArte.length} producto(s) sin imagen. Genera el arte con:  npm run imagenes`,
    );
  }
  console.log("\nComprueba que compila:  npm run build");
}

function leerMarcas(texto: string, problemas: Problema[]): Marca[] {
  const filas = leerCSV(texto);
  const cabecera = filas.shift();
  if (!cabecera) {
    problemas.push({ fila: 0, columna: "-", mensaje: "marcas.csv está vacío" });
    return [];
  }

  const lector = new Lector(cabecera, problemas, "marcas.csv");
  for (const falta of lector.faltantes(["slug", "nombre"])) {
    problemas.push({
      fila: 1,
      columna: falta,
      mensaje: "marcas.csv: falta esta columna en la cabecera",
    });
  }

  const marcas: Marca[] = [];
  const vistos = new Set<string>();

  filas.forEach((fila, i) => {
    const n = i + 2; // +1 por la cabecera, +1 porque Excel cuenta desde 1
    const nombre = lector.texto(fila, "nombre", n, true);
    const slug = lector.texto(fila, "slug", n) || aSlug(nombre);

    if (vistos.has(slug)) {
      problemas.push({
        fila: n,
        columna: "slug",
        mensaje: `marcas.csv: «${slug}» está repetido`,
      });
      return;
    }
    vistos.add(slug);

    marcas.push({
      slug,
      nombre,
      pais: lector.texto(fila, "pais", n),
      fundada: lector.numero(fila, "fundada", n, { min: 1500, max: 2100 }) ?? 0,
      firma: lector.texto(fila, "firma", n),
      descripcion: lector.texto(fila, "descripcion", n),
    });
  });

  return marcas;
}

function leerProductos(
  texto: string,
  marcasValidas: Set<string>,
  problemas: Problema[],
): Semilla[] {
  const filas = leerCSV(texto);
  const cabecera = filas.shift();
  if (!cabecera) {
    problemas.push({ fila: 0, columna: "-", mensaje: "productos.csv está vacío" });
    return [];
  }

  const lector = new Lector(cabecera, problemas, "productos.csv");

  // Lo indispensable para que una ficha exista y se pueda encontrar. El resto
  // tiene comportamiento definido cuando falta y está documentado en el LEEME.
  for (const falta of lector.faltantes([
    "nombre",
    "marca",
    "concentracion",
    "genero",
    "familia",
    "precio_100ml",
  ])) {
    problemas.push({
      fila: 1,
      columna: falta,
      mensaje: "productos.csv: falta esta columna en la cabecera",
    });
  }

  const desconocidas = lector.columnasDesconocidas(COLUMNAS_PRODUCTO);
  if (desconocidas.length > 0) {
    console.log(
      `· Columnas que no se leen (¿errata?): ${desconocidas.join(", ")}`,
    );
  }

  const semillas: Semilla[] = [];
  const vistos = new Set<string>();

  filas.forEach((fila, i) => {
    const n = i + 2;
    const nombre = lector.texto(fila, "nombre", n, true);
    const slug = lector.texto(fila, "slug", n) || aSlug(nombre);

    if (slug === "") return; // Ya se reportó la falta de nombre.
    if (vistos.has(slug)) {
      problemas.push({
        fila: n,
        columna: "slug",
        mensaje: `productos.csv: «${slug}» está repetido. Dos productos no pueden compartir dirección`,
      });
      return;
    }
    vistos.add(slug);

    const marca = lector.texto(fila, "marca", n, true);
    if (marca !== "" && !marcasValidas.has(marca)) {
      problemas.push({
        fila: n,
        columna: "marca",
        mensaje: `productos.csv: la marca «${marca}» no está en marcas.csv. Agrégala ahí primero`,
      });
    }

    const mls = lector
      .lista(fila, "mls")
      .map(Number)
      .filter((v) => Number.isFinite(v) && v > 0);

    const precios = leerPrecios(lector.texto(fila, "precios", n), n, problemas);
    const base = lector.numero(fila, "precio_100ml", n, {
      obligatorio: true,
      min: 1,
    });

    const rebaja = lector.numero(fila, "rebaja", n, { min: 0, max: 0.9 });
    const duracion = lector.numero(fila, "duracion", n, { min: 1, max: 5 });
    const estela = lector.numero(fila, "estela", n, { min: 1, max: 5 });
    const anio = lector.numero(fila, "anio", n, { min: 1900, max: 2100 });

    const concentracion = lector.opcion(fila, "concentracion", n, CONCENTRACIONES);
    const genero = lector.opcion(fila, "genero", n, GENEROS);
    const familia = lector.opcion(fila, "familia", n, FAMILIAS);

    // Sin alguno de estos no hay ficha que construir; los problemas ya están
    // anotados y el proceso se detendrá al terminar de revisar todas las filas.
    if (!concentracion || !genero || !familia || base === undefined) return;

    const corta = lector.texto(fila, "corta", n);

    semillas.push({
      slug,
      nombre,
      marca,
      linea: lector.texto(fila, "linea", n) || undefined,
      concentracion,
      genero,
      familia,
      salida: lector.lista(fila, "salida"),
      corazon: lector.lista(fila, "corazon"),
      fondo: lector.lista(fila, "fondo"),
      corta,
      // La descripción larga cae en la corta y no en un texto de relleno: la
      // ficha se lee corta, pero no dice nada que no sea verdad.
      larga: lector.texto(fila, "larga", n) || corta,
      base,
      ...(precios ? { precios } : {}),
      ...(rebaja ? { rebaja } : {}),
      // Sin presentaciones declaradas, un solo frasco de 100 ml al precio de la
      // lista. Inventar un 30 y un 50 fabricaría precios que nadie fijó.
      mls: mls.length > 0 ? mls : [100],
      badges: lector.opciones(fila, "badges", n, BADGES),
      duracion: ((duracion ?? 3) as Intensidad),
      estela: ((estela ?? 3) as Intensidad),
      ocasion: lector.opciones(fila, "ocasion", n, OCASIONES),
      ...(lector.siNo(fila, "destacado") ? { destacado: true } : {}),
      anio: anio ?? new Date().getFullYear(),
      origen: lector.texto(fila, "origen", n) || "México",
    });
  });

  return semillas;
}

/* ── Entrada ──────────────────────────────────────────────────────────── */

// Envuelto en una función y no con `await` de primer nivel: los scripts de este
// repositorio se transpilan a CommonJS, donde eso no existe.
const modo = process.argv[2];
(modo === "exportar" ? exportar() : importar()).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
