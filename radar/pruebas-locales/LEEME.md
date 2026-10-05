# Pruebas locales de la API (sin AWS)

La Lambda (`radar/servidor/api.ts`) empaquetada con esbuild y corriendo contra
**DynamoDB, S3 y Cognito falsos, en memoria**. Nada de esto habla con AWS: las
credenciales son falsas a propósito y cada servicio falso escucha en un puerto
local que elige el sistema.

## Correr las pruebas

```powershell
npm --prefix radar run probar:local
```

Empaqueta (`empaquetar.mjs` → `.generado/`, que no se versiona) y corre cada
archivo en su propio proceso:

- `probar-admin.mjs` — el panel del catálogo (`/admin/catalogo`, imágenes,
  exportar, publicar) y la carga del CSV (`catalogo:subir`, `catalogo:publicado`)
  contra la misma tabla falsa.
- `probar-tienda.mjs` — pedidos (crear con idempotencia y transacción, camino
  antiguo, «Mis pedidos», detalle, cancelar, rastreo sin cuenta), solicitudes y
  todo `/admin` de la tienda (pedidos, ventas con cifras hechas a mano, clientes
  con Cognito), más las puertas (401 / 403) de cada ruta nueva.
- `probar-equipo.mjs` — «Equipo y cuentas»: el superadmin por correo
  verificado, las puertas de `/superadmin`, pedir entrar al equipo, aceptar,
  rechazar, invitar, grupos y cortar el acceso.

La CI (`.github/workflows/aws.yml`) lo corre antes de pedir credenciales a AWS.
Funciona igual en Windows y en Linux. Necesita las dependencias de las dos apps
(`npm ci` en la raíz, que trae esbuild y tsx, y en `radar/`).

Los servicios falsos (`servicios-falsos.mjs`) entienden **solo** las
expresiones que usa el código (Query con índice, `BETWEEN`, `begins_with`,
paginación, `BatchGetItem` que devuelve parte sin procesar, `TransactWriteItems`
con condiciones, `UpdateItem` con rutas anidadas, `if_not_exists`,
`list_append`…) y fallan en voz alta con cualquier otra: si un endpoint nuevo
usa algo que no está simulado, se nota aquí en vez de pasar en verde. Query
pagina cada 25 filas y BatchGet contesta 40 claves por vuelta, para que el
código que pagina y reintenta se ejercite con pocos datos.

## Mirar las pantallas en el navegador

```powershell
npm --prefix radar run servidor:local
```

Deja la API en `http://127.0.0.1:4700` (otro puerto: `$env:PUERTO=4701`) con el
catálogo del repositorio y una tienda de **PRUEBA** sembrada: 34 pedidos de los
últimos 40 días en los seis estatus (con y sin cuenta, con lotes y sets, con
guía y nota), un folio heredado sin META, 4 solicitudes de los tres tipos y 5
cuentas (admin, proveedores y tres clientes, una sin confirmar). Todo vive en
memoria: al cerrar se pierde y al abrir se siembra igual.

En otra terminal, el panel y/o la tienda apuntando a esa API:

```powershell
# Panel (http://localhost:3100/radar/)
$env:NEXT_PUBLIC_API = "http://127.0.0.1:4700"
npm --prefix radar run dev

# Tienda (http://localhost:3000). OJO: `npx next dev`, NO `npm run dev`:
# el predev reescribiría src/data/catalogo.json con NEXT_PUBLIC_API definida.
$env:NEXT_PUBLIC_API = "http://127.0.0.1:4700"
$env:NEXT_PUBLIC_COGNITO_CLIENTE = "cliente-falso"   # para que enseñe «Mi cuenta»
npx next dev
```

### Entrar como admin, proveedor o cliente

No hay Cognito de verdad, así que no se puede iniciar sesión con correo y
contraseña. Al arrancar, `servidor:local` imprime (y guarda en
`.generado/sesiones.json`) una línea por cuenta para pegar en la **consola del
navegador** de la app abierta; por ejemplo, la del admin:

```js
localStorage.setItem("radar:token","<token>");localStorage.setItem("radar:vence","<fecha>");localStorage.setItem("radar:evaluador","Admin de Prueba");location.reload()
```

El token tiene forma de JWT con `iss` de Cognito (así lo reconocen la tienda y
el panel) y una firma de mentira que solo acepta la API empaquetada para
pruebas (`jwt-falso.mjs`). La tienda y el panel corren en orígenes distintos
(3000 y 3100): hay que pegar la línea en cada uno. Para salir, el botón
«Salir» de la app o `localStorage.clear()`.

- **superadmin** (el correo del dueño, solo en memoria): todo, más «Equipo y
  cuentas» (`/radar/equipo/`) con una solicitud de Luis por aceptar.
- **admin** (`admin@prueba.local`, grupo `admins`): el panel de la tienda
  completo, sin «Equipo y cuentas».
- **otro** (`luis@prueba.local`, cliente): en `/radar` ve que ya pidió acceso.
- **proveedor** (`campo@prueba.local`): el radar de proveedores, sin `/admin`.
- **cliente** (`cliente@prueba.local`, Ana Martínez): «Mis pedidos» con 10
  pedidos y un folio heredado (`AUR-2025-01100`).
- Rastreo sin cuenta: cualquier folio sembrado con el teléfono de su pedido
  (se ve en el detalle del panel).

### Al terminar

- `next dev` dentro de `radar/` crea `radar/AGENTS.md` y `radar/CLAUDE.md`:
  bórralos.
- Si `src/data/catalogo.json` cambió: `git checkout -- src/data/catalogo.json`.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `correr.mjs` | `probar:local`: empaqueta y corre los `probar-*.mjs`. |
| `empaquetar.mjs` | esbuild: `api.mjs` (la Lambda) y `puras.mjs` (funciones puras del servidor y de `compartido/`). |
| `servicios-falsos.mjs` | DynamoDB, S3 y Cognito falsos, el `entorno` con sus URLs y `sembrarCatalogo`. |
| `jwt-falso.mjs` | Sustituye a `aws-jwt-verify`: un token es JSON en base64 con `falso: true`. |
| `datos-prueba.mjs` | Tokens, filas de pedido a mano y la tienda de muestra del servidor local. |
| `servidor-local.mjs` | `servidor:local`: la API en `127.0.0.1:4700`. |
| `probar-admin.mjs`, `probar-tienda.mjs`, `probar-equipo.mjs` | Las comprobaciones. |
