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

Lo que **no** quedó cubierto y sigue pendiente:

- **Las direcciones siguen siendo de muestra** (`src/data/cuenta.ts`). Se editan
  en memoria y se pierden al recargar. Es el mismo patrón que el carrito: otra
  `SK` bajo `USER#<sub>` y un par de rutas.
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

## 7. Menores

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
- **La fusión del carrito ocurre una sola vez** por cuenta y navegador, y por eso
  el estado guarda `sincronizado`. Fusionar en cada carga duplica las cantidades
  en cada recarga: 2 → 3 → 6 → 12.
- **El carrito se guarda bajo el `sub` de Cognito**, no bajo el correo: el correo
  se puede cambiar y dejaría el carrito anterior huérfano.

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
