import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Contenedor, Seccion } from "@/components/comunes/layout";
import { TarjetaLote } from "@/components/lotes/tarjeta-lote";
import { LOTES } from "@/data/lotes";

export const metadata: Metadata = {
  title: "Paquetes para revender",
  description:
    "Paquetes armados de perfumes 1:1 con precio de distribuidor, envío gratis y material de venta incluido.",
  // Esta página lista los mismos ocho lotes que /lotes, solo que sin separar
  // mixtos de temáticos: para un buscador es contenido duplicado. Sigue
  // existiendo porque la home y el banner del paquete estrella apuntan aquí,
  // pero la autoridad se acumula en /lotes, que es la landing de mayoreo.
  alternates: { canonical: "/lotes" },
};

/**
 * Paquetes.
 *
 * Es el minicatálogo al que apuntan el círculo de "Paquetes" y el banner del
 * paquete estrella. Reutiliza los lotes existentes: cuando cambien las
 * cantidades (10, 20, 30…), precio, utilidad y ahorro se recalculan solos
 * porque salen del catálogo, no están escritos a mano.
 */
export default function PaquetesPage() {
  return (
    <>
      <Contenedor className="pt-8 pb-2 lg:pt-12">
        <header className="mx-auto max-w-3xl text-center">
          <h1 className="titular-audaz">PAQUETES</h1>
          <p className="text-fg-muted mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed font-medium lg:text-base">
            Los paquetes son la forma más inteligente de arrancar tu negocio de
            reventa. Cada lote incluye modelos de alta demanda listos para
            vender, con precios directos de importación que te dejan márgenes de
            ganancia únicos.
          </p>
        </header>
      </Contenedor>

      <Seccion denso>
        <Contenedor>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {LOTES.map((lote) => (
              <TarjetaLote
                key={lote.slug}
                lote={lote}
                destacada={lote.masVendido}
              />
            ))}
          </div>
        </Contenedor>
      </Seccion>

      <Seccion denso className="border-border-soft border-t">
        <Contenedor>
          <div className="border-border-soft flex flex-col items-start gap-5 rounded-lg border px-6 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl leading-tight font-bold">
                ¿Prefieres armar tu propio surtido?
              </h2>
              <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                Desde 12 piezas sueltas llegas al mismo 40% de descuento,
                eligiendo modelo por modelo.
              </p>
            </div>
            <Button asChild variant="gold" size="touch">
              <Link href="/catalogo">Ver todos los perfumes</Link>
            </Button>
          </div>
        </Contenedor>
      </Seccion>
    </>
  );
}
