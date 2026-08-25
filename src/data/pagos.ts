/**
 * Formas de pago de la tienda — la única fuente de verdad.
 *
 * Tres opciones, ni una más, y cada una con su regla escrita aquí en vez de
 * repartida entre el checkout, el FAQ y los términos. Cuando la escalera de
 * envío gratis cambió, los textos escritos a mano se quedaron prometiendo lo
 * anterior; con las formas de pago pasaría igual.
 *
 * Lo que falta para cobrar de verdad está marcado con `PENDIENTE` y se conecta
 * por variable de entorno: ningún dato de la pasarela se escribe en el
 * repositorio.
 */

/**
 * Tope para el pago contra entrega. Por debajo de esta cifra se ofrece; a
 * partir de ella, no. El riesgo de un paquete rechazado crece con el monto y
 * a partir de aquí conviene cobrar antes de que salga de bodega.
 */
export const TOPE_CONTRA_ENTREGA = 10000;

/** Lo que cuesta el servicio de cobro en destino. Lo paga el comprador. */
export const COMISION_CONTRA_ENTREGA = 400;

/**
 * Enlace de cobro de Clip.
 *
 * PENDIENTE: pega aquí el enlace de pago de tu cuenta Clip a través de
 * `NEXT_PUBLIC_CLIP_LINK`. Mientras esté vacío, el pedido se cierra igual y el
 * cobro se acuerda por WhatsApp — que es exactamente lo que se hace hoy, solo
 * que ahora queda registrado en el pedido en vez de fingir un cargo.
 *
 * La tienda es una exportación estática: no hay servidor donde firmar una
 * transacción, así que la integración correcta es el enlace de cobro alojado
 * por Clip, no su SDK.
 */
export const CLIP_LINK = process.env.NEXT_PUBLIC_CLIP_LINK ?? "";

/**
 * Datos bancarios para depósito y transferencia.
 *
 * PENDIENTE: se llenan por entorno (`NEXT_PUBLIC_CLABE`, `NEXT_PUBLIC_BANCO`,
 * `NEXT_PUBLIC_TITULAR`) o se dejan vacíos. Vacíos, el checkout dice la verdad:
 * las instrucciones van por WhatsApp. **Nunca se escriben en el repositorio.**
 */
export const DATOS_BANCARIOS = {
  banco: process.env.NEXT_PUBLIC_BANCO ?? "",
  clabe: process.env.NEXT_PUBLIC_CLABE ?? "",
  titular: process.env.NEXT_PUBLIC_TITULAR ?? "",
} as const;

/** `true` cuando hay CLABE que enseñar en pantalla. */
export const HAY_DATOS_BANCARIOS = DATOS_BANCARIOS.clabe !== "";

export type IdPago = "clip" | "transferencia" | "contra";

export interface MetodoPago {
  id: IdPago;
  /** Nombre corto, para la pestaña. */
  nombre: string;
  /** Cómo se guarda en el pedido y se lee en el comprobante. */
  etiqueta: string;
  /** Una línea bajo el título, en el paso de pago. */
  resumen: string;
}

export const METODOS: readonly MetodoPago[] = [
  {
    id: "clip",
    nombre: "Clip",
    etiqueta: "Clip · tarjeta o efectivo",
    resumen:
      "Crédito, débito y efectivo. Con tarjetas participantes, meses sin intereses.",
  },
  {
    id: "transferencia",
    nombre: "Transferencia",
    etiqueta: "Depósito o transferencia",
    resumen:
      "SPEI o depósito en ventanilla. Te mandamos las instrucciones por WhatsApp.",
  },
  {
    id: "contra",
    nombre: "Contra entrega",
    etiqueta: "Pago contra entrega",
    resumen: "Pagas al recibir el paquete. Servicio de cobro en destino.",
  },
] as const;

/**
 * Si el pago contra entrega aplica a este pedido.
 *
 * Se mide sobre el total **sin** la comisión: lo que decide es el valor del
 * envío, no lo que cuesta ir a cobrarlo. Sumar la comisión antes de comparar
 * dejaría fuera pedidos de $9,700 por culpa del propio servicio.
 */
export function hayContraEntrega(totalSinComision: number): boolean {
  return totalSinComision < TOPE_CONTRA_ENTREGA;
}

/** La comisión que suma al total el método elegido. Hoy solo la cobra uno. */
export function comisionDe(metodo: IdPago): number {
  return metodo === "contra" ? COMISION_CONTRA_ENTREGA : 0;
}
