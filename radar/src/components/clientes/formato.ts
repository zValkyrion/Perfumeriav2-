import { cargaDelToken } from "@/lib/cognito";
import type { ClienteAdmin } from "@/lib/tienda-admin";
import { soloDigitos } from "@/lib/utils";

/**
 * Formatos de clientes y solicitudes: nombres, teléfonos, búsqueda y la
 * dirección de la ficha. Sin React, para que lo usen las tres pantallas.
 */

/* Los acentos combinados (U+0300 a U+036F) se arman con su código: escritos a
   mano en el código se convertirían en el carácter invisible. */
const ACENTOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

/** «Pérez» y «perez» deben encontrarse igual: el dueño busca con el pulgar. */
export const normalizar = (t: string) => t.normalize("NFD").replace(ACENTOS, "").toLowerCase();

/** ¿Algún texto contiene la búsqueda (ya normalizada)? Vacío = todo coincide. */
export function coincide(q: string, ...textos: (string | null | undefined)[]): boolean {
  if (q === "") return true;
  const presentes = textos.filter((t): t is string => Boolean(t));
  if (normalizar(presentes.join(" ")).includes(q)) return true;
  // El teléfono se busca también sin espacios ni guiones: «5512» encuentra
  // «55-12…». Campo por campo, para no casar dígitos de dos campos juntos.
  const digitos = soloDigitos(q);
  return digitos.length >= 3 && digitos === q.replace(/[\s-]/g, "") && presentes.some((t) => soloDigitos(t).includes(digitos));
}

/** «55 1234 5678» si son 10 dígitos; si no, tal como vino. */
export function telefonoLegible(telefono: string | null | undefined): string {
  const t = (telefono ?? "").trim();
  const d = soloDigitos(t).slice(-10);
  if (d.length !== 10) return t;
  return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
}

/** Enlace `tel:` con los 10 dígitos y la lada de México; `null` si no alcanza. */
export function enlaceLlamar(telefono: string | null | undefined): string | null {
  const d = soloDigitos(telefono ?? "").slice(-10);
  return d.length === 10 ? `tel:+52${d}` : null;
}

/** Lo que se pinta como nombre: nunca una fila en blanco. */
export function nombreDe(c: Pick<ClienteAdmin, "nombre" | "correo" | "telefono">): string {
  return c.nombre.trim() || c.correo.trim() || telefonoLegible(c.telefono) || "Sin nombre";
}

export const enlaceCliente = (clave: string) => `/clientes/detalle/?clave=${encodeURIComponent(clave)}`;
export const enlacePedido = (folio: string) => `/pedidos/detalle/?folio=${encodeURIComponent(folio)}`;

/** «27 sep 2026» de una fecha `AAAA-MM-DD` (ya es de México: no se convierte). */
export function fechaDia(fecha: string | null | undefined): string {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "—";
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Estados de cuenta de Cognito, en palabras del dueño. */
const ESTADO_CUENTA: Record<string, string> = {
  CONFIRMED: "Confirmada",
  UNCONFIRMED: "Sin confirmar el correo",
  FORCE_CHANGE_PASSWORD: "Con contraseña temporal",
  RESET_REQUIRED: "Debe cambiar su contraseña",
  EXTERNAL_PROVIDER: "Entra con otra cuenta",
  ARCHIVED: "Archivada",
  COMPROMISED: "Bloqueada por seguridad",
};

export function estadoCuentaLegible(estado: string | null): string | null {
  if (!estado) return null;
  return ESTADO_CUENTA[estado] ?? estado;
}

/**
 * Tiene cuenta en la tienda (o compró con una): se reconoce por el `sub`.
 * Quien compró sin cuenta lleva una clave `tel:` o `folio:`.
 */
export const conCuenta = (c: Pick<ClienteAdmin, "sub">) => c.sub !== null;

/** Admins o proveedores: el equipo, no clientela. */
export const esEquipo = (c: Pick<ClienteAdmin, "grupos">) =>
  c.grupos.includes("admins") || c.grupos.includes("proveedores");

/**
 * El `sub` de quien usa el panel, leído del token **sin verificar**: solo sirve
 * para no ofrecerle un botón que el servidor le va a rechazar (quitarse a sí
 * mismo de `admins`). La regla de verdad está en la Lambda.
 */
export function subDeToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const carga = JSON.parse(cargaDelToken(token));
    return typeof carga.sub === "string" ? carga.sub : null;
  } catch {
    return null;
  }
}
