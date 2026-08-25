"use client";

import { useRef, useState } from "react";
import { Imagen } from "@/components/comunes/imagen";
import { cn } from "@/lib/utils";

/**
 * Galería de la ficha.
 *
 * En escritorio las fotos van **en columna, una debajo de otra**, y no como una
 * imagen grande con miniaturas al lado. Es lo que hace que el bloque de compra
 * —fijo a su derecha— tenga por dónde correr, y de paso enseña las cuatro fotos
 * a quien baja por la ficha en vez de esperar a que las pida una por una: con
 * miniaturas, casi nadie pasa de la primera.
 *
 * En móvil es un carrusel que se desliza, con sus puntos.
 */
export function Galeria({
  imagenes,
  nombre,
  marca,
}: {
  imagenes: string[];
  nombre: string;
  marca: string;
}) {
  const carrusel = useRef<HTMLDivElement>(null);
  const [activa, setActiva] = useState(0);
  const [ampliada, setAmpliada] = useState<number | null>(null);

  const alt = (i: number) =>
    i === 0
      ? `${nombre} de ${marca}, vista frontal`
      : i === 1
        ? `${nombre}, vista en tres cuartos`
        : i === 2
          ? `${nombre}, detalle de la tapa y la placa grabada`
          : `${nombre} con su estuche de regalo`;

  return (
    <div>
      {/* Escritorio: las cuatro fotos en columna */}
      <div className="hidden lg:block">
        <ul className="space-y-3">
          {imagenes.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setAmpliada(i)}
                aria-label={`Ampliar ${alt(i)}`}
                className="bg-surface border-border-soft hover:border-border-strong relative block aspect-3/4 w-full cursor-zoom-in overflow-hidden rounded-md border transition-colors"
              >
                <Imagen
                  src={src}
                  alt={alt(i)}
                  sizes="45vw"
                  // Solo la primera entra en la carga inicial. Marcar las cuatro
                  // como prioritarias compite con el precio y los botones, que
                  // es lo que de verdad hay que pintar primero.
                  priority={i === 0}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Móvil: carrusel con scroll-snap */}
      <div className="lg:hidden">
        <div
          ref={carrusel}
          // Los puntos siguen al dedo. Antes estaban clavados en el primero:
          // se deslizaba a la cuarta foto y el indicador seguía diciendo que
          // era la uno, que es peor que no tener indicador.
          onScroll={(e) => {
            const caja = e.currentTarget;
            const i = Math.round(caja.scrollLeft / caja.clientWidth);
            if (i !== activa) setActiva(i);
          }}
          className="snap-row -mx-4 flex"
        >
          {imagenes.map((src, i) => (
            <div key={src} className="bg-surface relative aspect-3/4 w-full shrink-0">
              <Imagen src={src} alt={alt(i)} sizes="100vw" priority={i === 0} />
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {imagenes.map((src, i) => (
            <span
              key={src}
              className={cn(
                "h-1 rounded-full transition-all",
                i === activa ? "bg-gold w-5" : "bg-border-strong w-1.5",
              )}
            />
          ))}
        </div>
        <p className="text-fg-subtle mt-2 text-center text-[11px]">
          {activa + 1} de {imagenes.length} — desliza para ver el resto
        </p>
      </div>

      {/* Foto a pantalla completa. Se cierra con Escape, con el botón o
          pulsando fuera: las tres salidas que alguien intenta por instinto. */}
      {ampliada !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt(ampliada)}
          tabIndex={-1}
          ref={(nodo) => nodo?.focus()}
          onClick={() => setAmpliada(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAmpliada(null);
            if (e.key === "ArrowRight")
              setAmpliada((n) => ((n ?? 0) + 1) % imagenes.length);
            if (e.key === "ArrowLeft")
              setAmpliada((n) => ((n ?? 0) - 1 + imagenes.length) % imagenes.length);
          }}
          className="bg-bg/95 fixed inset-0 z-100 grid cursor-zoom-out place-items-center p-6 backdrop-blur-xl"
        >
          <div className="relative aspect-3/4 max-h-full w-auto max-w-3xl">
            <Imagen src={imagenes[ampliada]!} alt={alt(ampliada)} sizes="90vw" />
          </div>
          <button
            type="button"
            onClick={() => setAmpliada(null)}
            className="border-border-strong text-fg absolute top-5 right-5 rounded-full border px-4 py-2 text-sm"
          >
            Cerrar
          </button>
        </div>
      ) : null}
    </div>
  );
}
