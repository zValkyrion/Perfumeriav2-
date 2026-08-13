"use client";

import { useState } from "react";
import { Lock, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Precio } from "@/components/comunes/precio";
import type { ResumenCarrito } from "@/lib/carrito";
import { mejorPlazo } from "@/lib/volumen";
import { useTienda } from "@/store/tienda";

/** Panel de resumen del carrito y del checkout (§12). */
export function ResumenPedido({
  resumen,
  children,
  conCupon = true,
}: {
  resumen: ResumenCarrito;
  /** CTA propio de cada pantalla. */
  children?: React.ReactNode;
  conCupon?: boolean;
}) {
  const [codigo, setCodigo] = useState("");
  const aplicarCupon = useTienda((s) => s.aplicarCupon);
  const quitarCupon = useTienda((s) => s.quitarCupon);
  const msi = mejorPlazo(resumen.total);

  return (
    <div className="border-border-soft bg-surface rounded-lg border p-5">
      <h2 className="font-display mb-4 text-xl">Resumen del pedido</h2>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-fg-muted">
            Subtotal ({resumen.piezasTotales}{" "}
            {resumen.piezasTotales === 1 ? "pieza" : "piezas"})
          </dt>
          <dd>
            <Precio valor={resumen.subtotalMenudeo} />
          </dd>
        </div>

        {resumen.ahorroVolumen > 0 ? (
          <div className="text-success flex justify-between">
            <dt>Descuento por volumen ({resumen.escalon.nombre})</dt>
            <dd>
              −<Precio valor={resumen.ahorroVolumen} />
            </dd>
          </div>
        ) : null}

        {resumen.descuentoCupon > 0 ? (
          <div className="text-success flex justify-between">
            <dt className="flex items-center gap-1.5">
              Cupón {resumen.cupon}
              <button
                type="button"
                onClick={quitarCupon}
                aria-label="Quitar cupón"
                className="text-fg-subtle hover:text-danger"
              >
                <X size={13} aria-hidden />
              </button>
            </dt>
            <dd>
              −<Precio valor={resumen.descuentoCupon} />
            </dd>
          </div>
        ) : null}

        <div className="flex justify-between">
          <dt className="text-fg-muted">Envío</dt>
          <dd className={resumen.envioGratis ? "text-success font-medium" : ""}>
            {resumen.envioGratis ? "GRATIS" : <Precio valor={resumen.envio} />}
          </dd>
        </div>

        <div className="border-border-soft flex items-baseline justify-between border-t pt-3 text-lg font-medium">
          <dt>Total</dt>
          <dd>
            <Precio valor={resumen.total} moneda />
          </dd>
        </div>
      </dl>

      {msi ? (
        <p className="text-fg-muted mt-2 text-[13px]">
          o {msi.plazo} pagos de{" "}
          <span className="text-gold-light">
            <Precio valor={msi.pago} />
          </span>{" "}
          sin intereses
        </p>
      ) : null}

      {conCupon && !resumen.cupon ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (aplicarCupon(codigo)) {
              toast.success("Cupón aplicado", {
                description: "10% de descuento sobre el subtotal.",
              });
              setCodigo("");
            } else {
              toast.error("Ese cupón no existe o ya venció");
            }
          }}
          className="mt-4 flex gap-2"
        >
          <div className="relative flex-1">
            <Tag
              size={15}
              aria-hidden
              className="text-fg-subtle absolute top-1/2 left-3 -translate-y-1/2"
            />
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Código de cupón"
              aria-label="Código de cupón"
              className="h-11 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="touch">
            Aplicar
          </Button>
        </form>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}

      <p className="text-fg-subtle mt-4 flex items-center justify-center gap-1.5 text-[11px]">
        <Lock size={12} aria-hidden />
        Pago seguro · Datos cifrados · Facturamos sin costo
      </p>
    </div>
  );
}
