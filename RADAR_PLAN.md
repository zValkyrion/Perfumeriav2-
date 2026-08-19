# RADAR DE PROVEEDORES — Plan de construcción

> **Este plan ya se ejecutó.** El estado vivo del módulo, la infraestructura real
> y la bitácora de cambios están en [radar/MEMORIA.md](radar/MEMORIA.md).

App móvil para evaluar proveedores de perfumería **en la calle**, en otro país,
con señal mala. Meta operativa: **90 segundos por proveedor**, sin perder una
sola ficha por falta de red.

---

## 0. Decisiones cerradas

| Tema | Decisión |
| --- | --- |
| Ubicación | Carpeta `radar/` en este repo, app Next.js independiente |
| Backend | 100% AWS |
| Base de datos | DynamoDB, tabla única, on-demand |
| Fotos | S3 + CloudFront, subida directa con URL prefirmada |
| API | API Gateway HTTP API + Lambda (Node/TS) |
| Acceso | Código de equipo (PIN) → JWT. Sin Cognito |
| Mapas | Leaflet + OpenStreetMap (Amazon Location Service queda como interruptor) |
| Infra como código | SST v3 (`sst.config.ts`) |
| Región | `us-east-1` |

**Restricción del repo:** la landing usa `output: "export"` (GitHub Pages).
`radar/` es una app aparte con su propio `package.json` y su propio deploy.
La landing **no se toca**.

**Infra deliberadamente evitada:** RDS/Aurora y Lambda en VPC. Arrastran NAT
Gateway (~32 USD/mes fijos) sin aportar nada a este volumen de datos.

---

## 1. Acceso y trazabilidad

PIN compartido para el equipo, guardado en SSM Parameter Store. Una Lambda lo
valida y firma un JWT (HS256).

**Estado actual (Fase 0):** el PIN está escrito en el cliente (`radar/src/lib/sesion.ts`)
y es visible para cualquiera que abra la URL. Es un pestillo provisional; la
cerradura llega con la Lambda de la Fase 1.

El PIN solo, por sí mismo, borra el rastro de quién capturó qué. Se recupera
gratis: al entrar, la app pregunta **una vez** "¿quién eres?" con la lista de
compañeros, lo guarda en el dispositivo y lo incrusta en el JWT. Cada ficha
queda firmada. Un tap extra el primer día, cero cuentas que administrar.

---

## 2. Modelo de datos (DynamoDB, tabla única)

```
PK                  SK                      Contenido
PROV#<id>           META                    proveedor + score + decisión
PROV#<id>           FOTO#<ts>               clave S3, tipo, lat/lng
PROV#<id>           PRECIO#<presentacion>   precio, moneda, MOQ, costo_por_ml
PROV#<id>           EVAL#<ts>               ejes puntuados + notas + evaluador

GSI1  PAIS#<pais>   SCORE#<0000-9999>#id    ranking y filtros por país
GSI2  TEL#<tel>     PROV#<id>               duplicados por teléfono
GSI3  GEO#<gh5>     PROV#<id>               "ya hay un proveedor a 30 m"
```

Geohash de 5 caracteres (~5 km) para cercanía y duplicados. Sin PostGIS.

---

## 3. La ficha de evaluación

**Identificación** — nombre comercial, razón social, tipo (fabricante / maquila /
importador / mayorista / revendedor), contacto y cargo, teléfono, WhatsApp,
correo, redes, horario.

**Ubicación** — GPS automático al abrir la ficha, con precisión en metros. Botón
"ajustar en mapa" con pin arrastrable. Dirección legible autocompletada y
editable. Sin señal: guarda coordenadas y resuelve la dirección al sincronizar.

**Producto y calidad** — familias, tipo (inspirados / originales / decants /
esencia a granel / envases), concentración (EDT/EDP/Parfum/aceite), **fijación en
horas**, **proyección**, **similitud vs. original**, calidad de envase (frasco,
tapa, atomizador), calidad de etiqueta, lote y caducidad visibles.

**Comercial** — precio por presentación y **costo por ml normalizado** (única
forma real de comparar), moneda, MOQ, escalera de descuento, capacidad mensual,
tiempo de entrega, formas de pago (contado / anticipo % / crédito), factura,
quién paga el flete, marca blanca, exclusividad por zona.

