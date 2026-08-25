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
| Panel de proveedores | https://devfq5kjop78h.cloudfront.net/radar/ |
| API | https://qdn0ihicj6.execute-api.us-east-1.amazonaws.com |
| Cuenta AWS | 637423567003 · us-east-1 · etapa `produccion` |
| Pool de Cognito | `Elrey_usuarios` (`us-east-1_qpU8tmkIB`) |
| Repositorio | `zValkyrion/Perfumeriav2-`, rama `main` |

Cada push a `main` despliega solo y corre las pruebas. Para desplegar a mano:
`npm --prefix radar run desplegar`.

**Estado de las cuentas:** solo existe `carlos.acosta12121998@gmail.com`, en el
grupo `admins` y con la contraseña ya cambiada.

---

## 1. Dar de alta al equipo — *lo único que bloquea usarlo*

**Por qué.** Mientras no tengan cuenta, entran con el PIN compartido: sin
identidad, sin poder revocar a una sola persona, y las fichas firmadas con un
nombre tecleado a mano.

**Cómo.** Dos comandos por persona. El `name` es lo que firma cada ficha, así que
va el nombre real.

```bash
aws cognito-idp admin-create-user --user-pool-id us-east-1_qpU8tmkIB --username "correo@ejemplo.com" --temporary-password "UnaTemporalDistinta2026" --user-attributes Name=email,Value=correo@ejemplo.com Name=email_verified,Value=true Name=name,Value="Nombre Real"
```

```bash
aws cognito-idp admin-add-user-to-group --user-pool-id us-east-1_qpU8tmkIB --username "correo@ejemplo.com" --group-name proveedores
```

Al equipo le toca `proveedores`, no `admins`. La contraseña temporal se manda por
un canal distinto al correo de la cuenta y vale 14 días; el panel les pide
cambiarla en el primer acceso.

Más detalle —bajas, cambios de grupo, listados— en
[radar/infra/usuarios.md](radar/infra/usuarios.md).

**Esfuerzo:** 5 minutos por persona.

---

## 2. Retirar el PIN compartido

**Por qué.** Es la única deuda de seguridad abierta: cualquiera que lo sepa entra,
y no se puede revocar a una sola persona sin cambiárselo a todos.

**Cuándo.** Solo cuando **todos** tengan cuenta (§1). Antes, dejaría a alguien
fuera a mitad de una gira.

**Cómo.** Cuatro cambios. El tercero es el que de verdad cierra la puerta; los
otros dejan de enseñarla.

1. `radar/src/components/portada-acceso.tsx` — borrar `FormaCodigo` y el enlace
   «Entrar con el código del equipo».
2. `radar/src/lib/sesion.ts` — borrar `entrarConCodigo` y `conectar`.
3. `radar/servidor/identidad.ts` — borrar `sesionPorPin` y la excepción de
   `puedeVerProveedores`; en `radar/servidor/api.ts`, borrar la ruta
   `POST /acceso`.
4. `cd radar && npx sst secret remove Elrey_pin --stage produccion`

Los scripts de prueba usan el PIN (`RADAR_PIN`), así que hay que reescribirlos
para que obtengan el token de Cognito. El patrón está en la §Verificación de
abajo.

**Esfuerzo:** 1–2 horas, incluyendo reescribir las pruebas.

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

## 4. Registro de clientes (fase 4 del plan de autenticación)

**Por qué.** Hoy nadie puede crearse una cuenta: el pool está en alta solo por
administrador y la pantalla remite a WhatsApp.

**Cómo.**

1. **SES primero**, porque es lo único con espera externa: verificar el dominio y
   pedir salir del sandbox. Tarda uno o dos días.
2. En `radar/sst.config.ts`, quitar `allowAdminCreateUserOnly: true` y conectar
   SES como proveedor de correo del pool.
3. Añadir un disparador *post-confirmación* (Lambda) que meta a cada alta en el
   grupo `clientes` — **nunca en otro**. Es lo que impide que alguien se
   auto-asigne permisos al registrarse.
4. En la tienda, añadir «Crear cuenta» junto al formulario de
   `src/components/cuenta/inicio-sesion.tsx`, reutilizando el mismo cliente de
   Cognito.

**Esfuerzo:** 4–5 horas, más la espera de SES.

Contexto completo en [AUTENTICACION_PLAN.md](AUTENTICACION_PLAN.md).

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

Lo que **no** quedó cubierto y sigue pendiente:

- **El total del pedido lo calcula el navegador** y el servidor se lo cree. Da
  igual mientras el checkout sea una demostración; con cobro real hay que
  calcularlo en el servidor a partir del catálogo.
- **Nadie mueve el estatus de un pedido.** Nace en «Pendiente» y ahí se queda: no
  hay panel de pedidos ni guía de paquetería para los reales.

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
- **El atajo «Panel» de la cabecera no desaparece al cerrar sesión** hasta que se
  recarga: `src/components/comunes/acceso-panel.tsx` lee `localStorage` solo al
  montarse. Ya existe la forma de arreglarlo —`useSesion` avisa a todas sus
  copias desde el 2026-08-20—, es cambiarlo por el hook.

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

- **El envío estándar cuesta $ 149.00 en el carrito y $ 0.00 en el checkout.**
  `resumenCarrito` cobra 149 cuando no hay envío gratis, pero la opción
  «Estándar» de `OPCIONES_ENVIO` tiene precio 0 y el checkout rehace el total con
  ella. Un pedido de una pieza se anuncia a $ 149 más caro de lo que se cobra.
  Es anterior a este trabajo y no lo toqué porque hay que decidir cuál de las dos
  cifras es la buena.
- **El pedido no cambia de estatus** ni hay panel donde verlos (§5). Con el aviso
  por WhatsApp y el webhook eso duele menos, pero sigue ahí.

---

## Lo que NO hay que deshacer

Decisiones tomadas con motivo. Si alguien las revierte por descuido, rompe cosas
que costó descubrir:

- **`null` significa «no se preguntó»** y nunca cero. Poner valores por defecto en
  los ejes de evaluación fabrica datos y falsea el puntaje.
- **Las banderas rojas topan el score en 39**, no restan. Sin el tope, la suma
  ponderada cuela al verde a un proveedor que es un riesgo legal.
- **El selector «Cliente / Equipo» no es un permiso**, solo un destino. El permiso
  vive en el token y lo comprueba la API.
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
RADAR_PIN=xxxxxxxx npm --prefix radar run probar
RADAR_PIN=xxxxxxxx npm --prefix radar run probar-textract
npm --prefix radar run probar-tienda
```

Compilar no es funcionar. Los fallos más caros de esta construcción —el preflight
CORS, las fotos huérfanas en S3, los borrados que no viajaban, el precio de 2800
leído como 280— no los detectó ni el compilador ni las pruebas con curl: hicieron
falta el navegador real y mirar el bucket.

Cuando el PIN desaparezca (§2), estos scripts tendrán que pedir el token a
Cognito. El patrón es este:

```js
const r = await fetch(`https://cognito-idp.us-east-1.amazonaws.com/`, {
  method: "POST",
  headers: {
    "content-type": "application/x-amz-json-1.1",
    "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
  },
  body: JSON.stringify({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: "6b3sm0a4pucc821m59jhf2hob3",
    AuthParameters: { USERNAME: correo, PASSWORD: contrasena },
  }),
});
const { AuthenticationResult } = await r.json();
// AuthenticationResult.IdToken va en la cabecera Authorization: Bearer …
```
