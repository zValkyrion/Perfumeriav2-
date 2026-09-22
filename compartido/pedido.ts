import type { ItemPedido } from "./cotizacion";
import type { IdEnvio, IdPago } from "./reglas";

/**
 * El contrato de `POST /pedidos`: lo que manda la tienda y lo que contesta el
 * servidor. Vive aquí para que los dos lados no puedan desalinearse en silencio.
 *
 * Lo que **no** viaja en la solicitud es tan importante como lo que sí: ni el
 * folio ni el total. El folio lo asigna el servidor con un contador —dos
 * navegadores no pueden ponerse de acuerdo para no repetir— y el total lo
 * recalcula con los precios del catálogo.
 */

export interface ContactoPedido {
  correo: string;
  nombre: string;
  telefono: string;
  calle: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  referencias: string;
}

export interface SolicitudPedido {
  items: ItemPedido[];
  cupon: string | null;
  metodo: IdPago;
  envio: IdEnvio;
  contacto: ContactoPedido;
}

export interface PedidoRegistrado {
  folio: string;
  fecha: string;
  /** El total que se cobra: el del servidor, no el que calculó el navegador. */
  total: number;
  comision: number;
  descuentoTransferencia: number;
  /** La forma de pago que aplica (el contra entrega sobre el tope pasa a Clip). */
  metodo: IdPago;
}
