import Link from "next/link";
import { Clock, HandCoins, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Contenedor } from "@/components/comunes/layout";
import { Cortina } from "@/components/comunes/efectos";
import { Imagen } from "@/components/comunes/imagen";
import { Precio } from "@/components/comunes/precio";
import { getLote, valorMenudeoLote } from "@/data/lotes";
import { precioRedondo } from "@/lib/format";

const VENTAJAS = [
  { icono: Truck, texto: "Envío gratis a todo México" },
  { icono: Clock, texto: "Entrega inmediata, sale hoy" },
  { icono: HandCoins, texto: "Pago contra entrega disponible" },
];

/**
 * Destacado del lote grande.
 *
 * En un mayorista, el lote más grande es la pieza que define el negocio, así
 * que va arriba y con la utilidad estimada como titular: es la cifra que hace
 * que un revendedor siga leyendo.
 */
export function DestacadoLote() {
  const lote = getLote("lote-50-distribuidor");
  if (!lote) return null;

  const valorMenudeo = valorMenudeoLote(lote);

  return (
    <Contenedor>
      <div className="border-gold/30 relative grid overflow-hidden rounded-lg border lg:grid-cols-[1.1fr_1fr]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 90% at 15% 0%, rgba(201,162,39,.16), transparent 65%)",
          }}
        />

        <div className="relative p-6 lg:p-10">
          <p className="eyebrow mb-3">El lote que más rota</p>

          <h2 className="titular-medio">
            Gana hasta{" "}
            <span className="text-gold-gradient">
              {precioRedondo(lote.utilidadEstimada)}
            </span>{" "}
            con un solo pedido
          </h2>

          <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
            {lote.piezas} piezas de {lote.productos.length} modelos probados. Te
            salen a <Precio valor={lote.precioIndividualEquivalente} /> cada una
            y las vendes al precio que publicamos aquí.
          </p>

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <dt className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                Inviertes
              </dt>
              <dd className="cifra-audaz mt-1">
                <Precio valor={lote.precio} />
              </dd>
            </div>
            <div>
              <dt className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                Vendes en
              </dt>
              <dd className="font-display mt-1 text-3xl" data-precio>
                <Precio valor={valorMenudeo} />
              </dd>
            </div>
          </dl>

          <ul className="mt-6 grid gap-2.5 sm:grid-cols-3">
            {VENTAJAS.map((v) => {
              const Icono = v.icono;
              return (
                <li
                  key={v.texto}
                  className="text-fg-muted flex items-start gap-2 text-[13px]"
                >
                  <Icono size={15} className="text-gold mt-0.5 shrink-0" aria-hidden />
                  {v.texto}
                </li>
              );
            })}
          </ul>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="gold" size="touch-lg">
              <Link href={`/lotes/${lote.slug}`}>Ver este lote</Link>
            </Button>
            <Button asChild variant="goldOutline" size="touch-lg">
              <Link href="/lotes">Ver todos los lotes</Link>
            </Button>
          </div>
        </div>

        <Cortina className="bg-bg relative order-first aspect-4/3 lg:order-none lg:aspect-auto">
          <div className="absolute inset-0">
            <Imagen
              src={lote.imagen}
              alt={`Lote de ${lote.piezas} perfumes surtidos`}
              sizes="(max-width: 1024px) 100vw, 45vw"
            />
          </div>
        </Cortina>
      </div>
    </Contenedor>
  );
}
