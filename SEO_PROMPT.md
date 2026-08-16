# Prompt maestro de SEO — EL REY DE LOS PERFUMES

> Pega el bloque completo de abajo en una sesión nueva de Claude Code, en la raíz
> del proyecto. Está escrito para ejecutarse por fases: puedes pedir "haz la Fase 1"
> o dejar que corra todo en orden.

---

## PROMPT

Actúa como consultor técnico de SEO para e-commerce en México, especializado en
Next.js App Router y en la industria de perfumería. Tu objetivo es dejar
`elreydelosperfumes.mx` como el resultado más fuerte posible en Google México
para búsquedas de perfumería (menudeo y mayoreo), trabajando **solo** las
palancas on-page y técnicas que viven en este repositorio.

### Contexto real del proyecto (verifícalo, no lo asumas)

- **Stack:** Next.js 16.3 (App Router), React 19.2, TypeScript, Tailwind v4,
  shadcn/ui. `AGENTS.md` advierte que esta versión de Next tiene cambios que
  rompen respecto a lo que conoces: **lee `node_modules/next/dist/docs/` antes de
  escribir cualquier API de Next** (metadata, sitemap, robots, imágenes).
- **Build:** `output: "export"` en `next.config.ts` → exportación 100% estática.
  No hay servidor, ni ISR, ni middleware, ni rutas API, ni optimizador de
  imágenes (`images.unoptimized = true`).
- **Deploy:** GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`),
  con `basePath = /<nombre-del-repo>` cuando corre en CI.
- **Idioma/mercado:** `es-MX`, público mexicano, precios en MXN.
- **Datos:** catálogo generado desde `src/data/semillas.ts` (53 productos),
  `src/data/marcas.ts` (13 marcas), taxonomía de familias olfativas, géneros,
  ocasiones y concentraciones en `src/data/taxonomia.ts`. Reseñas en
  `src/data/resenas.ts`.
- **Rutas existentes:** `/`, `/catalogo`, `/catalogo/[categoria]`,
  `/producto/[slug]`, `/marca/[slug]`, `/lotes`, `/lotes/[slug]`, `/paquetes`,
  `/promociones`, `/mayoreo`, `/buscar`, `/nosotros`, `/contacto`, `/faq`,
  `/envios`, `/devoluciones`, `/terminos`, `/privacidad`, y rutas
  transaccionales (`/carrito`, `/checkout`, `/cuenta`, `/favoritos`).
- **SEO ya presente:** metadata global en `src/app/layout.tsx`,
  `generateMetadata` en varias rutas, JSON-LD de `Product` en
  `src/app/producto/[slug]/page.tsx` y de `FAQPage` en
  `src/components/comunes/acordeon-faq.tsx`.

### Restricciones duras (romper cualquiera invalida el trabajo)

1. **No rompas la exportación estática.** Nada de `headers()`, `cookies()`,
   `revalidate`, Route Handlers dinámicos, `next/image` con loader remoto ni
   redirecciones de servidor. Si una técnica de SEO exige servidor, no la
   implementes: anótala en el reporte final como "requiere migrar el hosting".
2. **Cero dependencias nuevas.** Todo con lo que ya está en `package.json`.
3. **Nunca inventes señales de confianza.** Los precios, el stock y las reseñas
   de este repo son sintéticos. **Prohibido** emitir `aggregateRating`, `review`,
   `priceValidUntil` o disponibilidad en JSON-LD basados en datos fabricados: eso
   viola las políticas de datos estructurados de Google y arriesga una acción
   manual. Marca solo lo verificable (identidad, categoría, marca, notas,
   presentación, breadcrumbs). Si un dato no es real, deja el campo fuera y
   documéntalo.
4. **Español de México, sin relleno.** Nada de texto SEO repetitivo o generado
   para engordar páginas. Cada palabra que agregues debe servirle a un comprador.
5. **Los comentarios y el código deben leerse como el resto del repo**: español,
   misma densidad de comentarios, mismas convenciones de nombres.
6. **No toques el bloque de `AGENTS.md`** que Next regenera.

### Fases

**Fase 0 — Auditoría y decisión de dominio (bloqueante, entrega antes de codear).**
Hay una incoherencia real: `metadataBase` declara `https://elreydelosperfumes.mx`
pero el deploy sirve el sitio desde GitHub Pages bajo un `basePath`, y no existe
`public/CNAME`. Eso produce canonical, Open Graph y sitemap apuntando a un origen
donde el sitio no vive, y potencial contenido duplicado en dos hosts.
Antes de tocar nada, pregúntame cuál es el dominio canónico definitivo y si el
dominio ya está comprado y apuntando. Con la respuesta:
- Si es dominio propio: crea `public/CNAME`, ajusta el workflow para que **no**
  aplique `basePath`, y verifica que todas las URL absolutas usen ese origen.
- Si por ahora es GitHub Pages: alinea `metadataBase` y todas las URL absolutas
  al origen real, incluyendo el `basePath`.
Entrega también un inventario en tabla de las rutas actuales, marcando para cada
una: title, description, canonical, JSON-LD presente, e intención de búsqueda.

**Fase 1 — Cimientos de indexación.**
- `src/app/sitemap.ts` con todas las rutas indexables (estáticas + los 53
  productos + las 13 marcas + categorías + lotes), con `lastModified` real y
  `priority`/`changeFrequency` coherentes con la importancia comercial.
