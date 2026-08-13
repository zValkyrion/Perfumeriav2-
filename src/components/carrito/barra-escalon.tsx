"use client";

import { Truck } from "lucide-react";
import { NumeroAnimado } from "@/components/comunes/numero-animado";
import { precio } from "@/lib/format";
import type { ResumenCarrito } from "@/lib/carrito";
import { cn } from "@/lib/utils";

/**
 * Barra de progreso hacia el siguiente escalón (§7.4).
 *
 * Es la palanca #1 para subir el ticket: dice exactamente cuántas piezas faltan,
 * a cuánto baja el precio y cuánto se ahorra. Nunca muestra un porcentaje suelto
 * sin decir qué hay que hacer para conseguirlo.
 */
export function BarraEscalon({
  resumen,
  className,
}: {
  resumen: ResumenCarrito;
  className?: string;
}) {
  const { siguiente, escalon, envioGratis, piezasTotales } = resumen;

  if (resumen.vacio) return null;

  // Ya está en el escalón máximo: se celebra en vez de pedir más.
  if (!siguiente) {
    return (
      <div
        className={cn(
          "border-gold/30 bg-gold-muted animate-escala rounded-md border px-3.5 py-3",
          className,
        )}
      >
        <p className="text-gold-light text-[13px] font-medium">
          Tienes el precio distribuidor: 40% de descuento en todo el pedido.
        </p>
        <p className="text-fg-muted mt-1 text-xs">
          Llevas {piezasTotales} piezas · ahorras {precio(resumen.ahorroVolumen)} MXN
        </p>
      </div>
    );
  }

  const faltanEnvio = Math.max(0, 3 - piezasTotales);

  return (
    <div
      className={cn(
        "border-border-soft bg-surface rounded-md border px-3.5 py-3",
        className,
      )}
    >
      <p className="text-[13px] leading-snug">
        <span className="text-gold-light font-medium">
          Agrega {siguiente.faltan}{" "}
          {siguiente.faltan === 1 ? "pieza" : "piezas"}
        </span>{" "}
        <span className="text-fg-muted">
          y bajas al {Math.round(siguiente.escalon.descuento * 100)}% —
        </span>{" "}
        <span className="text-success font-medium">
          ahorras <NumeroAnimado valor={siguiente.ahorroAdicional} /> más
        </span>
      </p>

      <div
        className="bg-surface-2 mt-2.5 h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(siguiente.progreso * 100)}
        aria-label={`Progreso hacia el escalón ${siguiente.escalon.nombre}`}
      >
        <div
          className="bg-gold-gradient h-full rounded-full transition-[width] duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${Math.max(6, siguiente.progreso * 100)}%` }}
        />
      </div>

      <p className="text-fg-subtle mt-2 flex items-center gap-1.5 text-[11px]">
        <Truck size={13} aria-hidden className={envioGratis ? "text-success" : ""} />
        {envioGratis ? (
          <span className="text-success">Envío gratis aplicado</span>
        ) : (
          <span>
            Te {faltanEnvio === 1 ? "falta" : "faltan"} {faltanEnvio}{" "}
            {faltanEnvio === 1 ? "pieza" : "piezas"} para el envío gratis
          </span>
        )}
        <span aria-hidden>·</span>
        <span>Ahora: {escalon.etiqueta}</span>
      </p>
    </div>
  );
}
