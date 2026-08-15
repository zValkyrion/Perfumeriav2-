import { MessageCircle, RotateCcw, Truck } from "lucide-react";
import { Contenedor } from "@/components/comunes/layout";

const VALORES = [
  {
    icono: RotateCcw,
    titulo: "Devoluciones / Cambios",
    texto: "En todos nuestros productos para garantizar tu satisfacción.",
  },
  {
    icono: MessageCircle,
    titulo: "Soporte de primer nivel",
    texto: "Por personas, NO por robots.",
  },
  {
    icono: Truck,
    titulo: "¡Envíos GRATIS!",
    texto: "A partir de 3 perfumes.",
  },
];

/**
 * Barra de confianza.
 *
 * Icono grande a la izquierda y texto a la derecha, en fila: es el patrón de
 * tira de garantías de una tienda de volumen, más compacto que tres tarjetas
 * apiladas y pensado para leerse de una pasada.
 */
export function ValoresClave() {
  return (
    <Contenedor>
      <ul className="grid gap-7 sm:grid-cols-3 sm:gap-6 lg:gap-12">
        {VALORES.map((v, i) => {
          const Icono = v.icono;
          return (
            <li
              key={v.titulo}
              style={{ animationDelay: `${i * 110}ms` }}
              className="animate-subir flex items-start gap-4"
            >
              <Icono
                size={38}
                className="text-fg mt-0.5 shrink-0"
                strokeWidth={1.4}
                aria-hidden
              />
              <div>
                <h3 className="text-[15px] font-bold">{v.titulo}</h3>
                <p className="text-fg-muted mt-1 text-sm leading-relaxed">
                  {v.texto}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Contenedor>
  );
}
