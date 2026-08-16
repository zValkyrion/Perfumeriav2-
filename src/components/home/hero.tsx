"use client";

import Link from "next/link";
import { Imagen } from "@/components/comunes/imagen";

/**
 * Hero Panorámico Completo.
 *
 * Muestra el banner de la paca de 50 piezas abarcando todo el bloque inicial y
 * siendo 100% clickeable hacia los lotes. El arte se genera con
 * `npm run banner-paca`; si se cambia el precio hay que regenerarlo, porque la
 * cifra va dibujada dentro de la imagen.
 */
export function Hero() {
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
          href="/lotes"
          className="group relative block w-full aspect-[21/9] sm:aspect-[2.4/1] md:aspect-[2.7/1] min-h-[220px] sm:min-h-[320px] md:min-h-[420px] lg:min-h-[500px] overflow-hidden bg-black cursor-pointer"
          title="Paca de 50 perfumes por $19,999 MXN - Ver paquetes de mayoreo"
        >
          <Imagen
            src="/banner-paca-50.webp"
            alt="Paca de mayoreo: 50 perfumes por $19,999 MXN, envío gratis y entrega inmediata - El Rey de los Perfumes"
            sizes="100vw"
            priority
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.01]"
          />
        </Link>
      </div>
    </section>
  );
}



