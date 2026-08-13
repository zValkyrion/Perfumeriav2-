import { MessageCircle } from "lucide-react";
import { MARCA } from "@/data/contenido";

/**
 * Botón flotante de WhatsApp (§7.5). En móvil sube por encima de la barra
 * inferior para no solaparse con ella.
 */
export function BotonWhatsApp() {
  return (
    <a
      href={MARCA.whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      className="group fixed right-4 bottom-20 z-30 flex size-14 items-center justify-center rounded-full bg-[#25D366] transition-transform hover:scale-105 md:bottom-6"
      aria-label={`Escríbenos por WhatsApp al ${MARCA.whatsapp}`}
    >
      <MessageCircle size={26} className="text-[#04310f]" aria-hidden />
      <span className="bg-surface-2 border-border-strong text-fg pointer-events-none absolute right-full mr-3 hidden rounded-full border px-3 py-1.5 text-xs whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 md:block">
        ¿Dudas? Escríbenos
      </span>
    </a>
  );
}
