/**
 * Origen canónico del sitio. Es el único lugar donde vive la URL pública:
 * de aquí salen `metadataBase`, los canonical, el sitemap y el JSON-LD.
 *
 * Hoy el sitio se sirve desde GitHub Pages, así que la URL incluye el
 * `basePath` del repositorio (ver `next.config.ts`). El valor es fijo a
 * propósito: el canonical debe apuntar a producción aunque el build corra en
 * local, donde `basePath` está vacío.
 *
 * Cuando el dominio propio esté apuntando: cambia esta constante a
 * `https://elreydelosperfumes.mx`, crea `public/CNAME` con ese dominio y quita
 * el `basePath` del workflow. Nada más hay que tocar.
 */
export const SITIO_URL = "https://zvalkyrion.github.io/Perfumeriav2-";

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
