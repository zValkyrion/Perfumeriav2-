import type { Lote, Marca, Producto } from "@/types";
import { precioRedondo as redondo, precio as fmt } from "./format";

/**
 * Plantillas de title y description.
 *
 * La fórmula es siempre la misma: **qué es + diferenciador + señal de México**.
 * Lo que no puede faltar nunca es la señal local: el comprador mexicano filtra
 * por envío nacional antes que por marca, y ese es el filtro que decide el clic.
 *
 * Sobre el largo: la `template` del layout agrega ` | EL REY DE LOS PERFUMES`,
 * que son 24 caracteres. Google corta alrededor de los 60, así que la parte
 * propia de cada página tiene que caber en unos 35 para que la marca sobreviva
 * en el resultado. Por eso los títulos de aquí son más cortos de lo que parece
 * razonable: el resto lo pone la plantilla.
 */

/** Duración real en horas, la misma escala que usa la ficha de producto. */
const DURACION: Record<number, string> = {
  1: "1 a 2 horas",
  2: "2 a 4 horas",
  3: "4 a 6 horas",
  4: "6 a 9 horas",
  5: "más de 10 horas",
};

/** Imagen OG del sitio, para las páginas que no tienen una propia. */
export const OG_POR_DEFECTO = {
  url: "/og/portada.jpg",
  width: 1200,
  height: 630,
  alt: "EL REY DE LOS PERFUMES — perfumería fina al mayoreo y menudeo en México",
};

export function ogDe(ruta: string, alt: string) {
  return { url: ruta, width: 1200, height: 630, alt };
}

/* ── Límites y ajuste ─────────────────────────────────────────────────── */

/** Corte máximo de description que Google muestra sin recortar. */
const LARGO_DESCRIPCION = 155;

/**
 * Presupuesto de título para la parte propia de la página: 60 caracteres
 * menos los 25 que ocupa ` | EL REY DE LOS PERFUMES`. Los nombres del
 * catálogo van de 7 a 22 caracteres, así que no hay una fórmula que quepa
 * siempre: cada plantilla ofrece una versión completa y una corta.
 */
const LARGO_TITULO = 35;

/** La primera variante que quepa; si ninguna cabe, la última. */
function elMasLargoQueQuepa(...variantes: string[]): string {
  return (
    variantes.find((v) => v.length <= LARGO_TITULO) ??
    variantes[variantes.length - 1]!
  );
}

/** Devuelve las primeras oraciones completas de `texto` que caben en `max`. */
function oracionesQueQuepan(texto: string, max: number): string {
  if (max <= 0) return "";
  if (texto.length <= max) return texto;

  let salida = "";
  for (const oracion of texto.split(/(?<=\.)\s+/)) {
    if (salida.length + oracion.length + 1 > max) break;
    salida += (salida ? " " : "") + oracion;
  }
  return salida;
}

/**
 * El gancho comercial va fijo al frente y el texto de autor rellena lo que
 * quede, cortando por oración completa. Concatenar a ciegas dejaba la mitad
 * de las descripciones por encima del corte, partidas a media palabra.
 */
function completar(cabeza: string, relleno: string): string {
  const extra = oracionesQueQuepan(relleno, LARGO_DESCRIPCION - cabeza.length - 1);
  return extra ? `${cabeza} ${extra}` : cabeza;
}

/* ── Producto ─────────────────────────────────────────────────────────── */

/**
 * `Noir Absolu 100 ml — Maison Lumière`, y si no cabe, `Noir Absolu 100 ml`.
 *
 * Lo primero que se sacrifica es la casa, no la presentación: nadie busca por
 * el nombre de una casa que no conoce, pero "100 ml" sí aparece en la consulta
 * de quien ya sabe qué frasco quiere. La concentración se va a la description,
 * donde se lee junto al beneficio y no gasta presupuesto de título.
 */
export function tituloProducto(producto: Producto, nombreMarca: string): string {
  const ml = Math.max(...producto.presentaciones.map((p) => p.ml));
  return elMasLargoQueQuepa(
    `${producto.nombre} ${ml} ml — ${nombreMarca}`,
    `${producto.nombre} ${ml} ml`,
  );
}

/**
 * El beneficio real primero —a qué huele y cuánto dura—, el precio después y
 * el envío al final. En ese orden porque es el orden en que se decide.
 */
export function descripcionProducto(producto: Producto, desde: number): string {
  const familia = producto.familia.toLowerCase();
  const dura = DURACION[producto.duracion] ?? "toda la jornada";
  const cabeza = `${producto.concentracion} ${familia} que dura ${dura}. Desde ${redondo(desde)} MXN con envío gratis a todo México.`;
  return completar(cabeza, `${producto.descripcionCorta}.`);
}

/* ── Marca ────────────────────────────────────────────────────────────── */

export function tituloMarca(marca: Marca): string {
  return elMasLargoQueQuepa(
    `Perfumes ${marca.nombre} en México`,
    `Perfumes ${marca.nombre}`,
  );
}

export function descripcionMarca(marca: Marca, cantidad: number): string {
  const piezas = cantidad === 1 ? "1 perfume" : `${cantidad} perfumes`;
  const cabeza = `${piezas} de ${marca.nombre}, casa de ${marca.pais} desde ${marca.fundada}. Envío gratis a todo México y mayoreo desde 3 piezas.`;
  return completar(cabeza, marca.firma);
}

/* ── Categoría ────────────────────────────────────────────────────────── */

/**
 * Sirve igual para categorías y para familias olfativas: las dos son facetas
 * del catálogo y las dos traen el título ya redactado como consulta real
 * ("Perfumes para hombre", "Perfumes amaderados").
 */
export interface Faceta {
  titulo: string;
  descripcion: string;
}

/**
 * Al título solo se le agrega el precio de entrada: en este mercado el precio
 * es lo que decide el clic entre diez resultados que dicen lo mismo.
 */
export function tituloCategoria(categoria: Faceta, desde: number): string {
  // Sin centavos: en un título los decimales solo gastan caracteres.
  return `${categoria.titulo} desde ${redondo(desde)}`;
}

/**
 * El gancho comercial va primero y con el resto se rellena hasta donde quepa,
 * cortando por oración completa. Las descripciones de categoría van de 90 a
 * 145 caracteres, así que concatenar a ciegas dejaba varias por encima del
 * corte de Google, con la frase partida a media palabra.
 */
export function descripcionCategoria(
  categoria: Faceta,
  cantidad: number,
  desde: number,
): string {
  const cabeza = `${cantidad} modelos desde ${redondo(desde)} MXN con envío gratis a todo México.`;
  return completar(cabeza, categoria.descripcion);
}

/* ── Lote ─────────────────────────────────────────────────────────────── */

/**
 * Aquí el vocabulario cambia: quien busca esto no escribe "perfume", escribe
 * "paca", "lote" o "mayoreo". El título usa las palabras del revendedor y no
 * el nombre comercial del lote —"Lote Emprendedor" no lo busca nadie, "lote de
 * 12 perfumes al mayoreo" sí—, que de todos modos sigue en el h1 de la página.
 */
export function tituloLote(lote: Lote): string {
  return `Lote de ${lote.piezas} perfumes al mayoreo`;
}

export function descripcionLote(lote: Lote): string {
  return `${lote.piezas} perfumes por ${fmt(lote.precio)} MXN — ${fmt(lote.precioIndividualEquivalente)} la pieza. Precio de distribuidor, envío gratis a todo México y lista de precios sugeridos.`;
}
