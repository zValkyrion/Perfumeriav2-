import type { CorreoSuperadmin } from "../../../compartido/equipo";

/**
 * Copia de `SUPERADMINS` (`compartido/equipo.ts`) para el panel, que solo
 * puede importar tipos de `compartido/`. Solo decide qué se pinta —el enlace a
 * «Equipo y cuentas»—: quien de verdad lo comprueba es la Lambda, con el correo
 * verificado del token.
 *
 * Atada al original en los dos sentidos: `satisfies` impide meter aquí un
 * correo que allá no esté, y `_completa` falla si allá hay uno que aquí falta.
 */
const SUPERADMINS = ["carlos.acosta12121998@gmail.com"] as const satisfies readonly CorreoSuperadmin[];

type Faltan = Exclude<CorreoSuperadmin, (typeof SUPERADMINS)[number]>;
const _completa: [Faltan] extends [never] ? true : never = true;
void _completa;

export function esCorreoSuperadmin(correo: string | null | undefined): boolean {
  if (!correo) return false;
  return (SUPERADMINS as readonly string[]).includes(correo.trim().toLowerCase());
}
