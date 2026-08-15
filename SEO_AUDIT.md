# Auditoría SEO — EL REY DE LOS PERFUMES

Rama de trabajo: `seo/fase-0-auditoria`. Documento vivo: cada fase agrega su sección.

---

## Fase 0 — Auditoría y decisión de dominio

### 0.1 Contradicción de origen (bloqueante)

Los tres datos siguientes son incompatibles entre sí:

| Dato | Valor real | Archivo |
| --- | --- | --- |
| Origen declarado a Google | `https://elreydelosperfumes.mx` | [layout.tsx:33](src/app/layout.tsx:33) |
| Origen donde el sitio se sirve | `https://zvalkyrion.github.io/Perfumeriav2-/` | [deploy.yml](.github/workflows/deploy.yml), [next.config.ts:3-10](next.config.ts:3) |
| Dominio propio configurado | **no existe** (`public/CNAME` ausente) | — |

El repositorio se llama `Perfumeriav2-` (con guion final), así que en CI
`basePath = "/Perfumeriav2-"`. Consecuencias verificadas en `out/`:

- `out/producto/agar-negro.html` emite
  `og:image = https://elreydelosperfumes.mx/productos/agar-negro-1.webp` — una URL
  que hoy no resuelve. Todas las tarjetas de WhatsApp, Facebook e Instagram salen
  sin imagen.
- No hay **una sola** etiqueta `<link rel="canonical">` en todo el build. Cero
  rutas canonicalizadas, ni siquiera la home.
- Si mañana se compra el dominio y se apunta a Pages sin borrar la URL
  `github.io`, quedan dos hosts sirviendo el mismo contenido: duplicado puro.

**No puedo avanzar a la Fase 1 sin la decisión de dominio** — el sitemap, el
`robots.txt`, los canonical y las URL absolutas de JSON-LD dependen todos de ese
valor. La pregunta está al final de este documento.

### 0.2 Inventario de rutas

Conteos reales del build (`out/`), no los del brief: **52 productos**, **12 marcas**,
**8 lotes**, **8 categorías + sets**.

Leyenda de canonical: ninguna ruta tiene canonical explícito hoy. Los `title` se
muestran sin el sufijo `| EL REY DE LOS PERFUMES` que agrega la `template` del layout.

#### Rutas indexables

| Ruta | Title actual | Description | JSON-LD | Intención | Problema |
| --- | --- | --- | --- | --- | --- |
| `/` | *(default del layout)* "EL REY DE LOS PERFUMES — Perfumería fina al mayoreo y menudeo" | sí | `FAQPage` | Marca + navegacional | Sin `canonical`. Sin `Organization`/`WebSite`. |
| `/catalogo` | "Catálogo completo" | sí, dice "los 52 perfumes" ✔ | — | Comercial amplia | Title sin keyword real ("perfumes originales México"). Sin `ItemList`. |
| `/catalogo/[categoria]` ×8 | `cat.titulo` de [taxonomia.ts](src/data/taxonomia.ts) | `cat.descripcion` | — | Comercial por segmento | Sin `BreadcrumbList` ni `ItemList`. Texto único: pendiente de revisar. |
| `/catalogo/sets` | "Sets y estuches de regalo" | sí | — | Comercial regalo | Igual que arriba. |
| `/producto/[slug]` ×52 | `Nombre — Marca` | notas + precio desde + MXN ✔ | `Product` **con datos falsos** | Transaccional | Ver §0.3. Sin breadcrumb JSON-LD (el visual sí existe). |
| `/marca/[slug]` ×12 | `Marca — firma` | `descripcion.slice(0,155)` | — | Marca + comercial | El `slice(0,155)` corta a media palabra. Falta "originales México". |
| `/lotes` | "Lotes de mayoreo" | sí | — | **B2B alta prioridad** | Sin `ItemList`. |
| `/lotes/[slug]` ×8 | `lote.nombre` | piezas + precio ✔ | — | **B2B alta prioridad** | Sin breadcrumb ni `Product`/`Offer`. |
| `/paquetes` | "Paquetes para revender" | sí | — | B2B | **Canibaliza `/lotes`**: ambas listan `LOTES`. Ver §0.3. |
| `/promociones` | ❌ *ninguna* (es `"use client"`) | ❌ hereda la del layout | — | Comercial | Title y description duplicados con la home. |
| `/mayoreo` | "Mayoreo — convierte el perfume en tu negocio" | sí | `FAQPage` | **B2B, la más valiosa** | FAQ solapada con `/faq`. Ver §0.3. |
| `/faq` | "Preguntas frecuentes" | sí | `FAQPage` (HOME+MAYOREO) | Informacional | Ver §0.3. |
| `/nosotros` | "Nosotros" | sí | — | Confianza | Title sin keyword. Candidata a `Organization`. |
| `/contacto` | "Contacto" | sí | — | Local | Candidata a `LocalBusiness` (requiere datos reales). |
| `/envios` | "Envíos" | sí | — | Informacional pre-compra | OK. |
| `/devoluciones` | "Cambios y devoluciones" | sí | — | Informacional pre-compra | OK. |
| `/terminos` | "Términos y condiciones" | sí | — | Legal | OK. |
| `/privacidad` | "Aviso de privacidad" | sí | — | Legal | OK. |

