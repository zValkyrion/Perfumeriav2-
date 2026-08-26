/**
 * Origen canónico del sitio. Es el único lugar donde vive la URL pública:
 * de aquí salen `metadataBase`, los canonical, el sitemap y el JSON-LD.
 *
 * Producción es la distribución de CloudFront y se sirve en la raíz del
 * dominio: el workflow de AWS no define `PAGES`, así que ese build sale sin
 * `basePath` (ver `next.config.ts`). El valor es fijo a propósito: el canonical
 * debe apuntar a producción aunque el build corra en local o desde el workflow
 * de Pages, que sí lleva `basePath`.
 *
 * GitHub Pages sigue publicando una copia bajo `/Perfumeriav2-`, y no es un
 * descuido: al declarar aquí el origen de CloudFront, esa copia se canonicaliza
 * hacia producción y le cede la autoridad en vez de competir con ella por las
 * mismas búsquedas. Pages no permite redirecciones 301 propias, así que el
 * canonical es el único traspaso posible mientras las dos sigan vivas.
 *
 * Cuando el dominio propio esté apuntando: cambia esta constante a
 * `https://elreydelosperfumes.mx`. Nada más hay que tocar.
 */
export const SITIO_URL = "https://devfq5kjop78h.cloudfront.net";

/**
 * Convierte una ruta interna en URL absoluta para sitemap y JSON-LD, que —a
 * diferencia de los campos de `metadata`— no pasan por `metadataBase`.
 *
 * Siempre termina en barra, porque el sitio se exporta con `trailingSlash` y esa
 * es la forma que declaran los canonical. Un sitemap que anuncia `/mayoreo`
 * mientras la página se declara `/mayoreo/` manda al rastreador a resolver una
 * redirección en cada URL para acabar en la misma página.
 */
export function urlAbsoluta(ruta: string): string {
  const limpia = ruta === "/" ? "" : ruta.replace(/\/+$/, "");
  // Un archivo no lleva barra: `/sitemap.xml/` no existe. Solo las rutas de
  // página, que es lo que exporta Next como carpeta con su index.html.
  const esArchivo = /\.[a-z0-9]+$/i.test(limpia);
  return `${SITIO_URL}${limpia}${esArchivo ? "" : "/"}`;
}
