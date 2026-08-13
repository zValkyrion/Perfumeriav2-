"use client";

import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Imagen } from "@/components/comunes/imagen";
import { Precio, PrecioAnterior, Descuento } from "@/components/comunes/precio";
import { precio as fmt } from "@/lib/format";
import { useTienda } from "@/store/tienda";
import type { SetRegalo } from "@/types";

export function TarjetaSet({ set }: { set: SetRegalo }) {
  const agregarPaquete = useTienda((s) => s.agregarPaquete);
  const abrirDrawer = useTienda((s) => s.abrirDrawer);

  const descuento = set.precioAnterior
    ? 1 - set.precio / set.precioAnterior
    : 0;

  return (
    <article className="border-border-soft bg-surface lift flex flex-col overflow-hidden rounded-md border">
      <div className="bg-bg relative aspect-4/3 overflow-hidden">
        <Imagen
          src={set.imagen}
          alt={set.nombre}
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 33vw"
          quality={65}
        />
      </div>

      <div className="flex flex-1 flex-col p-4 lg:p-5">
        <h3 className="font-display text-xl leading-tight">{set.nombre}</h3>

        <p className="text-fg-muted mt-2 text-[13px] leading-relaxed">
          {set.descripcion}
        </p>

        <ul className="mt-4 space-y-1.5">
          {set.incluye.map((i) => (
            <li key={i} className="text-fg-muted flex items-start gap-2 text-[13px]">
              <Check size={14} className="text-gold mt-0.5 shrink-0" aria-hidden />
              {i}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Precio valor={set.precio} className="text-xl font-medium" />
          {set.precioAnterior ? (
            <>
              <PrecioAnterior valor={set.precioAnterior} />
              <Descuento fraccion={descuento} />
            </>
          ) : null}
        </div>

        {set.stock <= 15 ? (
          <p className="text-danger mt-1.5 text-[11px]">
            Solo quedan {set.stock}
          </p>
        ) : null}

        <div className="mt-4 pt-1">
          <Button
            variant="goldOutline"
            size="touch"
            className="w-full"
            onClick={() => {
              agregarPaquete(set.slug, 1);
              abrirDrawer();
              toast.success(`${set.nombre} agregado`, {
                description: `${fmt(set.precio)} MXN`,
              });
            }}
          >
            <Plus size={16} aria-hidden />
            Agregar set
          </Button>
        </div>
      </div>
    </article>
  );
}
