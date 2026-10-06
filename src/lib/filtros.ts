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
      // No hay cifra de ventas por producto en el catálogo: lo que hay es la
      // etiqueta «Más vendido» que pone el negocio. Esos primero y, dentro de
      // cada grupo, el orden del catálogo (`sort` es estable). Antes ordenaba
      // por un número de reseñas sacado al azar.
      return copia.sort((a, b) => Number(esMasVendido(b)) - Number(esMasVendido(a)));
    case "novedades":
      // Lo marcado como «Nuevo» primero; después, el año de lanzamiento si se
      // conoce. Casi ningún producto real lo trae, así que el año solo desempata.
      return copia.sort(
        (a, b) =>
          Number(b.badges.includes("Nuevo")) - Number(a.badges.includes("Nuevo")) ||
          (b.anio ?? 0) - (a.anio ?? 0),
      );
    default:
      // «Destacados»: lo que el negocio marca como destacado, luego lo que
      // marca como más vendido, y el resto en el orden del catálogo. Todo sale
      // de datos del catálogo; nada de popularidad inventada.
      return copia.sort(
        (a, b) =>
          Number(b.destacado) - Number(a.destacado) ||
          Number(esMasVendido(b)) - Number(esMasVendido(a)),
      );
  }
}

function esMasVendido(p: Producto): boolean {
  return p.badges.includes("Más vendido");
}

/** Cuántos productos tiene cada opción de un filtro: `clave → valor → n`. */
export type Conteos = Record<string, ReadonlyMap<string, number>>;

/**
 * Cuántos productos quedarían al marcar cada opción, con los **demás**
 * filtros puestos (los de su propio grupo no cuentan: dentro de un grupo se
 * combinan con O). Sirve para enseñar el número junto a cada casilla y para
 * esconder las que dejarían la lista vacía —por ejemplo, las marcas que no
 * tienen nada en existencia cuando «Solo en existencia» está puesto—.
 */
export function contarOpciones(base: Producto[], f: Filtros): Conteos {
  const sinGrupo = (clave: keyof Filtros): Filtros => ({ ...f, [clave]: [] });
  const contar = (lista: Producto[], valoresDe: (p: Producto) => readonly string[]) => {
    const m = new Map<string, number>();
    for (const p of lista) for (const v of new Set(valoresDe(p))) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  };
  const promos = (p: Producto) => [
    ...(p.badges.includes("3x2") ? ["3x2"] : []),
    ...(tieneRebaja(p) ? ["rebaja"] : []),
  ];
  return {
    genero: contar(aplicarFiltros(base, sinGrupo("genero")), (p) => [p.genero]),
    familia: contar(aplicarFiltros(base, sinGrupo("familia")), (p) => [p.familia]),
    marca: contar(aplicarFiltros(base, sinGrupo("marca")), (p) => [p.marca]),
    conc: contar(aplicarFiltros(base, sinGrupo("concentracion")), (p) => [p.concentracion]),
    ml: contar(aplicarFiltros(base, sinGrupo("ml")), (p) => p.presentaciones.map((v) => String(v.ml))),
    ocasion: contar(aplicarFiltros(base, sinGrupo("ocasion")), (p) => p.ocasion),
    promo: contar(aplicarFiltros(base, sinGrupo("promo")), promos),
    // Cuántos hay en existencia con todo lo demás puesto: para decir en el
    // interruptor cuántos quedarían al encenderlo.
    stock: contar(aplicarFiltros(base, { ...f, soloStock: false }), (p) =>
      p.presentaciones.some((v) => v.stock > 0) ? ["1"] : [],
    ),
  };
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
    (f.soloStock ? 1 : 0)
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
    chips.push({ clave: "stock", valor: "1", etiqueta: "Solo en existencia" });
  }

  return chips;
}
