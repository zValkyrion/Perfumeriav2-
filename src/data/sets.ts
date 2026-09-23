import type { SetRegalo } from "../types";
import { CATALOGO, urlImagen } from "./catalogo";

/**
 * Los sets de regalo del catálogo: estuches con varias fragancias y un precio
 * propio. No entran a la escalera de volumen —ya traen su precio de estuche—,
 * pero sí cuentan para el envío gratis.
 */
export const SETS: readonly SetRegalo[] = CATALOGO.sets
  .filter((s) => s.visible)
  .map((s) => ({
    id: s.slug,
    slug: s.slug,
    nombre: s.nombre,
    precio: s.precio,
    precioAnterior: s.precioAnterior,
    incluye: [...s.incluye],
    // Los sets sin foto usan el arte genérico de sets.
    imagen: s.imagenes[0] ? urlImagen(s.imagenes[0]) : "/sets/sin-foto.webp",
    descripcion: s.descripcion,
    // Sin inventario por pieza: lo que no está agotado se vende sin tope.
    stock: s.agotado ? 0 : 999,
  }));

export const SETS_POR_SLUG = new Map(SETS.map((s) => [s.slug, s]));

export function getSet(slug: string): SetRegalo | undefined {
  return SETS_POR_SLUG.get(slug);
}
