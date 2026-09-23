import type { Marca } from "@/types";
import { CATALOGO } from "./catalogo";

/**
 * Las casas del catálogo. Cada producto apunta a una por su `slug`.
 *
 * Solo las que tienen algo publicado: una página de marca vacía es un callejón
 * sin salida para quien llega desde Google.
 */
const CON_PRODUCTOS = new Set(
  CATALOGO.productos.filter((p) => p.visible).map((p) => p.marca),
);

export const MARCAS: readonly Marca[] = CATALOGO.marcas.filter((m) =>
  CON_PRODUCTOS.has(m.slug),
);

export const MARCAS_POR_SLUG = new Map(MARCAS.map((m) => [m.slug, m]));

export function getMarca(slug: string): Marca | undefined {
  return MARCAS_POR_SLUG.get(slug);
}
