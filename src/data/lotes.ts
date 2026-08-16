import type { Lote } from "@/types";
import { getProducto, precioDesde } from "./productos";

interface SemillaLote {
  slug: string;
  nombre: string;
  tema: string;
  piezas: number;
  /** Modelos distintos que trae el lote; se reparten en partes iguales. */
  modelos: string[];
  /**
   * Precio de venta del paquete, fijado a mano.
   *
   * Antes salía de aplicar un descuento sobre la suma del menudeo. Ahora la
   * escalera de precios es una decisión comercial —cada escalón tiene que bajar
   * el costo por perfume respecto al anterior, y eso es justo lo que se le
   * promete al cliente en la tarjeta—, así que se declara y no se calcula.
   */
  precio: number;
  descripcion: string;
  incluye: string[];
  masVendido?: boolean;
}

/**
 * Cinco paquetes, uno por escalón de volumen.
 *
 * Ya no hay surtidos temáticos (árabes, solo hombre, solo mujer): obligaban a
 * elegir por gusto a quien todavía no sabe qué se vende en su zona, y repartían
 * la atención entre ocho opciones. La única decisión que se le pide ahora a
 * quien empieza es cuánto quiere invertir.
 */
const SEMILLAS_LOTE: readonly SemillaLote[] = [
  {
    slug: "paquete-inicio",
    nombre: "Paquete Inicio",
    tema: "Mixto",
    piezas: 10,
    precio: 4299,
    modelos: [
      "frutos-del-septimo",
      "praline",
      "azahar-de-marzo",
      "costa-amalfi",
      "monoi",
    ],
    descripcion:
      "El primer paquete con el que ya se gana dinero. Diez perfumes de rotación probada para averiguar qué se mueve en tu zona antes de invertir en volumen.",
    incluye: [
      "10 Perfumes a Precio de Importador Directo",
      "Envío Gratis y Pago Seguro",
      "Atención Rápida y De Calidad",
    ],
  },
  {
    slug: "paquete-emprendedor",
    nombre: "Paquete Emprendedor",
    tema: "Mixto",
    piezas: 20,
    precio: 8199,
    modelos: [
      "frutos-del-septimo",
      "praline",
      "cafe-de-olla",
      "azahar-de-marzo",
      "solaris-azul",
      "vetiver-haiti",
    ],
    descripcion:
      "El punto donde el negocio empieza a tener sentido: veinte perfumes, seis modelos distintos y un costo por pieza menor que el del Paquete Inicio.",
    incluye: [
      "20 Perfumes a Precio de Importador Directo",
      "Envío Gratis y Pago Seguro",
      "Atención Rápida y De Calidad",
      "Menor Costo/Perfume que Paquete Inicio",
    ],
  },
  {
    slug: "paquete-negocio",
    nombre: "Paquete Negocio",
    tema: "Mixto",
    piezas: 30,
    precio: 12149,
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
    descripcion:
      "Nuestro paquete más vendido. Ocho modelos cubren prácticamente cualquier gusto y el volumen deja margen para dar descuentos y seguir ganando.",
    incluye: [
      "30 Perfumes a Precio de Importador Directo",
      "Envío Gratis y Pago Seguro",
      "Atención Rápida y De Calidad",
      "Menor Costo/Perfume que Paquete Emprendedor",
    ],
    masVendido: true,
  },
  {
    slug: "paquete-mayorista",
    nombre: "Paquete Mayorista",
    tema: "Mixto",
    piezas: 40,
    precio: 15999,
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
    descripcion:
      "Cuarenta perfumes de diez modelos para quien ya vende y no quiere quedarse sin inventario a media quincena.",
    incluye: [
      "40 Perfumes a Precio de Importador Directo",
      "Envío Gratis y Pago Seguro",
      "Atención Rápida y De Calidad",
      "Menor Costo/Perfume que Paquete Negocio",
    ],
  },
  {
    slug: "paquete-super-mayorista",
    nombre: "Paquete Super Mayorista",
    tema: "Mixto",
    piezas: 50,
    precio: 19749,
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
    descripcion:
      "La paca completa: cincuenta perfumes, diez modelos y el mejor precio unitario que damos. Es el paquete con el que trabajan nuestras distribuidoras.",
    incluye: [
      "50 Perfumes a Precio de Importador Directo",
      "Envío Gratis y Pago Seguro",
      "Atención Rápida y De Calidad",
      "Menor Costo/Perfume que Paquete Mayorista",
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

  // Valor del paquete a precio de menudeo — la referencia contra la que se
  // calculan tanto el "antes" tachado como la utilidad estimada del revendedor.
  const valorMenudeo = piezasDetalladas.reduce((suma, slug) => {
    const producto = getProducto(slug);
    return suma + (producto ? precioDesde(producto) : 0);
  }, 0);

  return {
    id: semilla.slug,
    slug: semilla.slug,
    nombre: semilla.nombre,
    piezas: semilla.piezas,
    precio: semilla.precio,
    precioIndividualEquivalente:
      Math.round((semilla.precio / semilla.piezas) * 100) / 100,
    // Si vendes cada pieza al precio de menudeo publicado, esto es lo que queda.
    utilidadEstimada: Math.round(valorMenudeo - semilla.precio),
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

/** Los paquetes que destaca la home: ahora son los cinco, no un subconjunto. */
export const LOTES_DESTACADOS = LOTES;

/** Utilidad máxima de un solo lote — alimenta el gancho de la home (§8.6). */
export const UTILIDAD_MAXIMA = Math.max(...LOTES.map((l) => l.utilidadEstimada));
