"use client";

import { DIAS_HORARIO, HORAS } from "@/data/catalogo";
import { Campo, Selector } from "@/components/ui";
import type { Horario } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/**
 * Horario en tres piezas: días, apertura y cierre.
 *
 * Antes era un campo de texto y por eso no servía para nada más que leerlo:
 * "L-S 9 a 6", "lunes a sábado de 9:00 a 18:00" y "9-6" son el mismo horario y
 * tres valores distintos para la base de datos — imposible filtrar "quién abre
 * los domingos". La nota libre sigue ahí para lo que el molde no captura:
 * comidas, domingos alternos, "cierra en temporada baja".
 */
export function SelectorHorario({
  horario,
  onChange,
}: {
  horario: Horario;
  onChange: (h: Horario) => void;
}) {
  const horas = HORAS.map((h) => ({ valor: h, etiqueta: h }));

  return (
    <div>
      <span className="mb-2 block text-[13px] font-medium text-fg-muted">Horario</span>

      <div className="flex flex-wrap gap-2">
        {DIAS_HORARIO.map((d) => {
          const activo = horario.dias === d.valor;
          return (
            <button
              key={d.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange({ ...horario, dias: activo ? null : d.valor })}
              className={cn(
                "min-h-11 rounded-full border px-4 text-[14px] font-medium",
                activo
                  ? "border-gold-deep bg-gold-gradient text-white"
                  : "border-border-strong bg-surface text-fg-muted",
              )}
            >
              {d.etiqueta}
            </button>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <Selector
          etiqueta="Abre"
          opciones={horas}
          valor={horario.abre}
          onChange={(v) => onChange({ ...horario, abre: v })}
        />
        <Selector
          etiqueta="Cierra"
          opciones={horas}
          valor={horario.cierra}
          onChange={(v) => onChange({ ...horario, cierra: v })}
        />
      </div>

      <div className="mt-2">
        <Campo
          etiqueta="Nota del horario"
          placeholder="Cierra 2–4, domingos alternos…"
          value={horario.nota}
          onChange={(e) => onChange({ ...horario, nota: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Cómo se lee un horario ya guardado. */
export function textoHorario(h: Horario): string {
  const dias = DIAS_HORARIO.find((d) => d.valor === h.dias)?.etiqueta;
  const franja = h.abre && h.cierra ? `${h.abre}–${h.cierra}` : h.abre ? `desde ${h.abre}` : "";
  const partes = [dias, franja].filter(Boolean).join(" ");
  if (partes && h.nota) return `${partes} · ${h.nota}`;
  return partes || h.nota || "";
}
