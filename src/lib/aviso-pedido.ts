"use client";

import { MARCA } from "@/data/contenido";
import { resumenCarrito } from "@/lib/carrito";
import { precio as fmt } from "@/lib/format";
import type { PedidoConfirmado } from "@/store/tienda";

/**
 * Aviso de compra: cómo se entera la tienda de que alguien pagó.
 *
 * La tienda es una exportación estática y no tiene servidor propio donde mandar
 * un correo, así que el aviso viaja por dos caminos que se complementan:
 *
 * 1. **WhatsApp, desde el navegador del comprador.** La pantalla de gracias
 *    abre un chat con el pedido ya escrito. Es el camino que siempre funciona:
 *    no depende de ninguna contratación y deja la conversación abierta con la
 *    persona, que es donde se cierran el pago y el envío.
 * 2. **Un webhook, si está configurado.** `NEXT_PUBLIC_WEBHOOK_PEDIDOS` recibe
 *    el pedido en JSON en cuanto se confirma, sin que el comprador tenga que
 *    pulsar nada. Sirve para enganchar Make, Zapier, n8n o la API de WhatsApp
 *    Business y que el aviso llegue solo.
 *
 * El primero no se puede automatizar —el navegador no manda un WhatsApp sin que
 * la persona lo mande— y el segundo no se puede dar por hecho. Por eso están
 * los dos: uno garantiza que el aviso exista, el otro que llegue sin esperar.
 */

const WEBHOOK = process.env.NEXT_PUBLIC_WEBHOOK_PEDIDOS ?? "";

export function hayWebhookPedidos(): boolean {
  return WEBHOOK !== "";
}

/** El pedido en la forma en que sale hacia el webhook. */
export interface AvisoPedido {
  folio: string;
  fecha: string;
  cliente: {
    nombre: string;
    telefono: string;
    correo: string;
  };
  direccion: {
    calle: string;
    colonia: string;
    cp: string;
    ciudad: string;
    estado: string;
    referencias?: string;
  };
  envio: string;
  metodoPago: string;
  comision: number;
  total: number;
  piezas: number;
  articulos: { nombre: string; detalle: string; cantidad: number; importe: number }[];
  /** El mismo pedido ya redactado, listo para pegar en un mensaje. */
  texto: string;
}

/** Las líneas del pedido con su precio ya rebajado, como en el comprobante. */
function articulos(pedido: PedidoConfirmado) {
  return resumenCarrito(pedido.items).lineas.map((l) => ({
    nombre: l.nombre,
    detalle: l.subtitulo,
    cantidad: l.item.cantidad,
    importe: l.subtotal,
  }));
}

/**
 * El pedido redactado en texto plano.
 *
 * Va con saltos de línea de verdad y sin adornos: se lee igual en WhatsApp, en
 * un correo o pegado en una hoja de cálculo, y quien lo recibe puede copiar la
 * dirección de un tirón para la guía de envío.
 */
export function textoPedido(pedido: PedidoConfirmado): string {
  const lineas = articulos(pedido)
    .map((a) => `• ${a.cantidad} × ${a.nombre} (${a.detalle}) — ${fmt(a.importe)}`)
    .join("\n");

  const direccion = [
    pedido.calle,
    pedido.colonia,
    `${pedido.cp} ${pedido.ciudad}, ${pedido.estado}`,
    pedido.referencias ? `Referencias: ${pedido.referencias}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `*Pedido ${pedido.folio}* — ${MARCA.nombre}`,
    "",
    `*Cliente:* ${pedido.nombre}`,
    `*WhatsApp:* ${pedido.telefono}`,
    `*Correo:* ${pedido.correo}`,
    "",
    "*Enviar a:*",
    direccion,
    "",
    "*Artículos:*",
    lineas,
    "",
    `*Envío:* ${pedido.envio}`,
    `*Forma de pago:* ${pedido.metodoPago}`,
    pedido.comision > 0
      ? `*Servicio de cobro en destino:* ${fmt(pedido.comision)}`
      : null,
    `*Total:* ${fmt(pedido.total)} MXN`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** Enlace a WhatsApp con el pedido ya escrito, hacia el número de la tienda. */
export function enlaceWhatsAppPedido(pedido: PedidoConfirmado): string {
  return `https://wa.me/${MARCA.whatsappNumero}?text=${encodeURIComponent(
    textoPedido(pedido),
  )}`;
}

/**
 * Manda el pedido al webhook, si lo hay.
 *
 * Sale con `sendBeacon` porque justo después el navegador se va a la pantalla
 * de gracias: un `fetch` normal se cancelaría a mitad de vuelo y el aviso se
 * perdería sin que nadie se entere. El cuerpo viaja como `text/plain` a
 * propósito —con `application/json` el navegador exigiría una comprobación CORS
 * previa que un beacon no puede hacer—; el JSON va dentro igual y cualquier
 * automatización lo interpreta.
 *
 * Nunca lanza: que el aviso falle no puede tumbar una compra que ya se hizo.
 */
export function avisarPedido(pedido: PedidoConfirmado): void {
  if (!WEBHOOK || typeof window === "undefined") return;

  const aviso: AvisoPedido = {
    folio: pedido.folio,
    fecha: pedido.fecha,
    cliente: {
      nombre: pedido.nombre,
      telefono: pedido.telefono,
      correo: pedido.correo,
    },
    direccion: {
      calle: pedido.calle,
      colonia: pedido.colonia,
      cp: pedido.cp,
      ciudad: pedido.ciudad,
      estado: pedido.estado,
      referencias: pedido.referencias,
    },
    envio: pedido.envio,
    metodoPago: pedido.metodoPago,
    comision: pedido.comision,
    total: pedido.total,
    piezas: pedido.piezas,
    articulos: articulos(pedido),
    texto: textoPedido(pedido),
  };

  try {
    const cuerpo = JSON.stringify(aviso);
    const mandado = navigator.sendBeacon?.(
      WEBHOOK,
      new Blob([cuerpo], { type: "text/plain;charset=UTF-8" }),
    );
    if (!mandado) {
      void fetch(WEBHOOK, {
        method: "POST",
        body: cuerpo,
        headers: { "content-type": "text/plain;charset=UTF-8" },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Sin red o con el webhook caído, queda el WhatsApp de la pantalla de
    // gracias. El pedido no se pierde por esto.
  }
}
