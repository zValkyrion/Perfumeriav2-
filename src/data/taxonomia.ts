import type {
  Concentracion,
  FamiliaOlfativa,
  Genero,
  Ocasion,
  Producto,
} from "@/types";

/* ── Familias olfativas ───────────────────────────────────────────────── */

export interface FamiliaInfo {
  nombre: FamiliaOlfativa;
  slug: string;
  descripcion: string;
  /** Color característico de la familia, tomado de los tokens del §6.1. */
  color: string;
  /** Segundo tono para el degradado del chip circular (§8.7). */
  color2: string;
}

export const FAMILIAS: readonly FamiliaInfo[] = [
  {
    nombre: "Amaderado",
    slug: "amaderado",
    descripcion: "Sándalo, cedro y vetiver. Seco, cálido y de larga duración.",
    color: "#8C6F14",
    color2: "#4A3A0C",
  },
  {
    nombre: "Oriental",
    slug: "oriental",
    descripcion: "Ámbar, resinas y vainilla. Denso, envolvente, de noche.",
    color: "#B5651D",
    color2: "#5A2F0C",
  },
  {
    nombre: "Floral",
    slug: "floral",
    descripcion: "Rosa, jazmín y tuberosa. El corazón de la perfumería.",
    color: "#C2708F",
    color2: "#5E2E42",
  },
  {
    nombre: "Cítrico",
    slug: "citrico",
    descripcion: "Limón, bergamota y azahar. Fresco, luminoso, para el calor.",
    color: "#B7BF3A",
    color2: "#4F5615",
  },
  {
    nombre: "Fougère",
    slug: "fougere",
    descripcion: "Lavanda, musgo y helecho. El clásico masculino de siempre.",
    color: "#5F8A5F",
    color2: "#22391F",
  },
  {
    nombre: "Chipre",
    slug: "chipre",
    descripcion: "Musgo de roble y bergamota. Elegante y ligeramente amargo.",
    color: "#7A6A4F",
    color2: "#332C1F",
  },
  {
    nombre: "Gourmand",
    slug: "gourmand",
    descripcion: "Vainilla, caramelo y café. Dulce, cálido y adictivo.",
    color: "#A9713F",
    color2: "#482C13",
  },
  {
    nombre: "Acuático",
    slug: "acuatico",
    descripcion: "Sal marina y notas de agua. Limpio, fresco y versátil.",
    color: "#4A8FA8",
    color2: "#1A3B48",
  },
  {
    nombre: "Especiado",
    slug: "especiado",
    descripcion: "Azafrán, cardamomo y pimienta. Cálido y con carácter.",
    color: "#A8453A",
    color2: "#471712",
  },
] as const;

export const FAMILIA_POR_SLUG = new Map(FAMILIAS.map((f) => [f.slug, f]));
export const FAMILIA_POR_NOMBRE = new Map(FAMILIAS.map((f) => [f.nombre, f]));

/* ── Categorías de tienda ─────────────────────────────────────────────── */

const MARCAS_ARABES = ["kairo-parfums", "oud-imperial"];
const MARCAS_NICHO = [
  "maison-lumiere",
  "orfevre",
  "atelier-nord",
  "lys-blanc",
  "nuit-royale",
  "vetiver-house",
];

export interface Categoria {
  slug: string;
  nombre: string;
  titulo: string;
  eyebrow: string;
  descripcion: string;
  /** Si es false no aparece en la tira de categorías de la home. */
  enHome: boolean;
  filtro: (p: Producto) => boolean;
}

