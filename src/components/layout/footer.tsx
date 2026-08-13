import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Logo } from "@/components/comunes/logo";
import { Contenedor, FileteOro } from "@/components/comunes/layout";
import { Newsletter } from "./newsletter";
import {
  FOOTER_AYUDA,
  FOOTER_LEGAL,
  FOOTER_TIENDA,
  type EnlaceNav,
} from "@/data/navegacion";
import { MARCA, METODOS_PAGO, PAQUETERIAS } from "@/data/contenido";

function ListaEnlaces({ enlaces }: { enlaces: EnlaceNav[] }) {
  return (
    <ul className="space-y-0.5">
      {enlaces.map((e) => (
        <li key={e.href + e.label}>
          <Link
            href={e.href}
            className="text-fg-muted hover:text-gold-light flex min-h-9 items-center text-sm transition-colors"
          >
            {e.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Footer() {
  return (
    <footer className="border-border-soft mt-auto border-t">
      <Contenedor>
        {/* Escritorio: cuatro columnas */}
        <div className="hidden gap-10 py-16 lg:grid lg:grid-cols-[1.4fr_1fr_1fr_1.6fr]">
          <div>
            <Logo href={null} />
            <p className="text-fg-muted mt-4 max-w-xs text-sm leading-relaxed">
              {MARCA.tagline}
            </p>
            <div className="mt-5 flex gap-4">
              <Redes />
            </div>
          </div>

          <div>
            <p className="eyebrow mb-3">Tienda</p>
            <ListaEnlaces enlaces={FOOTER_TIENDA} />
          </div>

          <div>
            <p className="eyebrow mb-3">Ayuda</p>
            <ListaEnlaces enlaces={FOOTER_AYUDA} />
          </div>

          <div>
            <p className="eyebrow mb-3">Recibe ofertas</p>
            <Newsletter />
            <div className="mt-6">
              <ListaEnlaces enlaces={FOOTER_LEGAL} />
            </div>
          </div>
        </div>

        {/* Móvil: acordeones */}
        <div className="lg:hidden">
          <div className="py-8">
            <Logo href={null} />
            <p className="text-fg-muted mt-3 text-sm leading-relaxed">
              {MARCA.tagline}
            </p>
          </div>

          <Newsletter />

          <Accordion type="multiple" className="mt-6">
            <AccordionItem value="tienda" className="border-border-soft">
              <AccordionTrigger className="py-4 text-sm hover:no-underline">
                Tienda
              </AccordionTrigger>
              <AccordionContent>
                <ListaEnlaces enlaces={FOOTER_TIENDA} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="ayuda" className="border-border-soft">
              <AccordionTrigger className="py-4 text-sm hover:no-underline">
                Ayuda
              </AccordionTrigger>
              <AccordionContent>
                <ListaEnlaces enlaces={FOOTER_AYUDA} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="legal" className="border-border-soft">
              <AccordionTrigger className="py-4 text-sm hover:no-underline">
                Legal
              </AccordionTrigger>
              <AccordionContent>
                <ListaEnlaces enlaces={FOOTER_LEGAL} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex justify-center gap-6 py-7">
            <Redes />
          </div>
        </div>
      </Contenedor>

      <FileteOro className="opacity-40" />

      <Contenedor>
        <div className="flex flex-col items-center gap-4 py-6 text-center lg:flex-row lg:justify-between lg:text-left">
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
            {METODOS_PAGO.map((m) => (
              <span
                key={m}
                className="border-border-soft text-fg-subtle rounded border px-2 py-1 text-[10px] tracking-wide uppercase"
              >
                {m}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
            {PAQUETERIAS.map((p) => (
              <span
                key={p}
                className="border-border-soft text-fg-subtle rounded border px-2 py-1 text-[10px] tracking-wide uppercase"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <p className="text-fg-subtle border-border-soft border-t py-5 text-center text-xs">
          © 2026 {MARCA.nombre}. Todos los derechos reservados.
        </p>
      </Contenedor>
    </footer>
  );
}

function Redes() {
  const redes = [
    { nombre: "Instagram", href: MARCA.instagram },
    { nombre: "Facebook", href: MARCA.facebook },
    { nombre: "TikTok", href: MARCA.tiktok },
    { nombre: "WhatsApp", href: MARCA.whatsappLink },
  ];

  return (
    <>
      {redes.map((r) => (
        <a
          key={r.nombre}
          href={r.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-fg-muted hover:text-gold-light text-sm transition-colors"
        >
          {r.nombre}
        </a>
      ))}
    </>
  );
}
