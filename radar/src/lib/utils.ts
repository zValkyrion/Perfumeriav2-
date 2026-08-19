import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Número en formato internacional.
 *
 * Sin la lada, wa.me no abre nada desde el extranjero — y el extranjero es donde
 * se está usando la app. Si el número ya la trae escrita, no se duplica.
 */
export function numeroCompleto(lada: string, numero: string): string {
  const n = soloDigitos(numero);
  const l = soloDigitos(lada);
  if (!l || n.startsWith(l)) return n;
  return l + n;
}

/** Enlace de WhatsApp con un mensaje cualquiera precargado. */
export function enlaceWhatsappTexto(lada: string, numero: string, texto: string): string {
  return `https://wa.me/${numeroCompleto(lada, numero)}?text=${encodeURIComponent(texto)}`;
}

/** Enlace de WhatsApp con el saludo de seguimiento por defecto. */
export function enlaceWhatsapp(lada: string, numero: string, nombre: string): string {
  const tel = numeroCompleto(lada, numero);
  const texto = encodeURIComponent(
    `Hola${nombre ? ` ${nombre}` : ""}, le escribo de EL REY DE LOS PERFUMES. Estuvimos en su local y quisiéramos avanzar con la cotización.`,
  );
  return `https://wa.me/${tel}?text=${texto}`;
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
