"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, MessageCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Logo } from "@/components/comunes/logo";
import { ToggleMayoreo } from "./toggle-mayoreo";
import { NAVEGACION } from "@/data/navegacion";
import { MARCA } from "@/data/contenido";
import { cn } from "@/lib/utils";

/** Navegación móvil: Sheet lateral a ancho completo con acordeones (§7.3). */
export function NavMovil() {
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        className="text-fg-muted hover:text-fg grid size-11 place-items-center rounded-full transition-colors lg:hidden"
      >
        <Menu size={22} aria-hidden />
      </button>

      <SheetContent
        side="left"
        className="bg-bg flex w-full flex-col gap-0 p-0 sm:max-w-sm"
      >
        <SheetHeader className="border-border-soft border-b px-4 py-4">
          <SheetTitle asChild>
            <div className="flex items-center">
              <Logo href={null} />
              <span className="sr-only">Menú de navegación</span>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="border-border-soft border-b px-4 py-4">
            <ToggleMayoreo />
          </div>

          <Accordion type="multiple" className="px-4">
            {NAVEGACION.map((seccion) =>
              seccion.grupos ? (
                <AccordionItem
                  key={seccion.label}
                  value={seccion.label}
                  className="border-border-soft"
                >
                  <AccordionTrigger className="py-4 text-[15px] font-medium hover:no-underline">
                    {seccion.label}
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    {seccion.grupos.map((grupo, i) => (
                      <div key={i} className="mb-3 last:mb-0">
                        {grupo.titulo.trim() ? (
                          <p className="eyebrow mb-2">{grupo.titulo}</p>
                        ) : null}
                        <ul>
                          {grupo.enlaces.map((e) => (
                            <li key={e.href + e.label}>
                              <Link
                                href={e.href}
                                onClick={cerrar}
                                className="text-fg-muted hover:text-gold-light flex min-h-11 items-center gap-2 text-[15px]"
                              >
                                {e.label}
                                {e.nota ? (
                                  <span className="text-fg-subtle text-[11px]">
                                    {e.nota}
                                  </span>
                                ) : null}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ) : (
                <div
                  key={seccion.label}
                  className="border-border-soft border-b last:border-b-0"
                >
                  <Link
                    href={seccion.href}
                    onClick={cerrar}
                    className={cn(
                      "flex min-h-14 items-center text-[15px] font-medium",
                      seccion.destacado
                        ? "text-gold-light uppercase"
                        : "text-fg",
                    )}
                  >
                    {seccion.label}
                  </Link>
                </div>
              ),
            )}
          </Accordion>
        </div>

        <div className="border-border-soft space-y-3 border-t px-4 py-4">
          <a
            href={MARCA.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-medium text-[#04310f]"
          >
            <MessageCircle size={18} aria-hidden />
            WhatsApp {MARCA.whatsapp}
          </a>
          <div className="text-fg-subtle flex items-center justify-center gap-5 text-xs">
            <a href={MARCA.instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
            <a href={MARCA.facebook} target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
            <a href={MARCA.tiktok} target="_blank" rel="noopener noreferrer">
              TikTok
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
