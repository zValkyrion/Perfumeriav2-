import { valorLote, type LoteCatalogo } from "../../compartido/catalogo";
import type { Lote } from "../types";
import { CATALOGO } from "./catalogo";

/**
 * Los paquetes para revender, uno por escalón de volumen.
 *
 * El precio de cada uno es una decisión comercial y se fija a mano en el
 * catálogo; lo que se calcula aquí es el valor a precio de lista de lo que
 * trae, que es la referencia del «antes» tachado y de la utilidad estimada.
 * Esa cuenta vive en `compartido/` porque el servidor la usa también para
 * aplicar el tope de descuento.
 */
const TODOS = new Map(CATALOGO.productos.map((p) => [p.codigo, p]));

function construirLote(l: LoteCatalogo): Lote {
  const valorMenudeo = valorLote(l, CATALOGO.productos);
  return {
    id: l.slug,
    slug: l.slug,
    nombre: l.nombre,
    piezas: l.piezas,
    precio: l.precio,
    precioIndividualEquivalente: Math.round((l.precio / l.piezas) * 100) / 100,
    // Si vendes cada pieza al precio de lista publicado, esto es lo que queda.
    utilidadEstimada: Math.round(valorMenudeo - l.precio),
    incluye: [...l.incluye],
    imagen: `/lotes/${l.slug}.webp`,
    masVendido: l.masVendido,
    // Las páginas enlazan por slug; el catálogo guarda códigos.
    productos: l.modelos.flatMap((codigo) => {
      const p = TODOS.get(codigo);
      return p?.visible ? [p.slug] : [];
    }),
    descripcion: l.descripcion,
    tema: l.tema,
  };
}

export const LOTES: readonly Lote[] = CATALOGO.lotes.map(construirLote);

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
