"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Piezas de diseño del panel de la tienda: el encabezado de cada página, las
 * tarjetas con título, los indicadores y el control segmentado. Todo con los
 * tokens de `globals.css`, pensado para leerse igual en un teléfono que en una
 * pantalla de escritorio.
 */

/** Título de la página, con regreso opcional y acciones a la derecha. */
export function EncabezadoPagina({
  titulo,
  subtitulo,
  volver,
  acciones,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  volver?: { href: string; texto: string };
  acciones?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {volver && (
          <Link
            href={volver.href}
            className="mb-1 inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-fg-subtle hover:text-fg"
          >
            <ArrowLeft size={15} />
            {volver.texto}
          </Link>
        )}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-[14px] text-fg-subtle">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex w-full items-center gap-2 sm:w-auto">{acciones}</div>}
    </header>
  );
}

/** Tarjeta de sección: título, acción opcional («Ver todo») y contenido. */
export function Panel({
  titulo,
  subtitulo,
  accion,
  children,
  className,
  sinRelleno = false,
}: {
  titulo?: React.ReactNode;
  subtitulo?: React.ReactNode;
  accion?: { href: string; texto: string } | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Para tablas que van de borde a borde. */
  sinRelleno?: boolean;
}) {
  const esEnlace = accion && typeof accion === "object" && "href" in (accion as object);
  return (
    <section className={cn("tarjeta-panel flex min-w-0 flex-col", className)}>
      {(titulo || accion) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
          <div className="min-w-0">
            {titulo && <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>}
            {subtitulo && <p className="mt-0.5 text-[13px] text-fg-subtle">{subtitulo}</p>}
          </div>
          {esEnlace ? (
            <Link
              href={(accion as { href: string }).href}
              className="inline-flex min-h-9 shrink-0 items-center gap-0.5 text-[13px] font-semibold text-info hover:underline"
            >
              {(accion as { texto: string }).texto}
              <ChevronRight size={15} />
            </Link>
          ) : (
            (accion as React.ReactNode)
          )}
        </header>
      )}
      <div className={cn("min-w-0 flex-1", sinRelleno ? "pt-3" : "p-4 sm:px-5")}>{children}</div>
    </section>
  );
}

/** Un indicador: etiqueta, cifra grande, variación y un detalle opcional. */
export function Indicador({
  etiqueta,
  valor,
  icono,
  variacion,
  detalle,
  extra,
  href,
  destacado = false,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  icono?: React.ReactNode;
  variacion?: React.ReactNode;
  detalle?: React.ReactNode;
  /** Algo pequeño a la derecha de la cifra (p. ej. una sparkline). */
  extra?: React.ReactNode;
  href?: string;
  destacado?: boolean;
}) {
  const cuerpo = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-fg-muted">{etiqueta}</span>
        {icono && (
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full",
              destacado ? "bg-gold-muted text-gold" : "bg-surface-2 text-fg-subtle",
            )}
          >
            {icono}
          </span>
        )}
      </span>
      <span className="mt-2 flex items-end justify-between gap-2">
        <span className="cifra block min-w-0 truncate text-[22px] font-bold leading-none text-fg sm:text-[26px]">{valor}</span>
        {extra && <span className="shrink-0">{extra}</span>}
      </span>
      {(variacion || detalle) && (
        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-subtle">
          {variacion}
          {detalle && <span className="min-w-0">{detalle}</span>}
        </span>
      )}
    </>
  );
  const clases = cn(
    "tarjeta-panel block p-4",
    href && "lift",
    destacado && "border-gold/40",
  );
  return href ? (
    <Link href={href} className={clases}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clases}>{cuerpo}</div>
  );
}

/** Control segmentado (periodo, vista). Un toque, sin desplegables. */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  className,
}: {
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={cn("inline-flex rounded-[var(--radius-md)] bg-surface-2 p-1", className)}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          aria-pressed={valor === o.valor}
          className={cn(
            "min-h-9 flex-1 whitespace-nowrap rounded-[var(--radius-sm)] px-3 text-[13px] font-semibold transition-colors",
            valor === o.valor ? "bg-surface text-fg shadow-sm" : "text-fg-subtle hover:text-fg",
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

/** Botón secundario compacto para encabezados (recargar, exportar). */
export function BotonIcono({
  etiqueta,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { etiqueta: string }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      {...props}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-[var(--radius-md)] border border-border-strong bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Esqueleto mientras carga: bloques grises del tamaño de lo que viene. */
export function Esqueleto({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-[var(--radius-md)] bg-surface-2", className)} />;
}