- `src/app/robots.ts`: permite el catálogo, **bloquea** `/carrito`, `/checkout`,
  `/checkout/confirmacion`, `/cuenta`, `/cuenta/pedidos/*`, `/favoritos` y
  `/buscar` (páginas sin valor de búsqueda que diluyen el crawl budget), y apunta
  al sitemap absoluto.
- `canonical` explícito en cada ruta indexable. Las páginas transaccionales
  además llevan `robots: { index: false, follow: true }` en su metadata.
- Confirma en `node_modules/next/dist/docs/` que `sitemap.ts` y `robots.ts` se
  emiten correctamente bajo `output: "export"` antes de escribirlos.

**Fase 2 — Metadata por plantilla, orientada a intención de compra.**
Reescribe títulos y descripciones por tipo de página con la fórmula
`[qué es] + [diferenciador] + [señal MX]`, respetando ~60 caracteres de title y
~155 de description, sin repetir la marca dos veces (la `template` del layout ya
la agrega):
- Producto: nombre + marca + concentración + ml, con el beneficio real (notas,
  duración) en la description.
- Marca: intención "perfumes <marca> originales México".
- Categoría/familia: intención "perfumes <familia/género> …".
- Mayoreo y lotes: intención B2B ("perfumes al mayoreo", "pacas de perfumes",
  "distribuidor"), que es donde hay menos competencia y más margen.
Agrega `alternates.canonical`, `openGraph` e imágenes OG por página. Si generas
imágenes OG, hazlo como assets estáticos en `public/` (no `opengraph-image.tsx`
dinámico, que no encaja con la exportación estática — verifica el comportamiento
en los docs locales antes de decidir).

**Fase 3 — Datos estructurados honestos.**
Centraliza los helpers de JSON-LD en un módulo nuevo (p. ej. `src/lib/jsonld.ts`)
y emítelos como `<script type="application/ld+json">`:
- `Organization` + `LocalBusiness` en el layout, con nombre, logo, URL, redes,
  `areaServed: MX`, y datos de contacto **solo si te los doy yo**.
- `WebSite` con `SearchAction` apuntando a `/buscar`.
- `BreadcrumbList` en producto, marca y categoría.
- `Product` mejorado: `brand`, `sku`, `category`, `additionalProperty` para
  familia olfativa/concentración/notas. `Offer` con `priceCurrency: MXN` y
  `availability` **solo cuando el dato sea real**; si no lo es, omite el precio y
  déjalo anotado.
- `ItemList` en catálogo y listados de marca.
- `FAQPage` una sola vez por página (revisa que `/`, `/faq` y `/mayoreo` no
  emitan bloques duplicados o solapados).

**Fase 4 — Contenido que gana consultas de cola larga.**
El tráfico de perfumería en México se juega en preguntas, no en la marca. Con la
taxonomía que ya existe:
- Enlazado interno real entre familia olfativa ↔ producto ↔ marca ↔ ocasión, con
  anchors descriptivos (nada de "ver más").
- Texto único y útil en cada página de categoría y marca (2–3 párrafos que
  respondan a la intención, no relleno).
- Propón —y solo implementa si te doy luz verde— un conjunto de páginas guía de
  alta intención comercial: "perfumes que duran todo el día", "perfumes de
  mayoreo para revender", "cómo saber si un perfume es original",
  "perfumes para clima cálido en México". Entrega primero los títulos, la
  intención objetivo y el esquema de cada una.

**Fase 5 — Core Web Vitals y accesibilidad (son factores de ranking).**
- Audita el LCP de la home y de producto: `priority` en la imagen del hero,
  dimensiones explícitas en todas las imágenes, `loading="lazy"` en lo que va
  bajo el pliegue.
- Revisa CLS en carruseles (`embla`), `framer-motion` y el drawer del carrito.
- Verifica que `alt` de cada imagen de producto sea descriptivo y en español.
- Comprueba jerarquía de encabezados: un solo `<h1>` por página, sin saltos.
- El script inline de temas en `layout.tsx` está marcado como temporal; evalúa si
  bloquea el render y repórtalo.

### Método de trabajo

- Antes de cada fase, **lee los archivos que vas a tocar**. No propongas cambios
  sobre supuestos.
- Después de cada fase corre `npm run build` y confirma que la exportación
  estática sigue generando `out/` sin errores.
- Verifica el resultado en el navegador con las herramientas de preview: revisa
  el `<head>` renderizado y los bloques JSON-LD de al menos la home, un producto,
  una marca y una categoría.
- Trabaja en una rama nueva. Commits pequeños, uno por fase, en español.
- No inventes datos de contacto, dirección, teléfono, RFC ni redes sociales:
  pregúntamelos.

### Entregable final

Un reporte en `SEO_AUDIT.md` con:
1. Tabla antes/después por ruta (title, description, canonical, JSON-LD).
2. Lista de lo implementado, con enlaces a archivo y línea.
3. **Lo que NO se puede resolver desde el repo**, separado y priorizado por
   impacto: Google Search Console, Google Business Profile, reseñas reales de
   clientes, backlinks, Merchant Center, velocidad del hosting, y la sustitución
   del catálogo sintético por inventario real.
4. Un plan de 90 días con las acciones off-page que dependen de mí, ordenadas por
   relación impacto/esfuerzo.

Empieza por la Fase 0 y detente ahí hasta que yo responda lo del dominio.
