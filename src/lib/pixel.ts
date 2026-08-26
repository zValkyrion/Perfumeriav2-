"use client";

/**
 * Pixel de Meta.
 *
 * Se activa con `NEXT_PUBLIC_META_PIXEL`. **Sin esa variable no se carga nada**:
 * ni el script, ni la cookie, ni una sola petición a Facebook. Así el sitio de
 * desarrollo no ensucia las estadísticas de la campaña con visitas propias, y
 * quien clone el repositorio no arrastra un identificador ajeno.
 *
 * Los eventos se mandan con los nombres estándar de Meta —`ViewContent`,
 * `AddToCart`, `InitiateCheckout`, `Purchase`— porque son los que el
 * Administrador de anuncios sabe optimizar. Un nombre inventado entra como
 * evento personalizado y no sirve para pujar por conversiones.
 */

export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL ?? "";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown };
  }
}

export type EventoPixel =
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase"
  | "Search"
  | "Lead"
  | "AddToWishlist"
  | "Contact";

export interface DatosPixel {
  content_ids?: string[];
  content_name?: string;
  content_type?: "product" | "product_group";
  contents?: { id: string; quantity: number; item_price?: number }[];
  value?: number;
  currency?: "MXN";
  num_items?: number;
  search_string?: string;
}

/**
 * Manda un evento. Silencioso si el pixel no está configurado o si el script
 * todavía no cargó: una compra no se cae porque el rastreo no esté listo.
 */
export function pixel(evento: EventoPixel, datos?: DatosPixel): void {
  if (!PIXEL_ID || typeof window === "undefined") return;
  try {
    window.fbq?.("track", evento, datos);
  } catch {
    // El rastreo nunca interrumpe la compra.
  }
}
