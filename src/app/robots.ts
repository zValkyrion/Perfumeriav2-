import type { MetadataRoute } from "next";
import { urlAbsoluta } from "@/lib/sitio";

// Mismo motivo que en sitemap.ts: Route Handler bajo `output: "export"`.
export const dynamic = "force-static";

/**
 * Lo que se bloquea no es privado: es lo que no le sirve a nadie que llegue
 * desde una búsqueda. Un carrito vacío o una página de resultados no responden
 * ninguna consulta, y rastrearlas gasta presupuesto que le hace falta a las 52
 * fichas de producto y a los 8 lotes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/carrito",
        "/checkout",
        "/checkout/confirmacion",
        "/cuenta",
        "/cuenta/pedido/",
        "/favoritos",
        "/buscar",
      ],
    },
    sitemap: urlAbsoluta("/sitemap.xml"),
  };
}
