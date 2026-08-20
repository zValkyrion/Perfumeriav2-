# Cuentas y grupos

El pool es **`Elrey_usuarios`** (`us-east-1_qpU8tmkIB`) y tiene tres grupos:

| Grupo | Qué abre |
| --- | --- |
| `admins` | Todo, incluido gestionar usuarios |
| `proveedores` | El panel de proveedores |
| `clientes` | Solo la tienda |

**El grupo es el permiso.** La API comprueba `cognito:groups` en el token: sin
`proveedores` ni `admins`, las rutas del panel responden 403 aunque la sesión sea
válida. Nadie puede auto-asignarse un grupo — es lo que sostiene todo el esquema.

Por ahora **no hay autoservicio**: las cuentas las crea un administrador. Cuando
se abra el registro de clientes, el alta automática solo podrá caer en
`clientes`.

## Dar de alta a alguien del equipo

Dos comandos. El primero crea la cuenta con una contraseña temporal; el segundo
le da el permiso.

```bash
aws cognito-idp admin-create-user --user-pool-id us-east-1_qpU8tmkIB --username "persona@correo.com" --temporary-password "UnaTemporal2026" --user-attributes Name=email,Value=persona@correo.com Name=email_verified,Value=true Name=name,Value="Nombre Apellido"
```

```bash
aws cognito-idp admin-add-user-to-group --user-pool-id us-east-1_qpU8tmkIB --username "persona@correo.com" --group-name proveedores
```

El atributo `name` es el que firma las fichas, así que conviene poner el nombre
con el que esa persona se reconoce en el equipo.

`email_verified=true` se pone a mano porque hoy no hay envío de correos
configurado: sin él, Cognito esperaría una verificación que nunca llega.

### La primera vez que entran

La contraseña temporal **solo sirve para el primer inicio de sesión**. El panel
detecta que es una cuenta nueva y pide elegir una definitiva ahí mismo: al menos
10 caracteres, con minúsculas y números. Vale 14 días; pasados, hay que volver a
crearla.

> Manda la temporal por un canal distinto al del correo de la cuenta —un mensaje
> directo, en persona— y que la cambien al entrar.

## Quitar el acceso a alguien

```bash
aws cognito-idp admin-remove-user-from-group --user-pool-id us-east-1_qpU8tmkIB --username "persona@correo.com" --group-name proveedores
```

Sigue teniendo cuenta y puede entrar a la tienda, pero el panel le responderá
403. Para cerrarle todo:

```bash
aws cognito-idp admin-disable-user --user-pool-id us-east-1_qpU8tmkIB --username "persona@correo.com"
```

## Ver quién hay

```bash
aws cognito-idp list-users --user-pool-id us-east-1_qpU8tmkIB --query "Users[].{Correo:Username,Estado:UserStatus}" --output table
aws cognito-idp list-users-in-group --user-pool-id us-east-1_qpU8tmkIB --group-name proveedores --query "Users[].Username" --output table
```

## El código de equipo sigue vivo

El PIN compartido no se ha retirado: la pantalla de acceso lo ofrece detrás de
«Entrar con el código del equipo», y la API lo sigue aceptando. Está así a
propósito — cortarlo antes de que todos tengan cuenta dejaría a alguien fuera a
mitad de una gira.

**Para retirarlo**, cuando todo el equipo tenga su cuenta:

1. Quitar `FormaCodigo` y su enlace de `src/components/portada-acceso.tsx`.
2. Quitar `entrarConCodigo` y `conectar` de `src/lib/sesion.ts`.
3. Quitar `sesionPorPin` y la excepción de `puedeVerProveedores` en
   `servidor/identidad.ts`, y la ruta `POST /acceso` de `servidor/api.ts`.
4. Borrar el secreto: `npx sst secret remove Elrey_pin --stage produccion`.

El paso 3 es el que de verdad cierra la puerta; los demás solo dejan de
enseñarla.
