import type { Metadata } from "next";
import { Clock, Mail, MessageCircle } from "lucide-react";
import { Contenedor } from "@/components/comunes/layout";
import { FormularioContacto } from "@/components/comunes/formulario-contacto";
import { MARCA } from "@/data/contenido";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Escríbenos por WhatsApp o correo. Te contesta una persona, normalmente en menos de una hora.",
};

export default function ContactoPage() {
  return (
    <Contenedor className="py-8 lg:py-14">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 max-w-2xl lg:mb-12">
          <p className="eyebrow mb-2">Contacto</p>
          <h1 className="font-display text-[32px] leading-[1.05] tracking-tight text-balance lg:text-[44px]">
            Te atienden personas, no robots.
          </h1>
          <p className="text-fg-muted mt-4 text-[15px] leading-relaxed lg:text-lg">
            Si tu duda es rápida, WhatsApp es el camino más corto. Si prefieres
            dejarlo por escrito, el formulario llega al mismo equipo.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-12">
          <FormularioContacto />

          <aside className="space-y-3">
            <a
              href={MARCA.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border-soft bg-surface lift block rounded-lg border p-5"
            >
              <MessageCircle size={20} className="mb-2 text-[#25D366]" aria-hidden />
              <p className="font-medium">WhatsApp</p>
              <p className="text-gold-light mt-0.5 text-sm">{MARCA.whatsapp}</p>
              <p className="text-fg-subtle mt-1 text-xs">
                La vía más rápida. Respuesta típica en minutos.
              </p>
            </a>

            <a
              href={`mailto:${MARCA.correo}`}
              className="border-border-soft bg-surface lift block rounded-lg border p-5"
            >
              <Mail size={20} className="text-gold mb-2" aria-hidden />
              <p className="font-medium">Correo</p>
              <p className="text-gold-light mt-0.5 text-sm break-all">
                {MARCA.correo}
              </p>
              <p className="text-fg-subtle mt-1 text-xs">
                Para facturación y temas que requieren adjuntos.
              </p>
            </a>

            <div className="border-border-soft rounded-lg border p-5">
              <Clock size={20} className="text-gold mb-2" aria-hidden />
              <p className="font-medium">Horario</p>
              <p className="text-fg-muted mt-1 text-sm leading-relaxed">
                Lunes a viernes de 9:00 a 19:00
                <br />
                Sábados de 10:00 a 14:00
                <br />
                <span className="text-fg-subtle">Hora del centro de México</span>
              </p>
            </div>
          </aside>
        </div>
      </div>
    </Contenedor>
  );
}
