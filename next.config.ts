import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS || false;
let repo = "";
if (isGithubActions && process.env.GITHUB_REPOSITORY) {
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
