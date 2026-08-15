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
  /** Encabezado de la página de familia, redactado como se busca. */
  titulo: string;
  /**
   * Dos párrafos para la página de la familia: a qué huele y cómo se comporta,
   * y cuándo usarla en el clima de México. No es relleno de SEO —es lo que
   * pregunta quien no sabe qué comprar— y por eso va en los datos y no en la
   * plantilla.
   */
  guia: [string, string];
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
    titulo: "Perfumes amaderados",
    guia: [
      "El amaderado se construye sobre maderas nobles —sándalo, cedro, vetiver— y casi siempre en seco: no lleva azúcar y por eso no empalaga. Es la familia que más tarda en desaparecer de la piel, porque las moléculas de la madera son pesadas y se evaporan despacio.",
      "En México funciona todo el año, pero rinde mejor de octubre a febrero y en zonas de clima templado como el Bajío o el altiplano. Con calor húmedo conviene bajar la dosis a dos disparos: la madera se abre con la temperatura y lo que en un sitio con aire acondicionado es elegante, en la costa puede volverse denso.",
    ],
    color: "#8C6F14",
    color2: "#4A3A0C",
  },
  {
    nombre: "Oriental",
    slug: "oriental",
    descripcion: "Ámbar, resinas y vainilla. Denso, envolvente, de noche.",
    titulo: "Perfumes orientales",
    guia: [
      "El oriental —también llamado ámbar— mezcla resinas, bálsamos y vainilla sobre una base cálida. Es la familia más envolvente que existe: proyecta mucho con poco producto y deja estela en el lugar donde estuviste.",
      "Es fragancia de noche y de temporada fría. En una comida al aire libre en Mérida o Culiacán a mediodía resulta pesado; en una cena, una boda o un diciembre en el norte es exactamente donde brilla. Un disparo suele bastar.",
    ],
    color: "#B5651D",
    color2: "#5A2F0C",
  },
  {
    nombre: "Floral",
    slug: "floral",
    descripcion: "Rosa, jazmín y tuberosa. El corazón de la perfumería.",
    titulo: "Perfumes florales",
    guia: [
      "Rosa, jazmín, tuberosa y azahar: la familia más amplia de la perfumería y la más difícil de resumir, porque un floral blanco cremoso y un floral verde y transparente no se parecen en nada salvo en el origen de la nota.",
      "Es la categoría más regalada en México —10 de mayo y 14 de febrero mueven el año entero— y la de rotación más predecible para quien revende. Los florales ligeros aguantan bien el calor; los blancos densos, tipo tuberosa, piden clima fresco o uso de noche.",
    ],
    color: "#C2708F",
    color2: "#5E2E42",
  },
  {
    nombre: "Cítrico",
    slug: "citrico",
    descripcion: "Limón, bergamota y azahar. Fresco, luminoso, para el calor.",
    titulo: "Perfumes cítricos",
    guia: [
      "Limón, bergamota, toronja y azahar. Es la familia más luminosa y también la más volátil: las moléculas cítricas son ligeras y se van rápido, así que un cítrico bien construido siempre lleva un anclaje debajo —petitgrain, almizcle o madera clara— que lo sostenga.",
      "Es lo que mejor funciona en el clima mexicano de mayo a septiembre y en costa todo el año. Si buscas un perfume para la oficina, para el diario o para alguien que dice que los perfumes le dan dolor de cabeza, empieza aquí. Conviene reaplicar a media tarde.",
    ],
    color: "#B7BF3A",
    color2: "#4F5615",
  },
  {
    nombre: "Fougère",
    slug: "fougere",
    descripcion: "Lavanda, musgo y helecho. El clásico masculino de siempre.",
    titulo: "Perfumes fougère",
    guia: [
      "Fougère significa helecho en francés, aunque el helecho no huele a nada: la familia es un acuerdo inventado en 1882 entre lavanda, cumarina y musgo de roble. Es el esqueleto de casi todo lo que se ha vendido como perfume de hombre desde entonces.",
      "Huele a limpio, a rasurada y a camisa recién planchada, y por eso es la apuesta más segura para oficina y uso diario en clima templado. Es también la familia que menos rechazo genera cuando no conoces el gusto de la otra persona.",
    ],
    color: "#5F8A5F",
    color2: "#22391F",
  },
  {
    nombre: "Chipre",
    slug: "chipre",
    descripcion: "Musgo de roble y bergamota. Elegante y ligeramente amargo.",
    titulo: "Perfumes chipre",
    guia: [
      "El chipre parte de un contraste: bergamota brillante arriba y musgo de roble con pachulí abajo. Ese amargor de fondo es su firma y lo que lo vuelve inconfundible; también lo que lo hace la familia menos complaciente de todas.",
      "Es un perfume de adulto y de ocasión formal, no de uso distraído. Funciona bien en clima fresco y de tarde-noche. Si alguien te dijo que quiere algo que no huela a nadie más en la oficina, esta es la familia por la que hay que empezar.",
    ],
    color: "#7A6A4F",
    color2: "#332C1F",
  },
  {
    nombre: "Gourmand",
    slug: "gourmand",
    descripcion: "Vainilla, caramelo y café. Dulce, cálido y adictivo.",
    titulo: "Perfumes gourmand",
    guia: [
      "Vainilla, caramelo, café, praliné: notas comestibles llevadas a la piel. Es la familia más joven de todas —nació en los años noventa— y la que más rápido crece, sobre todo entre compradores de menos de treinta años.",
      "Es la que mejor se vende en México para regalo y la de mayor rotación para quien revende, aunque conviene medir la dosis: con calor el dulce se amplifica y dos disparos se convierten en cuatro. De noche y en temporada fría es donde mejor queda.",
    ],
    color: "#A9713F",
    color2: "#482C13",
  },
  {
    nombre: "Acuático",
    slug: "acuatico",
    descripcion: "Sal marina y notas de agua. Limpio, fresco y versátil.",
    titulo: "Perfumes acuáticos",
    guia: [
      "El acuático no existe en la naturaleza: se construye con moléculas de síntesis que evocan aire salino, melón y ozono. De ahí su carácter transparente, limpio y ligeramente metálico, muy distinto al del cítrico aunque los dos se lean como frescos.",
      "Es la familia más versátil para el clima costero mexicano y la más segura para uso diario en Cancún, Veracruz o Mazatlán. Proyecta poco y de forma discreta, así que es buena elección para consultorio, salón o cualquier trabajo con trato cercano.",
    ],
    color: "#4A8FA8",
    color2: "#1A3B48",
  },
  {
    nombre: "Especiado",
    slug: "especiado",
    descripcion: "Azafrán, cardamomo y pimienta. Cálido y con carácter.",
    titulo: "Perfumes especiados",
    guia: [
      "Azafrán, cardamomo, pimienta rosa y canela. Las especias aportan calor sin dulzura y suelen ir montadas sobre madera o resina, lo que da fragancias con mucho carácter desde el primer minuto y sin fase de arranque tímida.",
      "Es la puerta de entrada a la perfumería árabe, donde el azafrán y la rosa mandan. Aguanta bien el clima fresco y la noche; con calor conviene aplicarlo sobre ropa más que sobre piel, porque la especia se dispara con la temperatura corporal.",
    ],
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
