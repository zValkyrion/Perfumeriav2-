import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Contenedor } from "./layout";

/** Plantilla de las páginas informativas y legales (§5). */
export function PaginaInfo({
  eyebrow,
  titulo,
  entrada,
  children,
  actualizado,
}: {
  eyebrow: string;
  titulo: string;
  entrada?: string;
  children: ReactNode;
  actualizado?: string;
}) {
  return (
    <Contenedor className="py-8 lg:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 lg:mb-12">
          <p className="eyebrow mb-2">{eyebrow}</p>
          <h1 className="font-display text-[32px] leading-[1.05] tracking-tight text-balance lg:text-[44px]">
            {titulo}
          </h1>
          {entrada ? (
            <p className="text-fg-muted mt-4 text-[15px] leading-relaxed lg:text-lg">
              {entrada}
            </p>
          ) : null}
        </header>

        <div className="space-y-8">{children}</div>

        {actualizado ? (
          <p className="border-border-soft text-fg-subtle mt-12 border-t pt-5 text-xs">
            Última actualización: {actualizado}
          </p>
        ) : null}

        <div className="border-border-soft mt-8 border-t pt-6">
          <Link
            href="/contacto"
            className="text-gold-light hover:text-gold group inline-flex items-center gap-1.5 text-sm font-medium"
          >
            ¿Te quedó una duda? Escríbenos
            <ArrowRight
              size={14}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </Contenedor>
  );
}

/** Bloque con título de sección dentro de una página informativa. */
export function Bloque({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display mb-3 text-xl leading-tight lg:text-2xl">
        {titulo}
      </h2>
      <div className="text-fg-muted space-y-3 text-[15px] leading-relaxed">
        {children}
      </div>
    </section>
  );
}
