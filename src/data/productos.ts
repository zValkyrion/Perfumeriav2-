import { normalizar, puntuar } from "@/lib/coincidencia";
import { randEntero } from "@/lib/rand";
import type { Nota, Presentacion, Producto } from "@/types";
import { SEMILLAS, type Semilla } from "./semillas";

/**
 * Precio por presentación, relativo al de 100 ml. No es lineal: en perfumería
 * el frasco grande siempre ofrece mejor precio por mililitro, y ese diferencial
 * es justamente lo que empuja al cliente a subir de tamaño.
 */
const RATIO_ML: Record<number, number> = {
  30: 0.45,
  50: 0.68,
  100: 1,
  200: 1.6,
};

/** Redondea a un precio "de tienda": termina en 0 y nunca en 00. */
function precioBonito(valor: number): number {
  const r = Math.round(valor / 10) * 10;
  return r % 100 === 0 ? r - 10 : r;
}

function sku(semilla: Semilla, ml: number): string {
  const marca = semilla.marca.replace(/-/g, "").slice(0, 3).toUpperCase();
  const nombre = semilla.slug.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `AUR-${marca}-${nombre}-${ml}`;
}

function notas(semilla: Semilla): Nota[] {
  return [
    ...semilla.salida.map((nombre) => ({ tipo: "salida" as const, nombre })),
    ...semilla.corazon.map((nombre) => ({ tipo: "corazon" as const, nombre })),
    ...semilla.fondo.map((nombre) => ({ tipo: "fondo" as const, nombre })),
  ];
}

function presentaciones(semilla: Semilla): Presentacion[] {
  const agotandose = semilla.badges.includes("Últimas piezas");

  return semilla.mls.map((ml) => {
    const precio = precioBonito(semilla.base * (RATIO_ML[ml] ?? 1));
    const precioAnterior = semilla.rebaja
      ? precioBonito(precio / (1 - semilla.rebaja))
      : undefined;

    return {
      ml,
      precio,
      precioAnterior,
      stock: agotandose
        ? randEntero(`${semilla.slug}-${ml}-stock`, 3, 9)
        : randEntero(`${semilla.slug}-${ml}-stock`, 6, 90),
      sku: sku(semilla, ml),
    };
  });
}

function construirProducto(semilla: Semilla, indice: number): Producto {
  return {
    id: `p${String(indice + 1).padStart(3, "0")}`,
    slug: semilla.slug,
    nombre: semilla.nombre,
    marca: semilla.marca,
    linea: semilla.linea,
    concentracion: semilla.concentracion,
    genero: semilla.genero,
    familia: semilla.familia,
    notas: notas(semilla),
    descripcionCorta: semilla.corta,
    descripcionLarga: semilla.larga,
    presentaciones: presentaciones(semilla),
    imagenes: [1, 2, 3, 4].map((n) => `/productos/${semilla.slug}-${n}.webp`),
    badges: semilla.badges,
    rating: randEntero(`${semilla.slug}-rating`, 42, 50) / 10,
    totalReseñas: randEntero(`${semilla.slug}-resenas`, 14, 486),
    duracion: semilla.duracion,
    estela: semilla.estela,
    ocasion: semilla.ocasion,
    // Las ediciones limitadas no entran a la escalera de mayoreo.
    esMayoreoElegible: !semilla.badges.includes("Edición limitada"),
    destacado: semilla.destacado ?? false,
    viendoAhora: randEntero(`${semilla.slug}-viendo`, 6, 34),
    anio: semilla.anio,
    origen: semilla.origen,
  };
}

export const PRODUCTOS: readonly Producto[] = SEMILLAS.map(construirProducto);

export const PRODUCTOS_POR_SLUG = new Map(PRODUCTOS.map((p) => [p.slug, p]));
export const PRODUCTOS_POR_ID = new Map(PRODUCTOS.map((p) => [p.id, p]));

export function getProducto(slug: string): Producto | undefined {
  return PRODUCTOS_POR_SLUG.get(slug);
}

export function getProductoPorId(id: string): Producto | undefined {
  return PRODUCTOS_POR_ID.get(id);
}

/* ── Derivados de precio ──────────────────────────────────────────────── */

export function precioDesde(p: Producto): number {
  return Math.min(...p.presentaciones.map((v) => v.precio));
}

export function precioHasta(p: Producto): number {
  return Math.max(...p.presentaciones.map((v) => v.precio));
}

/** Presentación que se muestra por defecto: 100 ml si existe, si no la mayor. */
export function presentacionPrincipal(p: Producto): Presentacion {
  return (
    p.presentaciones.find((v) => v.ml === 100) ??
    p.presentaciones[p.presentaciones.length - 1]!
  );
}

export function getPresentacion(p: Producto, ml: number): Presentacion {
  return p.presentaciones.find((v) => v.ml === ml) ?? presentacionPrincipal(p);
}

