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
  /**
   * El identificador estable de Cognito. `null` en las sesiones por PIN, que no
   * identifican a nadie en concreto.
   *
   * Es la clave de partición del carrito y los pedidos, y por eso se usa el
   * `sub` y no el correo: el correo se puede cambiar desde la cuenta y arrastraría
   * el carrito a otra partición, dejando el anterior huérfano. El `sub` no cambia
   * nunca.
   */
  sub: string | null;
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
    return { evaluador: nombre, grupos, sub: carga.sub, origen: "cognito" };
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
  return { evaluador: sesion.evaluador, grupos: [], sub: null, origen: "pin" };
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

/**
 * ¿Puede tener carrito y pedidos propios?
 *
 * Cualquier cuenta de Cognito, sin pedir grupo: quien compra en la tienda está
 * en `clientes`, y el equipo compra también. Lo que separa aquí no es el grupo
 * sino **tener identidad**, porque el carrito se guarda bajo el `sub`.
 *
 * El PIN compartido no la tiene: es el mismo token para todo el equipo, así que
 * un carrito guardado con él sería el carrito de todos a la vez.
 */
export function tieneIdentidadPropia(
  identidad: Identidad,
): identidad is Identidad & { sub: string } {
  return identidad.origen === "cognito" && typeof identidad.sub === "string";
}
