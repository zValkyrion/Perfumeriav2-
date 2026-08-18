# SEO — pendientes

Qué queda por hacer después de las fases 0 a 5 (rama `seo/fase-0-auditoria`).
Lo ya hecho está en [SEO_AUDIT.md](SEO_AUDIT.md); este documento es solo lo que
sigue, para poder retomarlo sin releer la auditoría completa.

Orden: primero lo que me bloquea a mí, luego lo que se activa solo cuando llegue
el inventario real, y al final la deuda menor.

---

## 1. Decisiones que dependen de ti

Sin estas respuestas no puedo avanzar en los puntos que las citan.

| # | Decisión | Qué desbloquea |
| --- | --- | --- |
| 1.1 | ¿Compramos el dominio `.mx`? | Migración de origen (§2.1) |
| 1.2 | Datos de contacto reales: teléfono, domicilio, redes con usuario | `LocalBusiness` en JSON-LD (§3.3) |
| 1.3 | ¿Luz verde a las 4 páginas guía? | Contenido de cola larga (§4) |
| 1.4 | ¿`/paquetes` se queda como está? | Hoy canonicaliza a `/lotes`; si quiere página propia necesita contenido distinto |
| 1.5 | ¿El mensaje es "100% originales" o "inspirados 1:1"? | Bloquea la guía de originalidad y afecta el copy global (§4.3) |

El 1.5 no es un detalle de redacción. El layout declara "Perfumes 100%
originales" y el catálogo incluye una categoría llamada "Inspirados" descrita
como "alternativas inspiradas en grandes clásicos". Son afirmaciones que se
contradicen y conviene resolverlas antes de escribir contenido que las repita.

---

## 2. Migración de dominio

### 2.1 Cuando el `.mx` esté comprado y apuntando

Tres cambios, en este orden:

1. [src/lib/sitio.ts](src/lib/sitio.ts) — `SITIO_URL` pasa a
   `https://elreydelosperfumes.mx`. Es la única línea con la URL pública: de ahí
   salen `metadataBase`, canonicals, sitemap y JSON-LD.
2. Crear `public/CNAME` con una sola línea: el dominio, sin protocolo.
3. [next.config.ts](next.config.ts) — el `basePath` solo debe aplicarse mientras
   se sirva desde `github.io`. Con dominio propio hay que dejarlo vacío.

Después: `npm run build` y confirmar que `out/sitemap.xml` y los canonicals ya
no llevan `/Perfumeriav2-`.

### 2.2 Lo que hay que hacer fuera del repo el mismo día

- Alta de la propiedad nueva en Search Console y envío del sitemap.
- **No** borrar la URL de `github.io` de inmediato: GitHub Pages no permite
  redirecciones 301 propias, así que el traspaso de autoridad depende del
  canonical. Conviene dejar ambas vivas unas semanas.
- Actualizar la URL en Business Profile y en redes.

---

## 3. Lo que se activa con inventario real

Todo esto está deliberadamente fuera hoy porque los datos son sintéticos. El
razonamiento completo está en la cabecera de [src/lib/jsonld.ts](src/lib/jsonld.ts).

### 3.1 `offers` en la ficha de producto

Reactivar en `producto()` de [src/lib/jsonld.ts](src/lib/jsonld.ts) cuando el
precio y el stock vengan de un inventario de verdad:

```
offers: {
  "@type": "AggregateOffer",
  priceCurrency: "MXN",
  lowPrice, highPrice, offerCount,
  availability: "https://schema.org/InStock",
}
```

Condición: que `precio` y `stock` dejen de salir de `randEntero()` sobre el slug
en [src/data/productos.ts](src/data/productos.ts).

### 3.2 `aggregateRating` y `review`

Solo cuando haya reseñas de clientes reales, verificables y **visibles en la
página**. Las de [src/data/resenas.ts](src/data/resenas.ts) son sintéticas.
Emitirlas antes arriesga una acción manual de Google, que fue justo lo que se
retiró en la Fase 3.

### 3.3 `LocalBusiness`

`organizacion()` en [src/lib/jsonld.ts](src/lib/jsonld.ts) emite hoy un
`Organization` sin contacto. Con los datos del punto 1.2 pasa a `LocalBusiness`
con `telephone`, `address`, `openingHours` y `sameAs`. Los marcadores de posición
están en [src/data/contenido.ts](src/data/contenido.ts): WhatsApp `477 123 4567`,
correo y redes sin usuario.

### 3.4 Las 12 páginas de marca

Las casas del catálogo son ficticias ([marcas.ts:3](src/data/marcas.ts:3)). Las
plantillas de title y description son correctas y funcionarán tal cual el día
que haya marcas reales, pero mientras tanto esas 12 páginas apuntan a consultas
con cero volumen. No hay nada que arreglar en el código: hay que cambiar los
datos.

### 3.5 Merchant Center

Requiere feed con precios y disponibilidad reales. Depende de 3.1.

---

## 4. Páginas guía propuestas (pendientes de aprobación)

Esquema completo en [SEO_AUDIT.md](SEO_AUDIT.md). Resumen:

| Ruta propuesta | Intención | Nota |
| --- | --- | --- |
| `/guias/perfumes-que-duran-todo-el-dia` | "perfumes que duran mucho" | Los campos `duracion` y `estela` ya existen: la lista se arma sola |
| `/guias/perfumes-al-mayoreo-para-revender` | "cómo revender perfumes" | **La de mayor valor comercial** |
| `/guias/como-saber-si-un-perfume-es-original` | "cómo saber si un perfume es original" | Bloqueada por la decisión 1.5 |
| `/guias/perfumes-para-clima-calido` | "perfumes para el calor" | Enlaza a `/catalogo/citrico` y `/catalogo/acuatico` |

Si se aprueban: van en `/guias/[slug]`, con `Article` en JSON-LD, alta en el
sitemap y enlazadas desde las familias correspondientes.

---

## 5. Deuda menor

Ninguna de estas penaliza el posicionamiento. Son calidad y accesibilidad.

### 5.1 Saltos de encabezado `h1` → `h3` (8 rutas)

Tres causas distintas, verificadas sobre el HTML generado:

| Causa | Dónde | Rutas afectadas |
| --- | --- | --- |
| El acordeón móvil del footer: `AccordionTrigger` de Radix se envuelve en `Accordion.Header`, que emite `h3` | [footer.tsx:82](src/components/layout/footer.tsx:82) | `/contacto`, `/favoritos`, `/cuenta`, `/404`, `/catalogo/sets` |
| `TarjetaLote` usa `h3` y en `/paquetes` no hay ningún `h2` antes de la rejilla | [tarjeta-lote.tsx:53](src/components/lotes/tarjeta-lote.tsx:53) | `/paquetes` |
| La calculadora emite un `h3` antes del primer `h2` de la página | [mayoreo/page.tsx:254](src/app/mayoreo/page.tsx:254) | `/mayoreo` |

Solo afecta a páginas sin `h2` propio entre su `h1` y el footer. El arreglo del
primer caso es el que más rutas cubre.

### 5.2 Restos de las pruebas de tema

Marcados como TEMPORAL en el propio código:

- El script inline de [layout.tsx](src/app/layout.tsx) en `<head>`. Medido: son
  ~200 bytes sin red, **no bloquea el render de forma apreciable**, así que no
  corre prisa por rendimiento — pero es andamiaje de pruebas en producción.
- El componente `SelectorTemas` y el bloque "TEMAS DE PRUEBA" de `globals.css`.

Conviene quitarlos antes de lanzar con dominio propio.

### 5.3 Peso de las imágenes

`out/` pesa 81 MB, de los cuales **14 MB son arte de producto**. Con
`images.unoptimized` no hay redimensionado por dispositivo: el móvil descarga la
misma imagen que el escritorio.

Opciones, de menor a mayor esfuerzo:

1. Generar variantes por ancho en
   [scripts/generar-imagenes.ts](scripts/generar-imagenes.ts) y servirlas con
   `srcSet` manual.
2. Bajar la calidad WebP del arte de producto, que hoy se genera al tamaño
   completo aunque la tarjeta lo muestre pequeño.
3. Migrar el hosting a uno con optimizador de imágenes, lo que además permitiría
   quitar `images.unoptimized`.

El banner del hero, que era el problema grave, ya está resuelto:
`npm run banners` lo dejó en 72 kB.

### 5.4 Avisos de lint previos al trabajo de SEO

Dos, ninguno introducido por estas fases:

- `Cortina` sin usar en [banner-paquete.tsx:4](src/components/home/banner-paquete.tsx:4)
- `precioDesde` sin usar en [hero.tsx:12](src/components/home/hero.tsx:12) — el
  hero dejó de mostrar el precio cuando pasó a ser una imagen completa; la prop
  sigue declarada.

### 5.5 `alt` de las páginas de pedido

En `/cuenta/pedidos/*` los `alt` son solo el nombre del producto ("Nardo",
"Copal"). Son rutas `noindex`, así que no afecta al posicionamiento, pero un
lector de pantalla agradecería el mismo formato descriptivo que usa
`TarjetaProducto`.

---

## 6. Cómo comprobar que nada se rompió

Después de cualquier cambio de los de arriba:

```bash
npm run build
```

Y sobre `out/`, las cuatro comprobaciones que se usaron en las fases:

1. **Un solo `h1` por página indexable** — hoy 103 de 107; las 4 sin `h1` son
   `noindex` (`/buscar`, `/carrito`, `/checkout`, `/checkout/confirmacion`).
2. **Ningún title >60 ni description >155** — hoy 0 de 107 fuera de rango.
   Contar el texto decodificado: `&amp;` es un carácter, no cinco.
3. **Un canonical por página** y ningún `Cargando...` donde debería ir el `h1`.
4. **Cero campos fabricados en el JSON-LD**: que no aparezcan `aggregateRating`,
   `review`, `offers`, `price` ni `availability` mientras el catálogo sea
   sintético.

La 4 es la que más importa: es la que evita una acción manual de Google.

---

## 7. Fuera del repositorio

El plan de 90 días completo está en [SEO_AUDIT.md](SEO_AUDIT.md). Lo urgente:

1. Dominio `.mx` (§2).
2. Search Console + envío del sitemap.
3. Google Business Profile con datos reales.
4. Inventario real, que desbloquea toda la sección 3.
5. Reseñas de clientes reales.
6. Backlinks: hoy son cero, y ninguna palanca on-page compensa eso.
