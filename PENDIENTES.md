# PENDIENTES

Qué falta y cómo hacerlo. Pensado para retomar en otra conversación sin tener que
reconstruir el contexto.

> **Antes de tocar nada, lee [radar/MEMORIA.md](radar/MEMORIA.md)**: es la fuente
> de verdad del módulo. Tiene la arquitectura, las decisiones con su porqué y la
> bitácora de cambios. Sus reglas (§0) aplican a todo lo de aquí — en particular:
> cada cambio se registra en su bitácora con el motivo.

---

## Dónde está todo hoy

| | |
| --- | --- |
| Tienda | https://devfq5kjop78h.cloudfront.net/ |
| Panel de la tienda (admins) | https://devfq5kjop78h.cloudfront.net/radar/tienda/ |
| Panel de proveedores | https://devfq5kjop78h.cloudfront.net/radar/ |
| API | https://qdn0ihicj6.execute-api.us-east-1.amazonaws.com |
| Cuenta AWS | 637423567003 · us-east-1 · etapa `produccion` |
| Pool de Cognito | `Elrey_usuarios` (`us-east-1_qpU8tmkIB`) |
| Repositorio | `zValkyrion/Perfumeriav2-`, rama `main` |

Cada push a `main` despliega solo y corre las pruebas. Para desplegar a mano:
`npm --prefix radar run desplegar`.

**Estado de las cuentas:** `carlos.acosta12121998@gmail.com` es el
**superadmin** (además de estar en `admins`): el único que reparte permisos,
desde **Panel de la tienda → Equipo y cuentas** (`/radar/equipo/`). Los
clientes se registran solos (caen en `clientes`); quien deba ser del equipo
pide acceso desde `/radar` o se le invita por correo. El PIN compartido ya no
existe (2026-10-05).

---

## Operar la tienda

Todo sale del **Panel de la tienda** (`/radar/tienda/`, o «Panel admin» en la
cabecera de la tienda con tu cuenta).

1. **Llega un pedido** → aparece en «Por cobrar» como `Pendiente`. El cliente
   te escribe por WhatsApp con el folio (la confirmación le arma el mensaje).
2. **Cobras** (transferencia, Clip o se acuerda el contra entrega) → en el
   detalle del pedido, **Confirmar pago** (`Pagado`).
3. **Surtes** → **Empezar a surtir** (`En preparación`). «Imprimir» da la hoja
   de surtido con las líneas y la nota interna.
4. **Envías** → pones paquetería y guía y **Marcar enviado** (`En camino`). El
   botón de WhatsApp arma el mensaje con el enlace de rastreo.
5. **Llega** → **Marcar entregado** (`Entregado`). Solo `Pagado` en adelante
   cuenta como venta.

El cliente ve cada paso al instante en «Mis pedidos» o, sin cuenta, en
`/rastreo` con su folio y su teléfono. Cancelar: él mismo mientras siga
`Pendiente`; después, tú desde el panel. Cada cambio queda en el historial con
quién y cuándo. Si dos personas tocan el mismo pedido, la segunda recibe un
aviso en vez de pisar al otro.

**Solicitudes** (`/radar/solicitudes/`): altas de distribuidor, mensajes de
contacto y **facturas** (con RFC, razón social, régimen, CP y uso de CFDI y el
folio). La factura se emite fuera del sistema; aquí se lleva el estado.

**Ventas** (`/radar/ventas/`) y **Clientes** (`/radar/clientes/`) se calculan
solos a partir de los pedidos; los dos exportan a CSV para Excel.

---

## Decisiones que solo tú puedes tomar

El código ya soporta cada una; falta el dato o la decisión:

- **Meses sin intereses:** el PDF dice hasta 3, el checkout ofrece 3/6/9/12,
  las garantías dicen «hasta 6» y los anuncios «3». Se cambian en
  `src/lib/volumen.ts` y `src/data/contenido.ts`.
