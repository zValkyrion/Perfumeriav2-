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
        <header className="max-w-2xl">
          <p className="eyebrow mb-2">Para revender</p>
          <h1 className="titular-medio">Paquetes</h1>
          <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
            Surtidos ya armados con los perfumes que más rotan. Todos incluyen
            envío gratis y lista de precios sugeridos, y salen a precio de
            distribuidor sin tener que elegir modelo por modelo.
          </p>
        </header>
      </Contenedor>

      <Seccion denso>
        <Contenedor>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
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
