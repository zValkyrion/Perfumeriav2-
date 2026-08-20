"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ML_PAQUETE } from "@/lib/carrito";
import { CUPONES } from "@/lib/volumen";
import type { ItemCarrito } from "@/types";

/** Pedido recién confirmado, para poder pintar la pantalla de gracias. */
export interface PedidoConfirmado {
  folio: string;
  fecha: string;
  correo: string;
  nombre: string;
  ciudad: string;
  estado: string;
  envio: string;
  diasEntrega: string;
  metodoPago: string;
  total: number;
  piezas: number;
  items: ItemCarrito[];
}

interface Estado {
  carrito: ItemCarrito[];
  guardados: ItemCarrito[];
  favoritos: string[];
  /** Muestra los precios de mayoreo en todo el sitio (§7.2). */
  modoMayoreo: boolean;
  cupon: string | null;
  ultimoPedido: PedidoConfirmado | null;

  /**
   * Falso hasta que `persist` termina de leer localStorage. `persist` rehidrata
   * después del primer render, así que los componentes que dependen del carrito
   * pintan un estado neutro hasta que esto se pone en `true`. Sin esto, el HTML
   * del servidor (carrito vacío) y el del cliente (carrito con piezas) difieren
   * y React lanza un error de hidratación (§18: cero errores en consola).
   */
  hidratado: boolean;
  setHidratado: () => void;
  drawerAbierto: boolean;

  agregar: (productoId: string, ml: number, cantidad?: number) => void;
  agregarPaquete: (slug: string, cantidad?: number) => void;
  cambiarCantidad: (productoId: string, ml: number, cantidad: number) => void;
  quitar: (productoId: string, ml: number) => void;
  guardarParaDespues: (productoId: string, ml: number) => void;
  regresarAlCarrito: (productoId: string, ml: number) => void;
  quitarGuardado: (productoId: string, ml: number) => void;
  vaciar: () => void;

  alternarFavorito: (productoId: string) => void;
  quitarFavorito: (productoId: string) => void;

  setModoMayoreo: (valor: boolean) => void;
  aplicarCupon: (codigo: string) => boolean;
  quitarCupon: () => void;

  /** Cierra el pedido: guarda el comprobante y vacía el carrito. */
  confirmarPedido: (pedido: PedidoConfirmado) => void;

  /**
   * De quién es este carrito y con qué versión del servidor quedó igualado.
   *
   * `null` mientras nadie ha iniciado sesión en este navegador: entonces el
   * carrito es anónimo y al entrar se **fusiona** con el de la cuenta. Una vez
   * puesto, el carrito local ya es el de esa cuenta y volver a fusionar sumaría
   * las cantidades otra vez en cada recarga.
   *
   * El `sello` es el `actualizadoEn` que devolvió el servidor la última vez.
   * Sirve para distinguir "nadie más lo tocó, mandan mis cambios" de "otro
   * aparato escribió después, me quedo con lo suyo".
   */
  sincronizado: { cuenta: string; sello: string } | null;

  /**
   * Adopta el carrito que resultó de reconciliarse con la cuenta.
   *
   * Lo llama `SincronizarCuenta`. La decisión de fusionar, adoptar o conservar
   * vive allí; aquí solo se deja el resultado con su marca.
   */
  adoptarRemoto: (
    datos: { carrito: ItemCarrito[]; guardados: ItemCarrito[]; favoritos: string[] },
    marca: { cuenta: string; sello: string },
  ) => void;

  /** Actualiza el sello tras subir un cambio, sin tocar el carrito. */
  marcarSello: (sello: string) => void;

  /**
   * Cierra la sesión del carrito: se lleva lo que era de esa cuenta.
   *
   * Un carrito que ya viajó a una cuenta no se queda en el navegador cuando esa
   * persona se va. Si no, la siguiente que entrara en el mismo aparato se
   * encontraría los frascos de la anterior sumados a los suyos. El carrito
   * anónimo —el de quien nunca inició sesión— no se toca: ese sí es de este
   * navegador.
   */
  olvidarCuenta: () => void;

  abrirDrawer: () => void;
  cerrarDrawer: () => void;
  setDrawer: (abierto: boolean) => void;
}

const mismo = (a: ItemCarrito, productoId: string, ml: number) =>
  a.productoId === productoId && a.ml === ml;

