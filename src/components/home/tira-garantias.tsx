"use client";

import { CreditCard, PackageCheck, RotateCcw, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Contenedor } from "@/components/comunes/layout";
import { GARANTIAS } from "@/data/contenido";

const ICONOS: Record<string, LucideIcon> = {
  sello: PackageCheck,
  camion: Truck,
  tarjeta: CreditCard,
  devolucion: RotateCcw,
};

/** Tira de garantías (§8.2). Carrusel automático en móvil, cuatro columnas en escritorio. */
export function TiraGarantias() {
  return (
    <div className="border-border-soft border-y overflow-hidden">
      <Contenedor>
        {/* En escritorio: 4 columnas fijas */}
        <ul className="hidden lg:grid lg:grid-cols-4 lg:gap-8 lg:py-6">
          {GARANTIAS.map((g) => {
            const Icono = ICONOS[g.icono] ?? PackageCheck;
            return (
              <li key={g.titulo} className="flex items-start gap-3">
                <Icono
                  size={20}
                  aria-hidden
                  className="text-gold mt-0.5 shrink-0"
                  strokeWidth={1.6}
                />
                <div>
                  <p className="text-[13px] font-medium">{g.titulo}</p>
                  <p className="text-fg-subtle mt-0.5 text-xs leading-snug">
                    {g.texto}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* En móvil: carrusel con movimiento automático (Autoplay) */}
        <div className="py-4 lg:hidden">
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            plugins={[
              Autoplay({
                delay: 2500,
                stopOnInteraction: false,
              }),
            ]}
            className="w-full"
          >
            <CarouselContent className="-ml-3">
              {GARANTIAS.map((g) => {
                const Icono = ICONOS[g.icono] ?? PackageCheck;
                return (
                  <CarouselItem
                    key={g.titulo}
                    className="basis-[82%] sm:basis-[50%] pl-3"
                  >
                    <div className="border-border-soft/60 bg-surface/50 flex items-start gap-3 rounded-lg border p-3">
                      <Icono
                        size={20}
                        aria-hidden
                        className="text-gold mt-0.5 shrink-0"
                        strokeWidth={1.6}
                      />
                      <div>
                        <p className="text-[13px] font-medium">{g.titulo}</p>
                        <p className="text-fg-subtle mt-0.5 text-xs leading-snug">
                          {g.texto}
                        </p>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
        </div>
      </Contenedor>
    </div>
  );
}