**Confianza y riesgo** — años operando, local físico, permisos sanitarios,
referencias, banderas rojas (falsificaciones de marca registrada, se niega a
facturar, no entrega muestra).

**Evidencia** — fotos por categoría (fachada, interior, producto, etiqueta,
**lista de precios**), nota de voz, muestras recogidas con código.

### Score automático 0–100

| Eje | Peso |
| --- | --- |
| Calidad de producto | 30 |
| Precio y margen | 25 |
| Confiabilidad y formalidad | 15 |
| Capacidad y surtido | 15 |
| Condiciones comerciales | 10 |
| Trato y comunicación | 5 |

Salida: semáforo 🔴🟡🟢 y ranking. El margen se calcula contra los precios reales
del catálogo (`src/data/productos.ts`): *"este proveedor deja 62% de margen en el
100 ml"*.

---

## 4. Flujo en calle — 3 pasos, autoguardado en cada campo

1. **Quién y dónde** — nombre, teléfono, GPS de un tap. Con esto ya es un
   registro válido.
2. **Fotos** — cámara directa, comprimidas a ~1600 px WebP **en el teléfono**
   antes de subir (ahorra roaming), cada una con su categoría.
3. **Evaluación** — sliders y chips, nada de teclear. Al final: decisión
   (descartar / seguimiento / negociar / aprobado) y nota.

Todo lo demás es opcional y se amplía después desde el hotel. La app nunca
bloquea por falta de red: guarda local (IndexedDB), sincroniza cuando hay señal y
muestra el estado de cada ficha — `borrador` / `pendiente de subir` /
`sincronizado`.

---

## 5. Fases

| Fase | Entrega | Estimado |
| --- | --- | --- |
| **0** ✅ | App en `radar/`: PIN, formulario completo, GPS + mapa manual, cámara, ficha ver/editar/eliminar, análisis por criterio, preguntas pendientes por WhatsApp, comparador, offline real. **Usable en calle sin backend** | Hecha |
| **1** ✅ | `sst.config.ts`: DynamoDB + S3 + API + auth por PIN. Desplegado | Hecha |
| **2** ✅ | Sincronización offline → API, subida de fotos con URL prefirmada | Hecha |
| **3** | ~~Mapa con pin arrastrable, score, listado y ficha~~ — adelantado a la Fase 0 | — |
| **4** | Panel admin: ranking y mapa global, export CSV (~~comparador~~: adelantado a la Fase 0) | 2–3 h |
| **5** | Extras (abajo), según prioridad | — |

La Fase 0 va primero **a propósito**: el equipo captura desde el día que sale, y
cuando la Fase 2 esté lista todo lo guardado localmente se sube solo.

---

## 6. Extras

- **Textract** sobre la foto de la lista de precios → extrae la tabla sola. Es el
  que más tiempo ahorra en calle: fotografían la hoja en vez de teclear 20
  precios.
- **Transcribe** para notas de voz → texto buscable.
- **Rekognition** para etiquetar fotos y detectar las borrosas al vuelo.
- Comparador lado a lado de 2–4 proveedores.
- Ficha PDF compartible por WhatsApp y export CSV.
- Botón WhatsApp con mensaje de seguimiento precargado.
- "Ruta del día": pendientes por visitar, marcar visitado.

---

## 7. Costo

CloudFront (1 TB/mes), Lambda (1M req/mes) y DynamoDB (25 GB) tienen capa
gratuita **perpetua**, no de 12 meses. S3 con unos GB de fotos ronda 0.10 USD/mes.

**Estimado: menos de 1–2 USD al mes**, sin depender de que la cuenta sea nueva.

---

## 8. Convenciones

- Nombres de archivo y de dominio **en español**, como el resto del repo.
- Se reutilizan `src/components/ui` (shadcn) y el sistema de `DESIGN_NOTES.md`.
- Antes de escribir código de Next.js: leer las guías en
  `node_modules/next/dist/docs/` — esta versión tiene cambios de ruptura
  respecto a lo conocido (ver `AGENTS.md`).
