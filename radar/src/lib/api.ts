"use client";

import type { Proveedor } from "@/lib/tipos";

/**
 * Cliente de la API en AWS.
 *
 * Todas las funciones fallan hacia arriba con un `Error` legible: en la calle la
 * red se cae a media operación y la app tiene que poder decir *qué* pasó, no
 * quedarse girando. Nada aquí bloquea la captura — el teléfono sigue guardando
 * en IndexedDB aunque esto no responda nunca.
 */

const BASE = process.env.NEXT_PUBLIC_API ?? "";

export function hayApi(): boolean {
  return BASE !== "";
}

/** Corta a los 15 s: sin esto, con señal pésima la petición cuelga para siempre. */
async function pedir<T>(
  ruta: string,
  opciones: RequestInit & { token?: string } = {},
): Promise<T> {
  if (!BASE) throw new Error("La app no tiene API configurada");

  const { token, ...resto } = opciones;
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(`${BASE}${ruta}`, {
      ...resto,
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...resto.headers,
      },
    });

    if (!res.ok) {
      const detalle = await res.json().catch(() => null);
      throw new Error(detalle?.error ?? `El servidor respondió ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("El servidor no respondió a tiempo");
    }
    throw e;
  } finally {
    clearTimeout(corte);
  }
}

export function acceso(pin: string, evaluador: string) {
  return pedir<{ token: string; evaluador: string }>("/acceso", {
    method: "POST",
    body: JSON.stringify({ pin, evaluador }),
  });
}

export function salud() {
  return pedir<{ ok: boolean }>("/salud");
}

export function listarRemoto(token: string) {
  return pedir<{ proveedores: Proveedor[] }>("/proveedores", { token });
}

export function subirProveedor(token: string, p: Proveedor) {
  return pedir<{ ok: boolean }>(`/proveedores/${p.id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(p),
  });
}

export function borrarRemoto(token: string, id: string) {
  return pedir<{ ok: boolean }>(`/proveedores/${id}`, { method: "DELETE", token });
}

export function urlDeSubida(
  token: string,
  meta: {
    proveedorId: string;
    fotoId: string;
    tipo: string;
    contentType: string;
    tomadaEn: string;
    lat: number | null;
    lng: number | null;
  },
) {
  return pedir<{ url: string; clave: string }>("/fotos", {
    method: "POST",
    token,
    body: JSON.stringify(meta),
  });
}

/**
 * Sube la foto directo a S3 con la URL prefirmada.
 *
 * No pasa por la API a propósito: con roaming, mandar la imagen por API Gateway
 * es pagar dos veces la misma transferencia.
 */
export async function subirFoto(url: string, blob: Blob): Promise<void> {
  const ctrl = new AbortController();
  // Más margen que el resto: una foto con mala señal tarda de verdad.
  const corte = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, {
      method: "PUT",
      body: blob,
      headers: { "content-type": blob.type || "image/webp" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`S3 rechazó la foto (${res.status})`);
  } finally {
    clearTimeout(corte);
  }
}
