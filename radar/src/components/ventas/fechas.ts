/**
 * Fechas del panel de ventas, **siempre en calendario de México**.
 *
 * El servidor corta los días con `pedido.fecha` (hora de México). Si el panel
 * calculara «hoy» con el reloj del teléfono —o en UTC—, a partir de las 18:00
 * pediría el día siguiente y el dueño vería «hoy: $0» con la tienda vendiendo.
 * Todas las fechas viajan como texto `AAAA-MM-DD`; para sumar días se usa el
 * mediodía UTC, que no cambia de día con ningún horario de verano.
 */

const ZONA = "America/Mexico_City";

/** `AAAA-MM-DD` de hoy en México. */
export function hoyMexico(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${de("year")}-${de("month")}-${de("day")}`;
}

export const esFecha = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días del rango, los dos extremos incluidos. */
export function diasDelRango(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000) + 1;
}

/** El tope del servidor para `/admin/ventas`. */
export const MAX_DIAS = 400;

export type IdRango = "hoy" | "7" | "30" | "mes" | "mesPasado" | "anio" | "personalizado";

export const RANGOS: { id: IdRango; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "7", etiqueta: "7 días" },
  { id: "30", etiqueta: "30 días" },
  { id: "mes", etiqueta: "Este mes" },
  { id: "mesPasado", etiqueta: "Mes pasado" },
  { id: "anio", etiqueta: "Este año" },
  { id: "personalizado", etiqueta: "Personalizado" },
];

/** Desde y hasta de un rango fijo, contados desde `hoy` (México). */
export function rangoDe(id: Exclude<IdRango, "personalizado">, hoy: string): { desde: string; hasta: string } {
  const [anio, mes] = hoy.split("-");
  switch (id) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "7":
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case "30":
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case "mes":
      return { desde: `${anio}-${mes}-01`, hasta: hoy };
    case "mesPasado": {
      // El último día del mes pasado es el día anterior al 1 de este.
      const hasta = sumarDias(`${anio}-${mes}-01`, -1);
      return { desde: `${hasta.slice(0, 7)}-01`, hasta };
    }
    case "anio":
      return { desde: `${anio}-01-01`, hasta: hoy };
  }
}

/** «27 sep» (o «27 sep 2025» si no es de este año). */
export function diaLegible(fecha: string, hoy = hoyMexico()): string {
  const mismoAnio = fecha.slice(0, 4) === hoy.slice(0, 4);
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(mismoAnio ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

/** «del 1 al 27 sep», «27 sep», «del 30 ago al 5 sep». */
export function rangoLegible(desde: string, hasta: string, hoy = hoyMexico()): string {
  if (desde === hasta) return diaLegible(desde, hoy);
  return `del ${diaLegible(desde, hoy)} al ${diaLegible(hasta, hoy)}`;
}
