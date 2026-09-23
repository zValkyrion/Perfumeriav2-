# Cómo cargar el catálogo

El catálogo de la tienda vive en AWS: los datos en DynamoDB (`Elrey_catalogo`) y
las fotos en S3 (`Elrey_imagenes`), servidas por CloudFront. Esta carpeta es la
**entrada**: lo que se edita en Excel o Google Sheets y se carga en cada
despliegue. No hace falta tocar código.

| Archivo | Qué lleva |
| --- | --- |
| `productos.csv` | Un perfume por fila |
| `marcas.csv` | Las casas a las que apuntan los perfumes |
| `sets.csv` | Estuches de regalo con precio propio |
| `lotes.csv` | Paquetes para revender y los modelos que traen |
| `fotos/<código>.jpg` | La foto de cada producto y de cada set (también `.png` o `.webp`) |
| `revision.csv` | Lo que se propuso o se ocultó al pasar el PDF y falta confirmar. No se carga |

---

## Cómo llega un cambio a la tienda

1. Edita el CSV (o agrega la foto en `fotos/`).
2. Comprueba que carga: `npm run catalogo`. Si algo está mal, **no escribe nada**
   y te dice archivo, fila y columna, con la fila numerada como en Excel.
3. Haz commit y push a `main`. El despliegue valida el catálogo, sube a S3 las
   fotos nuevas, escribe en DynamoDB solo lo que cambió y compila la tienda con
   lo que quedó en la tabla.

## Los comandos

```bash
npm run catalogo
```

Lee los CSV y las fotos, valida todo y deja la copia local en
`src/data/catalogo.json` (se versiona: es la que usan el desarrollo, la copia de
GitHub Pages y el primer despliegue) más las fotos procesadas en
`public/imagenes/` (no se versionan).

```bash
npm run catalogo:exportar
```

Lo contrario: de `src/data/catalogo.json` a los CSV. Sirve para volver a un
formato limpio después de editar a mano.

```bash
npm run probar:catalogo
```

Las pruebas que corren antes de cada despliegue: que nada agotado u oculto se
cobre, que cada producto visible tenga foto, que no se publiquen notas internas.

```bash
cd radar && npx sst shell --stage produccion -- npm --prefix .. run catalogo:subir
```

La carga a AWS a mano (la CI la hace sola). Con `-- --simular` dice qué haría
sin escribir nada. Necesita haber iniciado sesión en AWS (`aws login`).

---

## Las columnas de `productos.csv`

### Obligatorias

| Columna | Qué va | Ejemplo |
| --- | --- | --- |
| `codigo` | El número del catálogo en PDF. Es el identificador: no se repite ni se cambia | `0001` |
| `nombre` | Como se llama el perfume, sin la marca | `Yara` |
| `marca` | El `slug` de una fila de `marcas.csv` | `lattafa` |
| `concentracion` | `Parfum`, `Eau de Parfum`, `Eau de Toilette`, `Eau de Cologne` o `Body Mist` | `Eau de Parfum` |
| `genero` | `Hombre`, `Mujer` o `Unisex` | `Mujer` |
| `familia` | `Amaderado`, `Oriental`, `Floral`, `Cítrico`, `Fougère`, `Chipre`, `Gourmand`, `Acuático` o `Especiado` | `Gourmand` |
| `precios` o `precio_100ml` | El precio de lista de cada tamaño: `100:569`, o `105:569` para un frasco de 105 ml | `100:569` |

La familia y el género **no se adivinan**: de ellos dependen las páginas de
categoría y los filtros.

### Opcionales

| Columna | Qué va | Si la dejas vacía |
| --- | --- | --- |
| `codigos_alternos` | Otros números con los que aparece en el PDF: `0371` | Ninguno |
| `slug` | La dirección pública: `/producto/lattafa-yara/` | Se saca del nombre |
| `agotado` | `si` si no hay existencias: se ve, pero no se puede comprar | Disponible |
| `visible` | `no` para ocultarlo sin borrarlo (duplicados, pendientes de confirmar) | Visible |
| `mls` | Tamaños: `50\|100`. Un tamaño sin precio en `precios` se deduce del de 100 ml | Los de `precios` |
| `badges` | `Nuevo`, `Más vendido`, `Últimas piezas`, `Edición limitada`, `Importado`, `3x2`, `Exclusivo` | Sin etiquetas |
| `destacado` | `si` para que salga en la portada | No sale |
| `linea` | Colección dentro de la marca | No se muestra |
| `rebaja` | Descuento vigente en decimal: `0.25` es −25% | Sin precio tachado |
| `salida`, `corazon`, `fondo` | Notas, separadas por `\|` | La pirámide olfativa no se pinta |
| `corta`, `larga` | Descripción de catálogo y de ficha | Vacía |
| `duracion`, `estela` | Del 1 al 5 | 3 |
| `ocasion` | `Diario`, `Noche`, `Oficina`, `Cita`, `Evento`, `Verano`, `Invierno` | Sin filtro por ocasión |
| `anio`, `origen` | Año de lanzamiento y país | No se muestran: mejor nada que un dato inventado |
| `nota` | Para el equipo: de dónde salió el dato o qué falta confirmar. **No se publica** | Vacía |

`sets.csv` lleva `codigo`, `nombre`, `precio` y opcionalmente `slug`, `marca`,
`precio_anterior`, `incluye` (separado por `|`), `descripcion`, `agotado`,
`visible` y `nota`. `lotes.csv` lleva `slug`, `nombre`, `piezas`, `precio` y
`modelos` (códigos de productos separados por `|`); las piezas se reparten entre
los modelos.

---

## Cosas que conviene saber

**El código es la llave.** Los carritos guardados, los pedidos y la foto del
producto se atan al código del PDF. Cambiar el nombre o el slug no rompe nada;
cambiar el código es dar de alta otro producto.

**El slug no se cambia una vez publicado.** Es la dirección del producto: el
enlace viejo daría 404 y se perdería el posicionamiento en Google.

**Borrar una fila la borra de la tienda en el siguiente despliegue.** Si solo
quieres que deje de verse, pon `visible` en `no`: el producto sigue en la base,
no se publica y no se puede cobrar.

**Una foto nueva se detecta sola.** El nombre del archivo publicado lleva la
huella de la foto, así que cambiar `fotos/0001.jpg` sube la nueva y la tienda la
enseña sin que nadie tenga que limpiar cachés.

**Los precios se pueden pegar tal cual.** `$ 1,290.00` se entiende igual que
`1290`.

**Una marca nueva va primero en `marcas.csv`.** Si un producto apunta a una marca
que no existe, la carga se detiene y te lo dice.

**Excel en español guarda con punto y coma.** No pasa nada: el cargador lo
detecta solo, y escribe con el marcador que hace que Excel abra bien los acentos.

---

## Lo que falta confirmar del PDF

`revision.csv` enumera cada dato que no venía en el catálogo en PDF y se propuso
—sobre todo la **familia olfativa** de los 321 perfumes, y el género o la
concentración cuando el PDF no los decía— y los productos que se cargaron
**ocultos**: duplicados con dos precios (0057 frente a 0160, 0229 frente a 0194)
y variantes cuyo nombre no se alcanza a leer. Corrige lo que haga falta en
`productos.csv`, cambia `visible` a `si` en lo que ya esté confirmado y borra
de `revision.csv` los renglones resueltos.

Los productos de cuidado de la piel del PDF (CeraVe, Vichy, COSRX, Anua) no se
cargaron: la tienda todavía no tiene esa categoría.
