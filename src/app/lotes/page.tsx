import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Contenedor, Seccion, TituloSeccion } from "@/components/comunes/layout";
import { TarjetaLote } from "@/components/lotes/tarjeta-lote";
import { LOTES } from "@/data/lotes";

export const metadata: Metadata = {
  title: "Lotes de mayoreo",
  description:
    "Ocho lotes armados de 6 a 50 piezas, con precio de distribuidor, envío gratis y material de venta. Surtidos mixtos y temáticos.",
};

export default function LotesPage() {
  const mixtos = LOTES.filter((l) => l.tema === "Mixto");
  const tematicos = LOTES.filter((l) => l.tema !== "Mixto");

  return (
    <>
      <Contenedor className="pt-8 pb-2 lg:pt-12">
        <header className="max-w-2xl">
          <p className="eyebrow mb-2">Para revender</p>
          <h1 className="font-display text-[32px] leading-[1.05] tracking-tight text-balance lg:text-[44px]">
            Lotes de mayoreo
          </h1>
          <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
            Surtidos ya balanceados por rotación: no eliges modelo por modelo,
            pero tampoco te arriesgas a inventario parado. Todos incluyen envío
            gratis y lista de precios sugeridos.
          </p>
        </header>
      </Contenedor>

      <Seccion denso>
        <Contenedor>
          <TituloSeccion eyebrow="Por volumen" titulo="Surtido mixto" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {mixtos.map((lote) => (
              <TarjetaLote key={lote.slug} lote={lote} destacada={lote.masVendido} />
            ))}
          </div>
        </Contenedor>
      </Seccion>

      <Seccion denso className="border-border-soft border-t">
        <Contenedor>
          <TituloSeccion
            eyebrow="Por público"
            titulo="Surtido temático"
            descripcion="Cuando ya sabes qué te compra tu clientela."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {tematicos.map((lote) => (
              <TarjetaLote key={lote.slug} lote={lote} />
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
