import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Cortina, TituloRevelado } from "@/components/comunes/efectos";
import { Imagen } from "@/components/comunes/imagen";
import { Contenedor } from "@/components/comunes/layout";
import { UTILIDAD_MAXIMA } from "@/data/lotes";
import { ESCALONES } from "@/lib/volumen";
import { precioRedondo } from "@/lib/format";

const BENEFICIOS = [
  "Sin mínimo de compra ni papeleo",
  "Mezclas los modelos que quieras",
  "Envío gratis desde 3 piezas",
  "Cambiamos el modelo que no te rote",
];

/** Bloque de mayoreo de la home (§8.6). */
export function BloqueMayoreo() {
  return (
    <Contenedor>
      <div className="border-border-soft grid overflow-hidden rounded-lg border lg:grid-cols-2">
        {/* La foto se descubre como una cortina de izquierda a derecha
            mientras se desescala: material que se despliega, no un fundido. */}
        <Cortina className="bg-bg relative order-1 aspect-4/3 lg:order-none lg:aspect-auto lg:min-h-[440px]">
          <div className="absolute inset-0">
            <Imagen
              src="/lotes/lote-24-negocio.webp"
              alt="Lote de mayoreo EL REY DE LOS PERFUMES con veinticuatro perfumes"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </Cortina>

        <div className="order-2 p-6 lg:order-none lg:p-12">
          <p className="eyebrow mb-3">Mayoreo</p>
          <TituloRevelado
            texto="Convierte el perfume en tu negocio."
            className="font-display text-[26px] leading-tight tracking-tight text-balance lg:text-[40px]"
          />
          <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
            Gana hasta{" "}
            <strong className="text-gold-light font-medium">
              {precioRedondo(UTILIDAD_MAXIMA)} MXN
            </strong>{" "}
            con un solo lote de 50 piezas, vendiendo al precio que publicamos en
            esta tienda.
          </p>

          <table className="mt-6 w-full text-left text-sm">
            <caption className="sr-only">
              Escalones de descuento por volumen
            </caption>
            <thead>
              <tr className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                <th scope="col" className="pb-2 font-normal">
                  Piezas
                </th>
                <th scope="col" className="pb-2 font-normal">
                  Descuento
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  Nivel
                </th>
              </tr>
            </thead>
            <tbody className="divide-border-soft divide-y">
              {ESCALONES.map((e) => (
                <tr key={e.nombre}>
                  <td data-precio className="py-2.5">
                    {e.max === null ? `${e.min}+` : `${e.min} – ${e.max}`}
                  </td>
                  <td
                    data-precio
                    className={
                      e.descuento > 0 ? "text-gold-light py-2.5 font-medium" : "py-2.5"
                    }
                  >
                    {e.descuento === 0
                      ? "Precio menudeo"
                      : `−${Math.round(e.descuento * 100)}%`}
                  </td>
                  <td className="text-fg-muted py-2.5 text-right">{e.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {BENEFICIOS.map((b) => (
              <li key={b} className="text-fg-muted flex items-start gap-2 text-sm">
                <Check size={15} className="text-gold mt-0.5 shrink-0" aria-hidden />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-7">
            <Button asChild variant="gold" size="touch">
              <Link href="/lotes">Ver lotes de mayoreo</Link>
            </Button>
          </div>
        </div>
      </div>
    </Contenedor>
  );
}
