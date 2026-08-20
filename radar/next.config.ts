import path from "node:path";
import type { NextConfig } from "next";

// La app de campo es un SPA estático: se sirve desde S3 + CloudFront y todo el
// estado vive en el navegador (IndexedDB) hasta que la Fase 2 conecte la API.
// Sin servidor no hay nada que se caiga cuando el equipo pierde la señal.
/**
 * La app cuelga de /radar dentro del mismo sitio que la tienda: un solo origen,
 * un solo dominio el día que lo haya. Next reescribe solo los enlaces de `Link`
 * y `router`, pero no el manifest, los iconos ni el service worker — esos van a
 * mano en sus archivos.
 */
const RUTA = "/radar";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: RUTA,
  assetPrefix: RUTA,
  env: {
    NEXT_PUBLIC_RUTA: RUTA,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    // El repo tiene dos lockfiles (la landing y esta app). Sin fijar la raíz,
    // Turbopack elige la del repo y vigila archivos que no son de aquí.
    root: path.join(__dirname),
  },
};

export default nextConfig;
