# MEMORIA — Radar de Proveedores

**Este archivo es la fuente de verdad del módulo.** Todo lo que está construido,
por qué está así, y las reglas para trabajar aquí. Si algo cambia, se cambia
*aquí primero*.

---

## 0. Reglas para la IA

Quien trabaje en este módulo —persona o agente— sigue estas reglas:

1. **Lee este archivo antes de tocar nada.** Explica decisiones que no se
   deducen del código y que si se revierten por descuido rompen cosas.
2. **Toda modificación se registra en la §7 (Bitácora)**: qué cambió, *por qué*
   cambió y cuál es la nueva implementación. Sin el porqué, el registro no sirve
   — dentro de tres meses nadie recuerda contra qué problema se decidió.
3. **No inventes datos.** La regla central del modelo (§4) es que `null` significa
   "no se preguntó". Nunca poner valores por defecto en los ejes de evaluación,
   nunca rellenar un hueco con una suposición.
4. **Nada bloquea la captura.** La app se usa de pie, en la calle, en otro país y
   sin señal. Si una función nueva requiere red para poder capturar, está mal
   diseñada.
5. **Nombres en español**, igual que el resto del repositorio: archivos,
   variables, funciones y rutas.
6. **Prefijo `Elrey_` en todo recurso de AWS.** Única excepción documentada: los
   buckets de S3 (§2), por regla del propio servicio.
7. **Antes de escribir código de Next.js**, lee las guías en
   `node_modules/next/dist/docs/` — esta versión tiene cambios de ruptura
   respecto a lo que la mayoría de los modelos tienen memorizado.
8. **Verifica antes de dar algo por hecho.** Compilar no es funcionar: probar la
   ruta real, con datos reales, y decir qué se probó y qué no.
9. **El secreto no se escribe nunca en el repositorio.** PIN y clave de firma
   viven en SSM vía `sst secret`.

---

## 1. Qué es

App de campo para evaluar proveedores de perfumería durante una gira comercial
en otro país. Captura en la calle, funciona sin señal, sincroniza a AWS cuando
hay red, analiza y compara proveedores.

Es **independiente** de la landing de EL REY DE LOS PERFUMES: su propio
`package.json`, su propio despliegue. La landing sigue exportándose estática a
GitHub Pages y no se entera de que esto existe.

---

## 2. Infraestructura en AWS

Región **us-east-1**. Cuenta **637423567003**. Etapa: `produccion`.

| | |
| --- | --- |
| **Tienda** | https://devfq5kjop78h.cloudfront.net/ |
| **Panel** | https://devfq5kjop78h.cloudfront.net/radar/ |
| **API** | https://qdn0ihicj6.execute-api.us-east-1.amazonaws.com |

| Recurso | Nombre real | Para qué |
| --- | --- | --- |
| DynamoDB | `Elrey_proveedores` | Fichas y metadatos de fotos, tabla única |
| S3 (fotos) | `elrey-radar-produccion-elreyfotosbucket-mmokknwk` | Las fotos, subidas directo desde el teléfono |
| S3 (sitio) | `elrey-radar-produccion-elreyradarassetsbucket-*` | El SPA estático |
| Lambda | `Elrey_api_produccion` | La API entera, una sola función |
| API Gateway | `Elrey_api` | HTTP API v2 |
| CloudFront | distribución de `Elrey_radar` | Sirve el sitio |
| SSM | `Elrey_pin`, `Elrey_jwt_secreto` | Secretos (vía `sst secret`) |
| Cognito | `Elrey_usuarios` (`us-east-1_qpU8tmkIB`) | Identidad y grupos |

### La excepción a `Elrey_`

**S3 no admite mayúsculas ni guiones bajos en el nombre de un bucket**, y exige
unicidad global. `Elrey_fotos` es un nombre inválido: el despliegue lo rechaza.
Los buckets llevan el nombre que SST genera a partir del identificador, en
minúsculas. El *identificador* dentro de `sst.config.ts` sí es `Elrey_fotos`, así
que en el código se sigue leyendo con la convención:
`Resource.Elrey_fotos.name`.