- **3x2 del hero:** la portada anuncia «3X2 en toda la tienda» y ningún
  producto tiene la etiqueta, así que no se cobra. O se etiquetan modelos con
  «3x2» en `/radar/catalogo/`, o se cambia el arte.
- **Precio de los paquetes desde 20 piezas:** hoy sale más caro que comprar las
  mismas piezas sueltas con su descuento. Y sus textos del catálogo dicen
  «Precio de Importador Directo» y «el mejor precio unitario que damos»
  (se editan en `/radar/catalogo/`, tipo lote).
- **Familias, géneros, los 14 ocultos y los 5 de cuidado de la piel** del
  catálogo (`catalogo/revision.csv`).
- **Correo y redes:** `contacto@elreydelosperfumes.mx` es de un dominio que no
  se ha comprado; Instagram, Facebook y TikTok apuntan a las portadas genéricas.
- **Políticas sin confirmar:** apartar piezas 24 horas con transferencia, «sale
  el mismo día antes de la 1 pm», cambio de modelos que no rotan en paquetes de
  40 y 50.
- **Niveles de cliente:** «Mis pedidos» promete beneficios por nivel (Plata 5%
  extra en lotes, Distribuidor precio permanente) que el cobro no aplica. O se
  confirman y se programan en `compartido/cotizacion.ts`, o se quitan los textos
  de `compartido/niveles.ts`.
- **SES** para correos propios (tope actual de ~50 al día, §4).

---

## 1. Dar de alta al equipo — ✅ construido el 2026-10-05

Ya no hace falta la CLI. Con tu cuenta: **Panel de la tienda → Equipo y
cuentas** (`/radar/equipo/`).

- **Quien ya tiene cuenta de la tienda:** que abra `/radar` y pulse «Pedir
  acceso al equipo». Te aparece en «Por aceptar»: *Aceptar en el equipo*,
  *Como admin* o *Rechazar*.
- **Quien no tiene cuenta:** *Invitar por correo* con su nombre real (firma
  cada ficha). Le llega una contraseña temporal de 14 días.
- **Baja:** su fila → «Puede entrar» → No. No borra nada y se deshace.

Al equipo le toca *equipo de proveedores*, no administrador. Tras el cambio,
la persona sale y vuelve a entrar para que su sesión traiga el permiso.
Detalle y la alternativa por CLI en
[radar/infra/usuarios.md](radar/infra/usuarios.md).

**Queda de tu lado:** aceptar o invitar a cada persona (1 minuto cada una).

---

## 2. Retirar el PIN compartido — ✅ hecho el 2026-10-05

La API ya no tiene `POST /acceso`, la portada solo ofrece la cuenta y un
teléfono con la sesión vieja del PIN la cierra solo (las fichas sin subir se
quedan en él y suben al entrar con cuenta). **Avísale al equipo antes del
push**: quien entraba con el código tiene que crearse su cuenta en la tienda y
pedir acceso, o recibir tu invitación.

**No borres los secretos `Elrey_pin` ni `Elrey_jwt_secreto`.** Siguen
declarados en `sst.config.ts` sin enlazar a nada: producción va con `protect`
y quitarlos tumbó el primer despliegue (ver la bitácora). Borrarles el valor
con `sst secret remove` haría fallar todos los despliegues siguientes.

Para que la prueba de humo de la CI recorra el radar entero: crea (o invita)
una cuenta solo para pruebas en *equipo de proveedores* y guarda su correo y
contraseña como secretos `RADAR_CORREO` y `RADAR_CONTRASENA` del repositorio
(Settings → Secrets and variables → Actions). Sin ellos la CI solo comprueba
las puertas, y no falla. El secreto `RADAR_PIN` ya se puede borrar.

---

## 2.1 Publicar desde el panel — token de GitHub

**Por qué.** Sin él, lo que cambies en `/radar/catalogo/` (un perfume nuevo,
una foto, un texto) sale en la tienda hasta el siguiente push. Los agotados y
los precios no esperan: esos llegan en un minuto de todos modos.

