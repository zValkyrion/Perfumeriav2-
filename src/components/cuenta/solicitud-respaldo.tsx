"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARCA } from "@/data/contenido";
import { ErrorRemoto, enviarSolicitud, haySincronizacion } from "@/lib/cuenta-remota";
import type { SolicitudEntrada } from "../../../compartido/tienda-admin";

/**
 * Mandar una solicitud (distribuidor, contacto o factura) sin fingir nunca que
 * se mandó.
 *
 * Los formularios de mayoreo y contacto decían «Recibimos tus datos» sin
 * mandar nada: el prospecto creía que un asesor le escribiría y nadie se
 * enteraba. Ahora hay tres salidas y cada una se dice tal cual:
 * - `enviada`: el servidor la guardó y aparece en el panel («Solicitudes»).
 * - `invalida`: el servidor la rechazó por un dato (falta el teléfono, el RFC
 *   no es válido…); el mensaje se enseña y se corrige en el mismo formulario.
 * - `respaldo`: no hay servidor en esta copia de la tienda, o no contestó. Los
 *   datos siguen en pantalla y se ofrece mandarlos por WhatsApp ya escritos.
 */
export type ResultadoSolicitud =
  | { tipo: "enviada" }
  | { tipo: "invalida"; mensaje: string }
  | { tipo: "respaldo"; sinServidor: boolean };

export async function mandarSolicitud(entrada: SolicitudEntrada): Promise<ResultadoSolicitud> {
  if (!haySincronizacion()) return { tipo: "respaldo", sinServidor: true };
  try {
    await enviarSolicitud(entrada);
    return { tipo: "enviada" };
  } catch (e) {
    if (e instanceof ErrorRemoto && (e.estado === 400 || e.estado === 422)) {
      return { tipo: "invalida", mensaje: e.message };
    }
    return { tipo: "respaldo", sinServidor: false };
  }
}

/** La solicitud redactada para WhatsApp, con lo que la tienda necesita para contestar. */
export function textoSolicitud(s: SolicitudEntrada): string {
  const encabezado = {
    distribuidor: `Hola, quiero ser distribuidor de ${MARCA.nombre}.`,
    contacto: "Hola, les escribo desde la página.",
    factura: `Hola, quiero factura de mi pedido ${s.folio ?? ""}.`,
  }[s.tipo];
  const renglones: [string, string | undefined][] = [
    ["Nombre", s.nombre],
    ["WhatsApp", s.telefono],
    ["Correo", s.correo],
    ["Ciudad", s.ciudad],
    ["Negocio", s.negocio],
    ["Volumen", s.volumen],
    ["RFC", s.rfc],
    ["Razón social", s.razonSocial],
    ["Régimen fiscal", s.regimen],
    ["CP fiscal", s.cpFiscal],
    ["Uso del CFDI", s.usoCfdi],
    ["Mensaje", s.mensaje],
  ];
  return [
    encabezado,
    "",
    ...renglones.filter(([, v]) => v && v.trim()).map(([k, v]) => `*${k}:* ${v!.trim()}`),
  ].join("\n");
}

export function enlaceSolicitud(s: SolicitudEntrada): string {
  return `https://wa.me/${MARCA.whatsappNumero}?text=${encodeURIComponent(textoSolicitud(s))}`;
}

/**
 * El aviso cuando la solicitud no llegó al servidor. Dice que **no** se envió
 * y deja el WhatsApp a un toque; es un enlace y no un `window.open` porque el
 * navegador bloquea las ventanas que no salen directo de un clic.
 */
export function RespaldoWhatsApp({
  entrada,
  sinServidor,
}: {
  entrada: SolicitudEntrada;
  sinServidor: boolean;
}) {
  return (
    <div role="alert" className="border-warning/40 bg-warning/10 rounded-md border px-4 py-4">
      <p className="mb-1 text-sm font-medium">
        {sinServidor ? "Termina de enviarlo por WhatsApp" : "No pudimos enviarlo desde aquí"}
      </p>
      <p className="text-fg-muted mb-3 text-sm leading-relaxed">
        {sinServidor
          ? "Esta versión de la tienda no recibe formularios. Tus datos todavía no nos llegan: ábrelos en WhatsApp, ya van escritos, y solo hay que darle enviar."
          : "La tienda no contestó y tus datos todavía no nos llegan. Mándalos por WhatsApp, ya van escritos, o vuelve a intentarlo en un momento."}
      </p>
      <Button asChild variant="whatsapp" size="touch" className="w-full">
        <a href={enlaceSolicitud(entrada)} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={16} aria-hidden />
          Enviar por WhatsApp
        </a>
      </Button>
    </div>
  );
}
