"use client";

import type { ItemCarrito, Pedido } from "@/types";

/**
 * Carrito y pedidos guardados en el servidor, por usuario.
 *
 * Resuelve lo que el `localStorage` no puede: el carrito armado en el teléfono
 * mientras se veía el catálogo en el sofá aparece en la computadora al pagar, y
 * los pedidos dejan de ser una lista de muestra.
 *
 * **El servidor es la copia, no el jefe.** La tienda sigue funcionando entera
 * sin red y sin cuenta: el carrito vive en `localStorage` como siempre, y esto
 * solo entra cuando hay sesión. Si la API no responde, no pasa nada visible —
 * quien está comprando no tiene por qué enterarse de que hubo un reintento.
 */

const BASE = process.env.NEXT_PUBLIC_API ?? "";
/** La misma clave que usa el panel: comparten origen y comparten sesión. */
const CLAVE_TOKEN = "radar:token";

export function haySincronizacion(): boolean {
  return BASE !== "";
}

export type CarritoRemoto = {
  carrito: ItemCarrito[];
  guardados: ItemCarrito[];
  favoritos: string[];
  actualizadoEn: string;
};

function token(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const t = token();
  if (!BASE || !t) throw new Error("Sin sesión");

  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${BASE}${ruta}`, {
      ...opciones,
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${t}`,
        ...opciones.headers,
      },
    });
    if (!res.ok) {
      const detalle = await res.json().catch(() => null);
      throw new Error(detalle?.error ?? `El servidor respondió ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(corte);
  }
}

export function leerCarritoRemoto() {
  return pedir<CarritoRemoto>("/carrito");
}

export function guardarCarritoRemoto(contenido: {
  carrito: ItemCarrito[];
  guardados: ItemCarrito[];
  favoritos: string[];
}) {
  return pedir<CarritoRemoto>("/carrito", {
    method: "PUT",
    body: JSON.stringify(contenido),
  });
}

export function leerPedidosRemotos() {
  return pedir<{ pedidos: Pedido[] }>("/pedidos");
}

export function guardarPedidoRemoto(pedido: {
  folio: string;
  fecha: string;
  estatus: string;
  total: number;
  piezas: number;
  items: ItemCarrito[];
}) {
  return pedir<{ ok: boolean; folio: string }>("/pedidos", {
    method: "POST",
    body: JSON.stringify(pedido),
  });
}

/* ── Fusión ─────────────────────────────────────────────────────────────── */

const clave = (i: ItemCarrito) => `${i.productoId}|${i.ml}`;

/**
 * Junta dos carritos sumando cantidades.
 *
 * **Suma, no reemplaza**, y esa es la decisión importante. Quien mete tres
 * frascos sin haber entrado y luego inicia sesión no espera que desaparezcan;
 * quien tenía un carrito guardado de la semana pasada tampoco espera perderlo.
 * De las dos formas de equivocarse —dejar de más o borrar de menos— solo una es
 * reversible con un clic, y es la de dejar de más.
 */
export function fusionarItems(
  local: ItemCarrito[],
  remoto: ItemCarrito[],
): ItemCarrito[] {
  const suma = new Map<string, ItemCarrito>();
  for (const i of [...remoto, ...local]) {
    const k = clave(i);
    const previo = suma.get(k);
    suma.set(k, previo ? { ...previo, cantidad: previo.cantidad + i.cantidad } : { ...i });
  }
  return [...suma.values()];
}

/** Los favoritos son un conjunto: unión, sin duplicados. */
export function fusionarFavoritos(local: string[], remoto: string[]): string[] {
  return [...new Set([...remoto, ...local])];
}