### Lo que deliberadamente NO hay

Ni VPC, ni RDS, ni NAT Gateway. Un NAT Gateway cuesta ~32 USD/mes fijos y no
aportaría nada a este volumen de datos. Es la trampa clásica de "lo hago bien en
AWS" y aquí se evitó a propósito.

### Costo

CloudFront (1 TB/mes), Lambda (1M peticiones) y DynamoDB (25 GB) tienen capa
gratuita **perpetua**. S3 con unos GB de fotos ronda 0.10 USD/mes.
**Estimado: menos de 1–2 USD al mes.**

---

## 3. La API

Una sola Lambda (`servidor/api.ts`) que enruta por su cuenta desde la ruta
`$default` de API Gateway.

> **Por qué una sola.** La primera versión declaraba las siete rutas por separado
> y SST creaba una Lambda por ruta: las siete peleaban por el mismo nombre y el
> mismo grupo de logs, y el despliegue falló. Además, a este volumen, repartirlas
> solo multiplica arranques en frío sin ganar nada.

| Ruta | Qué hace |
| --- | --- |
| `GET /salud` | Diagnóstico. Sin token |
| `POST /acceso` | PIN + nombre → JWT de 90 días. Sin token |
| `GET /proveedores` | Todas las fichas, por fecha |
| `PUT /proveedores/{id}` | Guarda una ficha |
| `DELETE /proveedores/{id}` | Borra ficha y sus fotos |
| `POST /fotos` | URL prefirmada para subir a S3 |
| `GET /fotos?proveedorId=` | URLs firmadas de lectura |

**Autenticación:** PIN de equipo → JWT HS256 firmado con `node:crypto` (sin
librerías: son treinta líneas y una dependencia menos en el arranque en frío).
El nombre de quien captura viaja dentro del token, así cada ficha queda firmada.

**Las fotos no pasan por la Lambda.** Suben directo a S3 con URL prefirmada:
con roaming, mandar la imagen por API Gateway es pagar dos veces la misma
transferencia y arriesgarse al límite de 6 MB de payload.

---

## 4. Modelo de datos

### DynamoDB, tabla única

```
PK                SK              Contenido
PROV#<id>         META            la ficha completa + GSI1PK/GSI1SK
PROV#<id>         FOTO#<fotoId>   clave en S3, tipo, lat/lng

GSI "porFecha":   GSI1PK = "PROVEEDORES"   GSI1SK = "<actualizadoEn>#<id>"
```

### La regla del dato ausente

**`null` significa "no se preguntó", y no es lo mismo que un valor malo.**

La primera versión daba valores por defecto a todos los ejes
(`permisos_sanitarios: false`, `anios_operando: 3`) y el score los sumaba como si
fueran observaciones: un proveedor del que solo se tomó una foto salía con 44
puntos inventados y aparecía como "no tiene permisos" cuando nadie se lo había
preguntado.

Consecuencia en `lib/analisis.ts`: solo se puntúa lo respondido, el peso se
reparte entre lo que sí se sabe, y cada puntaje viaja con su **cobertura**. Un 75
sostenido por dos respuestas y un 75 con la ficha entera no son el mismo 75.

### Criterios y pesos

| Criterio | Peso |
| --- | --- |
| Calidad | 28 |
| Precio | 22 |
| Confiabilidad | 15 |
| Versatilidad | 12 |
| Capacidad | 10 |
| Comercial | 8 |
| Trato | 5 |

**Las banderas rojas no restan, topan.** Falsificaciones o precios
inconsistentes fijan el score en 39 como máximo: sin el tope, la suma ponderada
colaría al verde a un proveedor que es un riesgo legal.

### Vocabularios controlados

Cargo, país, origen de la esencia, días y horas del horario, lada y tipo de
promoción son selección, no texto libre — "Dueño", "dueño" y "propietario" son
tres valores para la base de datos y el mismo para una persona.