#### Rutas que **no** deben indexarse

| Ruta | `robots` actual | Debe ser |
| --- | --- | --- |
| `/carrito` | `index:false, follow:false` | `follow:true` (deja fluir el enlazado) |
| `/checkout` | `index:false, follow:false` | igual, + `Disallow` |
| `/checkout/confirmacion` | `index:false, follow:false` | igual, + `Disallow` |
| `/cuenta` | `index:false, follow:false` | igual, + `Disallow` |
| `/cuenta/pedidos/[folio]` | `index:false, follow:false` | igual, + `Disallow` |
| `/favoritos` | `index:false, follow:true` ✔ | + `Disallow` |
| `/buscar` | ❌ **ninguna** (es `"use client"`) | `noindex` + `Disallow` — hoy es indexable |

### 0.3 Hallazgos que no estaban en el brief

**a) El JSON-LD de producto viola las políticas de datos estructurados de Google.**
[producto/[slug]/page.tsx:101-116](src/app/producto/[slug]/page.tsx:101) emite
`aggregateRating` con `ratingValue` y `reviewCount` sintéticos, y `availability`
derivada de un `stock` inventado. Son exactamente los campos que Google penaliza
con acción manual cuando no corresponden a reseñas visibles y verificables. Se
elimina en Fase 3 y se documenta qué queda fuera.

**b) Nueve familias olfativas sin página indexable.**
`FAMILIAS` en [taxonomia.ts:24-86](src/data/taxonomia.ts:24) define slugs
(`amaderado`, `oriental`, `floral`, `citrico`, `fougere`, `chipre`, `gourmand`,
`acuatico`, `especiado`) pero `generateStaticParams` de `/catalogo/[categoria]`
solo genera las 8 `CATEGORIAS` + `sets`. Las familias se enlazan como
`/catalogo?familia=Amaderado` — un query param sobre una página estática, que para
Google es la misma URL con el mismo HTML. Son **9 landings de cola larga que hoy no
existen** ("perfumes amaderados", "perfumes gourmand"), y el andamiaje de datos ya
está construido.

**c) `/lotes` y `/paquetes` compiten por la misma consulta.**
Las dos renderizan `LOTES` con `TarjetaLote`. Sin canonical ni diferenciación de
contenido, Google elige una y descarta la otra — probablemente la equivocada. Hay
que decidir cuál es la landing B2B y qué hace la otra.

**d) `FAQPage` triplicado y solapado.**
`FAQ_HOME` se emite en `/` y otra vez dentro de `/faq`; `FAQ_MAYOREO` se emite en
`/mayoreo` y otra vez en `/faq`. Las mismas preguntas con las mismas respuestas en
tres URLs. Google atribuye los rich results a una sola.

**e) `/promociones` y `/buscar` son `"use client"` y por eso no pueden exportar
`metadata`.** Heredan title y description del layout, así que hoy hay tres URLs con
el mismo title. Se arregla envolviendo en un `layout.tsx` de servidor por ruta.

**f) El script inline de temas bloquea el render.**
[layout.tsx:74-78](src/app/layout.tsx:74) es un `<script>` síncrono en `<head>`,
marcado como TEMPORAL junto con `SelectorTemas`. Es pequeño, pero está en la ruta
crítica del primer pintado. Se mide en Fase 5.

