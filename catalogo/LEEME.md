# Cómo cargar el catálogo

El catálogo de la tienda vive en AWS: los datos en DynamoDB (`Elrey_catalogo`) y
las fotos en S3 (`Elrey_imagenes`), servidas por CloudFront. **La tabla es la
fuente de verdad**, y hay dos formas de cambiarla:

- **El panel** (`/radar/catalogo/`, con una cuenta del grupo `admins`): para el
  día a día. Marcar agotado, ocultar, cambiar un precio, dar de alta un perfume
  con su foto. Lo que se vende y a cuánto llega a la tienda en un minuto; lo
  demás, al publicar (el botón del panel, o solo a los diez minutos del último
  cambio si está configurado el token de GitHub).
- **Esta carpeta**: para los cambios a granel, como el catálogo del mes. Se
  edita en Excel o Google Sheets y se carga en cada despliegue. No hace falta
  tocar código.

**Las dos no se pisan.** La carga del CSV aplica solo los campos que cambiaron
en el CSV desde la carga anterior: si en el panel se marcó un perfume agotado y
en el Excel se le cambió el precio, se quedan los dos. Si los dos cambiaron el
mismo campo gana el CSV, y la carga lo dice en el registro del despliegue.

Antes de un cambio grande en Excel conviene partir de lo que hay: el botón
**Exportar** del panel baja cada CSV tal como está en la tabla, en este mismo
formato.

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
   fotos nuevas, fusiona en DynamoDB lo que cambió y compila la tienda con lo
   que quedó en la tabla.

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
| `foto` | La lleva el CSV que baja **Exportar**: la clave en S3 de la foto (`productos/0001/…webp`). No se escribe a mano | Se usa la de `fotos/` |

**La foto de `fotos/` manda sobre la columna `foto`.** Para cambiar una foto
basta con dejar el archivo nuevo en `fotos/`, aunque el CSV venga exportado. La
columna solo cuenta cuando no hay archivo, que es el caso de lo que se subió
desde el panel: así un CSV exportado vuelve a cargar sin perder esas fotos.

`sets.csv` lleva `codigo`, `nombre`, `precio` y opcionalmente `slug`, `marca`,
`precio_anterior`, `incluye` (separado por `|`), `descripcion`, `agotado`,
`visible`, `nota` y `foto`. Productos, sets y lotes no pueden repetir `slug`
entre sí. `lotes.csv` lleva `slug`, `nombre`, `piezas`, `precio` y
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
no se publica y no se puede cobrar. Lo que se dio de alta en el panel no lo
borra la carga aunque no esté en el CSV (si exportaste, ya está, con su foto en
la columna `foto`); lo que se borró en el panel no vuelve aunque siga aquí (la
carga avisa para que lo quites).

**Un modelo de lote agotado u oculto no es un error.** La carga lo menciona,
pero no se detiene: un agotado sigue contando en el valor del lote con su
precio, y uno oculto deja de contar.

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