**Siempre hay "Otro" con texto libre y dejarlo vacío sigue siendo válido.**
Forzar una opción en la calle produce datos peores que un hueco honesto: quien no
encuentra la suya elige la más parecida y ese error ya no se detecta nunca.

Siguen libres a propósito: nombre, razón social, contacto, correo, redes,
dirección, ciudad y notas.

---

## 4.1 Identidad y permisos

Un solo pool de Cognito para clientes y equipo: **son las mismas personas** —
quien captura proveedores también compra— y con dos pools tendría dos
contraseñas para el mismo humano. Lo que separa es el grupo, no la cuenta.

| Grupo | Precedencia | Qué abre |
| --- | --- | --- |
| `admins` | 1 | Todo |
| `proveedores` | 2 | El panel |
| `clientes` | 3 | Solo la tienda |

**El grupo es el permiso.** La API verifica el ID token contra las claves
públicas de Cognito y comprueba `cognito:groups`: sin `proveedores` ni `admins`
responde 403 aunque la sesión sea válida. Nadie puede auto-asignarse un grupo.

Se verifica el **ID token** y no el de acceso porque solo aquel trae el correo,
y sin correo la ficha quedaría firmada por un identificador que no le dice nada
a nadie — la trazabilidad es justo lo que se ganaba al salir del PIN compartido.

Sin autoservicio por ahora: las cuentas las crea un admin. Alta, baja y retirada
del PIN, en [`infra/usuarios.md`](infra/usuarios.md).

**Sin señal se sigue entrando** si ya se entró antes: el token de identidad dura
una hora y el de refresco 90 días, así que una gira entera cabe en un solo
inicio de sesión. Solo la primera vez hace falta red.

---
## 5. Sincronización

El teléfono es la fuente de verdad mientras el equipo está en la calle.

- Se sube **ficha por ficha**, marcando cada una en cuanto el servidor responde:
  si la señal se cae en la séptima, las seis anteriores ya están a salvo.
- **Un fallo no detiene la fila**: se acumulan los errores y se reportan al final.
- **Las fotos van después de su ficha**, y se marcan como subidas solo cuando S3
  confirma. Si se corta antes, la próxima vuelta reintenta.
- `descargar()` trae del servidor lo que falta en este teléfono (equipo nuevo o
  dispositivo perdido). Gana la versión con `actualizadoEn` más reciente. Las
  fotos no bajan: viven en S3.

### Quién ve qué

**No hay roles: todos ven lo de todos.** El servidor nunca filtró por evaluador;
`GET /proveedores` devuelve todas las fichas a cualquier token válido. Cada ficha
conserva quién la capturó (`evaluador`) y quién la subió (`subidoPor`), que es
trazabilidad, no permisos.

La sincronización ocurre sola en dos momentos: al pulsar **«Listo»** en una ficha
y al **abrir la app**. El botón «Sincronizar» sigue ahí para forzarla a mano.

### Acceso sin señal

Si al entrar no hay red, se permite trabajar igual y la app queda en **modo solo
local**: captura sí, subir no. Se pide el código otra vez desde la barra de
sincronización cuando haya red. Bloquear la captura por falta de señal sería
inaceptable en la calle, que es donde esto se usa.

---

## 6. Operación

```bash
# Desarrollo local
npm --prefix radar run dev              # http://localhost:3100

# Desplegar a producción
cd radar && npx sst deploy --stage produccion

# Cambiar el PIN del equipo
cd radar && npx sst secret set Elrey_pin <nuevo> --stage produccion
cd radar && npx sst deploy --stage produccion   # hace falta redesplegar

# Ver logs de la API
aws logs tail /aws/lambda/Elrey_api_produccion --follow

# Si un despliegue quedó a medias
cd radar && npx sst unlock --stage produccion
```

> En Git Bash sobre Windows, los comandos de `aws logs` con rutas que empiezan
> por `/` necesitan `MSYS_NO_PATHCONV=1` delante: si no, la shell convierte
> `/aws/lambda/...` en una ruta de Windows y AWS rechaza el parámetro.

---

## 6.1 Pruebas

```bash
npm --prefix radar run probar     # 22 comprobaciones contra producción
```

