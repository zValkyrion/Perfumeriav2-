import type { ProductoCatalogo } from "../../compartido/catalogo";
import { normalizar, puntuar } from "../lib/coincidencia";
import { randEntero } from "../lib/rand";
import type { Nota, Presentacion, Producto } from "../types";
import { CATALOGO, SIN_FOTO, urlImagen } from "./catalogo";

/** Redondea a un precio "de tienda": termina en 0 y nunca en 00. */
function precioBonito(valor: number): number {
  const r = Math.round(valor / 10) * 10;
  return r % 100 === 0 ? r - 10 : r;
}

/**
 * Existencias. No hay inventario por pieza todavía: el catálogo solo dice qué
 * está agotado. Lo que no lo está se vende sin tope, porque un tope inventado
 * —antes era un número al azar entre 15 y 30— impedía justo el pedido que el
 * mayoreo busca: veinte piezas del mismo modelo. Y un «solo quedan 17» sobre un
 * número inventado es una escasez falsa.
 */
const STOCK_DISPONIBLE = 999;

function notas(p: ProductoCatalogo): Nota[] {
  return [
    ...p.salida.map((nombre) => ({ tipo: "salida" as const, nombre })),
    ...p.corazon.map((nombre) => ({ tipo: "corazon" as const, nombre })),
    ...p.fondo.map((nombre) => ({ tipo: "fondo" as const, nombre })),
  ];
}

function presentaciones(p: ProductoCatalogo): Presentacion[] {
  return p.presentaciones.map((v) => ({
    ml: v.ml,
    // El precio es el de la lista, tal cual: redondear una cifra que alguien
    // tecleó a propósito la convertiría en otra.
    precio: v.precio,
    precioAnterior: p.rebaja ? precioBonito(v.precio / (1 - p.rebaja)) : undefined,
    stock: p.agotado ? 0 : STOCK_DISPONIBLE,
    // El código del PDF: es el que el cliente dicta por WhatsApp.
    sku: p.codigo,
  }));
}

function construirProducto(p: ProductoCatalogo): Producto {
  return {
    // El código y no la posición: con la posición, reordenar el catálogo
    // cambiaba el producto de los carritos ya guardados.
    id: p.codigo,
    codigo: p.codigo,
    agotado: p.agotado,
    slug: p.slug,
    nombre: p.nombre,
    marca: p.marca,
    linea: p.linea,
    concentracion: p.concentracion,
    genero: p.genero,
    familia: p.familia,
    notas: notas(p),
    descripcionCorta: p.corta,
    descripcionLarga: p.larga || p.corta,
    presentaciones: presentaciones(p),
    imagenes: p.imagenes.length > 0 ? p.imagenes.map(urlImagen) : [SIN_FOTO],
    badges: p.badges,
    rating: randEntero(`${p.slug}-rating`, 42, 50) / 10,
    totalReseñas: randEntero(`${p.slug}-resenas`, 14, 486),
    duracion: p.duracion,
    estela: p.estela,
    ocasion: p.ocasion,
    // Las ediciones limitadas no entran a la escalera de mayoreo.
    esMayoreoElegible: !p.badges.includes("Edición limitada"),
    destacado: p.destacado,
    viendoAhora: randEntero(`${p.slug}-viendo`, 6, 34),
    anio: p.anio,
    origen: p.origen,
  };
}

/** Lo publicado: los productos ocultos siguen en el catálogo, no en la tienda. */
export const PRODUCTOS: readonly Producto[] = CATALOGO.productos
  .filter((p) => p.visible)
  .map(construirProducto);

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
 * componente de servidor: entradas ligeras en vez de las fichas completas.
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

