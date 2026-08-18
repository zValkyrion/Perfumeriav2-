import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Contenedor, Seccion } from "@/components/comunes/layout";
import { TarjetaLote } from "@/components/lotes/tarjeta-lote";
import { DatosEstructurados } from "@/components/comunes/datos-estructurados";
import { LOTES } from "@/data/lotes";
import { listaLotes, migasDePan } from "@/lib/jsonld";

export const metadata: Metadata = {
  // "Paca" es la palabra que usa el revendedor mexicano; "lote" la que usa el
  // sitio. El título lleva las dos para no perder ninguna de las dos consultas.
  title: "Pacas de perfumes al mayoreo",
  description:
    "Cinco paquetes armados de 10 a 50 perfumes a precio de importador directo, con envío gratis a todo México y pago seguro.",
  alternates: { canonical: "/lotes" },
};

export default function LotesPage() {
  return (
    <>
      <DatosEstructurados
        datos={migasDePan([
          { nombre: "Inicio", ruta: "/" },
          { nombre: "Lotes de mayoreo", ruta: "/lotes" },
        ])}
      />
      <DatosEstructurados
        datos={listaLotes(LOTES, "Lotes de perfumes al mayoreo")}
      />

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

      {/* Una sola rejilla: los cinco paquetes son la misma escalera de volumen,
          así que separarlos en dos bloques solo partía la comparación. */}
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
              <h2 className="font-display text-2xl leading-tight">
                ¿Prefieres armar tu propio surtido?
              </h2>
              <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                A partir de 12 piezas sueltas llegas al mismo 40% de descuento
                del precio distribuidor, eligiendo modelo por modelo.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button asChild variant="gold" size="touch">
                <Link href="/catalogo">Armar mi surtido</Link>
              </Button>
              <Button asChild variant="goldOutline" size="touch">
                <Link href="/mayoreo#calculadora">Calcular ganancia</Link>
              </Button>
            </div>
          </div>
        </Contenedor>
      </Seccion>
    </>
  );
}
