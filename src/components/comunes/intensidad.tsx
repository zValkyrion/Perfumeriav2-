import { cn } from "@/lib/utils";
import { FAMILIA_POR_NOMBRE } from "@/data/taxonomia";
import type { FamiliaOlfativa } from "@/types";

/** Barra 1–5 de duración o proyección (§10.9). */
export function BarraIntensidad({
  etiqueta,
  valor,
  descripcion,
}: {
  etiqueta: string;
  valor: number;
  descripcion: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{etiqueta}</span>
        <span className="text-fg-subtle text-xs">{descripcion}</span>
      </div>
      <div
        className="flex gap-1.5"
        role="img"
        aria-label={`${etiqueta}: ${valor} de 5 — ${descripcion}`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              n <= valor ? "bg-gold-gradient" : "bg-surface-2",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Píldora de familia olfativa con su color característico. */
export function ChipFamilia({
  familia,
  className,
}: {
  familia: FamiliaOlfativa;
  className?: string;
}) {
  const info = FAMILIA_POR_NOMBRE.get(familia);

  return (
    <span
      className={cn(
        "border-border-strong inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{
          backgroundImage: info
            ? `linear-gradient(135deg, ${info.color}, ${info.color2})`
            : undefined,
        }}
      />
      {familia}
    </span>
  );
}
