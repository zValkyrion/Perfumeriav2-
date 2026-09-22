"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ML_PAQUETE, stockDisponible } from "@/lib/carrito";
import { CUPONES } from "@/lib/volumen";
import type { IdPago } from "@/data/pagos";
import type { ItemCarrito } from "@/types";

/**
 * Pedido recién confirmado, para poder pintar la pantalla de gracias.
 *
 * Lleva la dirección y el teléfono completos, y no solo ciudad y estado, porque
 * de aquí sale el aviso de compra: el mensaje con el que la tienda contacta al
 * comprador por WhatsApp (`src/lib/aviso-pedido.ts`). Un aviso sin calle ni
 * teléfono obliga a pedir los datos otra vez, que es justo lo que la página
 * tenía que ahorrar.
 */
/**
 * Lo que hace falta para volver a comprar sin teclear nada.
 *
 * Es la dirección de la última compra más la forma de pago elegida: justo lo
 * que el checkout pediría otra vez y la persona volvería a escribir igual.
 */
export interface DatosExpres {
  correo: string;
  nombre: string;
  telefono: string;
  calle: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  referencias?: string;
  /** `id` de `OPCIONES_ENVIO`. */
  envio: string;
  metodo: IdPago;
}

export interface PedidoConfirmado {
  folio: string;
  fecha: string;
  correo: string;
  nombre: string;
  telefono: string;
  calle: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  referencias?: string;
  envio: string;
  diasEntrega: string;
  /** Cómo se paga, en el texto que lee el comprador. */
  metodoPago: string;
  /** Cuál de los tres métodos, para saber qué instrucciones tocan. */
  metodoId: IdPago;
  /** Comisión del cobro en destino. Cero salvo en contra entrega. */
  comision: number;
  /**
   * Descuento extra por pagar con transferencia. Opcional porque los pedidos
   * guardados en el navegador antes de que existiera no lo traen.
   */
  descuentoTransferencia?: number;
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
   * Con qué datos se compró la última vez, para la compra exprés.
   *
   * Vive en este navegador y en ningún otro sitio: son los mismos datos que la
   * persona acaba de teclear en su propio aparato, no un perfil que la tienda
   * guarde por su cuenta. Se borra con «usar otros datos» y al cerrar sesión.
   *
   * No incluye nada de pago —Clip cobra en su pantalla, la transferencia y el
   * contra entrega se acuerdan por WhatsApp—, así que aquí no hay ningún dato
   * bancario que guardar. Solo a dónde va el paquete y cómo se prefiere pagar.
   */
  expres: DatosExpres | null;
  guardarExpres: (datos: DatosExpres) => void;
  olvidarExpres: () => void;

  /**
   * Bandera de un solo uso: «vengo de Comprar en 1 toque».
   *
   * No se persiste. Es lo que le dice al checkout que abra directo la pantalla
   * de revisión en vez del formulario. Va por el estado y no por la URL porque
   * la tienda es una exportación estática: leer parámetros de consulta obliga a
   * envolver la página en un límite de Suspense, y eso es exactamente lo que
   * dejó 66 páginas en blanco la última vez.
   */
  entradaExpres: boolean;
  pedirExpres: () => void;
  consumirExpres: () => void;

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
      expres: null,
      entradaExpres: false,
      sincronizado: null,
      hidratado: false,
      setHidratado: () => set({ hidratado: true }),
      drawerAbierto: false,

      agregar: (productoId, ml, cantidad = 1) =>
        set((s) => {
          // El tope es el stock, y se aplica sobre el total de la línea, no
          // sobre lo que se añade: sin esto, dos pulsaciones de «Agregar al
          // carrito» dejaban 14 piezas de algo que solo tiene 7.
          const tope = stockDisponible(productoId, ml);
          const existente = s.carrito.find((i) => mismo(i, productoId, ml));
          const nueva = Math.min(tope, (existente?.cantidad ?? 0) + cantidad);
          if (nueva <= 0) return s;

          return {
            carrito: existente
              ? s.carrito.map((i) =>
                  mismo(i, productoId, ml) ? { ...i, cantidad: nueva } : i,
                )
              : [...s.carrito, { productoId, ml, cantidad: nueva }],
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
                  mismo(i, productoId, ml)
                    ? {
                        ...i,
                        cantidad: Math.min(
                          cantidad,
                          stockDisponible(productoId, ml),
                        ),
                      }
                    : i,
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
          // Mismo tope que al agregar: volver del "guardado para después"
          // tampoco puede pasar de las existencias.
          const tope = stockDisponible(productoId, ml);
          const nueva = Math.min(
            tope,
            (existente?.cantidad ?? 0) + item.cantidad,
          );
          return {
            guardados: s.guardados.filter((i) => !mismo(i, productoId, ml)),
            carrito: existente
              ? s.carrito.map((i) =>
                  mismo(i, productoId, ml) ? { ...i, cantidad: nueva } : i,
                )
              : [...s.carrito, { ...item, cantidad: nueva }],
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

      guardarExpres: (datos) => set({ expres: datos }),
      olvidarExpres: () => set({ expres: null, entradaExpres: false }),

      pedirExpres: () => set({ entradaExpres: true }),
      consumirExpres: () => set({ entradaExpres: false }),

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
                // La dirección de la compra exprés se va con su dueño: la
                // siguiente persona que use este aparato no puede encontrarse
                // el domicilio y el teléfono de la anterior ya escritos.
                expres: null,
              },
        ),

      abrirDrawer: () => set({ drawerAbierto: true }),
      cerrarDrawer: () => set({ drawerAbierto: false }),
      setDrawer: (abierto) => set({ drawerAbierto: abierto }),
    }),
    {
      name: "aura-tienda",
      version: 2,
      /**
       * La versión 2 añadió teléfono, dirección y método al comprobante. Un
       * `ultimoPedido` guardado antes no los tiene, así que se descarta: un
       * recibo viejo no vale nada y pintarlo a medias rompería la pantalla de
       * gracias. Todo lo demás —carrito, guardados, favoritos— pasa intacto,
       * que es lo que de verdad dolería perder.
       */
      migrate: (guardado, version) => {
        const estado = guardado as Partial<Estado> | undefined;
        if (estado && version < 2) {
          return { ...estado, ultimoPedido: null } as Estado;
        }
        return estado as Estado;
      },
      // El estado de UI no se persiste: nadie quiere que el drawer del carrito
      // esté abierto al volver a entrar a la tienda.
      partialize: (s) => ({
        carrito: s.carrito,
        guardados: s.guardados,
        favoritos: s.favoritos,
        modoMayoreo: s.modoMayoreo,
        cupon: s.cupon,
        ultimoPedido: s.ultimoPedido,
        expres: s.expres,
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