**Cómo** (lo haces tú: es una credencial de tu cuenta de GitHub):

1. GitHub → foto de perfil → **Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token**.
2. Nombre `Elrey publicar`, caducidad la que prefieras (al vencer, se repite
   esto). **Repository access → Only select repositories →
   `zValkyrion/Perfumeriav2-`**.
3. **Permissions → Repository permissions → Actions: Read and write.** Nada
   más (Metadata: Read se pone solo).
4. Generar y copiar el token (empieza por `github_pat_`).
5. En PowerShell, con la sesión de AWS:

```bash
cd radar; npx.cmd sst secret set Elrey_github_token --stage produccion
```

   Sin el valor en la línea, SST lo pide y no queda en el historial de la
   terminal; si tu versión no lo pide, añádelo al final del comando. Luego haz
   un push o vuelve a correr el workflow para que la Lambda lo lea.

6. En `/radar/catalogo/` el botón «Publicar» deja de decir «no está
   configurado», y el Cron publica solo diez minutos después del último cambio.

---

## 3. Dominio propio

**Por qué.** Desbloquea tres cosas de golpe: la URL fea de CloudFront, el
canonical de la tienda —que hoy sigue apuntando a GitHub Pages— y el registro de
clientes, que necesita correos desde un dominio propio.

**Cómo.**

1. Comprar el dominio. Si el DNS queda en Route 53, SST hace el resto solo.
2. En `radar/sst.config.ts`, en el componente `Elrey_radar`:
   ```ts
   domain: { name: "elreydelosperfumes.mx", dns: sst.aws.dns() }
   ```
3. Cambiar `SITIO_URL` en `src/lib/sitio.ts` al dominio nuevo. Ese archivo ya
   explica exactamente qué hacer.
4. Crear `public/CNAME` y decidir si GitHub Pages sigue publicando o se apaga.
5. Redesplegar y comprobar `sitemap.xml` y los canonical.

**Hazlo una sola vez.** Cada cambio de URL reinicia el SEO acumulado, y por eso
el canonical no se movió cuando pasamos a CloudFront.

**Esfuerzo:** 1–2 horas más la propagación del DNS.

---

## 4. Registro de clientes — ✅ hecho el 2026-09-26

Registro abierto con código por correo, recuperación de contraseña, disparador
post-confirmación que mete cada alta en `clientes`, y «Mis datos» para editar
nombre, WhatsApp, correo y contraseña, cerrar sesión en todos lados o eliminar
la cuenta. Detalle en la bitácora de [radar/MEMORIA.md](radar/MEMORIA.md).

**Queda pendiente — SES.** El correo del código lo manda Cognito desde su
dirección, con un tope de **~50 correos al día**. Basta para arrancar; cuando el
registro crezca (o con el dominio propio, §3), verificar el dominio en SES, pedir
salir del sandbox (uno o dos días) y conectarlo al pool en `radar/sst.config.ts`
(`email: { from: … }` del componente `Elrey_usuarios`).

---

## 5. Carrito y pedidos por usuario (fase 5) — ✅ hecho el 2026-08-20

Carrito, guardados y favoritos viajan con la cuenta; los pedidos de `/cuenta` son
los de verdad. Rutas `GET/PUT /carrito` y `GET/POST /pedidos`, con los datos en
`Elrey_proveedores` bajo `PK = USER#<sub>`. La fusión al entrar **suma** y ocurre
una sola vez por cuenta y navegador. El detalle del pedido se mudó a
`/cuenta/pedido/?folio=` porque la ruta estática solo existía para los folios de
muestra. El porqué de cada decisión está en la bitácora de
[radar/MEMORIA.md](radar/MEMORIA.md).

Las direcciones se sumaron el mismo día: `GET/PUT /direcciones` bajo
`SK = DIRECCIONES`, con una sola predeterminada impuesta por el servidor, y el
checkout se prellena con ella —que es para lo que sirve guardarla—.

