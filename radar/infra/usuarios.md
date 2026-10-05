# Cuentas y grupos

El pool es **`Elrey_usuarios`** (`us-east-1_qpU8tmkIB`) y tiene tres grupos:

| Grupo | Qué abre |
| --- | --- |
| `admins` | El panel de la tienda: pedidos, ventas, clientes, solicitudes y catálogo |
| `proveedores` | El panel de proveedores |
| `clientes` | Solo la tienda |

Y por encima, **el superadmin** (`carlos.acosta12121998@gmail.com`): el único
que reparte permisos. No es un grupo: vive en `compartido/equipo.ts` y la API lo
reconoce por el correo verificado. El porqué, en `MEMORIA.md` §4.1.

**El grupo es el permiso.** La API comprueba `cognito:groups` en el token: sin
`proveedores` ni `admins`, las rutas del panel responden 403 aunque la sesión sea
válida. Nadie puede auto-asignarse un grupo — es lo que sostiene todo el esquema.

**Registro abierto.** Cualquiera se crea la cuenta en la tienda (`/cuenta` →
«Crear cuenta»), confirma su correo con un código y el disparador
`servidor/alta-cliente.ts` la mete en `clientes`, y en nada más. Todos inician
sesión en el mismo sitio; a quien está en `admins` o `proveedores` le aparece el
panel en la cabecera y en «Mi cuenta» en cuanto entra.

El correo del código (y el de las invitaciones) lo manda Cognito con su
dirección por defecto, con un tope de **~50 correos al día**. Si el registro
crece, hay que pasar a SES.

## Lo normal: desde «Equipo y cuentas»

Todo lo de esta página se hace desde el panel, con la cuenta del superadmin:
**Panel de la tienda → Equipo y cuentas** (`/radar/equipo/`).

- **Alguien del equipo que ya se registró en la tienda:** que abra `/radar`,
  vea «Tu cuenta todavía no abre el panel» y pulse **«Pedir acceso al
  equipo»**. Le aparece al superadmin en «Por aceptar»: **Aceptar en el
  equipo** (`proveedores`), **Como admin** o **Rechazar**.
- **Alguien sin cuenta:** **Invitar por correo** con su correo, su nombre real
  (es lo que firma cada ficha) y si entra como equipo o como administrador. Le
  llega una contraseña temporal de 14 días y el panel le pide cambiarla al
  primer acceso.
- **Cambiar de grupo:** abrir su fila en la lista y mover «Equipo de
  proveedores» o «Administrador».
- **Darle de baja:** «Puede entrar» → **No**. Se cierran sus sesiones y la
  cuenta queda deshabilitada; no se borra nada de lo que capturó o compró y se
  deshace con un toque.

Tras un cambio de grupo, la persona tiene que salir y volver a entrar (o
esperar una hora) para que su token traiga el grupo nuevo.

## Lo mismo por CLI, si el panel no está a mano

```bash
aws cognito-idp admin-add-user-to-group --user-pool-id us-east-1_qpU8tmkIB --username "persona@correo.com" --group-name proveedores
```

Crear la cuenta de alguien del equipo sin que se registre (Cognito le manda la
invitación con la contraseña temporal):

```bash
aws cognito-idp admin-create-user --user-pool-id us-east-1_qpU8tmkIB --username "persona@correo.com" --user-attributes Name=email,Value=persona@correo.com Name=email_verified,Value=true Name=name,Value="Nombre Apellido"
```

`email_verified=true` se pone a mano porque la cuenta la crea el superadmin y no
pasa por el código de verificación: sin él, no podría recuperar su contraseña.

Quitar el acceso del todo (primero cerrar sesiones, luego deshabilitar):

```bash
aws cognito-idp admin-user-global-sign-out --user-pool-id us-east-1_qpU8tmkIB --username "persona@correo.com"
```

```bash
aws cognito-idp admin-disable-user --user-pool-id us-east-1_qpU8tmkIB --username "persona@correo.com"
```

Ver quién hay:

```bash
aws cognito-idp list-users --user-pool-id us-east-1_qpU8tmkIB --query "Users[].{Correo:Username,Estado:UserStatus}" --output table
```

## La primera vez que entran

La contraseña temporal **solo sirve para el primer inicio de sesión**. El panel
detecta que es una cuenta nueva y pide elegir una definitiva ahí mismo: al menos
10 caracteres, con minúsculas y números. Vale 14 días; pasados, hay que volver a
invitar.

## El código de equipo ya no existe

El PIN compartido se retiró el 2026-10-05: la API ya no tiene `POST /acceso` y
la portada solo ofrece la cuenta.

Los secretos `Elrey_pin` y `Elrey_jwt_secreto` **se quedan** en SSM y
declarados en `sst.config.ts`, sin enlazar a ninguna función: producción va con
`protect` y Pulumi no deja borrarlos. **No uses `sst secret remove` con
ellos**: un secreto declarado sin valor hace fallar cada despliegue.