export const useTienda = create<Estado>()(
  persist(
    (set, get) => ({
      carrito: [],
      guardados: [],
      favoritos: [],
      modoMayoreo: false,
      cupon: null,
      ultimoPedido: null,
      sincronizado: null,
      hidratado: false,
      setHidratado: () => set({ hidratado: true }),
      drawerAbierto: false,

      agregar: (productoId, ml, cantidad = 1) =>
        set((s) => {
          const existente = s.carrito.find((i) => mismo(i, productoId, ml));
          return {
            carrito: existente
              ? s.carrito.map((i) =>
                  mismo(i, productoId, ml)
                    ? { ...i, cantidad: i.cantidad + cantidad }
                    : i,
                )
              : [...s.carrito, { productoId, ml, cantidad }],
          };
        }),

      agregarPaquete: (slug, cantidad = 1) =>
        get().agregar(slug, ML_PAQUETE, cantidad),

      cambiarCantidad: (productoId, ml, cantidad) =>
        set((s) => ({
          carrito:
            cantidad <= 0
              ? s.carrito.filter((i) => !mismo(i, productoId, ml))
              : s.carrito.map((i) =>
                  mismo(i, productoId, ml) ? { ...i, cantidad } : i,
                ),
        })),

      quitar: (productoId, ml) =>
        set((s) => ({
          carrito: s.carrito.filter((i) => !mismo(i, productoId, ml)),
        })),

      guardarParaDespues: (productoId, ml) =>
        set((s) => {
          const item = s.carrito.find((i) => mismo(i, productoId, ml));
          if (!item) return s;
          return {
            carrito: s.carrito.filter((i) => !mismo(i, productoId, ml)),
            guardados: s.guardados.some((i) => mismo(i, productoId, ml))
              ? s.guardados
              : [...s.guardados, item],
          };
        }),

      regresarAlCarrito: (productoId, ml) =>
        set((s) => {
          const item = s.guardados.find((i) => mismo(i, productoId, ml));
          if (!item) return s;
          const existente = s.carrito.find((i) => mismo(i, productoId, ml));
          return {
            guardados: s.guardados.filter((i) => !mismo(i, productoId, ml)),
            carrito: existente
              ? s.carrito.map((i) =>
                  mismo(i, productoId, ml)
                    ? { ...i, cantidad: i.cantidad + item.cantidad }
                    : i,
                )
              : [...s.carrito, item],
          };
        }),

      quitarGuardado: (productoId, ml) =>
        set((s) => ({
          guardados: s.guardados.filter((i) => !mismo(i, productoId, ml)),
        })),

      vaciar: () => set({ carrito: [], cupon: null }),

      alternarFavorito: (productoId) =>
        set((s) => ({
          favoritos: s.favoritos.includes(productoId)
            ? s.favoritos.filter((id) => id !== productoId)
            : [...s.favoritos, productoId],
        })),

      quitarFavorito: (productoId) =>
        set((s) => ({
          favoritos: s.favoritos.filter((id) => id !== productoId),
        })),

      setModoMayoreo: (valor) => set({ modoMayoreo: valor }),

      aplicarCupon: (codigo) => {
        const limpio = codigo.trim().toUpperCase();
        if (!CUPONES[limpio]) return false;
        set({ cupon: limpio });
        return true;
      },

      quitarCupon: () => set({ cupon: null }),

      confirmarPedido: (pedido) =>
        set({ ultimoPedido: pedido, carrito: [], cupon: null }),

      adoptarRemoto: ({ carrito, guardados, favoritos }, marca) =>
        set({ carrito, guardados, favoritos, sincronizado: marca }),

      marcarSello: (sello) =>
        set((s) =>
          s.sincronizado ? { sincronizado: { ...s.sincronizado, sello } } : s,
        ),

      olvidarCuenta: () =>
        set((s) =>
          s.sincronizado === null
            ? s
            : {
                carrito: [],
                guardados: [],
                favoritos: [],
                cupon: null,
                sincronizado: null,
              },
        ),

      abrirDrawer: () => set({ drawerAbierto: true }),
      cerrarDrawer: () => set({ drawerAbierto: false }),
      setDrawer: (abierto) => set({ drawerAbierto: abierto }),
    }),
    {
      name: "aura-tienda",
      version: 1,
      // El estado de UI no se persiste: nadie quiere que el drawer del carrito
      // esté abierto al volver a entrar a la tienda.
      partialize: (s) => ({
        carrito: s.carrito,
        guardados: s.guardados,
        favoritos: s.favoritos,
        modoMayoreo: s.modoMayoreo,
        cupon: s.cupon,
        ultimoPedido: s.ultimoPedido,
        sincronizado: s.sincronizado,
      }),
      onRehydrateStorage: () => (estado) => {
        estado?.setHidratado();
      },
    },
  ),
);

/** `true` cuando el carrito ya se leyó de localStorage. */
export function useHidratado(): boolean {
  return useTienda((s) => s.hidratado);
}

export function useEsFavorito(productoId: string): boolean {
  return useTienda((s) => s.favoritos.includes(productoId));
}

export function usePiezasCarrito(): number {
  return useTienda((s) => s.carrito.reduce((n, i) => n + i.cantidad, 0));
}
