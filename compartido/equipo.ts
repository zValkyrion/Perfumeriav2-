/**
 * El contrato del panel «Equipo y cuentas»: quién es superadmin, las
 * solicitudes para entrar al equipo y las cuentas tal como las ve el
 * superadmin. Lo comparten la Lambda (`/superadmin/*`, `/equipo/solicitud`) y
 * el panel.
 */

/**
 * Los superadministradores, por correo.
 *
 * **No es un grupo de Cognito a propósito.** Los grupos se ponen y se quitan
 * desde el panel; si el permiso de dar permisos también fuera un grupo, un
 * descuido en el panel podría dejar el sistema sin nadie que lo administre, o
 * dárselo a quien no debe. Vivir en el código hace que solo cambie con un
 * commit, a la vista en el historial.
 *
 * Es seguro identificar por correo porque la Lambda solo lo acepta con
 * `email_verified` en el token, Cognito no deja dos cuentas con el mismo correo
 * y cambiar el correo de una cuenta exige el código enviado a la dirección
 * nueva (`attributesRequireVerificationBeforeUpdates` en `sst.config.ts`).
 */
export const SUPERADMINS = ["carlos.acosta12121998@gmail.com"] as const;

/**
 * Los correos de `SUPERADMINS` como tipo. El panel no puede importar valores
 * de `compartido/` (su raíz de Turbopack es `radar/`) y lleva una copia en
 * `radar/src/lib/superadmin.ts` atada a este tipo en los dos sentidos: si una
 * lista gana o pierde un correo y la otra no, `tsc` falla.
 */
export type CorreoSuperadmin = (typeof SUPERADMINS)[number];

export function esCorreoSuperadmin(correo: string | null | undefined): boolean {
  if (!correo) return false;
  return (SUPERADMINS as readonly string[]).includes(correo.trim().toLowerCase());
}

/** Los grupos que el superadmin reparte. `clientes` lo pone el registro solo. */
export const GRUPOS_EQUIPO = ["proveedores", "admins"] as const;
export type GrupoEquipo = (typeof GRUPOS_EQUIPO)[number];

export const esGrupoEquipo = (v: unknown): v is GrupoEquipo =>
  (GRUPOS_EQUIPO as readonly unknown[]).includes(v);

/* ── Solicitudes para entrar al equipo ────────────────────────────────── */

export const ESTADOS_SOLICITUD_EQUIPO = ["pendiente", "aceptada", "rechazada"] as const;
export type EstadoSolicitudEquipo = (typeof ESTADOS_SOLICITUD_EQUIPO)[number];

/** Lo que pide quien ya tiene cuenta de la tienda y quiere entrar al panel. */
export interface SolicitudEquipo {
  /** `sub` de Cognito de quien la pide: una solicitud por cuenta. */
  sub: string;
  nombre: string;
  correo: string;
  mensaje: string | null;
  estado: EstadoSolicitudEquipo;
  creadaEn: string;
  resueltaEn: string | null;
  /** Nombre de quien la resolvió. */
  resueltaPor: string | null;
  /** Con qué grupo se aceptó. */
  grupo: GrupoEquipo | null;
}

/* ── Cuentas (GET /superadmin/equipo) ─────────────────────────────────── */

export interface CuentaEquipo {
  sub: string;
  nombre: string;
  correo: string;
  telefono: string;
  grupos: string[];
  registradoEn: string | null;
  /** "CONFIRMED", "FORCE_CHANGE_PASSWORD"… */
  estado: string | null;
  /** `false` si se le cortó el acceso. */
  habilitada: boolean;
  superadmin: boolean;
}

export interface VistaEquipo {
  cuentas: CuentaEquipo[];
  /** Todas, de la más nueva a la más vieja; el panel separa las pendientes. */
  solicitudes: SolicitudEquipo[];
}

/** Cuerpo de `POST /superadmin/invitar`. */
export interface Invitacion {
  correo: string;
  nombre: string;
  grupo: GrupoEquipo;
}
