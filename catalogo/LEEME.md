# Cómo cargar el catálogo

Aquí viven los dos archivos que mandan sobre el catálogo de la tienda. Se editan
en Excel o en Google Sheets; no hace falta tocar código.

| Archivo | Qué lleva |
| --- | --- |
| `productos.csv` | Un perfume por fila |
| `marcas.csv` | Las casas a las que apuntan los perfumes |

---

## Los tres comandos

```bash
npm run catalogo:exportar
```

Baja a CSV lo que hoy tiene la tienda. **Es lo primero que hay que hacer**: así
editas sobre el catálogo real en vez de partir de una hoja en blanco, y no se
pierde nada de lo que ya estaba.

```bash
npm run catalogo
```

Sube el CSV a la tienda. Si hay algún error, **no escribe nada** y te dice qué
fila y qué columna — el número de fila es el mismo que enseña Excel.

```bash
npm run imagenes
```

Genera el arte de los perfumes nuevos. Cada fragancia recibe un frasco propio,
construido a partir de su familia olfativa. Solo hace falta cuando agregas
productos.

Después de cargar, comprueba que todo compila con `npm run build`.

---

## Las columnas de `productos.csv`

### Obligatorias

| Columna | Qué va | Ejemplo |
| --- | --- | --- |
| `nombre` | Como se llama el perfume | `Noir Absolu` |
| `marca` | El `slug` de una fila de `marcas.csv` | `maison-lumiere` |
| `concentracion` | `Parfum`, `Eau de Parfum`, `Eau de Toilette`, `Eau de Cologne` o `Body Mist` | `Eau de Parfum` |
| `genero` | `Hombre`, `Mujer` o `Unisex` | `Unisex` |
| `familia` | `Amaderado`, `Oriental`, `Floral`, `Cítrico`, `Fougère`, `Chipre`, `Gourmand`, `Acuático` o `Especiado` | `Amaderado` |
| `precio_100ml` | Precio de menudeo del frasco de 100 ml | `2890` |

La familia y el género **no se adivinan**. De ellos dependen las páginas de
categoría y los filtros: un perfume con la familia equivocada aparece en la
página que no le toca y nadie se entera hasta que un cliente lo dice.

### Opcionales

| Columna | Qué va | Si la dejas vacía |
| --- | --- | --- |
| `slug` | La dirección pública: `/producto/noir-absolu/` | Se saca del nombre |
| `linea` | Colección dentro de la marca | No se muestra |
| `precios` | Precio exacto por tamaño: `30:990\|50:1690\|100:2890` | Se deduce del de 100 ml |
| `rebaja` | Descuento vigente en decimal: `0.25` es −25% | Sin precio tachado |
| `mls` | Tamaños disponibles: `30\|50\|100` | Solo 100 ml |
| `salida`, `corazon`, `fondo` | Notas, separadas por `\|` | La pirámide olfativa no se pinta |
| `corta` | Una línea, la que se lee en el catálogo | Vacía |
| `larga` | La descripción de la ficha | Se usa la corta |
| `badges` | `Nuevo`, `Más vendido`, `Últimas piezas`, `Edición limitada`, `Importado`, `3x2`, `Exclusivo` | Sin etiquetas |
| `duracion`, `estela` | Del 1 al 5 | 3 |
| `ocasion` | `Diario`, `Noche`, `Oficina`, `Cita`, `Evento`, `Verano`, `Invierno` | Sin filtro por ocasión |
| `destacado` | `si` para que salga en la portada | No sale |
| `anio` | Año de lanzamiento | El año actual |
| `origen` | País | México |

---

## Cosas que conviene saber antes de editar

**El slug no se cambia una vez publicado.** Es la dirección del producto. Si
cambia, el enlace viejo da 404 y se pierde el posicionamiento que esa página
había acumulado en Google. Por eso el exportador siempre lo escribe: para que al
reeditar se conserve el que ya existía.

**Los precios se pueden pegar tal cual.** `$ 1,290.00` se entiende igual que
`1290`. Lo que no se acepta es una celda con texto que no sea un número.

**`precios` manda sobre `precio_100ml`.** Sin la columna `precios`, el precio de
los frascos chicos se deduce con una curva (el de 50 ml sale al 68% del de 100,
el de 30 al 45%), que es una aproximación razonable de cómo se vende perfumería.
Si tu lista trae la cifra exacta de cada frasco, ponla en `precios` y esa se
respeta sin redondeos.

**Las etiquetas cambian el comportamiento, no solo el color.** `Edición
limitada` deja al producto fuera de los descuentos por volumen, y `3x2` lo mete
en la promoción de tres por dos. `Últimas piezas` baja sus existencias.

**Una marca nueva va primero en `marcas.csv`.** Si un producto apunta a una marca
que no existe, la carga se detiene y te lo dice. Es a propósito: la página de la
marca se rompería.

**El archivo generado no se edita.** `npm run catalogo` sobrescribe
`src/data/semillas.ts` y `src/data/marcas.ts` enteros. Si alguien tocó esos
archivos a mano, recupera esos cambios con `npm run catalogo:exportar` antes de
volver a cargar.

**Excel en español guarda con punto y coma.** No pasa nada: el cargador detecta
solo si el archivo viene separado por comas o por punto y coma, y escribe con el
marcador que hace que Excel abra los acentos bien.

---

## Lo que el CSV no incluye

- **Existencias.** Hoy son un número estable entre 15 y 30 por presentación,
  derivado del nombre del producto. Un inventario de verdad —que baje al vender—
  necesita que el stock viva en el servidor, no en el navegador.
- **Fotos reales.** El arte se genera solo, distinto para cada perfume. Si algún
  día hay fotografía de producto, va en `public/productos/` con el nombre
  `<slug>-1.webp` … `-4.webp`.
- **Reseñas y calificaciones.** Se derivan del slug y son estables.