### 0.4 Verificación de viabilidad técnica

Leído en `node_modules/next/dist/docs/` para esta versión (Next 16.3):

- `app/sitemap.ts` y `app/robots.ts` son Route Handlers **cacheados por defecto**
  salvo que usen APIs de request. Como los nuestros serán funciones puras, se
  materializan como archivos estáticos en el build → **compatibles con
  `output: "export"`**.
- `opengraph-image.tsx` con `ImageResponse` genera la imagen en request time →
  **descartado**. Las imágenes OG irán como assets estáticos en `public/`.
- Ninguna de las técnicas de las Fases 1-5 exige servidor. Nada que anotar todavía
  como "requiere migrar el hosting".

### 0.5 Decisión de dominio y alineación aplicada

**Decisión:** por ahora se usa GitHub Pages. Origen canónico:
`https://zvalkyrion.github.io/Perfumeriav2-`.

Cambios de esta fase:

- [src/lib/sitio.ts](src/lib/sitio.ts) — nuevo. `SITIO_URL` y `urlAbsoluta()`.
  Único lugar con la URL pública; el comentario documenta el cambio de una línea
  para migrar al dominio propio.
- [layout.tsx:35](src/app/layout.tsx:35) — `metadataBase` pasa de
  `elreydelosperfumes.mx` a `SITIO_URL`.
- [page.tsx:41](src/app/page.tsx:41) — canonical de la home.

**Trampa encontrada al verificar:** poner `alternates.canonical` en el layout raíz
lo hereda toda ruta que no lo sobrescriba. En el primer build, las 95 páginas
declararon como canonical la home — peor que no tener canonical, porque le pide a
Google que desindexe el catálogo entero. El canonical va página por página
(Fase 1); el layout lleva un comentario que lo advierte.

Verificado: `npm run build` genera `out/` sin errores; `og:image` de producto
resuelve a `https://zvalkyrion.github.io/Perfumeriav2-/productos/agar-negro-1.webp`
y solo la home emite canonical. Confirmado también en el render de dev.

**Pendiente para cuando compres el dominio .mx:** es la palanca off-page de mayor
impacto de todo este trabajo. Un `github.io/Perfumeriav2-` no compite en México
contra tiendas con dominio propio: la URL es la primera señal de confianza que ve
el comprador en el resultado de búsqueda. Va priorizado en el plan de 90 días.

### 0.6 Datos que necesito de ti (bloquean la Fase 3)

[contenido.ts:3-16](src/data/contenido.ts:3) tiene marcadores de posición que **no
puedo publicar como datos estructurados** — un `LocalBusiness` con teléfono
inventado es peor que no tenerlo:

| Campo | Valor actual | ¿Real? |
| --- | --- | --- |
| WhatsApp | `477 123 4567` | no |
| Correo | `contacto@elreydelosperfumes.mx` | depende del dominio |
| Instagram / Facebook / TikTok | `https://instagram.com` etc., sin usuario | no |
| Dirección física | no existe en el repo | — |
| `clientes: 1500`, `ratingGlobal: 4.9` | inventados | no |

Te los pregunto al llegar a la Fase 3. Si no hay dirección física ni teléfono
reales, se emite `Organization` sin `LocalBusiness` y se documenta la omisión.

---

## Fases 1 a 5 — Lo implementado

Cinco commits en `seo/fase-0-auditoria`, uno por fase. `npm run build` genera
`out/` sin errores y `npm run lint` no reporta errores (quedan 2 avisos previos
al trabajo, en `banner-paquete.tsx` y `hero.tsx`).

### Tabla antes / después

