"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, User } from "lucide-react";
import { Logo } from "@/components/comunes/logo";
import type { EntradaIndice } from "@/data/productos";
import { useTienda } from "@/store/tienda";
import { Buscador } from "./buscador";
import { BotonCarrito } from "./boton-carrito";
import { MegaMenu } from "./mega-menu";
import { NavMovil } from "./nav-movil";
import { ToggleMayoreo } from "./toggle-mayoreo";
import { cn } from "@/lib/utils";

/** Cabecera sticky: se encoge de 80px a 60px al pasar de 40px de scroll (§7.2). */
export function Header({ indice }: { indice: EntradaIndice[] }) {
  const [encogido, setEncogido] = useState(false);
  const favoritos = useTienda((s) => s.favoritos.length);
  const hidratado = useTienda((s) => s.hidratado);

  useEffect(() => {
    const alScroll = () => setEncogido(window.scrollY > 40);
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,backdrop-filter,border-color] duration-300",
        encogido
          ? "bg-bg/70 border-border-soft border-b backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 lg:px-8">
        <div
          className={cn(
            "flex items-center justify-between gap-2 transition-[height] duration-300",
            encogido ? "h-15" : "h-16 lg:h-20",
          )}
        >
          {/* Móvil: hamburguesa · logo centrado · acciones */}
          <div className="flex items-center gap-1 lg:hidden">
            <NavMovil />
          </div>

          <div className="lg:hidden">
            <Logo />
          </div>

          {/* Escritorio: logo · navegación */}
          <div className="hidden items-center gap-8 lg:flex">
            <Logo />
            <MegaMenu />
          </div>

          <div className="flex items-center gap-0.5">
            <div className="hidden lg:block">
              <ToggleMayoreo compacto />
            </div>

            <Buscador indice={indice} />

            <Link
              href="/favoritos"
              aria-label={
                hidratado && favoritos > 0
                  ? `Favoritos, ${favoritos} guardados`
                  : "Favoritos"
              }
              className="text-fg-muted hover:text-fg relative hidden size-11 place-items-center rounded-full transition-colors lg:grid"
            >
              <Heart size={20} aria-hidden />
              {hidratado && favoritos > 0 ? (
                <span
                  data-precio
                  className="bg-gold-gradient text-bg absolute top-1 right-0.5 grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] leading-[18px] font-semibold"
                >
                  {favoritos}
                </span>
              ) : null}
            </Link>

            <Link
              href="/cuenta"
              aria-label="Mi cuenta"
              className="text-fg-muted hover:text-fg hidden size-11 place-items-center rounded-full transition-colors lg:grid"
            >
              <User size={20} aria-hidden />
            </Link>

            <BotonCarrito />
          </div>
        </div>
      </div>
    </header>
  );
}