~~El total lo calcula el navegador~~ (✅ desde 2026-09-22 lo calcula el
servidor) y ~~nadie mueve el estatus~~ (✅ 2026-09-28: panel de pedidos con
estatus, guía, historial y seguimiento del cliente — ver «Operar la tienda»).

---

## 6. Panel de administración — ✅ hecho el 2026-08-20

`/radar/admin/`: resumen por semáforo, ranking global, mapa con todos los pines
del color de su semáforo y exportación CSV. Visible solo para `admins`, con el
enlace en la portada del panel.

**Esa puerta no guarda ningún secreto y no hay que confundirse:** los datos salen
de `GET /proveedores`, que devuelve todo a cualquier token válido. Si algún día
esta pantalla lee algo que un `proveedores` no deba ver, el filtro va en
`servidor/api.ts`, no en el navegador.

---

## 7. Auditoría de la tienda — ✅ hecha el 2026-08-20

Recorrido completo del sitio sobre la compilación de producción y sobre las dos
publicaciones. Arreglado y desplegado:

- **66 páginas salían en blanco al entrar directo** —catálogo, sus categorías y
  todas las fichas de producto—, incluida GitHub Pages, que es a donde apunta el
  canonical. Eran los dos `loading.tsx`. Ver la bitácora y la regla de arriba.
- **El 3x2 no se cobraba**, anunciándose en veinte productos, en una sección
  propia y en los términos. Ahora se aplica en el carrito y en el checkout.
- **Se podían meter más piezas de las que hay** pulsando «Agregar» dos veces.
- **El selector de colorimetrías de desarrollo** estaba publicado en la tienda.
- El escalón de 20+, tres textos en inglés y el título de la confirmación.

Lo que la auditoría encontró y **sigue abierto** está repartido abajo y en el
§5. Nada de esto se probó en un navegador distinto del integrado: conviene abrir
una ficha de producto en un teléfono real.

---

## 8. Menores

- ~~Limpiar los datos de prueba.~~ ✅ Borradas las cuatro fichas y las cinco
  fotos el 2026-08-20. La tabla y el bucket quedaron en cero. Dos de ellas no
  estaban vacías —una con 27 ejes, 4 precios y las 5 fotos; otra con 24 ejes y un
  teléfono—, así que antes se guardó copia completa (JSON y fotos) en
  `Documentos/GitHub/respaldo-radar-2026-08-20/`, fuera del repositorio.
- **La copia JSON no incluye las fotos** (son Blobs y no sobreviven a
  `JSON.stringify`). Si alguna vez importa, habría que empaquetarlas aparte.
- ~~Aviso de Node 20 en la CI.~~ ✅ Las acciones subieron a su versión actual y
  la CI corre Node 22, que además hace falta para `probar-tienda`.
- ~~El atajo «Panel» de la cabecera no desaparece al cerrar sesión.~~ ✅ Usa
  `useSesion` desde el 2026-09-26: aparece y desaparece al instante.

---

## 9. Funciones de la página — lo construido y lo que falta

Del documento «Funciones de la página» (2026-08-25). Lo hecho está en la bitácora
de [radar/MEMORIA.md](radar/MEMORIA.md), entrada del 2026-08-25.

### Listo, pero esperando un dato tuyo

Nada de esto se puede terminar desde el código: falta información que solo tú
tienes. Cada pieza ya está cableada y funciona sin ella.

| Qué falta | Dónde se pone | Qué pasa mientras no esté |
| --- | --- | --- |
| **Identificador del pixel de Meta** (15 dígitos) | Variable `META_PIXEL` del repositorio en GitHub | No se carga el pixel: ni script, ni cookie, ni una petición a Facebook |
| **Enlace de cobro de Clip** (`https://pay.clip.mx/…`) | Variable `CLIP_LINK` | El pedido se cierra igual y el cobro se acuerda por WhatsApp |
| **Webhook de avisos** (Make, Zapier, n8n…) | Variable `WEBHOOK_PEDIDOS` | El aviso va solo por WhatsApp, desde el botón de la confirmación |
| **CLABE, banco y titular** | `NEXT_PUBLIC_CLABE`, `NEXT_PUBLIC_BANCO`, `NEXT_PUBLIC_TITULAR` | El checkout dice la verdad: las instrucciones van por WhatsApp |