| Ruta | Title antes | Title después | Canonical | JSON-LD antes | JSON-LD después |
| --- | --- | --- | --- | --- | --- |
| `/` | Perfumería fina al mayoreo y menudeo (61) | Perfumes al mayoreo y menudeo (54) | ❌ → ✅ | FAQPage | Organization + WebSite |
| `/catalogo` | Catálogo completo | Catálogo completo de perfumes | ❌ → ✅ | — | Breadcrumb + ItemList |
| `/catalogo/[categoria]` ×8 | `cat.titulo` | + precio de entrada | ❌ → ✅ | — | Breadcrumb + ItemList |
| `/catalogo/[familia]` ×9 | **no existían** | Perfumes amaderados desde $X | — → ✅ | — | Breadcrumb + ItemList |
| `/catalogo/sets` | Sets y estuches de regalo | igual | ❌ → ✅ | — | — |
| `/producto/[slug]` ×52 | Nombre — Marca | Nombre + ml + casa | ❌ → ✅ | Product **con datos falsos** | Product limpio + Breadcrumb |
| `/marca/[slug]` ×12 | Marca — firma | Perfumes `<marca>` en México | ❌ → ✅ | — | Breadcrumb + ItemList |
| `/lotes` | Lotes de mayoreo | Pacas de perfumes al mayoreo | ❌ → ✅ | — | Breadcrumb + ItemList |
| `/lotes/[slug]` ×8 | `lote.nombre` | Lote de N perfumes al mayoreo | ❌ → ✅ | — | Breadcrumb |
| `/paquetes` | Paquetes para revender | igual | ❌ → **→ /lotes** | — | — |
| `/promociones` | ❌ heredaba la home | Promociones y rebajas | ❌ → ✅ | — | — |
| `/mayoreo` | Mayoreo — convierte el perfume… | Perfumes al mayoreo en México | ❌ → ✅ | FAQPage | FAQPage (única) |
| `/faq` | Preguntas frecuentes | igual | ❌ → ✅ | FAQPage ×2 juegos | FAQPage (solo FAQ_HOME) |
| institucionales y legales ×7 | sin cambio | sin cambio | ❌ → ✅ | — | — |
| `/buscar` | ❌ heredaba la home, indexable | Buscar perfumes, **noindex** | n/a | — | — |
| transaccionales ×5 | `follow: false` | `follow: true` + `Disallow` | n/a | — | — |

Las descriptions se reescribieron en todas las rutas comerciales con la fórmula
qué es + diferenciador + señal de México, derivando conteos y precios del
catálogo en lugar de escribirlos a mano.

Resultado medido sobre `out/`: **107 páginas, 0 con title >60 o description >155**
(antes 27 fuera de rango), **102 URLs en el sitemap**, **1 canonical por página**.

### Lista de cambios

**Fase 0 — origen canónico** · commit `3733731`

- [src/lib/sitio.ts](src/lib/sitio.ts) — `SITIO_URL` y `urlAbsoluta()`. Único
  lugar con la URL pública; migrar al dominio propio es cambiar una línea.
- [layout.tsx](src/app/layout.tsx) — `metadataBase` al origen real.

**Fase 1 — indexación** · commit `f988e85`

- [src/app/sitemap.ts](src/app/sitemap.ts) y [src/app/robots.ts](src/app/robots.ts)
  — ambos con `dynamic = "force-static"`, que `output: "export"` exige y que no
  aparece en la doc de `sitemap.xml` sino en la guía de exportación estática.
- Canonical en cada ruta indexable; `/paquetes` canonicaliza a `/lotes`.
- [buscar/layout.tsx](src/app/buscar/layout.tsx) y
  [promociones/layout.tsx](src/app/promociones/layout.tsx) — metadata para dos
  rutas de cliente que no podían exportarla.

**Fase 2 — metadata** · commit `4223154`

- [src/lib/seo.ts](src/lib/seo.ts) — plantillas que se ajustan al largo
  disponible. La `template` del layout consume 25 de los 60 caracteres del
  título, así que cada plantilla ofrece variante completa y corta, y las
  descriptions rellenan por oración completa hasta 155.
- [scripts/generar-og.ts](scripts/generar-og.ts) — `public/og/portada.jpg` y
  `logo.png` con sharp. `opengraph-image.tsx` queda descartado: `ImageResponse`
  compone en tiempo de petición y aquí no hay servidor.

**Fase 3 — datos estructurados** · commit `558909d`

- [src/lib/jsonld.ts](src/lib/jsonld.ts) — helpers centralizados; documenta qué
  campos faltan y bajo qué condición se pueden agregar.
- Retirados `aggregateRating` y `AggregateOffer` de la ficha de producto.
- Organization, WebSite, BreadcrumbList e ItemList; FAQPage desduplicado.

**Fase 4 — familias y enlazado** · commit `40bbc8c`

