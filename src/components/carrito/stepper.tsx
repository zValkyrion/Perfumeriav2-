"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Control de cantidad. Objetivos táctiles de 44px como mínimo (§6.5). */
export function Stepper({
  valor,
  onCambio,
  max = 99,
  min = 1,
  etiqueta,
  compacto = false,
}: {
  valor: number;
  onCambio: (n: number) => void;
  max?: number;
  min?: number;
  etiqueta: string;
  compacto?: boolean;
}) {
  const alto = compacto ? "h-9" : "h-11";
  const ancho = compacto ? "w-9" : "w-11";

  return (
    <div
      className={cn(
        "border-border-strong inline-flex items-center rounded-full border",
        alto,
      )}
    >
      <button
        type="button"
        onClick={() => onCambio(Math.max(min, valor - 1))}
        disabled={valor <= min}
        aria-label={`Quitar una unidad de ${etiqueta}`}
        className={cn(
          "text-fg-muted hover:text-fg grid h-full place-items-center rounded-l-full transition-colors disabled:opacity-30",
          ancho,
        )}
      >
        <Minus size={compacto ? 14 : 16} aria-hidden />
      </button>

      <span
        data-precio
        aria-live="polite"
        className={cn(
          "min-w-7 text-center font-medium",
          compacto ? "text-sm" : "text-[15px]",
        )}
      >
        {valor}
        <span className="sr-only"> unidades de {etiqueta}</span>
      </span>

      <button
        type="button"
        onClick={() => onCambio(Math.min(max, valor + 1))}
        disabled={valor >= max}
        aria-label={`Agregar una unidad de ${etiqueta}`}
        className={cn(
          "text-fg-muted hover:text-fg grid h-full place-items-center rounded-r-full transition-colors disabled:opacity-30",
          ancho,
        )}
      >
        <Plus size={compacto ? 14 : 16} aria-hidden />
      </button>
    </div>
  );
}
