import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Package,
  Shuffle,
  Sparkles,
  User,
  UserRound,
} from "lucide-react";
import { Imagen } from "@/components/comunes/imagen";
import { MAS_VENDIDOS } from "@/data/productos";
import type { LucideIcon } from "lucide-react";

interface Tipo {
  titulo: string;
  nota: string;
  href: string;
  icono: LucideIcon;
  destacado?: boolean;
}

/**
 * Tipos de compra, en círculos.
 *
 * Es la navegación principal de un mayorista: el cliente no llega buscando una
 * familia olfativa, llega buscando un **modo de comprar** —la promoción, un
 * lote armado, surtido suelto—. Por eso va arriba del todo y por delante de
 * cualquier navegación por producto.
 */
const TIPOS: Tipo[] = [
  {
    titulo: "Mayoreo surtido",
    nota: "Arma tu pedido",
    href: "/catalogo",
    icono: Shuffle,
    destacado: true,
  },
  { titulo: "Paquetes", nota: "De 10, 20 y 30", href: "/lotes", icono: Package },
  { titulo: "Diseñador", nota: "Casas europeas", href: "/catalogo/disenador", icono: Sparkles },
  { titulo: "Árabes", nota: "Oud y azafrán", href: "/catalogo/arabes", icono: Boxes },
  { titulo: "Hombre", nota: "Ver colección", href: "/catalogo/hombre", icono: User },
  { titulo: "Mujer", nota: "Ver colección", href: "/catalogo/mujer", icono: UserRound },
];

export function TiposCompra() {
  // El círculo destacado enseña producto real, no un sello de promoción: es la
  // entrada al surtido suelto y lo que se compra ahí son frascos.
  const portada = MAS_VENDIDOS[0]?.imagenes[0];

  return (
    <div className="foco-grupo snap-row -mx-4 flex gap-5 px-4 pt-2 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-7 lg:overflow-visible lg:px-0">
      {TIPOS.map((t, i) => {
        const Icono = t.icono;
        return (
          <Link
            key={t.titulo}
            href={t.href}
            style={{ animationDelay: `${i * 65}ms` }}
            className="group/tipo animate-subir flex w-30 shrink-0 flex-col items-center gap-3.5 text-center sm:w-36 lg:w-full"
          >
            {/* Disco gris con icono plano y sombra proyectada. El crecimiento
                al señalar se queda dentro de la caja del enlace: antes el
                desplazamiento vertical lo sacaba de su sección. */}
            <span
              aria-hidden
              className={`relative grid aspect-square w-full place-items-center overflow-hidden rounded-full transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/tipo:scale-[1.04] ${
                t.destacado ? "bg-[#f2f2f2]" : "bg-surface-2"
              }`}
            >
              {/* Sombra larga en diagonal, como los iconos planos de catálogo */}
              <span
                className="absolute inset-0 opacity-70"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, transparent 45%, rgb(0 0 0 / 0.08) 45%)",
                }}
              />

              {t.destacado && portada ? (
                <Imagen
                  src={portada}
                  alt=""
                  sizes="(max-width: 1024px) 40vw, 200px"
                  className="relative z-10 h-full w-full scale-[1.06] object-cover transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/tipo:scale-[1.14]"
                />
              ) : (
                <Icono
                  size={54}
                  strokeWidth={1.6}
                  className="text-fg relative z-10 transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/tipo:scale-110"
                />
              )}
            </span>

            <span className="leading-tight">
              <span className="block text-[14px] font-extrabold tracking-tight uppercase sm:text-[15px]">
                {t.titulo}
              </span>
              <span className="text-fg-muted mt-1 inline-flex items-center gap-1 text-[12px] font-medium">
                Ver colección
                <ArrowRight
                  size={13}
                  aria-hidden
                  className="transition-transform duration-200 group-hover/tipo:translate-x-0.5"
                />
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
