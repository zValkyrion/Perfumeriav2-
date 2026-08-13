const mxn = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const entero = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });

/**
 * Formato de precio de la tienda: `$ 1,290.00 MXN` (§2).
 * Se usa donde el precio es protagonista: ficha, carrito, totales, checkout.
 */
export function precioMXN(valor: number): string {
  return `$ ${mxn.format(valor)} MXN`;
}

/**
 * Variante corta `$ 1,290.00` para contextos densos —tablas de escalones,
 * líneas de resumen— donde repetir "MXN" en cada celda es ruido visual.
 */
export function precio(valor: number): string {
  return `$ ${mxn.format(valor)}`;
}

/** `1,290` sin decimales, para cifras grandes de marketing. */
export function numero(valor: number): string {
  return entero.format(valor);
}

/** `$ 1,290` sin centavos, para titulares de utilidad estimada. */
export function precioRedondo(valor: number): string {
  return `$ ${entero.format(Math.round(valor))}`;
}

/** `-25%` */
export function porcentaje(valor: number): string {
  return `-${Math.round(valor * 100)}%`;
}

/** Precio por mililitro, para justificar el valor (§1.2.2 anclaje). */
export function precioPorMl(precioTotal: number, ml: number): string {
  return `$ ${mxn.format(precioTotal / ml)} / ml`;
}

const fechaLarga = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const fechaCorta = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatoFechaLarga(iso: string): string {
  return fechaLarga.format(new Date(`${iso}T12:00:00`));
}

export function formatoFechaCorta(iso: string): string {
  return fechaCorta.format(new Date(`${iso}T12:00:00`));
}
