"use client";

import Link from "next/link";
import { Imagen } from "@/components/comunes/imagen";

/**
 * Hero Panorámico Completo.
 *
 * Muestra el banner promocional oficial 3x2 abarcando todo el bloque
 * inicial de forma limpia y directa, siendo 100% clickeable hacia el catálogo.
 */
export function Hero({ precioDesde }: { precioDesde?: number } = {}) {
  return (
    <section className="relative isolate w-full overflow-hidden border-b border-border-soft bg-black">
      {/* Halo dorado sutil de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(201, 162, 39, 0.15), transparent 75%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1920px]">
        <Link
          href="/catalogo"
          className="group relative block w-full aspect-[21/9] sm:aspect-[2.4/1] md:aspect-[2.7/1] min-h-[220px] sm:min-h-[320px] md:min-h-[420px] lg:min-h-[500px] overflow-hidden bg-black cursor-pointer"
          title="Aprovechar 3x2 en Perfumes - Ir al Catálogo"
        >
          <Imagen
            src="/hero-promo-3x2.webp"
            alt="3x2 en Toda la Tienda en Perfumes - El Rey de los Perfumes - Llévate 3 artículos y paga solo 2"
            sizes="100vw"
            priority
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
          />
        </Link>
      </div>
    </section>
  );
}



