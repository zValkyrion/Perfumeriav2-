import Link from "next/link";
import { FAMILIAS } from "@/data/taxonomia";

/**
 * Explora por familia olfativa (§8.7).
 *
 * Cada familia tiene su propio degradado —el único color fuera de la paleta de
 * marca, y solo aquí—. La sección tiene tres gestos propios que no se repiten
 * en ninguna otra: las esferas respiran con desfase, al señalar una las demás
 * se apagan, y aparece la descripción de la familia sin mover el layout.
 */
export function Familias({ conteos }: { conteos: Record<string, number> }) {
  return (
    <div className="foco-grupo snap-row -mx-4 flex gap-4 px-4 pt-2 pb-1 lg:mx-0 lg:grid lg:grid-cols-9 lg:gap-4 lg:overflow-visible lg:px-0">
      {FAMILIAS.map((f, i) => (
        <Link
          key={f.slug}
          href={`/catalogo/${f.slug}`}
          // El texto accesible dice a qué huele la familia, no solo su nombre:
          // sirve al lector de pantalla y también le dice al buscador de qué
          // trata la página del otro lado del enlace.
          aria-label={`${f.titulo}: ${f.descripcion}`}
          className="group/fam relative flex w-20 shrink-0 flex-col items-center gap-2.5 text-center hover:z-10 lg:w-full"
        >
          {/* Ficha de la familia: sale del flujo para no empujar la fila */}
          <span
            aria-hidden
            className="border-border-strong bg-surface-2 text-fg-muted pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 hidden w-52 -translate-x-1/2 translate-y-1 rounded-md border px-3 py-2.5 text-[12px] leading-snug opacity-0 transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/fam:translate-y-0 group-hover/fam:opacity-100 lg:block"
          >
            {f.descripcion}
          </span>

          {/* La esfera flota con un desfase por índice: la fila entera respira
              en vez de quedarse quieta, sin que nada llame la atención. */}
          <span
            aria-hidden
            style={{ animationDelay: `${i * 420}ms` }}
            className="animate-flotar grid aspect-square w-20 place-items-center rounded-full transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/fam:scale-110 lg:w-full"
          >
            <span
              className="grid size-full place-items-center rounded-full ring-0 ring-white/0 transition-[box-shadow] duration-300 group-hover/fam:ring-2 group-hover/fam:ring-white/20"
              style={{
                backgroundImage: `radial-gradient(circle at 32% 28%, ${f.color}, ${f.color2} 72%)`,
              }}
            >
              <span className="font-display text-2xl text-black/45">
                {f.nombre.charAt(0)}
              </span>
            </span>
          </span>

          <span className="leading-tight">
            <span className="group-hover/fam:text-gold-light block text-[13px] transition-colors">
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
