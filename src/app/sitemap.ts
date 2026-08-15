import type { MetadataRoute } from "next";
import { LOTES } from "@/data/lotes";
import { MARCAS } from "@/data/marcas";
import { PRODUCTOS } from "@/data/productos";
import { CATEGORIAS, FAMILIAS } from "@/data/taxonomia";
import { urlAbsoluta } from "@/lib/sitio";

// `sitemap.ts` es un Route Handler, y en modo `export` los handlers exigen esta
// declaración explícita o el build falla. No sale en la doc de sitemap.xml:
// está en la guía de exportación estática.
export const dynamic = "force-static";

/**
 * Fecha de la última modificación. El sitio es una exportación estática que se
 * regenera entera en cada despliegue, así que la fecha del build es —de forma
 * literal— cuándo cambió por última vez el documento que se sirve. No hay una
 * fecha por producto en los datos y no vamos a inventarla.
 */
const MODIFICADO = new Date();

/**
 * La prioridad refleja el valor comercial, no la profundidad de la ruta. El
 * mayoreo va arriba del catálogo de menudeo a propósito: es donde hay menos
 * competencia en México y más margen por pedido.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const portada = [
    { ruta: "/", priority: 1, changeFrequency: "weekly" as const },
    { ruta: "/mayoreo", priority: 0.9, changeFrequency: "monthly" as const },
    { ruta: "/lotes", priority: 0.9, changeFrequency: "weekly" as const },
    { ruta: "/catalogo", priority: 0.9, changeFrequency: "weekly" as const },
    { ruta: "/promociones", priority: 0.7, changeFrequency: "weekly" as const },
  ];

  // /paquetes no entra: canonicaliza hacia /lotes, y una URL que se declara
  // duplicada no debe anunciarse en el sitemap.

  // Institucionales y de servicio: se indexan porque resuelven dudas previas a
  // la compra, pero no compiten por consultas comerciales.
  const informativas = [
    { ruta: "/nosotros", priority: 0.4 },
    { ruta: "/contacto", priority: 0.4 },
    { ruta: "/faq", priority: 0.5 },
    { ruta: "/envios", priority: 0.4 },
    { ruta: "/devoluciones", priority: 0.4 },
  ];

  const legales = [{ ruta: "/terminos" }, { ruta: "/privacidad" }];

  return [
    ...portada.map((p) => ({
      url: urlAbsoluta(p.ruta),
      lastModified: MODIFICADO,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),

    // Los lotes son la oferta B2B: pesan más que el producto suelto.
    ...LOTES.map((lote) => ({
      url: urlAbsoluta(`/lotes/${lote.slug}`),
      lastModified: MODIFICADO,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),

    ...PRODUCTOS.map((producto) => ({
      url: urlAbsoluta(`/producto/${producto.slug}`),
      lastModified: MODIFICADO,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),

    ...CATEGORIAS.map((categoria) => ({
      url: urlAbsoluta(`/catalogo/${categoria.slug}`),
      lastModified: MODIFICADO,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),

    // Las familias olfativas son las landings de cola larga: "perfumes
    // amaderados", "perfumes gourmand". Menos volumen que las categorías, pero
    // mucha menos competencia.
    ...FAMILIAS.map((familia) => ({
      url: urlAbsoluta(`/catalogo/${familia.slug}`),
      lastModified: MODIFICADO,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),

    {
      url: urlAbsoluta("/catalogo/sets"),
      lastModified: MODIFICADO,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },

    ...MARCAS.map((marca) => ({
      url: urlAbsoluta(`/marca/${marca.slug}`),
      lastModified: MODIFICADO,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),

    ...informativas.map((p) => ({
      url: urlAbsoluta(p.ruta),
      lastModified: MODIFICADO,
      changeFrequency: "monthly" as const,
      priority: p.priority,
    })),

    ...legales.map((p) => ({
      url: urlAbsoluta(p.ruta),
      lastModified: MODIFICADO,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
