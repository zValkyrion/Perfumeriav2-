"use client";

import { useState } from "react";
import { Imagen } from "@/components/comunes/imagen";
import { cn } from "@/lib/utils";

/**
 * Galería de la ficha (§10.1): carrusel con puntos en móvil, miniaturas
 * verticales y zoom al hover en escritorio.
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
  const [activa, setActiva] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  const alt = (i: number) =>
    i === 0
      ? `${nombre} de ${marca}, vista frontal`
      : i === 1
        ? `${nombre}, vista en tres cuartos`
        : i === 2
          ? `${nombre}, detalle de la tapa y la placa grabada`
          : `${nombre} con su estuche de regalo`;

  return (
    <div className="lg:flex lg:gap-4">
      {/* Miniaturas — solo escritorio */}
      <ul className="hidden shrink-0 flex-col gap-2.5 lg:flex">
        {imagenes.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => setActiva(i)}
              aria-label={`Ver imagen ${i + 1} de ${imagenes.length}`}
              aria-current={i === activa}
              className={cn(
                "bg-surface relative block size-20 overflow-hidden rounded border transition-colors",
                i === activa
                  ? "border-gold"
                  : "border-border-soft hover:border-border-strong",
              )}
            >
              <Imagen src={src} alt="" sizes="80px" />
            </button>
          </li>
        ))}
      </ul>

      {/* Imagen principal con zoom al hover */}
      <div
        className="bg-surface border-border-soft relative hidden aspect-3/4 w-full overflow-hidden rounded-md border lg:block"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({
            x: ((e.clientX - r.left) / r.width) * 100,
            y: ((e.clientY - r.top) / r.height) * 100,
          });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <div
          className="absolute inset-0 transition-transform duration-200"
          style={{
            transform: zoom ? "scale(1.7)" : "scale(1)",
            transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "center",
          }}
        >
          <Imagen
            src={imagenes[activa]!}
            alt={alt(activa)}
            sizes="(max-width: 1024px) 100vw, 45vw"
            priority
          />
        </div>
      </div>

      {/* Carrusel con scroll-snap — solo móvil */}
      <div className="lg:hidden">
        <div className="snap-row -mx-4">
          {imagenes.map((src, i) => (
            <div key={src} className="bg-surface relative aspect-3/4 w-full shrink-0">
              <Imagen
                src={src}
                alt={alt(i)}
                sizes="100vw"
                priority={i === 0}
              />
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {imagenes.map((src, i) => (
            <span
              key={src}
              className={cn(
                "h-1 rounded-full transition-all",
                i === 0 ? "bg-gold w-5" : "bg-border-strong w-1.5",
              )}
            />
          ))}
        </div>
        <p className="text-fg-subtle mt-2 text-center text-[11px]">
          Desliza para ver las {imagenes.length} fotos
        </p>
      </div>
    </div>
  );
}
