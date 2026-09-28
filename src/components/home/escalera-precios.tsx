import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Contenedor, TituloSeccion } from "@/components/comunes/layout";
import { precio } from "@/lib/format";
import {
  COSTO_ENVIO_ESTANDAR,
  DESCUENTO_MAXIMO,
  DESCUENTO_TRANSFERENCIA,
  ESCALONES,
  PIEZAS_ENVIO_GRATIS,
  pct,
} from "@/lib/volumen";
import { cn } from "@/lib/utils";

/**
 * La escalera de precios, en la portada.
 *
 * Ocupa el sitio de la prueba social que había (videos, reseñas y «+1,500
 * clientes»), que era inventada. Lo que se enseña aquí sí es un hecho: son las
 * mismas reglas con las que cobran el carrito y el servidor
 * (`compartido/reglas.ts`), así que si cambia un porcentaje este bloque cambia
 * con él y no puede prometer otra cosa que la que se cobra.
 */
export function EscaleraPrecios() {
  return (
    <Contenedor>
      <TituloSeccion
        centrado
        eyebrow="Así baja tu precio"
        titulo="MAYOREO AUTOMÁTICO"
        descripcion="El descuento se calcula con el total de perfumes sueltos del pedido: mezcla los modelos y presentaciones que quieras."
      />

      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {ESCALONES.map((e) => {
          const conDescuento = e.descuento > 0;
          return (
            <li
              key={e.nombre}
              className={cn(
                "bg-surface flex flex-col rounded-md border p-4 text-center lg:p-5",
                conDescuento ? "border-gold/35" : "border-border-soft",
              )}
            >
              <p className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                {e.max === null ? `${e.min} o más` : `${e.min} a ${e.max}`} piezas
              </p>
              <p
                data-precio
                className={cn(
                  "font-display mt-2 text-3xl leading-none font-extrabold lg:text-4xl",
                  conDescuento ? "text-gold-gradient" : "text-fg",
                )}
              >
                {conDescuento ? `−${pct(e.descuento)}%` : "Lista"}
              </p>
              <p className="mt-2 text-sm font-semibold">{e.nombre}</p>
              <p className="text-fg-muted mt-1 text-[12px]">
                {e.min >= PIEZAS_ENVIO_GRATIS
                  ? "Envío gratis"
                  : `Envío ${precio(COSTO_ENVIO_ESTANDAR)}`}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="text-fg-muted mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed">
        Pagando por depósito o transferencia bajas {pct(DESCUENTO_TRANSFERENCIA)}%
        más sobre el precio de lista, hasta {pct(DESCUENTO_MAXIMO)}% en total.
        Los paquetes armados tienen su propio precio.
      </p>

      <div className="mt-4 text-center">
        <Link
          href="/mayoreo"
          className="text-gold-light hover:text-gold group inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
        >
          Cómo funciona el mayoreo
          <ArrowRight
            size={15}
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </Contenedor>
  );
}
