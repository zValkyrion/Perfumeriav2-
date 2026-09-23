import { createHash } from "node:crypto";
import { estable } from "./catalogo-tabla";

/**
 * Huella del contenido de una fila del catálogo.
 *
 * Aparte del resto de `compartido/` porque usa `node:crypto`: la importan la
 * Lambda y los scripts, nunca el navegador. Se calcula sobre el JSON con las
 * claves ordenadas (`estable`) para que el mismo producto dé la misma huella
 * lo haya escrito el CSV o el panel.
 */
export function huellaDe(valor: unknown): string {
  return createHash("sha1").update(estable(valor)).digest("hex");
}
