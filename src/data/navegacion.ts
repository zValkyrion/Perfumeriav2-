import { MARCAS } from "./marcas";
import { CATEGORIAS } from "./taxonomia";
import { LOTES } from "./lotes";

export interface EnlaceNav {
  label: string;
  href: string;
  nota?: string;
}

export interface GrupoNav {
  titulo: string;
  enlaces: EnlaceNav[];
}

export interface SeccionNav {
  label: string;
  href: string;
  /** Destaca la entrada en dorado dentro de la barra (§7.3). */
  destacado?: boolean;
  grupos?: GrupoNav[];
  /** Bloque promocional que acompaña al mega-menú. */
  promo?: { titulo: string; texto: string; href: string; cta: string };
}

const PERFUMES: GrupoNav[] = [
  {
    titulo: "Por público",
    enlaces: CATEGORIAS.filter((c) =>
      ["hombre", "mujer", "unisex"].includes(c.slug),
    ).map((c) => ({ label: c.nombre, href: `/catalogo/${c.slug}` })),
  },
  {
    titulo: "Por tipo",
    enlaces: CATEGORIAS.filter((c) =>
      ["arabes", "nicho", "inspirados", "body-mist"].includes(c.slug),
    ).map((c) => ({ label: c.nombre, href: `/catalogo/${c.slug}` })),
  },
  {
    titulo: "Por familia",
    enlaces: [
      { label: "Amaderado", href: "/catalogo?familia=Amaderado" },
      { label: "Oriental", href: "/catalogo?familia=Oriental" },
      { label: "Floral", href: "/catalogo?familia=Floral" },
      { label: "Cítrico", href: "/catalogo?familia=C%C3%ADtrico" },
      { label: "Gourmand", href: "/catalogo?familia=Gourmand" },
      { label: "Ver todo el catálogo", href: "/catalogo" },
    ],
  },
];

export const NAVEGACION: readonly SeccionNav[] = [
  {
    label: "3x2 en toda la tienda",
    href: "/promociones",
    destacado: true,
  },
  { label: "Rebajas", href: "/promociones?vista=rebajas" },
  {
    label: "Perfumes",
    href: "/catalogo",
    grupos: PERFUMES,
    promo: {
      titulo: "¿No sabes cuál elegir?",
      texto:
        "El Set Descubrimiento trae cinco de nuestros más vendidos en 10 ml. Pruebas todos y luego decides el frasco grande.",
      href: "/catalogo/sets",
      cta: "Ver el set",
    },
  },
  {
    label: "Marcas",
    href: "/catalogo",
    grupos: [
      {
        titulo: "Nuestras casas",
        enlaces: MARCAS.slice(0, 6).map((m) => ({
          label: m.nombre,
          href: `/marca/${m.slug}`,
          nota: m.pais,
        })),
      },
      {
        titulo: " ",
        enlaces: MARCAS.slice(6).map((m) => ({
          label: m.nombre,
          href: `/marca/${m.slug}`,
          nota: m.pais,
        })),
      },
    ],
  },
  {
    label: "Lotes",
    href: "/lotes",
    grupos: [
      {
        titulo: "Por volumen",
        enlaces: LOTES.filter((l) => l.tema === "Mixto").map((l) => ({
          label: `${l.piezas} piezas`,
          href: `/lotes/${l.slug}`,
          nota: l.masVendido ? "Más vendido" : undefined,
        })),
      },
      {
        titulo: "Surtido temático",
        enlaces: LOTES.filter((l) => l.tema !== "Mixto").map((l) => ({
          label: l.tema,
          href: `/lotes/${l.slug}`,
        })),
      },
    ],
    promo: {
      titulo: "Calcula tu ganancia",
      texto:
        "Mueve el número de piezas y te decimos cuánto inviertes, a cómo te queda cada frasco y cuánto ganas al revender.",
      href: "/mayoreo#calculadora",
      cta: "Abrir calculadora",
    },
  },
  { label: "Sets y regalos", href: "/catalogo/sets" },
  { label: "Mayoreo", href: "/mayoreo" },
] as const;

/** Enlaces del footer, por columna (§7.7). */
export const FOOTER_TIENDA: EnlaceNav[] = [
  { label: "Hombre", href: "/catalogo/hombre" },
  { label: "Mujer", href: "/catalogo/mujer" },
  { label: "Unisex", href: "/catalogo/unisex" },
  { label: "Árabes", href: "/catalogo/arabes" },
  { label: "Lotes de mayoreo", href: "/lotes" },
  { label: "Sets y regalos", href: "/catalogo/sets" },
  { label: "Rebajas", href: "/promociones" },
];

export const FOOTER_AYUDA: EnlaceNav[] = [
  { label: "Envíos", href: "/envios" },
  { label: "Devoluciones", href: "/devoluciones" },
  { label: "Rastrear pedido", href: "/cuenta" },
  { label: "Preguntas frecuentes", href: "/faq" },
  { label: "Contacto", href: "/contacto" },
  { label: "Nosotros", href: "/nosotros" },
];

export const FOOTER_LEGAL: EnlaceNav[] = [
  { label: "Términos y condiciones", href: "/terminos" },
  { label: "Aviso de privacidad", href: "/privacidad" },
];
