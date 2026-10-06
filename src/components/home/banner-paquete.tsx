import Link from "next/link";
import { ArrowRight, CreditCard, Landmark, Truck } from "lucide-react";
import { Contenedor } from "@/components/comunes/layout";
import { Imagen } from "@/components/comunes/imagen";
import { Sticker } from "@/components/comunes/sticker";
import { getLote, valorMenudeoLote } from "@/data/lotes";
import { precioRedondo } from "@/lib/format";
import { DESCUENTO_TRANSFERENCIA, pct } from "@/lib/volumen";

/**
 * Banner del paquete estrella: la paca de 50.
 *
 * El precio y el valor de reventa salen del propio paquete, no escritos a mano:
 * si la escalera de precios cambia, este bloque cambia con ella y no puede
 * quedarse contradiciendo a la tarjeta de más abajo.
 *
 * Las tres ventajas son las que el checkout le da de verdad a este pedido. Antes
 * decía «Entrega inmediata» y «Pago contra entrega», y la paca pasa del tope de
 * contra entrega (`TOPE_CONTRA_ENTREGA`, $10,000): el checkout no se lo ofrece.
 *
 * La foto va con el arte del propio paquete. El arte anterior
 * (`public/paca-50-piezas.webp`) traía escritos «DUPLICA TU INVERSIÓN» y
 * «ENTREGA INMEDIATA» y el precio fijo dentro de la imagen; se puede volver a
 * él cuando haya una versión sin esas frases.
 */
const BENEFICIOS = [
  { icono: Truck, texto: "Envío gratis" },
  { icono: CreditCard, texto: "Tarjeta con Clip" },
  {
    icono: Landmark,
    texto: `${pct(DESCUENTO_TRANSFERENCIA)}% menos por transferencia`,
  },
];

export function BannerPaquete() {
  const paca = getLote("paquete-super-mayorista");
  if (!paca) return null;

  const valorReventa = valorMenudeoLote(paca);

  return (
    <Contenedor>
      <div className="grid items-center gap-7 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border-soft bg-surface shadow-2xl">
          {/* Sin `priority`: queda bajo el pliegue y precargarla le quitaba
              ancho de banda al hero, que es el LCP de la portada. */}
          <Imagen
            src={paca.imagen}
            alt={`${paca.nombre}: ${paca.piezas} perfumes surtidos`}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
          {/* Todos sus modelos llevan la etiqueta «Más vendido»; el paquete en
              sí no es el más vendido (ese es el que marca `masVendido`). */}
          <span className="absolute top-3 left-3 z-10">
            <Sticker tono="oferta" giro={-6}>
              Lo más vendido
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

          {/* Antes: «duplica tu inversión». La cuenta real es la de abajo. */}
          <p className="text-fg-muted mt-2 text-[15px]">
            Con lo más vendido{" "}
            <span aria-hidden className="text-gold-light">
              ›
            </span>{" "}
            a precio de lista suma{" "}
            <strong className="text-gold-light font-semibold">
              {precioRedondo(valorReventa)}
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
