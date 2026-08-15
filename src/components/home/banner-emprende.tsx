import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Contenedor } from "@/components/comunes/layout";
import { CapaParallax, ContadorEnVista } from "@/components/comunes/efectos";
import { MARCA } from "@/data/contenido";
import { UTILIDAD_MAXIMA } from "@/data/lotes";
import { precioRedondo } from "@/lib/format";

/**
 * Banner de captación de revendedores.
 *
 * Va casi al final: quien ha llegado hasta aquí ya vio precios, lotes y prueba
 * social, así que es el momento de proponerle el negocio y no solo la compra.
 */
export function BannerEmprende() {
  return (
    <section className="zona-oscura grain relative isolate overflow-hidden border-y border-[color:var(--color-gold)]/25 bg-black">
      <CapaParallax
        desde={14}
        hasta={-14}
        className="-z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 55% 100% at 50% 0%, rgba(201,162,39,.20), transparent 70%)",
        }}
      />

      <Contenedor>
        <div className="mx-auto max-w-3xl py-14 text-center lg:py-20">
          <p className="eyebrow mb-3">Emprende con nosotros</p>

          <h2 className="titular-audaz">EMPRENDE CON EL REY</h2>

          <p className="text-fg-muted mx-auto mt-4 max-w-xl text-[15px] leading-relaxed lg:text-lg">
            Perfumes directamente importados para revender. Sin mínimo, sin
            papeleo y sin cuota de inscripción.
          </p>

          <p className="text-fg-muted mt-6 text-sm">
            Se han sumado{" "}
            <ContadorEnVista
              valor={MARCA.clientes}
              prefijo="+"
              className="text-gold-light font-medium"
            />{" "}
            personas, y ganan hasta{" "}
            <span className="text-gold-light font-medium">
              {precioRedondo(UTILIDAD_MAXIMA)}
            </span>{" "}
            por lote.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="gold" size="touch-lg">
              <Link href="/mayoreo">Ver la oportunidad</Link>
            </Button>
            <Button asChild variant="goldOutline" size="touch-lg">
              <Link href="/mayoreo#calculadora">Calcular mi ganancia</Link>
            </Button>
          </div>
        </div>
      </Contenedor>
    </section>
  );
}
