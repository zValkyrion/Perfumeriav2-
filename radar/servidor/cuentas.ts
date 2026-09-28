import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
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
 * `sst.config.ts`). Aquí solo se lee la lista, los grupos de cada cuenta y se
 * mueve a alguien de grupo; crear o borrar cuentas sigue siendo cosa de
 * `infra/usuarios.md`.
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
