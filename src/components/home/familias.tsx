import Link from "next/link";
import { FAMILIAS } from "@/data/taxonomia";

/**
 * Explora por familia olfativa (§8.7). Cada familia tiene su propio degradado
 * característico —el único color fuera de la paleta de marca, y solo aquí.
 */
export function Familias({ conteos }: { conteos: Record<string, number> }) {
  return (
    <div className="snap-row -mx-4 gap-4 px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-9 lg:gap-4 lg:px-0">
      {FAMILIAS.map((f) => (
        <Link
          key={f.slug}
          href={`/catalogo?familia=${encodeURIComponent(f.nombre)}`}
          className="group flex w-20 shrink-0 flex-col items-center gap-2.5 text-center lg:w-auto"
        >
          <span
            aria-hidden
            className="border-border-soft grid size-20 shrink-0 place-items-center rounded-full border transition-transform duration-300 group-hover:scale-105 lg:size-full lg:aspect-square lg:h-auto"
            style={{
              backgroundImage: `radial-gradient(circle at 32% 28%, ${f.color}, ${f.color2} 72%)`,
            }}
          >
            <span className="font-display text-2xl text-black/45">
              {f.nombre.charAt(0)}
            </span>
          </span>

          <span className="leading-tight">
            <span className="group-hover:text-gold-light block text-[13px] transition-colors">
              {f.nombre}
            </span>
            <span className="text-fg-subtle block text-[11px]">
              {conteos[f.nombre] ?? 0}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
