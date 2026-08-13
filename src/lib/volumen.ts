import type { Escalon } from "@/types";

/**
 * Escalera de descuento por volumen (§3.1) — la palanca comercial #1.
 *
 * El escalón lo determina el **total de piezas del pedido**, no la cantidad por
 * línea: así un revendedor que arma 12 piezas mezclando modelos obtiene precio
 * de distribuidor, que es como opera un mayorista real.
 */
export const ESCALONES: readonly Escalon[] = [
  {
    min: 1,
    max: 2,
    descuento: 0,
    nombre: "Menudeo",
    etiqueta: "Precio menudeo",
  },
  {
    min: 3,
    max: 5,
    descuento: 0.15,
    nombre: "Mayoreo",
    etiqueta: "Precio mayoreo · envío gratis",
  },
  {
    min: 6,
    max: 11,
    descuento: 0.25,
    nombre: "Mayoreo Plus",
    etiqueta: "Mayoreo Plus",
  },
  {
    min: 12,
    max: null,
    descuento: 0.4,
    nombre: "Distribuidor",
    etiqueta: "Precio distribuidor",
  },
] as const;

/** Piezas mínimas para envío gratis (§3.2). */
export const PIEZAS_ENVIO_GRATIS = 3;

/** Devuelve el escalón que aplica a un número de piezas. */
export function escalonPara(piezas: number): Escalon {
  const n = Math.max(1, Math.floor(piezas));
  for (const e of ESCALONES) {
    if (n >= e.min && (e.max === null || n <= e.max)) return e;
  }
  return ESCALONES[0]!;
}

/** Precio unitario ya con el descuento del escalón, redondeado a centavos. */
export function precioUnitario(precioBase: number, piezas: number): number {
  const { descuento } = escalonPara(piezas);
  return Math.round(precioBase * (1 - descuento) * 100) / 100;
}

export interface DesglosePrecio {
  escalon: Escalon;
  unitario: number;
  unitarioMenudeo: number;
  ahorroUnitario: number;
  total: number;
  totalMenudeo: number;
  ahorroTotal: number;
}

export function calcularPrecio(
  precioBase: number,
  piezas: number,
): DesglosePrecio {
  const n = Math.max(1, Math.floor(piezas));
  const escalon = escalonPara(n);
  const unitario = precioUnitario(precioBase, n);
  const total = Math.round(unitario * n * 100) / 100;
  const totalMenudeo = Math.round(precioBase * n * 100) / 100;

  return {
    escalon,
    unitario,
    unitarioMenudeo: precioBase,
    ahorroUnitario: Math.round((precioBase - unitario) * 100) / 100,
    total,
    totalMenudeo,
    ahorroTotal: Math.round((totalMenudeo - total) * 100) / 100,
  };
}

export interface SiguienteEscalon {
  faltan: number;
  escalon: Escalon;
  /** Precio unitario que tendría ese artículo al alcanzar el escalón. */
  nuevoUnitario: number;
  /** Cuánto se ahorra en el pedido completo al llegar ahí. */
  ahorroAdicional: number;
  /** Progreso 0–1 hacia el siguiente escalón, para la barra dorada. */
  progreso: number;
}

/**
 * Qué falta para el siguiente escalón. Devuelve `null` si ya está en el tope.
 * `precioBase` es opcional: sirve para poder decir "baja a $ 890.00 c/u".
 */
export function siguienteEscalon(
  piezas: number,
  precioBase = 0,
  subtotalMenudeo = 0,
): SiguienteEscalon | null {
  const n = Math.max(0, Math.floor(piezas));
  const actual = escalonPara(Math.max(1, n));
  const idx = ESCALONES.indexOf(actual);
  const proximo = ESCALONES[idx + 1];
  if (!proximo) return null;

  const faltan = proximo.min - n;
  const desde = actual.min;
  const progreso = Math.min(1, Math.max(0, (n - desde) / (proximo.min - desde)));

  return {
    faltan,
    escalon: proximo,
    nuevoUnitario: Math.round(precioBase * (1 - proximo.descuento) * 100) / 100,
    ahorroAdicional:
      Math.round(
        subtotalMenudeo * (proximo.descuento - actual.descuento) * 100,
      ) / 100,
    progreso,
  };
}

/** Meses sin intereses disponibles según el monto (§3.2). */
export const PLAZOS_MSI = [3, 6, 9, 12] as const;
export type PlazoMSI = (typeof PLAZOS_MSI)[number];

/** Monto mínimo para desbloquear cada plazo. */
const MINIMO_MSI: Record<PlazoMSI, number> = {
  3: 1200,
  6: 2500,
  9: 5000,
  12: 8000,
};

export function plazosDisponibles(total: number): PlazoMSI[] {
  return PLAZOS_MSI.filter((p) => total >= MINIMO_MSI[p]);
}

/** Mensualidad sin intereses; devuelve null si el monto no alcanza el plazo. */
export function mensualidad(total: number, plazo: PlazoMSI): number | null {
  if (total < MINIMO_MSI[plazo]) return null;
  return Math.round((total / plazo) * 100) / 100;
}

/** El mejor plazo que alcanza el monto, para el gancho "o 6 pagos de $215". */
export function mejorPlazo(
  total: number,
): { plazo: PlazoMSI; pago: number } | null {
  const disponibles = plazosDisponibles(total);
  const plazo = disponibles.at(-1);
  if (!plazo) return null;
  return { plazo, pago: mensualidad(total, plazo)! };
}

/** Cupón de bienvenida del §12. */
export const CUPONES: Record<string, { descuento: number; etiqueta: string }> = {
  AURA10: { descuento: 0.1, etiqueta: "10% de bienvenida" },
};
