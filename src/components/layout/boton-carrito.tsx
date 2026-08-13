"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useTienda } from "@/store/tienda";
import { cn } from "@/lib/utils";

/**
 * Icono de carrito con contador. El número solo se pinta tras la hidratación:
 * el servidor no conoce el localStorage y pintar 0 primero evita el error de
 * hidratación sin recurrir a `suppressHydrationWarning`.
 */
export function BotonCarrito({ className }: { className?: string }) {
  const piezas = useTienda((s) =>
    s.carrito.reduce((n, i) => n + i.cantidad, 0),
  );
  const hidratado = useTienda((s) => s.hidratado);
  const abrirDrawer = useTienda((s) => s.abrirDrawer);
  const [late, setLate] = useState(false);

  // Pequeño latido al cambiar la cantidad (§6.7).
  useEffect(() => {
    if (!hidratado || piezas === 0) return;
    setLate(true);
    const t = setTimeout(() => setLate(false), 320);
    return () => clearTimeout(t);
  }, [piezas, hidratado]);

  const visible = hidratado ? piezas : 0;

  return (
    <button
      type="button"
      onClick={abrirDrawer}
      aria-label={
        visible > 0
          ? `Abrir carrito, ${visible} ${visible === 1 ? "pieza" : "piezas"}`
          : "Abrir carrito, vacío"
      }
      className={cn(
        "text-fg-muted hover:text-fg relative grid size-11 place-items-center rounded-full transition-colors",
        className,
      )}
    >
      <ShoppingBag
        size={20}
        aria-hidden
        className={cn(
          "transition-transform duration-300",
          late && "scale-120 motion-reduce:scale-100",
        )}
      />
      {visible > 0 ? (
        <span
          data-precio
          className="bg-gold-gradient text-bg absolute top-1 right-0.5 grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] leading-[18px] font-semibold"
        >
          {visible > 99 ? "99+" : visible}
        </span>
      ) : null}
    </button>
  );
}
