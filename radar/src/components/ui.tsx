"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/* Primitivas de la app de campo. Todas cumplen la misma regla: nada por debajo
   de 48px de alto táctil. Se usa de pie, en la calle, con una sola mano. */

export function Tarjeta({
  titulo,
  pista,
  children,
  className,
}: {
  titulo?: string;
  pista?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius)] border border-border-soft bg-surface p-4",
        className,
      )}
    >
      {titulo && (
        <header className="mb-3">
          <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>
          <span aria-hidden className="rule-gold mt-1.5 block h-px w-10" />
          {pista && <p className="mt-0.5 text-[13px] text-fg-subtle">{pista}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Campo({
  etiqueta,
  pista,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; pista?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[13px] font-medium text-fg-muted">
        {etiqueta}
      </span>
      <input
        {...props}
        className="h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 text-fg placeholder:text-fg-subtle"
      />
      {pista && <span className="mt-1 block text-[12px] text-fg-subtle">{pista}</span>}
    </label>
  );
}

export function AreaTexto({
  etiqueta,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { etiqueta: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-fg-muted">
        {etiqueta}
      </span>
      <textarea
        {...props}
        rows={3}
        className="w-full rounded-[var(--radius-md)] border border-border-strong bg-surface p-3 text-fg placeholder:text-fg-subtle"
      />
    </label>
  );
}

/** Selección por chips. Un tap, sin desplegables: los `select` nativos en móvil
    tapan la pantalla y obligan a un segundo tap para confirmar. */
export function Chips<T extends string>({
  etiqueta,
  opciones,
  valor,
  onChange,
}: {
  etiqueta: string;
  opciones: { valor: T; etiqueta: string }[];
  valor: T | T[] | null;
  /** Alternar o fijar: quien llama decide, según reciba un valor o una lista. */
  onChange: (v: T) => void;
}) {
  const activo = (v: T) => (Array.isArray(valor) ? valor.includes(v) : valor === v);
  return (
    <div>
      <span className="mb-2 block text-[13px] font-medium text-fg-muted">
        {etiqueta}
      </span>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo(o.valor)}
            onClick={() => onChange(o.valor)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-[14px] font-medium transition-colors",
              activo(o.valor)
                ? "border-gold-deep bg-gold-gradient text-white"
                : "border-border-strong bg-surface text-fg-muted",
            )}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Deslizador con estado "sin preguntar".
 *
 * `null` no es un valor bajo, es la ausencia de respuesta. Mientras no se toque,
 * el control se ve apagado y marca "—": así, al repasar la ficha en el hotel, se
 * distingue de un golpe de vista lo que se preguntó y salió mal de lo que
 * sencillamente no se preguntó.
 */
export function Deslizador({
  etiqueta,
  valor,
  min = 1,
  max = 5,
  paso = 1,
  sufijo = "",
  porDefecto,
  leyendas,
  onChange,
}: {
  etiqueta: string;
  valor: number | null;
  min?: number;
  max?: number;
  paso?: number;
  sufijo?: string;
  /** Valor al que salta la primera vez que se toca. Por defecto, el punto medio. */
  porDefecto?: number;
  leyendas?: [string, string];
  onChange: (v: number | null) => void;
}) {
  const inicial = porDefecto ?? Math.round((min + max) / 2);
  const sinDato = valor === null;

  return (
    <div className="py-1">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium">{etiqueta}</span>
        {sinDato ? (
          <button
            type="button"
            onClick={() => onChange(inicial)}
            className="min-h-9 rounded-full border border-border-strong px-3 text-[13px] font-medium text-fg-subtle"
          >
            Sin preguntar
          </button>
        ) : (
          <span className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tabular-nums text-gold">
              {valor}
              {sufijo}
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Borrar respuesta de ${etiqueta}`}
              className="min-h-9 px-1 text-[13px] text-fg-subtle underline"
            >
              borrar
            </button>
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor ?? inicial}
        aria-label={etiqueta}
        className={cn(sinDato && "opacity-40")}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {leyendas && (
        <div className="flex justify-between text-[12px] text-fg-subtle">
          <span>{leyendas[0]}</span>
          <span>{leyendas[1]}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Sí / No / sin preguntar.
 *
 * Sustituye al interruptor de dos estados, que obligaba a mentir: dejarlo
 * apagado decía "no tiene permisos" cuando la verdad era "no se lo preguntamos".
 */
export function Ternario({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const opciones: { v: boolean | null; texto: string; activo: string }[] = [
    { v: true, texto: "Sí", activo: "border-success bg-success text-white" },
    { v: false, texto: "No", activo: "border-danger bg-danger text-white" },
    { v: null, texto: "—", activo: "border-border-strong bg-surface-2 text-fg-muted" },
  ];

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 text-[14px]">{etiqueta}</span>
      <div
        role="radiogroup"
        aria-label={etiqueta}
        className="flex shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border-strong"
      >
        {opciones.map((o) => {
          const activo = valor === o.v;
          return (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={activo}
              aria-label={o.v === null ? "Sin preguntar" : o.texto}
              onClick={() => onChange(o.v)}
              className={cn(
                "min-h-11 w-12 border-l text-[14px] font-semibold first:border-l-0",
                activo ? o.activo : "border-border-strong bg-surface text-fg-subtle",
              )}
            >
              {o.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Boton({
  variante = "primario",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "peligro";
}) {
  const estilos = {
    primario: "bg-gold-gradient text-white border-gold-deep",
    secundario: "bg-surface text-fg border-border-strong",
    peligro: "bg-surface text-danger border-danger",
  }[variante];
  return (
    <button
      {...props}
      className={cn(
        "lift inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 text-[15px] font-semibold disabled:opacity-50",
        estilos,
        className,
      )}
    />
  );
}

export function Insignia({
  children,
  color = "var(--color-fg-muted)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

/**
 * Selección con puerta abierta.
 *
 * Cierra el vocabulario para lo que se repite —cargos, países, casas de
 * esencia— sin obligar a nadie a mentir: "Otro" abre un campo de texto y dejarlo
 * vacío sigue siendo válido. Forzar una opción en la calle produce datos peores
 * que un hueco honesto, porque quien no encuentra la suya elige la más parecida
 * y ese error ya no se detecta nunca.
 */
export function SelectorAbierto({
  etiqueta,
  opciones,
  valor,
  onChange,
  placeholder = "Escríbelo",
  pista,
}: {
  etiqueta: string;
  opciones: string[];
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  pista?: string;
}) {
  const esOtro = valor.trim() !== "" && !opciones.includes(valor);
  const [otroAbierto, setOtroAbierto] = useState(false);
  const mostrarTexto = esOtro || otroAbierto;

  return (
    <div>
      <span className="mb-2 block text-[13px] font-medium text-fg-muted">{etiqueta}</span>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activo = valor === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={activo}
              onClick={() => {
                setOtroAbierto(false);
                // Volver a tocar la opción activa la quita: sin esto no habría
                // forma de dejar el campo en blanco después de elegir.
                onChange(activo ? "" : o);
              }}
              className={cn(
                "min-h-11 rounded-full border px-4 text-[14px] font-medium",
                activo
                  ? "border-gold-deep bg-gold-gradient text-white"
                  : "border-border-strong bg-surface text-fg-muted",
              )}
            >
              {o}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={mostrarTexto}
          onClick={() => {
            if (mostrarTexto) {
              setOtroAbierto(false);
              onChange("");
            } else {
              setOtroAbierto(true);
            }
          }}
          className={cn(
            "min-h-11 rounded-full border px-4 text-[14px] font-medium",
            mostrarTexto
              ? "border-gold-deep bg-gold-gradient text-white"
              : "border-border-strong bg-surface text-fg-muted",
          )}
        >
          Otro
        </button>
      </div>

      {mostrarTexto && (
        <input
          value={esOtro ? valor : ""}
          placeholder={placeholder}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 text-fg placeholder:text-fg-subtle"
        />
      )}
      {pista && <span className="mt-1 block text-[12px] text-fg-subtle">{pista}</span>}
    </div>
  );
}

/** Desplegable nativo: para listas largas (horas, ladas) gana al chip. */
export function Selector({
  etiqueta,
  opciones,
  valor,
  onChange,
  vacio = "—",
  className,
}: {
  etiqueta: string;
  opciones: { valor: string; etiqueta: string }[];
  valor: string | null;
  onChange: (v: string | null) => void;
  vacio?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[13px] font-medium text-fg-muted">{etiqueta}</span>
      <select
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className="h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface px-2 text-fg"
      >
        <option value="">{vacio}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}
