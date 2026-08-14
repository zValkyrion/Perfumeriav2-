import Link from "next/link";
import { ChevronDown, ShieldCheck, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Imagen } from "@/components/comunes/imagen";
import { Contenedor } from "@/components/comunes/layout";
import { Precio } from "@/components/comunes/precio";
import { MARCA } from "@/data/contenido";
import { numero } from "@/lib/format";

/**
 * Hero (§8.1).
 *
 * Cumple la prueba de los 3 segundos del §1.2.1: en el primer pantallazo, sin
 * hacer scroll, se ve qué se vende, desde qué precio, por qué comprar aquí
 * (originales, envío gratis, +9,000 clientes) y una sola acción primaria.
 */
export function Hero({ precioDesde }: { precioDesde: number }) {
  return (
    <section className="grain zona-oscura relative isolate flex h-[85dvh] min-h-[560px] items-end overflow-hidden lg:h-[92dvh]">
      <div className="deriva-hero absolute inset-0 -z-10">
        <Imagen
          src="/hero.webp"
          alt="Frasco de perfume EL REY DE LOS PERFUMES iluminado sobre fondo negro"
          sizes="100vw"
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
      </div>

      {/* El contenido entra en cascada de arriba abajo: primero la promesa,
          luego el precio y al final la acción. Cada escalón son 90 ms. */}
      <Contenedor className="pb-16 lg:pb-24">
        <div className="max-w-xl">
          <p className="eyebrow animate-subir mb-4">Nueva colección</p>

          <h1
            style={{ animationDelay: "90ms" }}
            className="titular-audaz animate-subir"
          >
            El lujo tiene un aroma.
          </h1>

          <p
            style={{ animationDelay: "180ms" }}
            className="text-fg-muted animate-subir mt-4 max-w-md text-[15px] leading-relaxed lg:text-lg"
          >
            Calidad 1:1: la misma fragancia y el mismo frasco, a una fracción
            del precio. Menudeo y mayoreo desde 3 piezas.
          </p>

          {/* Señal de precio + prueba social, antes del primer scroll (§1.2.2) */}
          <div
            style={{ animationDelay: "270ms" }}
            className="animate-subir mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
          >
            <span className="text-fg">
              Desde{" "}
              <Precio
                valor={precioDesde}
                moneda
                className="text-gold-light font-medium"
              />
            </span>
            <span className="text-fg-muted inline-flex items-center gap-1.5">
              <Star size={14} className="fill-gold text-gold" aria-hidden />
              {MARCA.ratingGlobal} · +{numero(MARCA.clientes)} clientes
            </span>
          </div>

          <div
            style={{ animationDelay: "360ms" }}
            className="animate-subir mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <Button asChild variant="gold" size="touch-lg">
              <Link href="/catalogo">Comprar ahora</Link>
            </Button>
            <Button asChild variant="goldOutline" size="touch-lg">
              <Link href="/mayoreo">Precios de mayoreo</Link>
            </Button>
          </div>

          <ul
            style={{ animationDelay: "450ms" }}
            className="text-fg-muted animate-subir mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs"
          >
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-gold" aria-hidden />
              Calidad 1:1
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Truck size={14} className="text-gold" aria-hidden />
              Envío gratis desde 3 piezas
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden className="text-gold">
                ✦
              </span>
              6 meses sin intereses
            </li>
          </ul>
        </div>
      </Contenedor>

      <a
        href="#mas-vendidos"
        aria-label="Ver los más vendidos"
        className="text-fg-subtle hover:text-gold-light absolute bottom-5 left-1/2 hidden -translate-x-1/2 lg:block"
      >
        <ChevronDown size={26} className="animate-bounce motion-reduce:animate-none" aria-hidden />
      </a>
    </section>
  );
}
