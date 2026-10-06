"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Producto } from "@/types";
import { TarjetaProducto } from "./tarjeta-producto";
import { cn } from "@/lib/utils";

/**
 * Carrusel horizontal con scroll-snap nativo y arrastre táctil, sin flechas en
 * móvil (§14). Se prefiere al carrusel con JavaScript porque no bloquea el hilo
 * principal y funciona sin hidratar.
 *
 * En escritorio sí lleva flechas: la fila no tiene barra visible y con un ratón
 * sin rueda horizontal no había forma de llegar de la quinta tarjeta en
 * adelante. Las flechas solo llaman a `scrollBy`; el desplazamiento y el ajuste
 * siguen siendo los nativos.
 */
export function CarruselProductos({
  productos,
  className,
  prioritarios = 0,
}: {
  productos: Producto[];
  className?: string;
  prioritarios?: number;
}) {
  const pista = useRef<HTMLDivElement>(null);
  // Antes de hidratar no se sabe si sobra contenido: se supone que sí y que se
  // está al principio, que es como carga siempre.
  const [orillas, setOrillas] = useState({ alInicio: true, alFinal: false });

  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    let cuadro = 0;
    // Una medición por cuadro, y solo se guarda si cambió alguna orilla: el
    // evento «scroll» llega muchas veces por cuadro y cada render repinta las
    // diez tarjetas.
    const medir = () => {
      cuadro = 0;
      const max = el.scrollWidth - el.clientWidth;
      const alInicio = el.scrollLeft <= 2;
      const alFinal = el.scrollLeft >= max - 2;
      setOrillas((previo) =>
        previo.alInicio === alInicio && previo.alFinal === alFinal
          ? previo
          : { alInicio, alFinal },
      );
    };
    const programar = () => {
      if (!cuadro) cuadro = requestAnimationFrame(medir);
    };
    programar();
    const obs = new ResizeObserver(programar);
    obs.observe(el);
    el.addEventListener("scroll", programar, { passive: true });
    return () => {
      cancelAnimationFrame(cuadro);
      obs.disconnect();
      el.removeEventListener("scroll", programar);
    };
  }, []);

  const mover = (direccion: 1 | -1) => {
    const el = pista.current;
    if (!el) return;
    // Casi una pantalla por paso, para que asome la tarjeta siguiente.
    el.scrollBy({ left: direccion * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const flecha =
    "border-border-soft bg-bg/95 text-fg hover:text-gold-light absolute top-[38%] z-30 hidden size-11 -translate-y-1/2 place-items-center rounded-full border shadow-lg backdrop-blur-sm transition-[opacity,color] disabled:pointer-events-none disabled:opacity-0 lg:grid";

  return (
    <div className="relative">
      <div
        ref={pista}
        className={cn(
          "snap-row -mx-4 flex gap-3 px-4 pb-2 lg:-mx-8 lg:gap-5 lg:px-8",
          className,
        )}
        role="region"
        aria-label="Carrusel de productos"
      >
        {productos.map((p, i) => (
          <div
            key={p.id}
            className="w-[47%] shrink-0 sm:w-[31%] lg:w-[23%] 2xl:w-[19%]"
          >
            <TarjetaProducto producto={p} prioridad={i < prioritarios} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => mover(-1)}
        disabled={orillas.alInicio}
        aria-label="Ver productos anteriores"
        className={cn(flecha, "-left-3")}
      >
        <ChevronLeft size={22} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => mover(1)}
        disabled={orillas.alFinal}
        aria-label="Ver más productos"
        className={cn(flecha, "-right-3")}
      >
        <ChevronRight size={22} aria-hidden />
      </button>
    </div>
  );
}
