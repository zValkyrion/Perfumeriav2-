import type { Lote } from "@/types";
import { getProducto, precioDesde } from "./productos";

interface SemillaLote {
  slug: string;
  nombre: string;
  tema: string;
  piezas: number;
  /** Modelos distintos que trae el lote; se reparten en partes iguales. */
  modelos: string[];
  /** Descuento del lote sobre el precio de menudeo sumado. */
  descuento: number;
  descripcion: string;
  incluye: string[];
  masVendido?: boolean;
}

const SEMILLAS_LOTE: readonly SemillaLote[] = [
  {
    slug: "lote-6-arranque",
    nombre: "Lote Arranque · 6 piezas",
    tema: "Mixto",
    piezas: 6,
    modelos: [
      "frutos-del-septimo",
      "praline",
      "azahar-de-marzo",
      "costa-amalfi",
      "monoi",
      "verde-ingles",
    ],
    descuento: 0.28,
    descripcion:
      "El lote más pequeño con el que ya se gana dinero. Seis modelos distintos, todos de rotación probada, para averiguar qué se mueve en tu zona antes de invertir en volumen.",
    incluye: [
      "6 perfumes de 6 modelos distintos",
      "Envío gratis a todo México",
      "Bolsas de regalo AURA incluidas",
      "Lista de precios sugeridos de venta",
    ],
  },
  {
    slug: "lote-12-emprendedor",
    nombre: "Lote Emprendedor · 12 piezas",
    tema: "Mixto",
    piezas: 12,
    modelos: [
      "frutos-del-septimo",
      "praline",
      "cafe-de-olla",
      "azahar-de-marzo",
      "solaris-azul",
      "vetiver-haiti",
    ],
    descuento: 0.42,
    descripcion:
      "El punto donde el negocio empieza a tener sentido: ya entras a precio de distribuidor y el margen por pieza se duplica respecto al lote de 6.",
    incluye: [
      "12 perfumes · 6 modelos, 2 de cada uno",
      "Envío gratis y seguro de paquetería",
      "Bolsas de regalo y etiquetas AURA",
      "Guía de venta para redes sociales",
    ],
  },
  {
    slug: "lote-24-negocio",
    nombre: "Lote Negocio · 24 piezas",
    tema: "Mixto",
    piezas: 24,
    modelos: [
      "frutos-del-septimo",
      "praline",
      "cafe-de-olla",
      "azahar-de-marzo",
      "solaris-azul",
      "sal-y-higuera",
      "vetiver-haiti",
      "copal",
    ],
    descuento: 0.48,
    descripcion:
      "Nuestro lote más vendido. Ocho modelos cubren prácticamente cualquier gusto, y el volumen te deja precio de distribuidor con margen para dar descuentos y seguir ganando.",
    incluye: [
      "24 perfumes · 8 modelos, 3 de cada uno",
      "Envío gratis y seguro de paquetería",
      "Bolsas, etiquetas y probadores",
      "Asesoría por WhatsApp para tu primera venta",
    ],
    masVendido: true,
  },
  {
    slug: "lote-50-distribuidor",
    nombre: "Lote Distribuidor · 50 piezas",
    tema: "Mixto",
    piezas: 50,
    modelos: [
      "frutos-del-septimo",
      "praline",
      "cafe-de-olla",
      "azucar-quemada",
      "azahar-de-marzo",
      "costa-amalfi",
      "solaris-azul",
      "sal-y-higuera",
      "vetiver-haiti",
      "copal",
    ],
    descuento: 0.55,
    descripcion:
      "Para quien ya vende y necesita inventario. Diez modelos, cincuenta piezas y el mejor precio unitario que damos. Es el lote con el que trabajan nuestras distribuidoras de Bajío y Occidente.",
    incluye: [
      "50 perfumes · 10 modelos, 5 de cada uno",
      "Envío gratis y seguro de paquetería",
      "Material de punto de venta impreso",
      "Precio preferente en tus siguientes pedidos",
    ],
  },
  {
    slug: "lote-hombre",
    nombre: "Lote Solo Hombre · 12 piezas",
    tema: "Hombre",
    piezas: 12,
    modelos: [
      "vetiver-haiti",
      "solaris-azul",
      "costa-amalfi",
      "madera-palida",
      "bergamota-salina",
      "resina-1901",
    ],
    descuento: 0.42,
    descripcion:
      "Doce piezas pensadas para clientela masculina: amaderados, cítricos y acuáticos de uso diario. Es el lote que mejor funciona cerca de oficinas y gimnasios.",
    incluye: [
      "12 perfumes masculinos · 6 modelos",
      "Envío gratis a todo México",
      "Bolsas de regalo AURA incluidas",
      "Lista de precios sugeridos de venta",
    ],
  },
  {
    slug: "lote-mujer",
    nombre: "Lote Solo Mujer · 12 piezas",
    tema: "Mujer",
    piezas: 12,
    modelos: [
      "frutos-del-septimo",
      "praline",
      "azucar-quemada",
      "monoi",
      "jazmin-de-medianoche",
      "vanille-obscure",
    ],
    descuento: 0.42,
    descripcion:
      "Florales, gourmands y un oriental para noche. Es el surtido con la rotación más rápida del catálogo y el que más se repite entre revendedoras.",
    incluye: [
      "12 perfumes femeninos · 6 modelos",
      "Envío gratis a todo México",
      "Bolsas de regalo AURA incluidas",
      "Guía de venta para redes sociales",
    ],
  },
  {
    slug: "lote-arabes",
    nombre: "Lote Árabes · 12 piezas",
    tema: "Árabes",
    piezas: 12,
    modelos: ["oud-y-rosa", "ambar-gris", "azafran-real", "kairo-noche"],
    descuento: 0.42,
    descripcion:
      "Cuatro modelos de la escuela del Golfo, tres piezas de cada uno. Ticket más alto y margen por pieza muy superior: es el lote con el que se atiende a clientela que ya sabe de perfumes.",
    incluye: [
      "12 perfumes árabes · 4 modelos",
      "Envío gratis y seguro de paquetería",
      "Probadores de 2 ml de cada modelo",
      "Ficha olfativa impresa por modelo",
    ],
  },
  {
    slug: "lote-best-sellers",
    nombre: "Lote Best Sellers · 24 piezas",
    tema: "Más vendidos",
    piezas: 24,
    modelos: [
      "praline",
      "frutos-del-septimo",
      "azahar-de-marzo",
      "monoi",
      "cafe-de-olla",
      "sal-y-higuera",
      "vetiver-haiti",
      "solaris-azul",
    ],
    descuento: 0.48,
    descripcion:
      "Solo los ocho modelos con mejor rotación del año, sin experimentos. Si es tu primer pedido grande y no quieres inventario parado, este es el lote.",
    incluye: [
      "24 perfumes · los 8 más vendidos",
      "Envío gratis y seguro de paquetería",
      "Bolsas, etiquetas y probadores",
      "Garantía de cambio por modelo que no rote",
    ],
  },
] as const;

