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

/**
 * Barra de navegación principal.
 *
 * Son exactamente los seis destinos de los círculos de "tipos de compra" de la
 * home, con las mismas etiquetas y las mismas URLs. Antes esto era un
 * mega-menú de siete secciones con desplegables: para un mayorista era ruido,
 * porque quien llega ya sabe si viene por surtido, por paquete o por categoría.
 * Un solo juego de enlaces en toda la tienda también significa que el cliente
 * aprende la navegación una vez.
 */
export const NAVEGACION: readonly SeccionNav[] = [
  { label: "Mayoreo surtido", href: "/catalogo", destacado: true },
  { label: "Paquetes", href: "/lotes" },
  { label: "Diseñador", href: "/catalogo/disenador" },
  { label: "Árabes", href: "/catalogo/arabes" },
  { label: "Hombre", href: "/catalogo/hombre" },
  { label: "Mujer", href: "/catalogo/mujer" },
] as const;

/**
 * Categorías del catálogo, para la columna de filtros.
 *
 * Se derivan de la navegación en vez de escribirse aparte: son la misma lista
 * que ve el cliente arriba y en los círculos de la home, y mantener dos copias
 * termina siempre con una desactualizada. Se cae "Paquetes", que no es una
 * categoría de producto sino un formato de venta.
 */
export const CATEGORIAS_CATALOGO: readonly EnlaceNav[] = NAVEGACION.filter(
  (s) => s.href !== "/lotes",
).map((s) => ({ label: s.label, href: s.href }));

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
