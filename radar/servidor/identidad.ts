import { Resource } from "sst";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { verificarToken, type Sesion as SesionPin } from "./jwt";

/**
 * Quién está llamando a la API y qué puede hacer.
 *
 * Conviven dos formas de identificarse mientras dura la transición:
 *
 * 1. **Cognito** — lo definitivo. El token trae la identidad real y los grupos.
 * 2. **El PIN compartido** — lo anterior. Un JWT que firma esta misma Lambda,
 *    sin identidad ni grupos.
 *
 * El PIN sigue aceptándose a propósito: el equipo está en la calle y no se le
 * puede cortar el acceso a mitad de una gira por un despliegue. Se retira cuando
 * todos tengan cuenta, y ese día basta con borrar `sesionPorPin` de aquí.
 */

/**
 * Se verifica el **ID token**, no el de acceso.
 *
 * Ambos traen `cognito:groups`, pero solo el de identidad trae el correo, y sin
 * correo la ficha quedaría firmada por un identificador que no le dice nada a
 * nadie. La trazabilidad de quién capturó qué es justo lo que se quería ganar al
 * salir del PIN compartido.
 */
const verificador = CognitoJwtVerifier.create({
  userPoolId: Resource.Elrey_usuarios.id,
  tokenUse: "id",
  clientId: Resource.Elrey_web.id,
});

export type Identidad = {
  /** Nombre legible para firmar las fichas. */
  evaluador: string;
  /** Grupos de Cognito. Vacío cuando la sesión viene del PIN antiguo. */
  grupos: string[];
  /** De dónde salió esta sesión. */
  origen: "cognito" | "pin";
};

export async function identificar(
  cabecera: string | undefined,
): Promise<Identidad | null> {
  if (!cabecera?.startsWith("Bearer ")) return null;
  const token = cabecera.slice(7);

  return (await sesionPorCognito(token)) ?? sesionPorPin(token);
}

async function sesionPorCognito(token: string): Promise<Identidad | null> {
  try {
    const carga = await verificador.verify(token);
    const grupos = (carga["cognito:groups"] as string[] | undefined) ?? [];
    const nombre =
      (carga.name as string | undefined) ??
      (carga.email as string | undefined) ??
      carga.sub;
    return { evaluador: nombre, grupos, origen: "cognito" };
  } catch {
    // No es de Cognito —o está vencido—: puede seguir siendo del PIN.
    return null;
  }
}

function sesionPorPin(token: string): Identidad | null {
  const sesion: SesionPin | null = verificarToken(
    token,
    Resource.Elrey_jwt_secreto.value,
  );
  if (!sesion) return null;
  return { evaluador: sesion.evaluador, grupos: [], origen: "pin" };
}

/**
 * ¿Puede entrar al panel de proveedores?
 *
 * Las sesiones por PIN pasan mientras exista el PIN: quien lo tiene ya está
 * dentro del equipo, y exigirle un grupo que todavía no se le ha asignado lo
 * dejaría fuera sin alternativa.
 */
export function puedeVerProveedores(identidad: Identidad): boolean {
  if (identidad.origen === "pin") return true;
  return identidad.grupos.includes("proveedores") || identidad.grupos.includes("admins");
}
