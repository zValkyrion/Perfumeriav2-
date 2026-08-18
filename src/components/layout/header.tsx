"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, User } from "lucide-react";
import { Logo } from "@/components/comunes/logo";
import { MARCA } from "@/data/contenido";
import type { EntradaIndice } from "@/data/productos";
import { Buscador } from "./buscador";
import { BotonCarrito } from "./boton-carrito";
import { MegaMenu } from "./mega-menu";
import { NavMovil } from "./nav-movil";
import { cn } from "@/lib/utils";

/** Cabecera sticky: se encoge de 80px a 60px al pasar de 40px de scroll (§7.2). */
export function Header({ indice }: { indice: EntradaIndice[] }) {
  const [encogido, setEncogido] = useState(false);

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
      {/* Más estrecho que el resto de la página (1400px) a propósito: con el
          logo pegado a un borde y los iconos al otro, en un monitor ancho la
          cabecera se leía como tres islas sueltas en vez de como una barra. */}
      <div className="mx-auto w-full max-w-[1160px] px-4 lg:px-6">
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

          {/* Escritorio: el logo va solo; la navegación baja a su propia fila */}
          <div className="hidden lg:block">
            <Logo />
          </div>

          {/* Buscador ancho en el centro: en un mayorista es la vía principal
              para llegar al producto, así que ocupa sitio propio y no se
              esconde detrás de una lupa. */}
          <div className="mx-6 hidden max-w-lg flex-1 lg:block">
            <Buscador indice={indice} variante="barra" />
          </div>

          {/* Solo cuenta y carrito: el interruptor de modo mayoreo y el acceso
              a favoritos se retiraron de la cabecera. Favoritos sigue vivo en
              la barra inferior del móvil y en su propia ruta. */}
          <div className="flex items-center gap-0.5">
            <div className="lg:hidden">
              <Buscador indice={indice} />
            </div>

            {/* WhatsApp con su color de marca: es el canal por el que se cierra
                la venta de mayoreo, así que no se disfraza de icono neutro. */}
            <a
              href={MARCA.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Escríbenos por WhatsApp al ${MARCA.whatsapp}`}
              title={`WhatsApp ${MARCA.whatsapp}`}
              className="grid size-11 place-items-center rounded-full text-[#25D366] transition-transform hover:scale-110"
            >
              <MessageCircle size={21} aria-hidden />
            </a>

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

        {/* Segunda fila: navegación a ancho completo, solo en escritorio */}
        <div className="border-border-soft hidden border-t lg:block">
          <MegaMenu />
        </div>
      </div>
    </header>
  );
}