- [taxonomia.ts](src/data/taxonomia.ts) — `titulo` y `guia` de dos párrafos por
  familia, orientados al clima de México.
- [catalogo/[categoria]/page.tsx](src/app/catalogo/[categoria]/page.tsx) — las 9
  familias pasan a ser páginas indexables.
- Enlaces repuntados en home, menú y ficha: no queda ningún `?familia=` en el
  HTML generado. Anclas descriptivas, nunca "ver más".

**Fase 5 — rendimiento y accesibilidad** · commit `fae331b`

- [vista-catalogo.tsx](src/components/catalogo/vista-catalogo.tsx) — el
  encabezado sale del Suspense. **Era el defecto on-page más grave**: 22 rutas
  se servían con "Cargando..." en lugar de su h1 y su contenido.
- [scripts/optimizar-banners.ts](scripts/optimizar-banners.ts) — el banner del
  hero, que es el elemento LCP de la home, pasa de **903 kB a 72 kB (-92%)**.
- `h1` sr-only en la home, que no tenía ninguno porque el hero es una imagen.

### Verificado

| Comprobación | Resultado |
| --- | --- |
| `npm run build` a `out/` | sin errores en las 5 fases |
| Páginas con exactamente un `h1` | 103 de 107 (las 4 sin `h1` son `noindex`) |
| Saltos de nivel de encabezado | 8 rutas con `h1` a `h3`, por tres causas distintas (detalle en `SEO_PENDIENTES.md`) |
| `alt` de imágenes | los vacíos son decorativos o duplicados con `aria-label` en el padre: correcto |
| CLS | las imágenes usan `fill` dentro de contenedores con proporción fija |
| Script de temas en `<head>` | inline, ~200 bytes, sin red: no bloquea de forma medible |

Pendiente menor: los 8 saltos `h1` a `h3` vienen del acordeón móvil del footer,
de `TarjetaLote` y del orden de encabezados de `/mayoreo`. No es penalización, sí
es ruido para lectores de pantalla. Desglosado en
[SEO_PENDIENTES.md](SEO_PENDIENTES.md).

---

## Lo que NO se puede resolver desde el repositorio

Ordenado por impacto. Los tres primeros pesan más que todo el trabajo técnico
hecho arriba.

### 1. El catálogo es ficticio, y eso bloquea todo lo demás

No es solo que los precios sean sintéticos: **las 12 casas son inventadas**
([marcas.ts:3](src/data/marcas.ts:3) lo dice explícitamente). Consecuencias:

- Las 12 páginas de marca apuntan a consultas con **cero volumen de búsqueda**.
  Nadie busca "perfumes Orfèvre": esa casa no existe. La plantilla es correcta y
  funcionará el día que haya marcas reales, pero hoy esas páginas no traen
  tráfico.
- Sin inventario real no se puede emitir `offers`, `availability` ni
  `aggregateRating`, ni entrar a Merchant Center. Queda fuera todo el resultado
  enriquecido de comercio, que es el que mueve el CTR.
- Lo que sí puede rankear hoy: las 9 familias, las 8 categorías, `/mayoreo` y
  los 8 lotes. Ahí la consulta es genérica y no depende del nombre de la casa.

**Acción:** sustituir `src/data/semillas.ts` y `marcas.ts` por inventario real.

### 2. Dominio propio

`zvalkyrion.github.io/Perfumeriav2-` no compite en México contra tiendas con
dominio propio: la URL es la primera señal de confianza en el resultado. El repo
ya está listo — una línea en [sitio.ts](src/lib/sitio.ts), un `public/CNAME` y
quitar el `basePath` del workflow.

### 3. Search Console y Business Profile

Sin Search Console no hay envío de sitemap, ni informe de cobertura, ni consultas
reales, ni aviso de acciones manuales. Sin Business Profile no hay panel local ni
Maps, donde se decide buena parte de la búsqueda comercial en México.

### 4. Reseñas reales

Las de `resenas.ts` son sintéticas. Hasta que haya reseñas verificables y
visibles no se puede emitir `aggregateRating` sin arriesgar acción manual. Es el
campo que más sube el CTR en resultados de producto.

### 5. Datos de contacto

