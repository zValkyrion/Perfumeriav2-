import type { Catalogo, ImagenCatalogo } from "../../compartido/catalogo";
import datos from "./catalogo.json";

/**
 * El catálogo que compila la tienda.
 *
 * `catalogo.json` es la copia versionada que genera `npm run catalogo`. En el
 * despliegue a AWS, `scripts/obtener-catalogo.ts` la sustituye antes del build
 * por lo que devuelve `GET /catalogo` —lo que hay en DynamoDB—, así que en
 * producción la tienda publica la base de datos y no el archivo. Sin API
 * (desarrollo, GitHub Pages) se queda la copia.
 *
 * Todo lo demás de `src/data` lee de aquí: productos, marcas, sets y lotes.
 */
export const CATALOGO = datos as unknown as Catalogo;

/**
 * Dónde viven las fotos. En producción, la distribución de CloudFront del
 * bucket de imágenes; sin ella, la copia que deja `npm run catalogo` en
 * `public/imagenes/`, que tiene exactamente las mismas claves.
 */
const BASE_IMAGENES =
  (process.env.NEXT_PUBLIC_IMAGENES ?? "").replace(/\/+$/, "") || "/imagenes";

export function urlImagen(imagen: ImagenCatalogo): string {
  return `${BASE_IMAGENES}/${imagen.clave}`;
}

/** Foto de reemplazo para un producto que todavía no tiene la suya. */
export const SIN_FOTO = "/productos/sin-foto.webp";

const BLURS = new Map<string, string>();
for (const conFotos of [...CATALOGO.productos, ...CATALOGO.sets]) {
  for (const imagen of conFotos.imagenes) BLURS.set(urlImagen(imagen), imagen.blur);
}

/** El placeholder blur de una foto del catálogo; viaja dentro del propio catálogo. */
export function blurDeCatalogo(src: string): string | undefined {
  return BLURS.get(src);
}
