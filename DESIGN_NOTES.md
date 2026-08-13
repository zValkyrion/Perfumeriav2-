# DESIGN_NOTES — AURA Perfumes

Bitácora de diseño del frontend. Se escribe **antes** de codear (§16.0) y se
actualiza con el pase de crítica (§16.13).

---

## 0. Estado de las skills de diseño (§1.1)

El brief exige cargar `taste-skills` / `design-taste-frontend` y la familia
`design:*` antes de escribir código. **Ninguna está disponible en este entorno.**
Se verificó por tres vías independientes:

| Vía | Resultado |
| --- | --- |
| Listado de skills habilitadas | Solo `morning`, `skill-creator`, `xlsx`, `pptx`, `pdf`, `docx` |
| Búsqueda por palabra clave (`taste`, `design system`, `design critique`, `ux copy`, `accessibility`) | 0 resultados |
| Catálogo de skills instalables (org / Anthropic) | 0 resultados |
| `~/.claude/skills`, `.claude/skills`, `~/.claude/plugins` | No existen |

El §1.1 contempla este caso: *"Si no es posible, aplica de todos modos los
principios anti-slop del §1.3."* No se descargó ningún paquete de terceros sin
verificar para simular la skill.

**Consecuencia:** la regla de precedencia estética de §1.1 queda inactiva; manda
este documento, derivado de §1.3 (anti-slop), §6 (sistema de diseño) y §15
(accesibilidad). El pase de autocrítica del §16.13 se ejecuta de forma manual
contra la lista de verificación de la §7 de este archivo.

---

## 1. Reglas tipográficas

- **Display:** Cormorant Garamond (300/400/600). Solo títulos, nombres de
  producto y cifras de lujo. `tracking-tight` y tamaños generosos.
- **UI:** Inter (400/500/600). Todo lo demás.
- **Nunca** una sola fuente para todo (§1.3) ni fuentes del sistema.
- Precios: Inter con `font-variant-numeric: tabular-nums` vía el atributo
  `[data-precio]` — evita el "salto" de dígitos al recalcular el escalón.
- Escala móvil 32/26/20/15/12 · desktop 56/40/26/16, fluida con `clamp()`.
- Eyebrows: 11px, `uppercase`, `tracking-[0.2em]`, `--color-gold-light`.

## 2. Color

- El dorado es **acento, no fondo**: nunca más del ~10% de la superficie visible.
- Degradado oficial único: `linear-gradient(135deg,#8C6F14,#E8C766 45%,#C9A227)`.
  Se usa en botón primario, filetes divisorios y cifras destacadas. **No** hay
  ningún otro degradado de marca; los degradados morado→azul están prohibidos.
- Familias olfativas: cada una tiene un tono propio derivado de su carácter
  (amaderado ámbar oscuro, cítrico amarillo verdoso, acuático azul frío…). Son
  los **únicos** colores fuera de la paleta base, y solo aparecen en los chips de
  familia y la píldora de la ficha.
- Los emojis viven **solo** en la barra de anuncios y el microcopy, nunca como
  iconografía de sección (§1.3).

## 3. Elevación y forma

- En oscuro la elevación se hace con **borde + luminosidad**, nunca con
  `shadow-lg` (§1.3). Utilidad `.lift`: `translateY(-2px)` + borde dorado al 35%
  + `--color-surface-2`. Solo bajo `@media (hover:hover)`.
- Radios mezclados a propósito: `rounded-full` en botones y chips, `--radius-md`
  (10px) en tarjetas, esquinas rectas en imágenes de producto. Nunca un radio
  uniforme en todo.
- Glassmorphism **exclusivamente** en header sticky y drawer del carrito.
- Grano SVG al 3% sobre el hero para romper el plano digital.

## 4. Ritmo y espaciado

- Secciones densas alternadas con secciones amplias — nunca `py-*` uniforme.
  Bloques de catálogo (densos) contra hero / mayoreo / newsletter (amplios).
- Contenedor `max-w-[1400px]`, `px-4` móvil / `px-8` desktop.
- Grid de producto: 2 columnas en móvil (el usuario compara), 3 / 4 / 5 arriba.
- Texto centrado solo en titulares cortos; los párrafos van alineados a la
  izquierda.

## 5. Movimiento

- Entradas: `opacity 0→1` + `y 16→0`, 0.5s, `easeOut`, `whileInView` una sola vez.
- Stagger de 60ms en grids.
- El precio por escalón anima con conteo (`AnimatePresence` + key).
- Nada por encima de 700ms. Sin parallax agresivo ni autoplay con sonido.
- `prefers-reduced-motion` anula **todo** vía regla global en `globals.css`.
- No se anima todo: solo lo que comunica un cambio de estado o de precio.

## 6. Jerarquía de conversión (§1.2)

- **Una sola acción primaria dorada por pantalla.** Todo lo demás es secundario
  (borde dorado) o fantasma (texto). Si dos botones compiten, el diseño está mal.
- La escalera de descuento se comunica en **ficha, drawer y carrito**, siempre
  con el mensaje "agrega X y ahorras $Y".
- Las micro-garantías (original, envío gratis 3+, devolución) viajan **junto al
  CTA**, no en el footer.
- Escasez y urgencia solo con datos reales del dataset (stock real, promo con
  fecha fija). Nada de contadores que se reinician ni cifras alarmistas.

---

## 7. Desviaciones deliberadas del brief

