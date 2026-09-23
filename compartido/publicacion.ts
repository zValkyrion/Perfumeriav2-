import type { CorridaPublicacion } from "./catalogo-admin";

/**
 * Cuándo volver a compilar la tienda por su cuenta.
 *
 * Aparte y sin dependencias para poder probarlo: equivocarse aquí es o una
 * tienda que no enseña lo que se guardó, o un despliegue cada diez minutos.
 */

/** Lo que `Elrey_catalogo` guarda en META sobre cambios y publicaciones. */
export interface MetaCatalogo {
  /** Último cambio de datos, por el panel o por el CSV. */
  generado?: string;
  /** El `generado` del catálogo con que se compiló la tienda publicada. */
  publicado?: string;
  publicadoEn?: string;
  pedidaEn?: string;
  pedidaPor?: string;
}

/** Diez minutos sin cambios antes de publicar solo. */
export const QUIETO_MS = 10 * 60_000;

/** Hay cambios que la tienda compilada todavía no enseña. */
export const hayPendiente = (m: MetaCatalogo) =>
  Boolean(m.generado) && (!m.publicado || m.generado! > m.publicado);

/**
 * Por qué no pedir la publicación ahora, o `null` si hay que pedirla.
 *
 * Se espera a que pasen diez minutos sin cambios —quien edita veinte perfumes
 * seguidos necesita un despliegue al terminar, no veinte— y se pide **una
 * sola vez** por tanda de cambios: si ese despliegue falla no se reintenta
 * solo, porque reintentar un fallo cada diez minutos sería desplegar roto para
 * siempre. `corrida` se pasa cuando ya se consultó a GitHub.
 */
export function porQueNoPublicar(
  meta: MetaCatalogo,
  ahora: number,
  corrida?: CorridaPublicacion | null,
): string | null {
  if (!hayPendiente(meta)) return "la tienda está al día";
  if (ahora - Date.parse(meta.generado!) < QUIETO_MS) return "siguen editando";
  if (meta.pedidaEn && meta.pedidaEn > meta.generado!) return "ya se pidió para estos cambios";
  if (corrida && corrida.estado !== "terminada") return "hay un despliegue en marcha";
  return null;
}
