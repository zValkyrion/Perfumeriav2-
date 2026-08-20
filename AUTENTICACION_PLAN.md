# Plan de autenticación — Cognito con grupos

Un solo inicio de sesión para las dos caras del sitio: clientes de la tienda y
equipo del panel de proveedores. Los permisos se deciden por **grupo**, no por
banderas sueltas en el código.

> Estado del módulo de proveedores y su bitácora: [radar/MEMORIA.md](radar/MEMORIA.md).

---

## 1. De dónde partimos

Conviene decirlo sin adornos, porque el plan se apoya en ello:

| Pieza | Hoy |
| --- | --- |
| Panel de proveedores | PIN compartido → JWT firmado por nuestra Lambda. **Sin roles** |
| Tienda | **Sin autenticación**. `/cuenta` muestra un usuario ficticio y la propia página avisa que la sesión es simulada |
| Carrito y favoritos | `zustand` + `localStorage`. Viven en el navegador, no en el servidor |
| Atajo al panel | Heurística: la tienda mira si hay sesión del panel en `localStorage` |

Nada de eso es seguridad. La protección real hoy es que **la API rechaza toda
petición sin token firmado**, y eso se mantiene: lo que cambia es quién firma y
qué dice el token.

---

## 2. El diseño

### Un pool, tres grupos

Un solo **Cognito User Pool** (`Elrey_usuarios`) con tres grupos:

| Grupo | Quién | Qué puede |
| --- | --- | --- |
| `clientes` | Compradores de la tienda | Su cuenta, su carrito, sus pedidos |
| `proveedores` | Equipo de campo | Todo lo anterior + el panel de proveedores |
| `admins` | Tú y quien decidas | Todo + gestionar usuarios y grupos |

Un solo pool y no dos porque **son las mismas personas**: alguien del equipo
también compra, y con dos pools tendría dos contraseñas y dos identidades para el
mismo humano. El grupo es lo que separa, no la cuenta.

Los grupos son acumulativos por precedencia: `admins` implica todo lo de
`proveedores`, que implica todo lo de `clientes`.

### Dos formas de entrar al pool

- **Clientes: autoservicio.** Se registran solos con correo y contraseña. Un
  disparador *post-confirmación* los mete en `clientes` automáticamente — nunca
  en otro grupo, pase lo que pase.
- **Equipo: por invitación.** Los crea un admin y los asigna a `proveedores`.
  **No hay forma de auto-asignarse un grupo**: eso es lo que sostiene todo el
  esquema.

### Del grupo al permiso

El token de Cognito trae `cognito:groups`. Con eso:

1. **La API** (`radar/servidor/api.ts`) deja de validar nuestro JWT HS256 y pasa
   a validar el de Cognito contra su JWKS. Las rutas de proveedores exigen
   `proveedores` o `admins`; si el grupo no está, responde 403.
2. **La tienda** muestra el atajo al panel según el grupo real del token, no
   según la heurística de `localStorage` de hoy.
3. **La ficha** deja de firmarse con un nombre escrito a mano y pasa a llevar la
   identidad real (`sub` y correo). La trazabilidad deja de depender de que
   alguien escriba bien su nombre.

---

## 3. Lo que hay que cuidar

Cuatro cosas que suelen descubrirse tarde y caras:

**El correo.** Cognito manda correos de verificación por su cuenta, pero limitado
a ~50 al día y desde una dirección de Amazon. Para registro real de clientes hace
falta **SES verificado y fuera del sandbox**, que tarda un día o dos en
aprobarse. Si el registro de clientes va a abrirse, esto arranca primero porque
es lo único con tiempo de espera externo.

**Trabajar sin señal.** El equipo captura en la calle sin cobertura. Cognito
necesita red **solo para iniciar sesión**: después el token de refresco dura lo
que se configure. Con 90 días, una gira entera cabe en un solo inicio de sesión.
Es el mismo comportamiento que hoy tiene el PIN, así que no se pierde nada.

**El panel seguirá siendo público como URL.** Es un sitio estático: cualquiera
puede abrir `/radar/` y ver la pantalla de inicio de sesión. No hay nada que
proteger ahí — los datos viven detrás de la API. Esconder la propia URL exigiría
CloudFront Functions y no compensa.

**El carrito es otro proyecto.** Hoy vive en el navegador. Que «vea su carrito al
iniciar sesión» en cualquier dispositivo significa guardarlo en el servidor:
tabla nueva, endpoints nuevos y decidir qué pasa cuando alguien tenía cosas en el
carrito antes de identificarse (lo normal es fusionar). Va como fase aparte para
no mezclarlo con la autenticación.

---

## 4. Fases

| Fase | Entrega | Estimado |
| --- | --- | --- |
| **1** | Pool `Elrey_usuarios`, los tres grupos, disparador post-confirmación y las cuentas del equipo | 2–3 h |
| **2** | La API valida Cognito y exige grupo. El PIN sigue vivo en paralelo | 2–3 h |
| **3** | El panel entra con Cognito. Se retira el PIN | 2–3 h |
| **4** | Tienda: registro e inicio de sesión de clientes, sustituyendo el usuario ficticio de `/cuenta` | 4–5 h |
| **5** | Carrito, favoritos y pedidos por usuario en el servidor | 4–6 h |

Las fases 1–3 se pueden hacer **sin tocar la tienda**, y dejan al equipo con
identidades reales. La 4 y la 5 son la parte de clientes y pueden esperar.

**El PIN se retira solo al final de la fase 3**, con las cuentas del equipo ya
funcionando. Nadie se queda fuera a mitad de una gira.

---

## 5. Costo

Cognito es gratis hasta **50 000 usuarios activos al mes**. A la escala de esta
tienda es gratis y seguirá siéndolo por mucho tiempo. SES cuesta 0.10 USD por mil
correos.

---

## 6. Decisiones abiertas

1. **¿Se abre el registro de clientes ya, o primero solo el equipo?** Si se abre,
   hay que arrancar SES cuanto antes por el tiempo de aprobación.
2. **¿Pantallas propias o las de Cognito (Hosted UI)?** Las propias respetan el
   diseño de la tienda y no necesitan dominio; las de Cognito son gratis en
   trabajo pero se ven ajenas y con un dominio de Amazon en la barra.
3. **¿Google como opción de entrada para clientes?** Quita fricción en el
   registro y evita el problema del correo, pero suma configuración.