Las variables se ponen en **Settings → Secrets and variables → Actions →
Variables** del repositorio. Los dos workflows y `radar/sst.config.ts` ya las
recogen; basta con volver a desplegar.

**La CLABE es el único caso donde conviene pensárselo**: puesta ahí, aparece en
el código fuente de la página, visible para cualquiera. Si prefieres darla solo
por WhatsApp —que es lo que dice el documento—, no la pongas y déjalo como está.

### Pendiente de contenido

- **Catálogo completo con sus precios.** Ya no hay que tocar código: se edita
  `catalogo/productos.csv` en Excel y se carga con `npm run catalogo`. Las
  instrucciones completas, columna por columna, están en
  [catalogo/LEEME.md](catalogo/LEEME.md). El archivo trae ya los 52 productos
  actuales para que se vea el formato lleno.
- **Tabla de descuentos.** La escalera actual —3+ 10%, 6+ 20%, 10+ 30%, 20+ a
  cotizar— vive en `src/lib/volumen.ts` y ya se aplica sola en el carrito y en el
  checkout. Si la tabla que mandes es distinta, se cambia **solo ahí**: media
  docena de textos del sitio derivan sus cifras de ese archivo justamente para
  que no se queden prometiendo lo anterior.

### Segunda tanda

- **Contabilización automática de stock.** Hoy las existencias son un número
  estable entre 15 y 30 derivado del slug, no un inventario. Restar al vender
  necesita que el stock viva en el servidor, no en el navegador — es el mismo
  trabajo que el §5 deja anotado para el total del pedido.
- **Correos automatizados de marketing.** Depende de SES fuera del sandbox (§4).
- **IA para automatizar procesos.** Sin definir todavía.

### Deudas que este trabajo dejó a la vista

- ~~El envío estándar cuesta $ 149.00 en el carrito y $ 0.00 en el checkout.~~
  ✅ Resuelto el 2026-08-25. La regla confirmada es: **gratis desde 3 piezas,
  $ 149.00 por debajo**. La tarifa vive ahora en `COSTO_ENVIO_ESTANDAR`
  (`src/lib/volumen.ts`), junto al mínimo que la vuelve gratis, y de ahí la leen
  el carrito, el checkout y la página de envíos.
- ~~El pedido no cambia de estatus ni hay panel donde verlos.~~ ✅ 2026-09-28.

---

## Lo que NO hay que deshacer

Decisiones tomadas con motivo. Si alguien las revierte por descuido, rompe cosas
que costó descubrir:

- **`null` significa «no se preguntó»** y nunca cero. Poner valores por defecto en
  los ejes de evaluación fabrica datos y falsea el puntaje.
- **Las banderas rojas topan el score en 39**, no restan. Sin el tope, la suma
  ponderada cuela al verde a un proveedor que es un riesgo legal.
- **El superadmin no es un grupo de Cognito** y no se da desde el panel: vive en
  `compartido/equipo.ts` y se reconoce por el correo *verificado*. Convertirlo
  en grupo dejaría que un descuido en el panel se lo quitara al dueño o se lo
  diera a otro. Si se cambia el correo de la lista, también la copia de
  `radar/src/lib/superadmin.ts` (`tsc` avisa).
- **En producción no se quita nada de `sst.config.ts` a la ligera.** Va con
  `protect`: borrar la declaración de un recurso (hasta un `sst.Secret`)
  tumba el despliegue entero. Para retirar algo se le quita el `link` o el
  uso, y la declaración se queda.
- **El botón del panel no es un permiso**, solo un enlace. El permiso vive en el
  grupo del token y lo comprueba la API; la tienda solo decide qué pintar.