Recorre cada ruta con datos reales —incluida la subida de una foto a S3— y
verifica también los rechazos: PIN equivocado, token inventado, ruta inexistente.
Crea una ficha de prueba y la borra al terminar, así que se puede correr contra
producción sin dejar basura.

**Se corre después de cada despliegue.** Dos de los fallos más caros de esta
construcción no los detectó ni el compilador ni curl (§7): hicieron falta el
navegador real y la verificación en el bucket.

## 6.2 Despliegue automático

Cada push a `main` que toque `radar/` despliega y corre las pruebas, vía GitHub
Actions con OIDC — sin llaves guardadas en GitHub. Detalles y los dos comandos
pendientes de IAM: [`infra/README.md`](infra/README.md).

La tienda y el radar viven en el mismo repositorio pero se publican en sitios
distintos, así que cada workflow filtra por rutas: un cambio en `radar/` ya no
reconstruye ni republica la tienda, y uno en la tienda no toca el radar. Un push
que mezcle ambos despliega los dos.

El rol `Elrey_despliegue_github` solo puede asumirse desde
`repo:zValkyrion/Perfumeriav2-:ref:refs/heads/main`. Quien pueda hacer push a
`main` puede tocar la cuenta de AWS: proteger esa rama es parte de la seguridad
del módulo.

## 7. Bitácora de cambios

Formato: **fecha · qué cambió · por qué · nueva implementación.**

### 2026-08-19 · Inicio de sesión en la tienda, con selector de destino

- **Por qué:** la tienda no tenía autenticación y su pantalla de cuenta mostraba
  un usuario ficticio. Hacía falta entrar desde ahí, y que el equipo pudiera
  saltar al panel sin cambiar de sitio.
- **Implementación:** pantalla propia en /cuenta con un selector discreto
  «Cliente / Equipo», en Cliente por defecto. Tras entrar, si eligió Equipo y su
  token trae el grupo, va al panel.
- **El selector no es un permiso**, solo dice a dónde ir después. Quien lo elige
  sin tener el grupo entra como cliente y recibe una explicación: el permiso vive
  en el token que firma Cognito y lo comprueba la API.
- **Dos fallos que solo aparecieron probando:** el aviso de «no tienes acceso» se
  perdía porque la pantalla de login desaparece en cuanto hay sesión; viaja ahora
  por sessionStorage. Y leerlo en un efecto de montaje no servía —esa vista ya
  estaba montada mostrando el formulario—, así que el efecto depende del perfil.
- El atajo del encabezado dejó de bastarle con «hay sesión» y ahora exige el
  grupo: un cliente inicia sesión igual y no debe ver la puerta del panel.

### 2026-08-19 · Identidad real con Cognito y grupos

- **Por qué:** el panel entraba con un PIN compartido: sin identidad, sin roles
  y sin forma de revocar a una sola persona. La ficha se firmaba con un nombre
  tecleado a mano, que nadie garantizaba que fuera el suyo.
- **Implementación:** pool `Elrey_usuarios` con los grupos `admins`,
  `proveedores` y `clientes`. La API valida el ID token contra Cognito y exige
  grupo; el panel entra con correo y contraseña desde pantallas propias, sin
  SDK — la API de Cognito es JSON sobre HTTPS y meter el SDK de AWS en el
  navegador costaría cientos de kilobytes que el equipo paga en roaming.
- **Verificado en producción:** una cuenta en `proveedores` entra y su ficha
  queda firmada con su identidad; una en `clientes` inicia sesión igual pero
  recibe 403 del panel. También el reto de contraseña temporal en el primer
  acceso.
- **El PIN sigue vivo a propósito.** Cortarlo antes de que todos tengan cuenta
  dejaría a alguien fuera a mitad de una gira. Los cuatro pasos para retirarlo
  están en `infra/usuarios.md`.
### 2026-08-19 · Un solo origen: tienda en / y panel en /radar

- **Por qué:** el panel vivía en un dominio de CloudFront distinto al de la
  tienda. Con un solo origen, el día que haya dominio se conecta en un único
  lugar y las dos quedan bajo él.
