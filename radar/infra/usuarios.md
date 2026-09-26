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

**Registro abierto.** Cualquiera se crea la cuenta en la tienda (`/cuenta` →
«Crear cuenta»), confirma su correo con un código y el disparador
`servidor/alta-cliente.ts` la mete en `clientes`, y en nada más. Todos inician
sesión en el mismo sitio; a quien está en `admins` o `proveedores` le aparece el
panel en la cabecera y en «Mi cuenta» en cuanto entra.

El correo del código lo manda Cognito con su dirección por defecto, con un tope
de **~50 correos al día**. Si el registro crece, hay que pasar a SES.

## Hacer admin a alguien que ya tiene cuenta

La forma normal: la persona se registra sola en la tienda y luego se le sube de
grupo. Tiene que cerrar sesión y volver a entrar (o esperar una hora) para que su
token traiga el grupo nuevo.

```bash
aws cognito-idp admin-add-user-to-group --user-pool-id us-east-1_qpU8tmkIB --username "persona@correo.com" --group-name admins
```

Para el equipo de campo, el grupo es `proveedores`.

## Dar de alta a alguien del equipo sin que se registre

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

`email_verified=true` se pone a mano porque la cuenta la crea un admin y no pasa
por el código de verificación: sin él, no podría recuperar su contraseña.

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
