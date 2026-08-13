"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, LayoutGrid, Search, ShoppingBag } from "lucide-react";
import { useTienda } from "@/store/tienda";
import { cn } from "@/lib/utils";

/** Punto dorado sobre la pestaña activa. */
function Punto({ act }: { act: boolean }) {
  if (!act) return null;
  return (
    <span
      aria-hidden
      className="bg-gold animate-escala absolute top-1.5 size-1 rounded-full"
    />
  );
}

/** Barra inferior móvil (§7.6). Se oculta a partir de 768px. */
export function BottomNav() {
  const ruta = usePathname();
  const piezas = useTienda((s) =>
    s.carrito.reduce((n, i) => n + i.cantidad, 0),
  );
  const favoritos = useTienda((s) => s.favoritos.length);
  const hidratado = useTienda((s) => s.hidratado);
  const abrirDrawer = useTienda((s) => s.abrirDrawer);

  const activa = (href: string) =>
    href === "/" ? ruta === "/" : ruta.startsWith(href);

  // El ítem activo se marca con color, un icono algo mayor y un punto dorado
  // arriba: tres señales suaves en vez de un bloque de color que pese.
  const clase = (act: boolean) =>
    cn(
      "presionable relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] transition-colors duration-200",
      "[&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-[cubic-bezier(0.34,1.56,0.64,1)]",
      act
        ? "text-gold-light [&_svg]:-translate-y-0.5 [&_svg]:scale-110"
        : "text-fg-subtle",
    );


  return (
    <nav
      aria-label="Navegación rápida"
      className="border-border-soft bg-bg/85 fixed inset-x-0 bottom-0 z-40 h-16 border-t backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16">
        <Link href="/" className={clase(activa("/"))}>
          <Punto act={activa("/")} />
          <Home size={20} aria-hidden />
          Inicio
        </Link>

        <Link href="/catalogo" className={clase(activa("/catalogo"))}>
          <Punto act={activa("/catalogo")} />
          <LayoutGrid size={20} aria-hidden />
          Catálogo
        </Link>

        <Link href="/buscar" className={clase(activa("/buscar"))}>
          <Punto act={activa("/buscar")} />
          <Search size={20} aria-hidden />
          Buscar
        </Link>

        <Link href="/favoritos" className={clase(activa("/favoritos"))}>
          <Punto act={activa("/favoritos")} />
          <span className="relative">
            <Heart size={20} aria-hidden />
            {hidratado && favoritos > 0 ? (
              <span className="bg-gold absolute -top-0.5 -right-1 size-2 rounded-full" />
            ) : null}
          </span>
          Favoritos
        </Link>

        <button type="button" onClick={abrirDrawer} className={clase(false)}>
          <span className="relative">
            <ShoppingBag size={20} aria-hidden />
            {hidratado && piezas > 0 ? (
              <span
                data-precio
                className="bg-gold-gradient text-bg absolute -top-1.5 -right-2 grid min-w-4 place-items-center rounded-full px-0.5 text-[9px] leading-4 font-semibold"
              >
                {piezas > 99 ? "99+" : piezas}
              </span>
            ) : null}
          </span>
          Carrito
        </button>
      </div>
    </nav>
  );
}
