/**
 * Reglas comerciales de la tienda — la única fuente de verdad.
 *
 * Este archivo lo leen **dos programas**: la tienda, para enseñar precios, y la
 * Lambda de `radar/servidor`, para cobrarlos. Por eso vive fuera de `src/` y no
 * importa nada: ni React, ni alias `@/`, ni datos del catálogo. Si las reglas
 * estuvieran copiadas en los dos lados, el día que cambie un porcentaje el
 * carrito prometería una cifra y el servidor cobraría otra.
 *
 * Las cifras salen del catálogo en PDF (página 1, agosto de 2026):
 *   3–9 piezas: 10% · 10–19: 20% · 20 o más: 30%, siempre con envío gratis.
 *   Depósito o transferencia: 10% extra, sumado al de volumen. Tope: 40%.
 */

/* ── Escalera de volumen ──────────────────────────────────────────────── */

/** Escalón de precio por volumen. */
export interface Escalon {
  min: number;
  max: number | null;
  descuento: number;
  etiqueta: string;
  nombre: string;
}

/**
 * El escalón lo decide el **total de piezas sueltas del pedido**, no la cantidad
 * por línea: un revendedor que arma diez piezas con diez modelos distintos
 * obtiene el mismo precio que quien lleva diez del mismo.
 */
export const ESCALONES: readonly Escalon[] = [
  { min: 1, max: 2, descuento: 0, nombre: "Menudeo", etiqueta: "Precio menudeo" },
  {
    min: 3,
    max: 9,
    descuento: 0.1,
    nombre: "Mayoreo",
    etiqueta: "10% de descuento · envío gratis",
  },
  {
    min: 10,
    max: 19,
    descuento: 0.2,
    nombre: "Mayoreo Plus",
    etiqueta: "20% de descuento · envío gratis",
  },
  {
    min: 20,
    max: null,
    descuento: 0.3,
    nombre: "Distribuidor",
    etiqueta: "30% de descuento · envío gratis",
  },
];

/** Devuelve el escalón que aplica a un número de piezas. */
export function escalonPara(piezas: number): Escalon {
  const n = Math.max(1, Math.floor(piezas));
  for (const e of ESCALONES) {
    if (n >= e.min && (e.max === null || n <= e.max)) return e;
  }
  return ESCALONES[0]!;
}

/* ── Envío ────────────────────────────────────────────────────────────── */

/** Piezas mínimas para que el envío estándar salga gratis. */
export const PIEZAS_ENVIO_GRATIS = 3;

/**
 * Tarifa de cada forma de envío. Solo la estándar se vuelve gratis con el
 * mínimo de piezas: las urgentes se pagan siempre porque las cobra la
 * paquetería por viaje, no por volumen.
 */
export const TARIFAS_ENVIO = {
  estandar: 149,
  express: 180,
  "mismo-dia": 250,
} as const;

export type IdEnvio = keyof typeof TARIFAS_ENVIO;

export const COSTO_ENVIO_ESTANDAR = TARIFAS_ENVIO.estandar;

export function esIdEnvio(v: unknown): v is IdEnvio {
  return typeof v === "string" && v in TARIFAS_ENVIO;
}

/* ── Formas de pago ───────────────────────────────────────────────────── */

export type IdPago = "clip" | "transferencia" | "contra";

export function esIdPago(v: unknown): v is IdPago {
  return v === "clip" || v === "transferencia" || v === "contra";
}

/**
 * Descuento extra por pagar con depósito o transferencia. **Se suma** al de
 * volumen sobre el precio de lista (30% + 10% = 40%), no se multiplica: así lo
 * fija el tope del catálogo, que con multiplicación nunca llegaría al 40%.
 * No aplica a tarjeta ni a pago contra entrega.
 */
export const DESCUENTO_TRANSFERENCIA = 0.1;

/**
 * Descuento máximo de un pedido: volumen + transferencia + cupón, medido sobre
 * el precio de lista. El 3x2 queda fuera porque tiene sus propios términos.
 */
export const DESCUENTO_MAXIMO = 0.4;

/**
 * Tope para el pago contra entrega. Por debajo de esta cifra se ofrece; a
 * partir de ella, no. El riesgo de un paquete rechazado crece con el monto.
 */
export const TOPE_CONTRA_ENTREGA = 10000;

/** Lo que cuesta el servicio de cobro en destino. Lo paga el comprador. */
export const COMISION_CONTRA_ENTREGA = 400;

/**
 * Si el pago contra entrega aplica. Se mide sobre el total **sin** la comisión:
 * lo que decide es el valor del envío, no lo que cuesta ir a cobrarlo.
 */
export function hayContraEntrega(totalSinComision: number): boolean {
  return totalSinComision < TOPE_CONTRA_ENTREGA;
}

/** La comisión que suma al total el método elegido. Hoy solo la cobra uno. */
export function comisionDe(metodo: IdPago): number {
  return metodo === "contra" ? COMISION_CONTRA_ENTREGA : 0;
}

/* ── Cupones ──────────────────────────────────────────────────────────── */

export const CUPONES: Record<string, { descuento: number; etiqueta: string }> = {
  AURA10: { descuento: 0.1, etiqueta: "10% de bienvenida" },
};
