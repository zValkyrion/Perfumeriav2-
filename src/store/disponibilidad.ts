import { useMemo } from "react";
import { create } from "zustand";
import {
  fuenteDeCatalogo,
  type Disponibilidad,
  type ProductoPrecio,
  type SetPrecio,
} from "../../compartido/catalogo";
import type { FuentePrecios } from "../../compartido/cotizacion";
import { FUENTE_TIENDA } from "@/data/fuente-precios";
import { presentacionesDe } from "@/data/productos";
import type { Producto, SetRegalo } from "@/types";

/**
 * Lo que se vende y a cuánto, **ahora**.
 *
 * La tienda se compila con el catálogo de ese momento. Al abrirse pregunta
 * `GET /disponibilidad` y, si responde, lo agotado, lo oculto y los precios
 * del panel mandan sobre lo compilado: en la tarjeta, en la ficha, en el
 * carrito y en el total del checkout, que así coincide con lo que cobra el
 * servidor. Si no responde —o no hay API, como en GitHub Pages— se sigue con
 * lo compilado, que es lo que se hacía antes.
 */

interface Vivo {
  generado: string;
  productos: ReadonlyMap<string, ProductoPrecio>;
  sets: ReadonlyMap<string, SetPrecio>;
}

interface EstadoDisponibilidad {
  /** `null` mientras no haya respuesta: se usa lo compilado. */
  vivo: Vivo | null;
  fuente: FuentePrecios;
  consultadaEn: number;
}

export const useDisponibilidad = create<EstadoDisponibilidad>(() => ({
  vivo: null,
  fuente: FUENTE_TIENDA,
  consultadaEn: 0,
}));

const API = (process.env.NEXT_PUBLIC_API ?? "").replace(/\/+$/, "");

/** Pide la disponibilidad. Nunca falla hacia arriba: sin respuesta, lo compilado. */
export async function consultarDisponibilidad(): Promise<void> {
  if (!API) return;
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${API}/disponibilidad`, { signal: ctrl.signal });
    if (!res.ok) return;
    const d = (await res.json()) as Disponibilidad;
    // Una respuesta vacía o rara no puede dejar la tienda sin nada que vender.
    if (!Array.isArray(d?.productos) || d.productos.length === 0 || !Array.isArray(d.sets)) {
      return;
    }
    useDisponibilidad.setState({
      vivo: {
        generado: d.generado,
        productos: new Map(d.productos.map((p) => [p.codigo, p])),
        sets: new Map(d.sets.map((s) => [s.slug, s])),
      },
      fuente: fuenteDeCatalogo(d),
      consultadaEn: Date.now(),
    });
  } catch {
    // Sin red o sin API: se queda lo compilado.
  } finally {
    clearTimeout(corte);
  }
}

/** Con qué se cotiza ahora mismo, fuera de React (el carrito, el aviso). */
export const fuenteVigente = () => useDisponibilidad.getState().fuente;

/** Lo mismo dentro de un componente, que se vuelve a pintar al llegar. */
export const useFuentePrecios = () => useDisponibilidad((s) => s.fuente);

/**
 * El producto compilado con lo que dice la disponibilidad. Uno que ya no
 * viene en ella se ocultó o se borró después del build: se enseña agotado,
 * que es lo más cerca de «no se puede comprar» sin romper la página.
 */
export function productoVivo(p: Producto, vivo: Vivo | null): Producto {
  if (!vivo) return p;
  const d = vivo.productos.get(p.codigo);
  if (!d) {
    return { ...p, agotado: true, presentaciones: p.presentaciones.map((v) => ({ ...v, stock: 0 })) };
  }
  return { ...p, agotado: d.agotado, presentaciones: presentacionesDe(d) };
}

export function setVivo(s: SetRegalo, vivo: Vivo | null): SetRegalo {
  if (!vivo) return s;
  const d = vivo.sets.get(s.slug);
  if (!d) return { ...s, stock: 0 };
  return {
    ...s,
    precio: d.precio,
    precioAnterior: d.precioAnterior,
    stock: d.agotado ? 0 : 999,
  };
}

export function useProductoVivo(p: Producto): Producto {
  const vivo = useDisponibilidad((s) => s.vivo);
  return useMemo(() => productoVivo(p, vivo), [p, vivo]);
}

export function useSetVivo(s: SetRegalo): SetRegalo {
  const vivo = useDisponibilidad((e) => e.vivo);
  return useMemo(() => setVivo(s, vivo), [s, vivo]);
}
