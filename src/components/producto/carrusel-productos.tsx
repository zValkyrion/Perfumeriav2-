import type { Producto } from "@/types";
import { TarjetaProducto } from "./tarjeta-producto";
import { cn } from "@/lib/utils";

/**
 * Carrusel horizontal con scroll-snap nativo y arrastre táctil, sin flechas en
 * móvil (§14). Se prefiere al carrusel con JavaScript porque no bloquea el hilo
 * principal y funciona sin hidratar.
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
  return (
    <div
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
  );
}
