import { esVendido, type EstatusPedido } from "../../compartido/pedido";

/**
 * Lo que la cuenta del cliente necesita además de sus datos.
 *
 * Aquí vivía una cuenta de muestra —«Andrea Villaseñor», cinco pedidos con
 * guía y dos direcciones— que se enseñaba sin iniciar sesión en el build de
 * GitHub Pages. Se quitó: un visitante veía pedidos, teléfonos y direcciones
 * inventados como si fueran de alguien, y los folios de muestra caían en el
 * rango de folios reales antiguos. Sin Cognito, la cuenta ahora dice que vive
 * en la tienda principal (MEMORIA §0.3: no inventar datos).
 */

/* ── Nivel de cliente ─────────────────────────────────────────────────── */

// El nivel vive en `compartido/`: el panel lo calcula con la misma regla.
export { NIVELES, nivelDePiezas as nivelDe } from "../../compartido/niveles";
export type { Nivel } from "../../compartido/niveles";

/**
 * Las piezas que cuentan para el nivel: solo las de pedidos vendidos
 * (`ESTATUS_VENDIDO`). Un pendiente que nunca se pagó o un cancelado no puede
 * subir a nadie de nivel; es la misma regla con la que el panel calcula el
 * nivel de cada cliente, para que los dos lados digan lo mismo.
 */
export function piezasVendidas(
  pedidos: readonly { estatus: EstatusPedido; piezas: number }[],
): number {
  return pedidos.reduce((n, p) => (esVendido(p.estatus) ? n + p.piezas : n), 0);
}
