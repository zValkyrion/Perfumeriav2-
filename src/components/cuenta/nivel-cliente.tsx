import { NIVELES, nivelDe } from "@/data/cuenta";
import { cn } from "@/lib/utils";

/** Nivel de cliente gamificado (§13). */
export function NivelCliente({ piezas }: { piezas: number }) {
  const { actual, siguiente, progreso, faltan } = nivelDe(piezas);

  return (
    <div className="border-border-soft bg-surface rounded-lg border p-5 lg:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Tu nivel</p>
          <p className="font-display text-gold-gradient text-3xl leading-none">
            {actual.nombre}
          </p>
        </div>
        <p className="text-fg-muted text-sm">
          <span data-precio className="text-fg font-medium">
            {piezas}
          </span>{" "}
          piezas compradas
        </p>
      </div>

      <div
        className="bg-surface-2 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progreso * 100)}
        aria-label={
          siguiente
            ? `Progreso hacia el nivel ${siguiente.nombre}`
            : "Nivel máximo alcanzado"
        }
      >
        <div
          className="bg-gold-gradient h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.max(4, progreso * 100)}%` }}
        />
      </div>

      <ol className="mt-3 flex justify-between">
        {NIVELES.map((n) => {
          const alcanzado = piezas >= n.desde;
          return (
            <li
              key={n.nombre}
              className={cn(
                "text-center text-[11px]",
                alcanzado ? "text-gold-light" : "text-fg-subtle",
              )}
            >
              <span className="block font-medium">{n.nombre}</span>
              <span data-precio>{n.desde}+</span>
            </li>
          );
        })}
      </ol>

      <p className="border-border-soft text-fg-muted mt-4 border-t pt-4 text-sm leading-relaxed">
        {siguiente ? (
          <>
            Te faltan{" "}
            <strong className="text-gold-light font-medium">
              {faltan} piezas
            </strong>{" "}
            para {siguiente.nombre}: {siguiente.beneficio.toLowerCase()}.
          </>
        ) : (
          <>
            Estás en el nivel máximo: {actual.beneficio.toLowerCase()}.
          </>
        )}
      </p>
    </div>
  );
}
