/**
 * Nivel de cliente según las piezas que ha comprado.
 *
 * Vive en `compartido/` porque lo calculan dos lados: la tienda lo pinta en
 * «Mi cuenta» y el panel lo enseña en la ficha de cada cliente. Con dos copias,
 * el dueño vería a alguien como «Oro» mientras el cliente se ve «Plata».
 *
 * **Solo cuentan piezas de pedidos vendidos** (`ESTATUS_VENDIDO`): un beneficio
 * mayorista no puede depender de pedidos que nunca se pagaron o se cancelaron.
 * Quien llama es quien filtra; esta función solo convierte piezas en nivel.
 */

export interface Nivel {
  nombre: string;
  desde: number;
  beneficio: string;
}

export const NIVELES: readonly Nivel[] = [
  { nombre: "Bronce", desde: 0, beneficio: "Envío gratis desde 3 piezas" },
  { nombre: "Plata", desde: 12, beneficio: "5% extra en lotes de mayoreo" },
  { nombre: "Oro", desde: 36, beneficio: "Preventa de ediciones limitadas" },
  {
    nombre: "Distribuidor",
    desde: 72,
    beneficio: "Precio distribuidor permanente y asesor asignado",
  },
];

export function nivelDePiezas(piezas: number): {
  actual: Nivel;
  siguiente: Nivel | null;
  /** De 0 a 1, el avance hacia el siguiente nivel. */
  progreso: number;
  faltan: number;
} {
  const n = Number.isFinite(piezas) ? Math.max(0, piezas) : 0;
  let actual = NIVELES[0]!;
  for (const nivel of NIVELES) if (n >= nivel.desde) actual = nivel;

  const siguiente = NIVELES[NIVELES.indexOf(actual) + 1] ?? null;
  if (!siguiente) return { actual, siguiente: null, progreso: 1, faltan: 0 };

  const tramo = siguiente.desde - actual.desde;
  return {
    actual,
    siguiente,
    progreso: Math.min(1, (n - actual.desde) / tramo),
    faltan: siguiente.desde - n,
  };
}
