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
 */
export function urlAbsoluta(ruta: string): string {
  return ruta === "/" ? SITIO_URL : `${SITIO_URL}${ruta}`;
}