- **Implementación:** `scripts/construir-sitio.mjs` compila las dos
  exportaciones estáticas y las ensambla en un directorio; una sola
  distribución las sirve.
- **La trampa del basePath:** el de la tienda dependía de detectar
  `GITHUB_ACTIONS`, que también se activa en el workflow de CloudFront — allí
  habría dejado el sitio colgando de `/Perfumeriav2-`. Ahora se activa con
  `PAGES=1`, que solo pone el workflow de Pages.
- **El canonical de la tienda NO se movió:** sigue apuntando a GitHub Pages,
  que es la URL indexada. Cambiarlo ahora obligaría a mudar de URL dos veces —
  una a CloudFront y otra al dominio propio— y cada mudanza reinicia el SEO.
- **`basePath` no alcanza para el panel:** Next reescribe los enlaces de `Link`
  y `router`, pero el manifest, los iconos y el service worker llevan rutas
  propias y van a mano.
- **Migración del service worker:** el registro viejo tenía ámbito `/`, que
  ahora es la tienda. Al abrir el panel se da de baja y se borran sus cachés,
  para que un worker de la app de campo no intercepte la tienda. Las fichas no
  se tocan: viven en IndexedDB.

### 2026-08-19 · Saltar entre tienda y panel

- **Por qué:** hacía falta que quien trabaja en el panel pudiera entrar desde
  la tienda, y volver sin cerrar sesión.
- **Implementación:** al compartir origen comparten `localStorage`, así que la
  tienda mira si hay sesión del panel (`radar:token`) y solo entonces pinta el
  atajo en la cabecera. Un cliente de la tienda no ve nada.
- **No es control de acceso, y no pretende serlo.** Cualquiera puede escribir su
  propio `localStorage` y hacer aparecer el botón; no ganaría nada, porque el
  panel sigue pidiendo el código del equipo y la API rechaza toda petición sin
  token firmado. Ahí solo se decide si se pinta un enlace.
- En GitHub Pages el atajo nunca aparece: es otro origen y esa sesión no existe.

### 2026-08-19 · Los dos despliegues dejan de pisarse

- **Por qué:** cualquier push disparaba los dos workflows. Tocar la app de campo
  reconstruía y republicaba la tienda sin que hubiera cambiado nada suyo:
  republicar producción por trabajo ajeno, sin beneficio.
- **Implementación:** `paths-ignore` en el workflow de Pages y `paths` en el del
  radar. El filtro solo salta la ejecución cuando *todos* los archivos del push
  están en la lista, así que un cambio mezclado sigue desplegando ambos.

### 2026-08-19 · Los borrados no viajaban entre teléfonos

- **Por qué:** `descargar()` solo añadía y actualizaba, nunca quitaba. Quien
  borraba una ficha la veía desaparecer de su teléfono, pero seguía viva para
  siempre en los de sus compañeros: cada uno acababa mirando una lista distinta,
  lo contrario de "todos ven lo de todos". Se detectó al verificar otra cosa —
  una pestaña seguía pidiendo una ficha ya borrada del servidor.
- **Implementación:** `propagarBorrados()` elimina lo local que ya no está en el
  servidor, **solo si está marcado `sincronizado`**. Una ficha en borrador o
  pendiente nunca llegó a subir: borrarla destruiría el trabajo de la mañana.

### 2026-08-19 · La lista se refresca siempre

- **Por qué:** el refresco estaba condicionado a que "algo hubiera cambiado", y
  la lista de condiciones se quedó corta dos veces seguidas: primero con las
  descargas, luego con los borrados. El resultado era el mismo las dos veces —
  los datos correctos en IndexedDB y la pantalla mostrando otra cosa.
- **Implementación:** tras cada sincronización se relee de IndexedDB pase lo que
  pase. Releer es barato; enumerar todos los casos posibles, no.

### 2026-08-19 · El PIN salió también del repositorio

