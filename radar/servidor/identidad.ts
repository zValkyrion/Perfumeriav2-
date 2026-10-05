import { Resource } from "sst";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { esCorreoSuperadmin } from "../../compartido/equipo";

/**
 * Quién está llamando a la API y qué puede hacer.
 *
 * Solo hay una forma de identificarse: una cuenta de Cognito. El PIN
 * compartido del equipo se retiró el 2026-10-05 (ver la bitácora de
 * MEMORIA.md): no identificaba a nadie y no se podía revocar a una sola
 * persona. Ahora cada quien entra con su cuenta y el superadmin le da o le
 * quita el acceso desde «Equipo y cuentas».
 */

/**
 * Se verifica el **ID token**, no el de acceso.
 *
 * Ambos traen `cognito:groups`, pero solo el de identidad trae el correo, y sin
 * correo la ficha quedaría firmada por un identificador que no le dice nada a
 * nadie. El correo, además, es lo que reconoce al superadmin.
 */
const verificador = CognitoJwtVerifier.create({
  userPoolId: Resource.Elrey_usuarios.id,
  tokenUse: "id",
  clientId: Resource.Elrey_web.id,
});

export type Identidad = {
  /** Nombre legible para firmar las fichas. */
  evaluador: string;
  /** Grupos de Cognito. */
  grupos: string[];
  /**
   * El identificador estable de Cognito.
   *
   * Es la clave de partición del carrito y los pedidos, y por eso se usa el
   * `sub` y no el correo: el correo se puede cambiar desde la cuenta y arrastraría
   * el carrito a otra partición, dejando el anterior huérfano. El `sub` no cambia
   * nunca.
   */
  sub: string;
  /**
   * El correo de la cuenta, si el token lo trae. Se guarda en el pedido para
   * que el panel sepa con qué cuenta se compró aunque el cliente haya escrito
   * otro correo de contacto.
   */
  correo: string | null;
  /** `email_verified` del token: sin él, el correo no prueba nada. */
  correoVerificado: boolean;
};

export async function identificar(
  cabecera: string | undefined,
): Promise<Identidad | null> {
  if (!cabecera?.startsWith("Bearer ")) return null;
  const token = cabecera.slice(7);
  try {
    const carga = await verificador.verify(token);
    const grupos = (carga["cognito:groups"] as string[] | undefined) ?? [];
    const nombre =
      (carga.name as string | undefined) ??
      (carga.email as string | undefined) ??
      carga.sub;
    const correo = typeof carga.email === "string" ? carga.email : null;
    // Cognito lo manda como booleano; algunos flujos viejos, como texto.
    const crudo: unknown = carga.email_verified;
    const verificado = crudo === true || crudo === "true";
    return { evaluador: nombre, grupos, sub: carga.sub, correo, correoVerificado: verificado };
  } catch {
    // Inventado, vencido o de otro pool: no hay sesión.
    return null;
  }
}

/**
 * ¿Es superadmin? Lo decide el correo verificado contra `SUPERADMINS`
 * (`compartido/equipo.ts`), no un grupo: el permiso de dar permisos no se
 * puede dar ni quitar desde el panel.
 */
export function esSuperadmin(identidad: Identidad): boolean {
  return identidad.correoVerificado && esCorreoSuperadmin(identidad.correo);
}

/**
 * ¿Puede editar el catálogo y ver la tienda por dentro?
 *
 * El grupo `admins`, y el superadmin siempre: si alguien le quitara el grupo,
 * no debe poder quedarse fuera de su propio panel.
 */
export function esAdmin(identidad: Identidad): boolean {
  return identidad.grupos.includes("admins") || esSuperadmin(identidad);
}

/** ¿Puede entrar al panel de proveedores? */
export function puedeVerProveedores(identidad: Identidad): boolean {
  return identidad.grupos.includes("proveedores") || esAdmin(identidad);
}
