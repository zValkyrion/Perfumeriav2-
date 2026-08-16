"use client";

import { ShoppingCart } from "lucide-react";
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
      {/* Cambiar la `key` remonta el icono y reinicia la animación CSS: el
          latido del §6.7 sin estado ni temporizadores que limpiar. */}
      {/* Carrito, no bolsa: el carrito se lee como "compra por volumen", que es
          lo que hace aquí el cliente. */}
      <ShoppingCart
        key={visible}
        size={20}
        aria-hidden
        className="animate-latido"
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
