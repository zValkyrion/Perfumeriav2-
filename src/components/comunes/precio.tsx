import { cn } from "@/lib/utils";
import { precio as corto, precioMXN, porcentaje } from "@/lib/format";

/**
 * Precio con cifras tabulares. `data-precio` activa `tabular-nums` desde
 * globals.css, para que el número no "salte" al recalcular un escalón.
 */
export function Precio({
  valor,
  moneda = false,
  className,
}: {
  valor: number;
  /** Añade el sufijo MXN. Se usa donde el precio es protagonista (§2). */
  moneda?: boolean;
  className?: string;
}) {
  return (
    <span data-precio className={cn("whitespace-nowrap", className)}>
      {moneda ? precioMXN(valor) : corto(valor)}
    </span>
  );
}

/** Precio anterior tachado — el ancla contra la que se lee la oferta. */
export function PrecioAnterior({
  valor,
  className,
}: {
  valor: number;
  className?: string;
}) {
  return (
    <span
      data-precio
      className={cn("text-fg-subtle text-sm line-through", className)}
    >
      {corto(valor)}
      <span className="sr-only"> pesos, precio anterior</span>
    </span>
  );
}

/** Etiqueta de ahorro: -25%. */
export function Descuento({
  fraccion,
  className,
}: {
  fraccion: number;
  className?: string;
}) {
  if (fraccion <= 0) return null;
  return (
    <span
      data-precio
      className={cn(
        "bg-gold-muted text-gold-light rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {porcentaje(fraccion)}
    </span>
  );
}
