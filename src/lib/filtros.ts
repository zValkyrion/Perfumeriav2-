import { MARCAS_POR_SLUG } from "@/data/marcas";
import { PRODUCTOS, precioDesde, tieneRebaja } from "@/data/productos";
import type { Orden } from "@/data/taxonomia";
import type { Producto } from "@/types";

export interface Filtros {
  genero: string[];
  familia: string[];
  marca: string[];
  concentracion: string[];
  ml: number[];
  ocasion: string[];
  promo: string[];
  precioMin?: number;
  precioMax?: number;
  soloStock: boolean;
  rating?: number;
  orden: Orden;
  /** Cuántos productos se muestran; sube de 24 en 24 (§9). */
  mostrar: number;
}

export type ParamsBusqueda = Record<string, string | string[] | undefined>;

function lista(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const crudo = Array.isArray(v) ? v.join(",") : v;
  return crudo
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function numeroDe(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const ORDENES_VALIDOS = new Set<string>([
  "relevancia",
  "vendidos",
  "precio-asc",
  "precio-desc",
  "novedades",
  "rating",
]);

export function leerFiltros(params: ParamsBusqueda): Filtros {
  const orden = Array.isArray(params.orden) ? params.orden[0] : params.orden;

  return {
    genero: lista(params.genero),
    familia: lista(params.familia),
    marca: lista(params.marca),
    concentracion: lista(params.conc),
    ml: lista(params.ml).map(Number).filter(Number.isFinite),
    ocasion: lista(params.ocasion),
    promo: lista(params.promo),
    precioMin: numeroDe(params.precioMin),
    precioMax: numeroDe(params.precioMax),
    soloStock: lista(params.stock).includes("1"),
    rating: numeroDe(params.rating),
    orden:
      orden && ORDENES_VALIDOS.has(orden) ? (orden as Orden) : "relevancia",
    mostrar: numeroDe(params.n) ?? 24,
  };
}

/** Rango de precio de todo el catálogo, para los topes del slider. */
export const PRECIO_MIN = Math.min(...PRODUCTOS.map(precioDesde));
export const PRECIO_MAX = Math.max(
  ...PRODUCTOS.map((p) => Math.max(...p.presentaciones.map((v) => v.precio))),
);

/** Aplica los filtros. Todos se combinan con Y; dentro de cada uno, con O. */
export function aplicarFiltros(base: Producto[], f: Filtros): Producto[] {
  return base.filter((p) => {
    if (f.genero.length && !f.genero.includes(p.genero)) return false;
    if (f.familia.length && !f.familia.includes(p.familia)) return false;
    if (f.marca.length && !f.marca.includes(p.marca)) return false;
    if (f.concentracion.length && !f.concentracion.includes(p.concentracion))
      return false;

    if (f.ml.length && !p.presentaciones.some((v) => f.ml.includes(v.ml)))
      return false;

    if (f.ocasion.length && !p.ocasion.some((o) => f.ocasion.includes(o)))
      return false;

    if (f.promo.includes("3x2") && !p.badges.includes("3x2")) return false;
    if (f.promo.includes("rebaja") && !tieneRebaja(p)) return false;

    const desde = precioDesde(p);
    if (f.precioMin !== undefined && desde < f.precioMin) return false;
    if (f.precioMax !== undefined && desde > f.precioMax) return false;

    if (f.soloStock && !p.presentaciones.some((v) => v.stock > 0)) return false;
    if (f.rating !== undefined && p.rating < f.rating) return false;

    return true;
  });
}

export function ordenar(productos: Producto[], orden: Orden): Producto[] {
  const copia = [...productos];

  switch (orden) {
    case "precio-asc":
      return copia.sort((a, b) => precioDesde(a) - precioDesde(b));
    case "precio-desc":
      return copia.sort((a, b) => precioDesde(b) - precioDesde(a));
    case "vendidos":
      return copia.sort((a, b) => b.totalReseñas - a.totalReseñas);
    case "novedades":
      return copia.sort((a, b) => b.anio - a.anio);
    case "rating":
      return copia.sort((a, b) => b.rating - a.rating);
    default:
      // Relevancia: destacados primero, luego por reseñas.
      return copia.sort((a, b) => {
        if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
        return b.totalReseñas - a.totalReseñas;
      });
  }
}

/** Cuántos filtros hay activos, para el contador del botón "Filtrar" (§9). */
export function contarActivos(f: Filtros): number {
  return (
    f.genero.length +
    f.familia.length +
    f.marca.length +
    f.concentracion.length +
    f.ml.length +
    f.ocasion.length +
    f.promo.length +
    (f.precioMin !== undefined || f.precioMax !== undefined ? 1 : 0) +
    (f.soloStock ? 1 : 0) +
    (f.rating !== undefined ? 1 : 0)
  );
}

export interface ChipActivo {
  clave: string;
  valor: string;
  etiqueta: string;
}

/** Filtros activos en forma de chips, cada uno con su ✕ (§9). */
export function chipsActivos(f: Filtros): ChipActivo[] {
  const chips: ChipActivo[] = [];

  const empujar = (
    clave: string,
    valores: string[],
    etiquetar: (v: string) => string = (v) => v,
  ) => {
    for (const v of valores) {
      chips.push({ clave, valor: v, etiqueta: etiquetar(v) });
    }
  };

  empujar("genero", f.genero);
  empujar("familia", f.familia);
  empujar("conc", f.concentracion);
  empujar("ocasion", f.ocasion);
  empujar("ml", f.ml.map(String), (v) => `${v} ml`);
  empujar(
    "marca",
    f.marca,
    (v) => MARCAS_POR_SLUG.get(v)?.nombre ?? v.replace(/-/g, " "),
  );
  empujar("promo", f.promo, (v) => (v === "3x2" ? "En 3x2" : "En rebaja"));

  if (f.precioMin !== undefined || f.precioMax !== undefined) {
    chips.push({
      clave: "precio",
      valor: "1",
      etiqueta: `$${f.precioMin ?? PRECIO_MIN} – $${f.precioMax ?? PRECIO_MAX}`,
    });
  }
  if (f.soloStock) {
    chips.push({ clave: "stock", valor: "1", etiqueta: "Solo disponibles" });
  }
  if (f.rating !== undefined) {
    chips.push({
      clave: "rating",
      valor: String(f.rating),
      etiqueta: `${f.rating}★ o más`,
    });
  }

  return chips;
}
