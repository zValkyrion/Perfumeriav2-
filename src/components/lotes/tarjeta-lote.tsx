import Link from "next/link";
import { Check, TrendingUp } from "lucide-react";
import { Imagen } from "@/components/comunes/imagen";
import { Precio, PrecioAnterior } from "@/components/comunes/precio";
import { valorMenudeoLote } from "@/data/lotes";
import { precioRedondo } from "@/lib/format";
import type { Lote } from "@/types";
import { BotonAgregarLote } from "./boton-agregar-lote";
import { cn } from "@/lib/utils";

export function TarjetaLote({
  lote,
  className,
  destacada = false,
}: {
  lote: Lote;
  className?: string;
  /** La tarjeta destacada lleva el borde dorado; solo debe haber una. */
  destacada?: boolean;
}) {
  const valorMenudeo = valorMenudeoLote(lote);

  return (
    <article
      className={cn(
        "bg-surface lift relative flex flex-col overflow-hidden rounded-md border",
        destacada ? "border-gold/45" : "border-border-soft",
        className,
      )}
    >
      {lote.masVendido ? (
        <span className="bg-gold-gradient text-bg absolute top-3 left-3 z-20 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase">
          Más vendido
        </span>
      ) : null}

      <Link
        href={`/lotes/${lote.slug}`}
        className="bg-bg relative block aspect-4/3 overflow-hidden"
      >
        <Imagen
          src={lote.imagen}
          alt={`${lote.nombre}: ${lote.piezas} perfumes surtidos`}
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 33vw"
          quality={65}
        />
      </Link>

      <div className="flex flex-1 flex-col p-4 lg:p-5">
        <p className="eyebrow">
          {lote.piezas} piezas · {lote.tema}
        </p>

        <h3 className="font-display mt-1.5 text-xl leading-tight">
          <Link href={`/lotes/${lote.slug}`} className="hover:text-gold-light">
            {lote.nombre}
          </Link>
        </h3>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Precio valor={lote.precio} className="text-2xl font-medium" />
          <PrecioAnterior valor={valorMenudeo} />
        </div>

        <p className="text-fg-muted mt-1 text-[13px]">
          Te sale a{" "}
          <Precio
            valor={lote.precioIndividualEquivalente}
            className="text-fg font-medium"
          />{" "}
          por pieza
        </p>

        <p className="text-success mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium">
          <TrendingUp size={14} aria-hidden />
          Ganas hasta {precioRedondo(lote.utilidadEstimada)} al revenderlo
        </p>

        <ul className="mt-4 space-y-1.5">
          {lote.incluye.slice(0, 3).map((i) => (
            <li key={i} className="text-fg-muted flex items-start gap-2 text-[13px]">
              <Check size={14} className="text-gold mt-0.5 shrink-0" aria-hidden />
              {i}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2 pt-1 sm:flex-row">
          <BotonAgregarLote
            slug={lote.slug}
            nombre={lote.nombre}
            precioLote={lote.precio}
            variante={destacada ? "gold" : "goldOutline"}
            className="flex-1"
          />
        </div>
      </div>
    </article>
  );
}
