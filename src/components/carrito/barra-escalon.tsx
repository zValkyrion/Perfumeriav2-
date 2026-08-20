"use client";

import { Truck } from "lucide-react";
import { NumeroAnimado } from "@/components/comunes/numero-animado";
import { precio } from "@/lib/format";
import { ESCALON_TOPE, pct } from "@/lib/volumen";
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

  // Cuántas piezas participantes faltan para completar el siguiente 3x2. Con
  // dos en el carrito, la tercera sale gratis: decirlo es lo que convierte la
  // etiqueta del catálogo en una compra.
  const faltan3x2 = resumen.piezas3x2 > 0 ? (3 - (resumen.piezas3x2 % 3)) % 3 : 0;

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
          Tienes el mejor precio: {pct(ESCALON_TOPE.descuento)}% de descuento en
          todo el pedido.
        </p>
        <p className="text-fg-muted mt-1 text-xs">
          Llevas {piezasTotales} piezas · ahorras {precio(resumen.ahorroVolumen)} MXN
        </p>
        <Aviso3x2 faltan={faltan3x2} gratis={resumen.piezasGratis3x2} />
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
        <Aviso3x2 faltan={faltan3x2} gratis={resumen.piezasGratis3x2} enLinea />
      </p>
    </div>
  );
}

/**
 * El estado del 3x2, junto al del volumen.
 *
 * Con dos piezas participantes en el carrito, la tercera sale gratis: decirlo
 * ahí es lo que convierte la etiqueta del catálogo en una compra. Si no falta
 * ninguna, se confirma lo ya conseguido en vez de callar — un descuento que
 * aparece solo en el resumen se lee como un error de cuentas.
 */
function Aviso3x2({
  faltan,
  gratis,
  enLinea = false,
}: {
  faltan: number;
  gratis: number;
  enLinea?: boolean;
}) {
  if (faltan === 0 && gratis === 0) return null;

  const texto =
    faltan > 0 ? (
      <>
        Agrega {faltan} {faltan === 1 ? "pieza" : "piezas"} con 3x2 y{" "}
        {faltan === 1 ? "una sale gratis" : "otra sale gratis"}
      </>
    ) : (
      <>
        3x2: {gratis} {gratis === 1 ? "pieza gratis" : "piezas gratis"}
      </>
    );

  if (enLinea) {
    return (
      <>
        <span aria-hidden>·</span>
        <span className={faltan > 0 ? "text-gold-light" : "text-success"}>
          {texto}
        </span>
      </>
    );
  }

  return (
    <p
      className={cn(
        "mt-1 text-xs",
        faltan > 0 ? "text-gold-light" : "text-success",
      )}
    >
      {texto}
    </p>
  );
}
