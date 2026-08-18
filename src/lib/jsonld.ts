import type { Lote, Producto } from "@/types";
import { MARCA } from "@/data/contenido";
import { SITIO_URL, urlAbsoluta } from "./sitio";

/**
 * Datos estructurados del sitio.
 *
 * Regla única y sin excepciones: **solo se marca lo verificable**. Identidad,
 * categoría, casa, notas, presentación y navegación son hechos del catálogo y
 * se emiten. Calificaciones, número de reseñas, precios y disponibilidad salen
 * hoy de `randEntero()` sobre el slug del producto —son deterministas, no
 * reales— y emitirlos como `aggregateRating` u `offers` es justo lo que Google
 * sanciona con acción manual. Van fuera hasta que haya inventario real.
 *
 * Qué falta y por qué, para cuando se pueda:
 *
 * - `offers` con `price`, `priceCurrency` y `availability`: en cuanto los
 *   precios y el stock vengan de un inventario de verdad.
 * - `aggregateRating` y `review`: en cuanto haya reseñas de clientes reales
 *   verificables y visibles en la página.
 * - `LocalBusiness` con `telephone`, `address` y `sameAs`: los datos de
 *   contacto de `src/data/contenido.ts` son marcadores de posición.
 */

/** Serializa el JSON-LD para inyectarlo en un `<script>`. */
export function jsonLd(datos: object): string {
  return JSON.stringify(datos);
}

/* ── Identidad del sitio ──────────────────────────────────────────────── */

/**
 * `Organization` sin datos de contacto: no hay teléfono, dirección ni perfiles
 * sociales reales en el repositorio. Cuando los haya, aquí van `telephone`,
 * `address` y `sameAs`, y esto pasa a ser un `LocalBusiness`.
 */
export function organizacion() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITIO_URL}/#organizacion`,
    name: MARCA.nombre,
    url: SITIO_URL,
    logo: urlAbsoluta("/og/logo.png"),
    slogan: MARCA.tagline,
    areaServed: {
      "@type": "Country",
      name: "México",
      identifier: "MX",
    },
  };
}

export function sitioWeb() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITIO_URL}/#sitio`,
    name: MARCA.nombre,
    url: SITIO_URL,
    inLanguage: "es-MX",
    publisher: { "@id": `${SITIO_URL}/#organizacion` },
    // Google retiró la caja de búsqueda de sitelinks en 2023, así que esto ya
    // no se muestra en resultados. Se mantiene porque sigue describiendo bien
    // la estructura del sitio y no cuesta nada.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITIO_URL}/buscar?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/* ── Navegación ───────────────────────────────────────────────────────── */

export interface Miga {
  nombre: string;
  ruta: string;
}

/** Debe reflejar las migas visibles de la página, no una jerarquía inventada. */
export function migasDePan(migas: Miga[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migas.map((miga, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: miga.nombre,
      item: urlAbsoluta(miga.ruta),
    })),
  };
}

/* ── Producto ─────────────────────────────────────────────────────────── */

/**
 * Ficha de producto sin precio ni disponibilidad, por lo dicho arriba. Lo que
 * sí va —familia olfativa, concentración, notas, año, origen— es contenido de
 * autor del catálogo y describe el producto de verdad.
 */
export function producto(item: Producto, nombreMarca: string) {
  const notas = (tipo: string) =>
    item.notas.filter((n) => n.tipo === tipo).map((n) => n.nombre);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.nombre,
    url: urlAbsoluta(`/producto/${item.slug}`),
    image: item.imagenes.map((img) => urlAbsoluta(img)),
    description: item.descripcionCorta,
    sku: item.presentaciones[0]?.sku,
    brand: { "@type": "Brand", name: nombreMarca },
    category: `Perfumería > ${item.genero} > ${item.familia}`,
    countryOfOrigin: item.origen,
    releaseDate: String(item.anio),
    additionalProperty: [
      propiedad("Familia olfativa", item.familia),
      propiedad("Concentración", item.concentracion),
      propiedad("Género", item.genero),
      propiedad("Presentaciones", presentaciones(item)),
      propiedad("Notas de salida", notas("salida").join(", ")),
      propiedad("Notas de corazón", notas("corazon").join(", ")),
      propiedad("Notas de fondo", notas("fondo").join(", ")),
    ].filter((p) => p.value),
  };
}

function propiedad(nombre: string, valor: string) {
  return { "@type": "PropertyValue", name: nombre, value: valor };
}

function presentaciones(item: Producto): string {
  return item.presentaciones.map((p) => `${p.ml} ml`).join(", ");
}

/* ── Listados ─────────────────────────────────────────────────────────── */

/**
 * `ItemList` de un listado. Solo nombre y URL: es un índice de navegación, no
 * una oferta, y no debe cargar datos que no se puedan sostener.
 */
export function listaProductos(items: readonly Producto[], nombre: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: nombre,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.nombre,
      url: urlAbsoluta(`/producto/${item.slug}`),
    })),
  };
}

export function listaLotes(items: readonly Lote[], nombre: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: nombre,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.nombre,
      url: urlAbsoluta(`/lotes/${item.slug}`),
    })),
  };
}
