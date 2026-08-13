"use client";

import { useTienda } from "@/store/tienda";
import { cn } from "@/lib/utils";

/**
 * Interruptor "Modo Mayoreo" (§7.2). Cambia los precios de todo el sitio al
 * precio del primer escalón de mayoreo y persiste en localStorage.
 */
export function ToggleMayoreo({ compacto = false }: { compacto?: boolean }) {
  const activo = useTienda((s) => s.modoMayoreo);
  const setModo = useTienda((s) => s.setModoMayoreo);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => setModo(!activo)}
      className={cn(
        "group flex items-center gap-2.5 rounded-full transition-colors",
        compacto ? "h-11 px-2" : "h-11 w-full justify-between px-1",
      )}
    >
      <span className="flex flex-col items-start leading-tight">
        <span
          className={cn(
            "text-[13px] font-medium transition-colors",
            activo ? "text-gold-light" : "text-fg-muted group-hover:text-fg",
          )}
        >
          Modo mayoreo
        </span>
        {!compacto ? (
          <span className="text-fg-subtle text-[11px]">
            {activo ? "Viendo precios desde 3 piezas" : "Ver precios desde 3 piezas"}
          </span>
        ) : null}
      </span>

      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          activo
            ? "bg-gold-gradient border-transparent"
            : "border-border-strong bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-[left] duration-200",
            activo ? "bg-bg left-[26px]" : "bg-fg-subtle left-[3px]",
          )}
        />
      </span>
    </button>
  );
}
