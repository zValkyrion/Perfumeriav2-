import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Revelar } from "./revelar";
import { TituloRevelado } from "./efectos";

/** Contenedor de página: 1400px, px-4 en móvil y px-8 en desktop (§6.3). */
export function Contenedor({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1400px] px-4 lg:px-8", className)}>
      {children}
    </div>
  );
}

/**
 * Sección con ritmo vertical. `denso` comprime el bloque: el §1.3 pide alternar
 * secciones densas con secciones amplias en vez de un `py-*` uniforme.
 */
export function Seccion({
  children,
  className,
  denso = false,
  id,
  revelar = false,
}: {
  children: ReactNode;
  className?: string;
  denso?: boolean;
  id?: string;
  /** Aparece al entrar en pantalla, una sola vez (§6.7). */
  revelar?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(denso ? "py-10 lg:py-14" : "py-14 lg:py-24", className)}
    >
      {revelar ? <Revelar>{children}</Revelar> : children}
    </section>
  );
}

/** Encabezado de sección: eyebrow + título serif + enlace opcional. */
export function TituloSeccion({
  eyebrow,
  titulo,
  descripcion,
  enlace,
  enlaceTexto = "Ver todos",
  className,
  revelado = false,
}: {
  eyebrow?: string;
  titulo: string;
  descripcion?: string;
  enlace?: string;
  enlaceTexto?: string;
  className?: string;
  /** Revela el título palabra por palabra tras una máscara. */
  revelado?: boolean;
}) {
  const claseTitulo =
    "font-display text-[26px] leading-[1.1] tracking-tight text-balance lg:text-[40px]";

  return (
    <div
      className={cn(
        "mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 lg:mb-10",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        {revelado ? (
          <TituloRevelado texto={titulo} className={claseTitulo} />
        ) : (
          <h2 className={claseTitulo}>{titulo}</h2>
        )}
        {descripcion ? (
          <p className="text-fg-muted mt-3 text-[15px] leading-relaxed lg:text-base">
            {descripcion}
          </p>
        ) : null}
      </div>

      {enlace ? (
        <Link
          href={enlace}
          className="text-gold-light hover:text-gold group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium"
        >
          {enlaceTexto}
          <ArrowRight
            size={15}
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      ) : null}
    </div>
  );
}

/** Filete dorado de 1px: separa sin recurrir a sombras (§6.4). */
export function FileteOro({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rule-gold h-px w-full", className)} />;
}