- **Por qué:** `scripts/probar-api.mjs` lo llevaba como valor por defecto. Es el
  mismo error que ya se había corregido en el cliente: sacamos el PIN del
  JavaScript de la app para que no lo leyera cualquiera, y dejarlo en un script
  versionado lo devolvía al mismo sitio.
- **Implementación:** se lee de `RADAR_PIN` y el script aborta si falta. En CI
  llega desde un secreto de GitHub.

### 2026-08-19 · Sube al dar «Listo» y baja al abrir

- **Por qué:** dos perfiles distintos no se veían entre sí. No era el servidor
  —`GET /proveedores` siempre devolvió todo a todos— sino el cliente: la app solo
  mostraba lo que había en su IndexedDB y únicamente traía lo remoto si alguien se
  acordaba de pulsar «Sincronizar». Mientras no haya roles, todos ven lo de todos,
  y eso tiene que pasar solo.
- **Implementación:** `sincronizarDeFondo()` se dispara al cerrar una ficha con
  «Listo» (sin esperar: con señal mala, subir tres fotos puede tardar un minuto y
  bloquear al capturista sería peor que el problema que resuelve), y `BarraSync`
  sincroniza y descarga una vez al montar.

### 2026-08-19 · La descarga automática llegaba pero no se veía

- **Por qué:** `alTerminar` llega como función nueva en cada render del padre; el
  efecto dependía de ella, se limpiaba a media sincronización y descartaba el
  resultado. Las fichas **sí** bajaban a IndexedDB, pero la lista seguía diciendo
  "Todavía no hay proveedores" — exactamente el síntoma reportado.
- **Implementación:** la función se guarda en una ref y el efecto depende solo del
  token.

### 2026-08-19 · 403 en cada prefetch de navegación (bug de compilar en Windows)

- **Por qué:** compilando en Windows, la exportación estática escribe el payload
  de cada ruta dentro de una carpeta (`captura/__next.captura/__PAGE__.txt`)
  mientras el cliente lo pide con puntos
  (`captura/__next.captura.__PAGE__.txt`). Esa clave no existía en S3: CloudFront
  devolvía 403 y la navegación caía a recarga completa.
- **Descubrimiento posterior:** en Linux no pasa. El primer despliegue por CI
  informó `payloads duplicados: 0` y en S3 apareció el archivo con puntos generado
  de forma nativa. **Era un problema de la máquina que compilaba, no del código.**
- **Implementación:** `scripts/arreglar-rsc.mjs` duplica los payloads al final de
  `npm run build`. En Linux no encuentra nada y no hace nada, así que es seguro
  dejarlo — pero la conclusión real es **desplegar desde la CI**, no desde una
  laptop con Windows.

### 2026-08-19 · El preflight CORS moría en la ruta `$default`

- **Por qué:** API Gateway responde el preflight por su cuenta *salvo* cuando
  existe una ruta `$default`: entonces el `OPTIONS` también cae en ella, llegaba
  a la Lambda y salía como 404 sin cabeceras. El navegador bloqueaba **todas** las
  peticiones desde el sitio. Las pruebas con curl pasaban porque curl no hace
  preflight; solo apareció al probar en el navegador real.
- **Implementación:** `servidor/api.ts` contesta `OPTIONS` con 204 antes de
  cualquier otra cosa y añade las cabeceras CORS a todas las respuestas.

### 2026-08-19 · Las fotos quedaban huérfanas en S3

- **Por qué:** `DELETE /proveedores/{id}` borraba los registros de DynamoDB pero
  no los objetos de S3. Nadie sabría que están ahí y seguirían costando dinero
  para siempre. Se detectó listando el bucket después de la prueba de borrado.
- **Implementación:** `borrar()` hace `DeleteObjectsCommand` con las claves antes
  de limpiar DynamoDB, y devuelve `fotosBorradas` para poder comprobarlo.

### 2026-08-19 · La barra de sincronización se ocultaba sin pendientes

- **Por qué:** sincronizar también sirve para *traer* fichas, y un teléfono nuevo
  —o el de alguien que perdió el suyo— empieza con cero pendientes. La barra se
  escondía justo en el caso donde más falta hacía: la recuperación no tenía
  ninguna puerta de entrada.
