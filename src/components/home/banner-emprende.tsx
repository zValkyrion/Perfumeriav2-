import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Contenedor } from "@/components/comunes/layout";
import { CapaParallax } from "@/components/comunes/efectos";

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

          {/* Una línea y un enlace, nada más. El bloque no tiene que cerrar la
              venta aquí: solo tiene que mandar a la landing de mayoreo, que es
              donde está el argumento completo. Los dos botones grandes y el
              contador competían con esa única salida. */}
          <p className="text-fg-muted mx-auto mt-4 max-w-xl text-[15px] leading-relaxed lg:text-lg">
            Perfumes directamente Importados para revender.
          </p>

          <Link
            href="/mayoreo"
            className="text-gold-light hover:text-gold group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
          >
            Ver oportunidad
            <ArrowRight
              size={15}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </Contenedor>
    </section>
  );
}