[contenido.ts:3](src/data/contenido.ts:3) tiene WhatsApp `477 123 4567`, redes
sin usuario y ningún domicilio. Con datos reales, el `Organization` pasa a
`LocalBusiness` con `telephone`, `address` y `sameAs`.

### 6. Backlinks

Cero enlaces entrantes. Ninguna palanca on-page compensa eso en un mercado
competido.

### 7. Velocidad del hosting

GitHub Pages no permite cabeceras de caché propias ni CDN configurable. `out/`
pesa **81 MB**, de los cuales **14 MB son arte de producto**. Con
`images.unoptimized` no hay redimensionado por dispositivo: el móvil descarga la
misma imagen que el escritorio.

---

## Plan de 90 días

### Días 1 a 15 — cimientos que dependen de ti

| Acción | Impacto / esfuerzo |
| --- | --- |
| Comprar el dominio `.mx` y apuntarlo | **alto / bajo** |
| Alta en Search Console y envío del sitemap | **alto / bajo** |
| Google Business Profile con dirección, teléfono y horario reales | **alto / bajo** |
| Darme los datos de contacto reales para cerrar el `LocalBusiness` | alto / bajo |
| Bing Webmaster Tools (importa desde Search Console en un clic) | medio / muy bajo |

### Días 16 a 45 — inventario real

| Acción | Impacto / esfuerzo |
| --- | --- |
| Sustituir el catálogo sintético por inventario real | **muy alto / alto** |
| Reactivar `offers` y `availability` en el JSON-LD | alto / bajo (ya documentado) |
| Pedir reseñas a clientes que ya compraron y publicarlas verificadas | alto / medio |
| Merchant Center con el feed de productos reales | alto / medio |

### Días 46 a 90 — contenido y autoridad

| Acción | Impacto / esfuerzo |
| --- | --- |
| Páginas guía de alta intención (propuesta abajo) | alto / medio |
| Fichas de producto con texto propio, no copiado del proveedor | alto / alto |
| Directorios locales mexicanos y cámaras de comercio | medio / bajo |
| Alianzas con revendedores: que enlacen desde sus perfiles | medio / medio |
| Contenido en video reutilizando el material de la tienda | medio / alto |

---

## Propuesta pendiente de tu visto bueno: páginas guía

No las implementé porque pediste aprobarlas primero. Las cuatro atacan consultas
informativas con intención de compra cercana, que es donde un catálogo sin marca
conocida sí puede competir.

**1. `/guias/perfumes-que-duran-todo-el-dia`**
Intención: "perfumes que duran mucho", "perfume de larga duración".
Esquema: por qué duran unos y otros no (concentración y notas de fondo) · cómo
leer la concentración · los del catálogo con `duracion` 4 o 5, enlazados ·
errores de aplicación que acortan la duración.
Ventaja: los campos `duracion` y `estela` ya existen y la lista se arma sola.

**2. `/guias/perfumes-al-mayoreo-para-revender`**
Intención B2B: "cómo revender perfumes", "negocio de perfumes".
Esquema: cuánto se necesita para empezar · margen real con la escalera de
precios · qué familias rotan más · cómo elegir el primer lote · enlaces a
`/mayoreo` y a los 8 lotes.
**Es la de mayor valor comercial**: menos competencia y cliente recurrente.

**3. `/guias/como-saber-si-un-perfume-es-original`**
Intención: "cómo saber si un perfume es original".
Esquema: qué revisar en lote, códigos y sellos · qué NO prueba nada · en qué se
distingue un original de un inspirado · qué vendemos exactamente.
**Ojo:** esta página obliga a ser explícitos sobre el 1:1 y los "inspirados"
frente al "100% originales" que declara el layout. Bien hecha genera confianza;
mal hecha la destruye. Conviene alinear ese mensaje antes de publicarla.

**4. `/guias/perfumes-para-clima-calido`**
Intención: "perfumes para el calor", "perfume para clima húmedo".
Esquema: qué le hace el calor a cada familia · cítricos y acuáticos como apuesta
segura · qué evitar a mediodía · cómo aplicar para que rinda · enlaces a
`/catalogo/citrico` y `/catalogo/acuatico`.

Si les das luz verde, van en `/guias/[slug]` con `Article` en JSON-LD, entran al
sitemap y se enlazan desde las familias correspondientes.