| # | Brief | Implementado | Razón |
| --- | --- | --- | --- |
| 1 | `React 20+` (§2) | **React 19.2.8** | React 20 no existe; 19.2.8 es la última publicada y la que Next 16 soporta. |
| 2 | `--color-fg-subtle: #71717A` (§6.1) | **`#8A8A94`** | #71717A da 4.08:1 sobre `--color-bg` y reprueba el mínimo 4.5:1 del §15. Se elevó al primer valor que cumple (5.8:1) conservando el mismo rol visual. El §15 es criterio de aceptación; el hex no. |
| 3 | Imágenes de Unsplash (§4.1) | **Arte SVG generado localmente y rasterizado** | Unsplash por hotlink produce imágenes rotas y bloquea el objetivo Lighthouse ≥90; el §4.1 admite explícitamente "SVGs generados localmente". Cada producto recibe arte determinista derivado de su familia olfativa. Cumple "sin cuadros grises" y "sin imágenes rotas" (§17). |
| 4 | Botones shadcn `radix-nova` | **Variantes `gold`/`goldOutline`/`whatsapp` + tamaños `touch`** | El preset trae botones de 32px de alto; el §6.5 exige 48px en móvil y 44×44 mínimo táctil. Se extendió `buttonVariants` en vez de pelear con el preset. |

| 5 | Filtrado en servidor con `searchParams` | **Filtros en cliente** | `next.config.ts` fija `output: "export"` para GitHub Pages. La exportación estática no recibe `searchParams` en el servidor, así que catálogo, búsqueda y promociones leen la URL desde el cliente con `useSearchParams` + `Suspense`. |
| 6 | `quality` en `next/image` | **Eliminado** | Con `images.unoptimized: true` (obligatorio en export estático) la prop no hace nada y Next 16 emite un warning por cada imagen. El arte ya se genera en WebP al tamaño final. |

---

## 8. Pase de crítica (§16.13)

### Alcance y limitación honesta

**El panel del navegador no estaba disponible durante la sesión**, así que las
capturas fallaron (`the Browser pane is not displayed`). La crítica se hizo
sobre el DOM renderizado, los estilos calculados, las medidas de layout y las
imágenes generadas —no mirando píxeles—. Queda pendiente una revisión visual
directa; las comprobaciones geométricas y de contenido sí se ejecutaron contra
la página real.

### Defectos detectados y corregidos

| # | Pantalla | Defecto | Corrección |
| --- | --- | --- | --- |
| 1 | Confirmación | La línea del pedido mostraba **$ 14,280.00** (menudeo) junto a un total de **$ 8,568.00** (con 40% aplicado). El comprobante no cuadraba: el error más grave encontrado. | Se reutiliza `resumenCarrito` para las líneas, igual que en carrito y drawer. Verificado: la línea pasa a $ 8,568.00. |
| 2 | Ficha (PDP) | El interruptor "Modo Mayoreo" cambiaba las tarjetas pero **no la ficha**, incumpliendo el §7.2 y el criterio de aceptación de "cambia los precios en todo el sitio". | La ficha muestra la línea dorada `Mayoreo 3+: $ X c/u · envío gratis`. Verificado en Vetiver Haití: $ 1,890 → $ 1,606.50. |
| 3 | Arte de producto | La tercera toma recortaba la tapa por arriba: quedaba una mancha de color sin lectura, justo la señal de "plantilla" del §1.3. Además cada concentración tenía un frasco de altura distinta, y en la cuadrícula parecía un error de maquetación. | Reencuadre del detalle (recorta por abajo, nunca por arriba) y **normalización de la altura del frasco** a 720 px para las cinco formas. |
| 4 | Global | Cada imagen emitía un warning de `next/image` en consola, contra el §18 ("cero warnings"). | Se eliminó la prop `quality`, que es inerte bajo exportación estática. |
| 5 | Global | Cuatro `setState` dentro de efectos (barra de anuncios, contador 3x2, badge del carrito, slider de precio) provocaban renders en cascada. | Reescritos con `useSyncExternalStore` (sessionStorage y reloj), estado derivado (slider) y animación CSS reiniciada por `key` (badge). ESLint queda en cero. |

### Verificaciones ejecutadas

- **Escalera de volumen**, medida sobre la ficha renderizada de Praliné 100 ml
  ($ 1,190): 3–5 → $ 1,011.50 (−15%), 6–11 → $ 892.50 (−25%), 12+ → $ 714.00
  (−40%). Mensaje de upsell: *"Agrega 2 piezas más y baja a $ 1,011.50 c/u —
  ahorras $ 178.50"*.
- **Carrito con 12 piezas**: subtotal $ 14,280 → descuento $ 5,712 → total
  $ 8,568 con envío gratis y 12 MSI de $ 714. Coincide con la ficha.
- **Sin scroll horizontal a 375 px** en home, catálogo, ficha y mayoreo: cero
  elementos desbordados fuera de contenedores con scroll propio.
- **CP autocompletado**: 37160 → León, Guanajuato.
- **14 rutas** responden 200; las 52 fichas y los 8 lotes se prerenderizan.
- **Consola limpia** en pestaña nueva: sin errores, sin warnings, sin avisos de
  hidratación.
- **ESLint**: 0 errores, 0 warnings.

### Lo que queda fuera de esta entrega

- Revisión visual con capturas y auditoría Lighthouse: no se pudieron ejecutar
  en este entorno (panel de navegador no disponible). El objetivo de
  Performance ≥ 90 / Accesibilidad ≥ 95 está **sin medir**, no verificado.
- Los tres últimos clics del checkout (avanzar de paso 2 a 3 y confirmar) no se
  pudieron automatizar sin capturas; el árbol de accesibilidad del navegador
  truncaba antes del botón. La lógica sí se validó: los pasos 1 y 2 se
  recorrieron con datos reales y la pantalla de confirmación se verificó
  renderizando un pedido.
