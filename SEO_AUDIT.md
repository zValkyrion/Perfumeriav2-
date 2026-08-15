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
