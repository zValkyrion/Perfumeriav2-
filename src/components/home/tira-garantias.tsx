import { CreditCard, PackageCheck, RotateCcw, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Contenedor } from "@/components/comunes/layout";
import { GARANTIAS } from "@/data/contenido";

const ICONOS: Record<string, LucideIcon> = {
  sello: PackageCheck,
  camion: Truck,
  tarjeta: CreditCard,
  devolucion: RotateCcw,
};

/** Tira de garantías (§8.2). Scroll horizontal en móvil, cuatro columnas arriba. */
export function TiraGarantias() {
  return (
    <div className="border-border-soft border-y">
      <Contenedor>
        <ul className="snap-row -mx-4 gap-6 px-4 py-5 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-8 lg:px-0 lg:py-6">
          {GARANTIAS.map((g) => {
            const Icono = ICONOS[g.icono] ?? PackageCheck;
            return (
              <li
                key={g.titulo}
                className="flex w-[72%] shrink-0 items-start gap-3 sm:w-[46%] lg:w-auto"
              >
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
      </Contenedor>
    </div>
  );
}
