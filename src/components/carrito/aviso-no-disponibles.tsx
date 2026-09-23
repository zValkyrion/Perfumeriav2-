"use client";

import type { LineaNoDisponible } from "@/lib/carrito";
import { cn } from "@/lib/utils";
import { useTienda } from "@/store/tienda";

/**
 * Lo que había en el carrito y ya no se vende: se agotó o se retiró después
 * de agregarlo. No se cobra, y se dice aquí en vez de que desaparezca del
 * total sin explicación.
 */
export function AvisoNoDisponibles({
  lineas,
  className,
}: {
  lineas: LineaNoDisponible[];
  className?: string;
}) {
  const quitar = useTienda((s) => s.quitar);
  if (lineas.length === 0) return null;

  return (
    <div
      role="status"
      className={cn("border-warning/40 bg-warning/10 rounded-md border p-3 text-sm", className)}
    >
      <p className="font-medium">
        {lineas.length === 1 ? "Esto ya no está disponible" : "Estos ya no están disponibles"}
      </p>
      <p className="text-fg-muted text-xs">
        Se agotó después de que lo agregaste. No entra en el total.
      </p>
      <ul className="mt-2 grid gap-1">
        {lineas.map((l) => (
          <li
            key={`${l.item.productoId}:${l.item.ml}`}
            className="flex items-center justify-between gap-2"
          >
            <span className="min-w-0 truncate">{l.nombre}</span>
            <button
              type="button"
              onClick={() => quitar(l.item.productoId, l.item.ml)}
              className="text-gold-light min-h-9 shrink-0 text-xs font-medium underline"
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
