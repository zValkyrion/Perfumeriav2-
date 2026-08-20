import type { NextConfig } from "next";

/**
 * El `basePath` solo existe para GitHub Pages, que sirve el sitio bajo el nombre
 * del repositorio.
 *
 * Se activa con `PAGES=1`, **no** detectando `GITHUB_ACTIONS`. La diferencia
 * importa: esta misma tienda también se compila desde el workflow que publica en
 * CloudFront, donde va en la raíz del dominio. Con la detección automática, ese
 * build heredaba `/Perfumeriav2-` y el sitio quedaba colgando de una ruta que allí
 * no existe.
 */
const paraPages = process.env.PAGES === "1";
let repo = "";
if (paraPages && process.env.GITHUB_REPOSITORY) {
  repo = process.env.GITHUB_REPOSITORY.replace(/.*?\//, "");
}

const basePath = repo ? `/${repo}` : "";

const nextConfig: NextConfig = {
  output: "export",
  // Cada ruta se exporta como `ruta/index.html`, así que GitHub Pages sirve
  // igual `/mayoreo` que `/mayoreo/`. Sin esto la segunda forma daba 404, y es
  // la que genera cualquiera que copie el enlace desde la barra del navegador.
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    // La exportación estática no lleva optimizador de imágenes; el arte de
    // producto ya se genera en WebP al tamaño correcto (scripts/generar-imagenes.ts).
    unoptimized: true,
  },
};

export default nextConfig;
