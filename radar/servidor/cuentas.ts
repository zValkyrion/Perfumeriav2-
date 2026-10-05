import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import type { Grupo } from "../../compartido/tienda-admin";
import type { CuentaCognito } from "./ventas";

/**
 * Las cuentas de Cognito, vistas desde el panel.
 *
 * La Lambda ya tiene `cognito-idp:*` sobre el pool (el enlace `usuarios` de
 * `sst.config.ts`). Aquí se lee la lista y los grupos de cada cuenta, y —solo
 * desde «Equipo y cuentas», que es del superadmin— se invita, se mueve de
 * grupo y se corta o devuelve el acceso.
 */

export type ContextoCuentas = { cognito: CognitoIdentityProviderClient; pool: string };

/** Un `sub` de Cognito: un UUID. Se valida antes de meterlo en un filtro de ListUsers. */
export const esSub = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{1,128}$/.test(v);

function atributo(u: UserType, nombre: string): string {
  return u.Attributes?.find((a) => a.Name === nombre)?.Value ?? "";
}

async function gruposDe(ctx: ContextoCuentas, usuario: string): Promise<string[]> {
  const grupos: string[] = [];
  let siguiente: string | undefined;
  do {
    const r = await ctx.cognito.send(
      new AdminListGroupsForUserCommand({ UserPoolId: ctx.pool, Username: usuario, NextToken: siguiente }),
    );
    for (const g of r.Groups ?? []) if (g.GroupName) grupos.push(g.GroupName);
    siguiente = r.NextToken;
  } while (siguiente);
  return grupos.sort();
}

function cuentaDe(u: UserType, grupos: string[]): CuentaCognito {
  return {
    sub: atributo(u, "sub"),
    usuario: u.Username ?? "",
    nombre: atributo(u, "name"),
    correo: atributo(u, "email"),
    // Cognito lo guarda como +52XXXXXXXXXX; el resto del panel usa 10 dígitos.
    telefono: atributo(u, "phone_number").replace(/^\+52/, ""),
    grupos,
    registradoEn: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : null,
    estado: u.UserStatus ?? null,
    habilitada: u.Enabled !== false,
  };
}

/**
 * Corre `fn` sobre cada elemento con como mucho `n` a la vez.
 *
 * `AdminListGroupsForUser` es una llamada por cuenta y Cognito limita las
 * peticiones por segundo: soltarlas todas juntas con cientos de cuentas
 * acabaría en `TooManyRequestsException` y el panel sin lista.
 */
export async function enTandas<T, R>(lista: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = new Array(lista.length);
  let i = 0;
  const trabajador = async () => {
    while (i < lista.length) {
      const j = i++;
      salida[j] = await fn(lista[j]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, trabajador));
  return salida;
}

export async function listarCuentas(ctx: ContextoCuentas): Promise<CuentaCognito[]> {
  const usuarios: UserType[] = [];
  let siguiente: string | undefined;
  do {
    const r = await ctx.cognito.send(
      new ListUsersCommand({ UserPoolId: ctx.pool, Limit: 60, PaginationToken: siguiente }),
    );
    usuarios.push(...(r.Users ?? []));
    siguiente = r.PaginationToken;
  } while (siguiente);

  return enTandas(usuarios, 5, async (u) => cuentaDe(u, await gruposDe(ctx, u.Username ?? "")));
}

/** La cuenta con ese `sub`, o `null` si no existe (o se borró). */
export async function cuentaPorSub(ctx: ContextoCuentas, sub: string): Promise<CuentaCognito | null> {
  if (!esSub(sub)) return null;
  const r = await ctx.cognito.send(
    new ListUsersCommand({ UserPoolId: ctx.pool, Filter: `sub = "${sub}"`, Limit: 1 }),
  );
  const u = r.Users?.[0];
  if (!u?.Username) return null;
  return cuentaDe(u, await gruposDe(ctx, u.Username));
}

/** Agrega o quita a la cuenta de un grupo y devuelve los grupos con que queda. */
export async function moverDeGrupo(
  ctx: ContextoCuentas,
  usuario: string,
  grupo: Grupo,
  accion: "agregar" | "quitar",
): Promise<string[]> {
  const datos = { UserPoolId: ctx.pool, Username: usuario, GroupName: grupo };
  await ctx.cognito.send(
    accion === "agregar"
      ? new AdminAddUserToGroupCommand(datos)
      : new AdminRemoveUserFromGroupCommand(datos),
  );
  return gruposDe(ctx, usuario);
}

/**
 * Crea la cuenta de alguien del equipo. Cognito le manda por correo una
 * contraseña temporal (la plantilla en español está en `sst.config.ts`) que
 * vale 14 días; el panel le pide cambiarla al primer acceso.
 *
 * El correo se da por verificado: lo escribió el superadmin, que conoce a la
 * persona, y sin eso no podría recuperar la contraseña. Devuelve `null` si ya
 * existe una cuenta con ese correo.
 */
export async function crearCuenta(
  ctx: ContextoCuentas,
  correo: string,
  nombre: string,
): Promise<CuentaCognito | null> {
  try {
    const r = await ctx.cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: ctx.pool,
        Username: correo,
        DesiredDeliveryMediums: ["EMAIL"],
        UserAttributes: [
          { Name: "email", Value: correo },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: nombre },
        ],
      }),
    );
    if (!r.User) return null;
    return cuentaDe(r.User, []);
  } catch (e) {
    if ((e as { name?: string }).name === "UsernameExistsException") return null;
    throw e;
  }
}

/**
 * Corta o devuelve el acceso. Al cortarlo también se cierran sus sesiones: sin
 * eso, el token de refresco (90 días) seguiría dándole tokens nuevos. El token
 * que ya tiene en la mano vale hasta una hora más; no hay forma de anularlo
 * antes, y así se le explica al superadmin.
 */
export async function cambiarAcceso(ctx: ContextoCuentas, usuario: string, habilitada: boolean): Promise<void> {
  const datos = { UserPoolId: ctx.pool, Username: usuario };
  if (habilitada) {
    await ctx.cognito.send(new AdminEnableUserCommand(datos));
    return;
  }
  // Primero cerrar sesiones y luego deshabilitar: con la cuenta ya
  // deshabilitada, Cognito puede negarse a operar sobre ella.
  await ctx.cognito.send(new AdminUserGlobalSignOutCommand(datos));
  await ctx.cognito.send(new AdminDisableUserCommand(datos));
}