export function stockTotal(p: Producto): number {
  return p.presentaciones.reduce((n, v) => n + v.stock, 0);
}

export function descuentoMaximo(p: Producto): number {
  return p.presentaciones.reduce((max, v) => {
    if (!v.precioAnterior) return max;
    return Math.max(max, 1 - v.precio / v.precioAnterior);
  }, 0);
}

export function tieneRebaja(p: Producto): boolean {
  return p.presentaciones.some((v) => v.precioAnterior !== undefined);
}

/* ── Colecciones para la home y el catálogo ───────────────────────────── */

export const DESTACADOS = PRODUCTOS.filter((p) => p.destacado);

export const MAS_VENDIDOS = PRODUCTOS.filter((p) =>
  p.badges.includes("Más vendido"),
).sort((a, b) => b.totalReseñas - a.totalReseñas);

export const NOVEDADES = PRODUCTOS.filter((p) => p.badges.includes("Nuevo"));

export const EN_PROMOCION = PRODUCTOS.filter(
  (p) => p.badges.includes("3x2") || tieneRebaja(p),
);

export const PROMO_3X2 = PRODUCTOS.filter((p) => p.badges.includes("3x2"));

export function porMarca(slugMarca: string): Producto[] {
  return PRODUCTOS.filter((p) => p.marca === slugMarca);
}

export function porFamilia(familia: string): Producto[] {
  return PRODUCTOS.filter((p) => p.familia === familia);
}

/** Cuenta de productos por marca, para el mega-menú y la landing de marca. */
export const CONTEO_POR_MARCA = PRODUCTOS.reduce<Record<string, number>>(
  (acc, p) => {
    acc[p.marca] = (acc[p.marca] ?? 0) + 1;
    return acc;
  },
  {},
);

/**
 * "Combina bien con": misma ocasión, distinta familia — que es como se
 * recomienda de verdad en mostrador, no simplemente "más de lo mismo".
 */
export function combinaCon(p: Producto, n = 4): Producto[] {
  return PRODUCTOS.filter(
    (o) =>
      o.slug !== p.slug &&
      o.familia !== p.familia &&
      o.ocasion.some((oc) => p.ocasion.includes(oc)),
  )
    .sort((a, b) => b.rating - a.rating)
    .slice(0, n);
}

/** "También te puede interesar": misma familia olfativa (§10.13). */
export function relacionados(p: Producto, n = 10): Producto[] {
  const mismaFamilia = PRODUCTOS.filter(
    (o) => o.slug !== p.slug && o.familia === p.familia,
  );
  const resto = PRODUCTOS.filter(
    (o) =>
      o.slug !== p.slug &&
      o.familia !== p.familia &&
      (o.genero === p.genero || o.marca === p.marca),
  );
  return [...mismaFamilia, ...resto].slice(0, n);
}

/* ── Búsqueda tolerante a errores de dedo (§1.2.2 punto 11) ───────────── */

/** Texto indexable de un producto: nombre, marca, familia, notas y ocasión. */
function textoIndice(p: Producto): string {
  return normalizar(
    [
      p.nombre,
      p.marca.replace(/-/g, " "),
      p.linea ?? "",
      p.familia,
      p.genero,
      p.concentracion,
      p.descripcionCorta,
      ...p.notas.map((n) => n.nombre),
      ...p.ocasion,
    ].join(" "),
  );
}

const INDICE = new Map(
  PRODUCTOS.map((p) => [
    p.slug,
    { texto: textoIndice(p), nombre: normalizar(p.nombre) },
  ]),
);

export function buscar(consulta: string, limite = 60): Producto[] {
  const q = normalizar(consulta);
  if (!q) return [];

  return PRODUCTOS.map((p) => {
    const entrada = INDICE.get(p.slug)!;
    const puntos = puntuar(entrada.nombre, entrada.texto, q);
    // Desempate suave por popularidad.
    return { p, puntos: puntos > 0 ? puntos + p.rating / 10 : 0 };
  })
    .filter((r) => r.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, limite)
    .map((r) => r.p);
}

/** Sugerencias para el autocompletado del buscador. */
export function sugerencias(consulta: string, limite = 6): Producto[] {
  return buscar(consulta, limite);
}

/**
 * Índice compacto para el buscador del header. Se pasa como prop desde un
 * componente de servidor: 52 entradas ligeras en vez de las fichas completas.
 */
export interface EntradaIndice {
  slug: string;
  nombre: string;
  marca: string;
  imagen: string;
  precio: number;
  /** Texto ya normalizado sobre el que se busca. */
  texto: string;
}

export function indiceCompacto(): EntradaIndice[] {
  return PRODUCTOS.map((p) => ({
    slug: p.slug,
    nombre: p.nombre,
    marca: p.marca,
    imagen: p.imagenes[0]!,
    precio: precioDesde(p),
    texto: INDICE.get(p.slug)!.texto,
  }));
}

