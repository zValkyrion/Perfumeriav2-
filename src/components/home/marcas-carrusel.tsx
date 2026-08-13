import Link from "next/link";
import { MARCAS } from "@/data/marcas";

/**
 * Carrusel infinito de marcas (§8.12). Los "logos" son wordmarks tipográficos
 * reales, no imágenes: pesan cero, escalan y evitan el look de logo de stock.
 */
export function MarcasCarrusel() {
  const tira = [...MARCAS, ...MARCAS];

  return (
    <div className="group relative overflow-hidden">
      {/* Difuminado en los extremos para que la tira no "corte" en seco */}
      <div
        aria-hidden
        className="from-bg pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r to-transparent lg:w-32"
      />
      <div
        aria-hidden
        className="from-bg pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l to-transparent lg:w-32"
      />

      <div className="flex w-max">
        {[0, 1].map((copia) => (
          <ul
            key={copia}
            aria-hidden={copia === 1}
            className="animate-marquee flex items-center group-hover:[animation-play-state:paused]"
          >
            {tira.map((m, i) => (
              <li key={`${copia}-${m.slug}-${i}`} className="px-6 lg:px-10">
                <Link
                  href={`/marca/${m.slug}`}
                  tabIndex={copia === 1 ? -1 : undefined}
                  className="font-display text-fg-subtle hover:text-gold-light text-xl whitespace-nowrap transition-colors lg:text-2xl"
                >
                  {m.nombre}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
