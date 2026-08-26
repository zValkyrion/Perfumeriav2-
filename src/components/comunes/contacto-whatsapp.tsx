"use client";

import { useEffect } from "react";
import { PIXEL_ID, pixel } from "@/lib/pixel";

/**
 * `Contact` para el pixel: cada clic en un enlace de WhatsApp.
 *
 * Escucha en `document` en lugar de poner un `onClick` en cada botón. Los
 * enlaces viven repartidos en ocho archivos —cabecera, pie, barra móvil, botón
 * flotante, cabecera de mayoreo, confirmación de pedido, detalle de pedido— y
 * varios son componentes de servidor: instrumentarlos uno a uno obligaría a
 * volverlos de cliente solo para medir, y bastaría olvidar uno —o añadir un
 * enlace nuevo mañana— para perder la conversión sin enterarse.
 *
 * Importa más aquí que en otras tiendas: buena parte de la venta se cierra
 * conversando por WhatsApp. Sin este evento, quien llega por un anuncio,
 * pregunta y compra por ahí le cuenta a la campaña como abandono, y Meta
 * termina optimizando en contra del canal que más vende.
 *
 * No manda `value`: cuánto acabará gastando quien escribe todavía no se sabe, y
 * un importe inventado ensuciaría el retorno que reporta el administrador.
 */
export function ContactoWhatsApp() {
  useEffect(() => {
    if (!PIXEL_ID) return;

    function alPulsar(evento: MouseEvent) {
      const destino = evento.target;
      if (!(destino instanceof Element)) return;
      // `closest` y no el destino directo: el clic suele caer en el icono o en
      // el texto de dentro del enlace, nunca en la etiqueta `<a>` misma.
      if (!destino.closest('a[href*="wa.me/"]')) return;
      pixel("Contact");
    }

    // En fase de captura: el evento se manda aunque algún manejador de por
    // medio detenga la propagación antes de que el clic llegue a `document`.
    document.addEventListener("click", alPulsar, true);
    return () => document.removeEventListener("click", alPulsar, true);
  }, []);

  return null;
}
