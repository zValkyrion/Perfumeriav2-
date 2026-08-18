import Link from "next/link";
import { ArrowRight, HandCoins, Truck, Zap } from "lucide-react";
import { Contenedor } from "@/components/comunes/layout";
import { Imagen } from "@/components/comunes/imagen";
import { Sticker } from "@/components/comunes/sticker";
import { getLote, valorMenudeoLote } from "@/data/lotes";
import { precioRedondo } from "@/lib/format";

/**
 * Banner del paquete estrella: la paca de 50.
 *
 * El precio y el valor de reventa salen del propio paquete, no escritos a mano:
 * si la escalera de precios cambia, este bloque cambia con ella y no puede
 * quedarse contradiciendo a la tarjeta de más abajo.
 *
 * El arte lo produce `npm run banner-paca` en 1200 × 900. Para sustituirlo por
 * una foto definitiva basta con dejarla en `public/paca-50-piezas.webp`.
 */
const BENEFICIOS = [
  { icono: Truck, texto: "Envío gratis" },
  { icono: Zap, texto: "Entrega inmediata" },
  { icono: HandCoins, texto: "Pago contra entrega" },
];

export function BannerPaquete() {
  const paca = getLote("paquete-super-mayorista");
  if (!paca) return null;

  const valorReventa = valorMenudeoLote(paca);

  return (
    <Contenedor>
      <div className="grid items-center gap-7 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border-soft bg-surface shadow-2xl">
          <Imagen
            src="/paca-50-piezas.webp"
            alt="Paca 50 piezas - Con lo más vendido - Duplica tu inversión"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
          <span className="absolute top-3 left-3 z-10">
            <Sticker tono="oferta" giro={-6}>
              Más vendido
            </Sticker>
          </span>
          <span className="absolute right-3 bottom-3 z-10">
            <Sticker tono="negro" giro={4} className="text-xs font-bold">
              {precioRedondo(paca.precio)} MXN
            </Sticker>
          </span>
        </div>

        <div>
          <h2 className="titular-medio">PACA {paca.piezas} PIEZAS</h2>

          <p className="text-fg-muted mt-2 text-[15px]">
            Con lo más vendido{" "}
            <span aria-hidden className="text-gold-light">
              ›
            </span>{" "}
            duplica tu inversión:{" "}
            <strong className="text-gold-light font-semibold">
              más de {precioRedondo(valorReventa)}
            </strong>{" "}
            en ventas
          </p>

          <p className="text-fg-muted mt-4 text-[15px] leading-relaxed">
            Emprende fácil con los perfumes más vendidos, en calidad exacta 1.1
          </p>

          <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5">
            {BENEFICIOS.map((b) => {
              const Icono = b.icono;
              return (
                <li
                  key={b.texto}
                  className="text-fg-muted flex items-center gap-2 text-sm font-medium"
                >
                  <Icono size={16} className="text-gold shrink-0" aria-hidden />
                  {b.texto}
                </li>
              );
            })}
          </ul>

          <Link
            href="/paquetes"
            className="text-gold-light hover:text-gold group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
          >
            Ver Paquetes
            <ArrowRight
              size={15}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </Contenedor>
  );
}
