import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcordeonFAQ, FAQJsonLd } from "@/components/comunes/acordeon-faq";
import {
  Contenedor,
  Seccion,
  TituloSeccion,
} from "@/components/comunes/layout";
import { Precio } from "@/components/comunes/precio";
import { Calculadora } from "@/components/mayoreo/calculadora";
import { FormularioDistribuidor } from "@/components/mayoreo/formulario-distribuidor";
import { TarjetaLote } from "@/components/lotes/tarjeta-lote";
import {
  FAQ_MAYOREO,
  RAZONES_MAYOREO,
  TESTIMONIOS_MAYOREO,
} from "@/data/contenido";
import { LOTES_DESTACADOS, UTILIDAD_MAXIMA } from "@/data/lotes";
import { MAS_VENDIDOS, precioDesde } from "@/data/productos";
import { precioRedondo } from "@/lib/format";
import { ESCALONES, precioUnitario } from "@/lib/volumen";

export const metadata: Metadata = {
  title: "Mayoreo — convierte el perfume en tu negocio",
  description:
    "Precio de mayoreo desde 3 piezas, hasta 40% de descuento con 12 o más. Sin mínimo, sin papeleo y con envío gratis. Calcula tu ganancia.",
};

export default function MayoreoPage() {
  // Ticket promedio real de los más vendidos: la calculadora no inventa cifras.
  const ticket = Math.round(
    MAS_VENDIDOS.reduce((n, p) => n + precioDesde(p), 0) / MAS_VENDIDOS.length,
  );

  return (
    <>
      <FAQJsonLd items={FAQ_MAYOREO} />

      {/* Hero propio */}
      <section className="grain border-border-soft relative isolate overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 90% at 20% 0%, rgba(201,162,39,0.18), transparent 65%)",
          }}
        />
        <Contenedor>
          <div className="grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-20">
            <div>
              <p className="eyebrow mb-3">Mayoreo EL REY DE LOS PERFUMES</p>
              <h1 className="font-display text-[clamp(2.25rem,8vw,3rem)] leading-[1.02] tracking-tight text-balance lg:text-[3.5rem]">
                Convierte el perfume en tu negocio.
              </h1>
              <p className="text-fg-muted mt-4 max-w-lg text-[15px] leading-relaxed lg:text-lg">
                Desde 3 piezas obtienes precio de mayoreo y envío gratis. Con 12
                o más llegas al 40% de descuento, que es nuestro precio de
                distribuidor. Sin mínimos, sin cuotas y sin papeleo.
              </p>

              <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
                <div>
                  <dt className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                    Descuento máximo
                  </dt>
                  <dd
                    data-precio
                    className="font-display text-gold-gradient text-3xl"
                  >
                    40%
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                    Desde
                  </dt>
                  <dd data-precio className="font-display text-3xl">
                    3 piezas
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                    Ganas hasta
                  </dt>
                  <dd data-precio className="font-display text-success text-3xl">
                    {precioRedondo(UTILIDAD_MAXIMA)}
                  </dd>
                </div>
              </dl>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="gold" size="touch-lg">
                  <Link href="#calculadora">Calcular mi ganancia</Link>
                </Button>
                <Button asChild variant="goldOutline" size="touch-lg">
                  <Link href="/lotes">Ver lotes armados</Link>
                </Button>
              </div>
            </div>

            <div id="calculadora" className="scroll-mt-24">
              <Calculadora ticketPromedio={ticket} />
            </div>
          </div>
        </Contenedor>
      </section>

      {/* Tabla de escalones */}
      <Seccion denso>
        <Contenedor>
          <TituloSeccion
            eyebrow="La escalera"
            titulo="Entre más piezas, menor el precio"
            descripcion="El descuento se calcula sobre el total de piezas del pedido, no por modelo. Puedes mezclar las fragancias que quieras."
          />

          <div className="border-border-soft overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">
                Escalones de descuento por volumen y precio resultante
              </caption>
              <thead className="bg-surface text-fg-subtle border-border-soft border-b text-[11px] tracking-[0.14em] uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Piezas
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Nivel
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Descuento
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    Precio por pieza
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">
                    Envío
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border-soft divide-y">
                {ESCALONES.map((e) => (
                  <tr key={e.nombre} className="hover:bg-surface transition-colors">
                    <td data-precio className="px-4 py-4 font-medium">
                      {e.max === null ? `${e.min} o más` : `${e.min} – ${e.max}`}
                    </td>
                    <td className="text-fg-muted px-4 py-4">{e.nombre}</td>
                    <td
                      data-precio
                      className={
                        e.descuento > 0
                          ? "text-gold-light px-4 py-4 font-medium"
                          : "text-fg-muted px-4 py-4"
                      }
                    >
                      {e.descuento === 0
                        ? "—"
                        : `−${Math.round(e.descuento * 100)}%`}
                    </td>
                    <td className="px-4 py-4">
                      <Precio valor={precioUnitario(ticket, e.min)} />
                      <span className="text-fg-subtle text-xs"> c/u</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {e.min >= 3 ? (
                        <span className="text-success font-medium">GRATIS</span>
                      ) : (
                        <span className="text-fg-subtle">$ 149.00</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-fg-subtle mt-3 text-xs">
            Precios calculados sobre el ticket promedio de{" "}
            <Precio valor={ticket} /> MXN por pieza.
          </p>
        </Contenedor>
      </Seccion>

      {/* Comparativa menudeo vs mayoreo */}
      <Seccion denso className="border-border-soft border-y">
        <Contenedor>
          <TituloSeccion
            eyebrow="La diferencia"
            titulo="Menudeo contra mayoreo"
          />

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <div className="border-border-soft rounded-lg border p-6">
              <p className="text-fg-muted text-sm">Comprando 1 pieza</p>
              <p data-precio className="font-display mt-1 text-4xl">
                <Precio valor={ticket} />
              </p>
              <ul className="text-fg-muted mt-5 space-y-2.5 text-sm">
                {[
                  ["Precio de menudeo", false],
                  ["Envío $ 149.00", false],
                  ["Sin margen para revender", false],
                ].map(([t]) => (
                  <li key={String(t)} className="flex items-start gap-2">
                    <X size={15} className="text-fg-subtle mt-0.5 shrink-0" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-gold/40 bg-gold-muted rounded-lg border p-6">
              <p className="text-gold-light text-sm">Comprando 12 piezas</p>
              <p data-precio className="font-display mt-1 text-4xl">
                <Precio valor={precioUnitario(ticket, 12)} />
                <span className="text-fg-subtle text-base"> c/u</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "40% de descuento por pieza",
                  "Envío gratis a todo México",
                  `Ganas ${precioRedondo((ticket - precioUnitario(ticket, 12)) * 12)} al revender`,
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check size={15} className="text-gold mt-0.5 shrink-0" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Contenedor>
      </Seccion>

      {/* 6 razones */}
      <Seccion denso>
        <Contenedor>
          <TituloSeccion
            eyebrow="Por qué con nosotros"
            titulo="Seis razones para comprar mayoreo en EL REY DE LOS PERFUMES"
          />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {RAZONES_MAYOREO.map((r, i) => (
              <li key={r.titulo} className="border-border-soft border-t pt-4">
                <span
                  data-precio
                  aria-hidden
                  className="text-gold-gradient font-display block text-2xl leading-none"
                >
                  0{i + 1}
                </span>
                <h3 className="font-display mt-2 text-lg leading-tight">
                  {r.titulo}
                </h3>
                <p className="text-fg-muted mt-1.5 text-sm leading-relaxed">
                  {r.texto}
                </p>
              </li>
            ))}
          </ul>
        </Contenedor>
      </Seccion>

      {/* Lotes */}
      <Seccion denso className="border-border-soft border-t">
        <Contenedor>
          <TituloSeccion
            eyebrow="Ya armados"
            titulo="Lotes listos para vender"
            descripcion="Si no quieres elegir modelo por modelo, estos surtidos ya están balanceados por rotación."
            enlace="/lotes"
          />
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            {LOTES_DESTACADOS.map((lote) => (
              <TarjetaLote key={lote.slug} lote={lote} destacada={lote.masVendido} />
            ))}
          </div>
        </Contenedor>
      </Seccion>

      {/* Testimonios */}
      <Seccion className="bg-surface/40 border-border-soft border-y">
        <Contenedor>
          <TituloSeccion
            eyebrow="Quienes ya venden"
            titulo="Revendedores de EL REY DE LOS PERFUMES"
          />
          <ul className="snap-row -mx-4 flex gap-4 px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {TESTIMONIOS_MAYOREO.map((t) => (
              <li
                key={t.autor}
                className="border-border-soft bg-surface flex w-[80%] shrink-0 flex-col rounded-md border p-5 sm:w-[48%] lg:w-full"
              >
                <p className="text-fg-muted flex-1 text-sm leading-relaxed">
                  “{t.texto}”
                </p>
                <div className="border-border-soft mt-4 border-t pt-3">
                  <p className="text-sm font-medium">{t.autor}</p>
                  <p className="text-fg-subtle text-[11px]">
                    {t.ciudad} · {t.tiempo}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Contenedor>
      </Seccion>

      {/* Formulario + FAQ */}
      <Seccion>
        <Contenedor>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <FormularioDistribuidor />

            <div>
              <TituloSeccion
                eyebrow="Dudas frecuentes"
                titulo="Sobre el mayoreo"
                className="mb-4"
              />
              <AcordeonFAQ items={FAQ_MAYOREO} />

              <Link
                href="/contacto"
                className="text-gold-light hover:text-gold group mt-6 inline-flex items-center gap-1.5 text-sm font-medium"
              >
                ¿Otra pregunta? Escríbenos
                <ArrowRight
                  size={14}
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </Contenedor>
      </Seccion>
    </>
  );
}