- **El canonical de la tienda no se mueve** hasta que exista el dominio.
- **Desplegar desde la CI**, no desde una laptop con Windows: allí Next genera
  los payloads de navegación con otro nombre y provoca 403 en cada prefetch.
- **La lista de precios se guarda en JPEG**, no en WebP: Textract no lee WebP.
- **Nada de `loading.tsx` en la tienda.** Con `output: export`, ese archivo crea
  un límite de Suspense que al hidratar se queda pendiente para siempre: la
  página entera en blanco al entrar directo. Costó 66 páginas rotas descubrirlo.
  Se comprueba con `grep -rlF '$RC(' out --include=index.html`, que tiene que
  devolver cero.
- **El 3x2 se resta en el carrito y también en el checkout.** El checkout rehace
  el total por su cuenta porque el envío depende de la opción elegida ahí; un
  concepto que descuente y solo se reste en un sitio hace que se cobre de más.
- **La fusión del carrito ocurre una sola vez** por cuenta y navegador, y por eso
  el estado guarda `sincronizado`. Fusionar en cada carga duplica las cantidades
  en cada recarga: 2 → 3 → 6 → 12.
- **El carrito se guarda bajo el `sub` de Cognito**, no bajo el correo: el correo
  se puede cambiar y dejaría el carrito anterior huérfano.
- **El tope del pago contra entrega se mide antes de su propia comisión.** Al
  revés, un pedido de $ 9,700 se quedaría fuera por culpa de los $ 400 del
  servicio.
- **La comisión del cobro en destino se enseña como concepto**, nunca sumada
  callada al total: es el mismo error que el 3x2, cobrar de más sin que se vea.
- **El pixel no carga sin `META_PIXEL`.** No es un descuido: evita que el
  desarrollo cuente visitas en las estadísticas de la campaña.
- **Subir la versión del estado persistido exige `migrate`.** Sin él, zustand
  tira lo guardado y todo el mundo pierde el carrito. La versión 2 solo descarta
  el comprobante viejo.
- **No se piden datos de tarjeta en la tienda.** Es una exportación estática: sin
  servidor que cobre, un formulario de tarjeta recoge un número de tarjeta para
  nada. El cobro con tarjeta lo hace Clip, en su propia pantalla.
- **El CSV manda sobre `semillas.ts` y `marcas.ts`.** Esos dos archivos están
  generados y lo dicen en su primera línea. Editarlos a mano funciona hasta la
  siguiente `npm run catalogo`, que se lo lleva todo.
- **Una carga de catálogo con errores no escribe nada.** Nunca a medias: medio
  catálogo cargado parece que funcionó y es peor que ninguno.
- **La compra exprés salta pasos, nunca la confirmación.** Un botón que cobra sin
  enseñar el total antes no es rapidez, es un cargo sorpresa — y con el contra
  entrega son $400 de diferencia.
- **`maxPaso` es lo que marca una sección del checkout como hecha**, no `paso`.
  Con `paso`, corregir la dirección apaga entrega y pago y obliga a recorrer todo
  otra vez.

---

## Verificación

Después de cualquier cambio:

```bash
npm --prefix radar run probar:local
RADAR_CORREO=... RADAR_CONTRASENA=... npm --prefix radar run probar
RADAR_CORREO=... RADAR_CONTRASENA=... npm --prefix radar run probar-textract
npm --prefix radar run probar-tienda
```

Compilar no es funcionar. Los fallos más caros de esta construcción —el preflight
CORS, las fotos huérfanas en S3, los borrados que no viajaban, el precio de 2800
leído como 280— no los detectó ni el compilador ni las pruebas con curl: hicieron
falta el navegador real y mirar el bucket.

Los dos scripts contra producción piden el token a Cognito con la cuenta de
prueba (`radar/scripts/token-cognito.mjs`); sin ella, `probar` solo comprueba
las puertas y `probar-textract` no corre.