/** Reparte `piezas` entre los modelos, ciclando la lista. */
function repartir(modelos: string[], piezas: number): string[] {
  return Array.from(
    { length: piezas },
    (_, i) => modelos[i % modelos.length]!,
  );
}

function construirLote(semilla: SemillaLote): Lote {
  const piezasDetalladas = repartir([...semilla.modelos], semilla.piezas);

  // Valor del lote a precio de menudeo — la referencia contra la que se
  // calculan tanto el ahorro como la utilidad estimada del revendedor.
  const valorMenudeo = piezasDetalladas.reduce((suma, slug) => {
    const producto = getProducto(slug);
    return suma + (producto ? precioDesde(producto) : 0);
  }, 0);

  const precio = Math.round((valorMenudeo * (1 - semilla.descuento)) / 10) * 10;

  return {
    id: semilla.slug,
    slug: semilla.slug,
    nombre: semilla.nombre,
    piezas: semilla.piezas,
    precio,
    precioIndividualEquivalente: Math.round((precio / semilla.piezas) * 100) / 100,
    // Si vendes cada pieza al precio de menudeo publicado, esto es lo que queda.
    utilidadEstimada: Math.round(valorMenudeo - precio),
    incluye: [...semilla.incluye],
    imagen: `/lotes/${semilla.slug}.webp`,
    masVendido: semilla.masVendido,
    productos: [...semilla.modelos],
    descripcion: semilla.descripcion,
    tema: semilla.tema,
  };
}

export const LOTES: readonly Lote[] = SEMILLAS_LOTE.map(construirLote);

export const LOTES_POR_SLUG = new Map(LOTES.map((l) => [l.slug, l]));

export function getLote(slug: string): Lote | undefined {
  return LOTES_POR_SLUG.get(slug);
}

/** Valor a precio de menudeo del lote — para pintar el "antes" tachado. */
export function valorMenudeoLote(lote: Lote): number {
  return lote.precio + lote.utilidadEstimada;
}

/** Los tres lotes que destaca la home (§8.9). */
export const LOTES_DESTACADOS = [
  "lote-12-emprendedor",
  "lote-24-negocio",
  "lote-50-distribuidor",
]
  .map((slug) => LOTES_POR_SLUG.get(slug))
  .filter((l): l is Lote => Boolean(l));

/** Utilidad máxima de un solo lote — alimenta el gancho de la home (§8.6). */
export const UTILIDAD_MAXIMA = Math.max(...LOTES.map((l) => l.utilidadEstimada));