- **Implementación:** la barra queda visible siempre que haya token.

### 2026-08-19 · Backend en AWS (Fase 1 y 2)

- **Por qué:** todo vivía en el teléfono; si se perdía el dispositivo, se perdía
  la gira.
- **Implementación:** SST v3 con DynamoDB `Elrey_proveedores`, S3, Lambda
  `Elrey_api_produccion`, API Gateway HTTP y CloudFront. Cliente en `lib/api.ts`
  y `lib/sync.ts`.

### 2026-08-19 · El PIN sale del cliente

- **Por qué:** estaba escrito en `lib/sesion.ts` y, siendo un SPA estático,
  cualquiera que abriera la URL podía leerlo en el JavaScript.
- **Implementación:** vive en SSM (`Elrey_pin`), lo valida la Lambda y devuelve
  un JWT de 90 días. Comparación en tiempo constante para no filtrar el PIN byte
  a byte.

### 2026-08-19 · Una Lambda en vez de siete

- **Por qué:** declarar cada ruta por separado creaba una función por ruta;
  todas colisionaban en el mismo nombre y grupo de logs, y el despliegue falló.
- **Implementación:** ruta `$default` y enrutado interno en `servidor/api.ts`.

### 2026-08-19 · Promociones por volumen

- **Por qué:** la escalera de descuento es lo que decide una compra de mayoreo y
  vivía en las notas, donde no se puede calcular nada con ella.
- **Implementación:** tipo `Promocion` estructurado y `precioConPromocion()`, que
  baja cada promoción a precio por pieza. Un frasco a 45 con 3x2 sale a 30 —
  más barato que otro a 38 sin promoción.

### 2026-08-19 · Vocabularios controlados

- **Por qué:** gobernanza de datos; el texto libre en cargo, país, horario y
  origen de esencia hacía imposible agrupar y filtrar.
- **Implementación:** `SelectorAbierto` (chips + "Otro" con texto libre) y
  `SelectorHorario` (días + horas + nota). El horario pasó de `string` a objeto;
  `normalizar()` migra lo viejo a la nota para no perderlo.

### 2026-08-19 · `null` = "no se preguntó"

- **Por qué:** los valores por defecto fabricaban datos y el score los sumaba
  como observaciones reales.
- **Implementación:** todos los ejes nacen en `null`; `analisis.ts` puntúa solo
  lo respondido y reporta cobertura. Controles `Ternario` (Sí/No/—) y deslizador
  con estado "sin preguntar".

### 2026-08-19 · Mapa con punto manual

- **Por qué:** el GPS del navegador miente cuando no hay GPS real: sale de la IP
  o del wifi y cae a kilómetros.
- **Implementación:** Leaflet con pin arrastrable; el punto manual guarda
  `origenUbicacion: "manual"` y borra la precisión anterior. Mover el punto
  **siempre** reescribe la dirección (decisión explícita del usuario).

### 2026-08-19 · Offline de verdad

- **Por qué:** la app prometía funcionar sin señal pero solo los datos eran
  offline; la página no abría sin red.
- **Implementación:** service worker en `public/sw.js` + manifest. Abre sin señal
  después de la primera visita con red.

---

## 8. Pendientes conocidos

- **La copia JSON no incluye las fotos** (son Blobs, no sobreviven a
  `JSON.stringify`). Están en el teléfono y en S3.
- **PIN compartido**: no se puede revocar a una sola persona sin cambiárselo a
  todos. Para una gira corta es un intercambio aceptable; si esto sobrevive al
  viaje, migrar a Cognito.
- **Cámara y GPS exigen HTTPS**: funcionan en la URL de CloudFront, no por IP
  local.
- **Textract sobre la foto de la lista de precios** es el extra con más retorno
  pendiente: fotografiar la hoja en vez de teclear 20 precios.
- **Panel admin** (ranking global, mapa con todos los pines, export CSV) sigue
  sin construirse.