export const CATEGORIAS: readonly Categoria[] = [
  {
    slug: "hombre",
    nombre: "Hombre",
    titulo: "Perfumes para hombre",
    eyebrow: "Colección",
    descripcion:
      "Amaderados, cueros y fougères que aguantan la jornada completa. Desde el diario de oficina hasta la fragancia de noche.",
    enHome: true,
    filtro: (p) => p.genero === "Hombre",
  },
  {
    slug: "mujer",
    nombre: "Mujer",
    titulo: "Perfumes para mujer",
    eyebrow: "Colección",
    descripcion:
      "Florales blancos, gourmands y orientales. Las fragancias que más se repiten y las que más se regalan.",
    enHome: true,
    filtro: (p) => p.genero === "Mujer",
  },
  {
    slug: "unisex",
    nombre: "Unisex",
    titulo: "Perfumes unisex",
    eyebrow: "Colección",
    descripcion:
      "Fórmulas sin género: maderas, cítricos y resinas que funcionan igual de bien en cualquier piel.",
    enHome: true,
    filtro: (p) => p.genero === "Unisex",
  },
  {
    slug: "disenador",
    nombre: "Diseñador",
    titulo: "Perfumes de diseñador",
    eyebrow: "Casas europeas",
    descripcion:
      "Las fragancias de las grandes casas europeas, en calidad 1:1. Misma pirámide olfativa y mismo frasco, sin pagar la etiqueta.",
    enHome: false,
    filtro: (p) =>
      !MARCAS_ARABES.includes(p.marca) && p.concentracion !== "Body Mist",
  },
  {
    slug: "arabes",
    nombre: "Árabes",
    titulo: "Perfumes árabes",
    eyebrow: "Escuela del Golfo",
    descripcion:
      "Oud, azafrán y rosa de Taif en concentraciones altas. Media pulverización rinde una jornada entera.",
    enHome: true,
    filtro: (p) => MARCAS_ARABES.includes(p.marca),
  },
  {
    slug: "nicho",
    nombre: "Nicho",
    titulo: "Perfumería de nicho",
    eyebrow: "Casas de autor",
    descripcion:
      "Casas pequeñas, materias primas caras y fórmulas cortas. Perfumes que no vas a oler en todas partes.",
    enHome: true,
    filtro: (p) => MARCAS_NICHO.includes(p.marca),
  },
  {
    slug: "inspirados",
    nombre: "Inspirados",
    titulo: "Fragancias inspiradas",
    eyebrow: "Precio accesible",
    descripcion:
      "Alternativas inspiradas en grandes clásicos, con buena duración y precio de entrada. La categoría que mejor margen deja al revender.",
    enHome: false,
    filtro: (p) =>
      p.concentracion !== "Body Mist" &&
      Math.min(...p.presentaciones.map((v) => v.precio)) <= 1290,
  },
  {
    slug: "body-mist",
    nombre: "Body Mist",
    titulo: "Brumas corporales",
    eyebrow: "Formato grande",
    descripcion:
      "200 ml para usar sin contar los disparos. Rotación alta y el mejor margen del catálogo para quien revende.",
    enHome: false,
    filtro: (p) => p.concentracion === "Body Mist",
  },
] as const;

export const CATEGORIA_POR_SLUG = new Map(CATEGORIAS.map((c) => [c.slug, c]));

export function getCategoria(slug: string): Categoria | undefined {
  return CATEGORIA_POR_SLUG.get(slug);
}

/* ── Listas para los filtros del catálogo (§9) ────────────────────────── */

export const GENEROS: readonly Genero[] = ["Hombre", "Mujer", "Unisex"];

export const CONCENTRACIONES: readonly Concentracion[] = [
  "Parfum",
  "Eau de Parfum",
  "Eau de Toilette",
  "Eau de Cologne",
  "Body Mist",
];

export const OCASIONES: readonly Ocasion[] = [
  "Diario",
  "Noche",
  "Oficina",
  "Cita",
  "Evento",
  "Verano",
  "Invierno",
];

export const TAMANOS: readonly number[] = [30, 50, 100, 200];

export const ORDENES = [
  { valor: "relevancia", etiqueta: "Relevancia" },
  { valor: "vendidos", etiqueta: "Más vendidos" },
  { valor: "precio-asc", etiqueta: "Precio: menor a mayor" },
  { valor: "precio-desc", etiqueta: "Precio: mayor a menor" },
  { valor: "novedades", etiqueta: "Novedades" },
  { valor: "rating", etiqueta: "Mejor calificados" },
] as const;

export type Orden = (typeof ORDENES)[number]["valor"];
