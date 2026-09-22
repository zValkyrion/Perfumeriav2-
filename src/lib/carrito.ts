import {
  ML_PAQUETE,
  cotizar,
  type Cotizacion,
} from "../../compartido/cotizacion";
import type { IdEnvio, IdPago } from "../../compartido/reglas";
import { FUENTE_TIENDA } from "@/data/fuente-precios";
import { getLote } from "@/data/lotes";
import { getPresentacion, getProductoPorId } from "@/data/productos";
import { getSet } from "@/data/sets";
import type { Escalon, ItemCarrito, Presentacion, Producto } from "@/types";
import { siguienteEscalon, type SiguienteEscalon } from "./volumen";

/**
 * El §4 fija `ItemCarrito` con tres campos, así que los paquetes (lotes y sets)
 * viajan en la misma estructura usando `ml: 0` como marca y el slug del paquete
 * en `productoId`. Evita inventar un tipo paralelo y mantiene el contrato.
 */
export { ML_PAQUETE };

export type TipoLinea = "producto" | "lote" | "set";

export interface LineaCarrito {
  clave: string;
  tipo: TipoLinea;
  item: ItemCarrito;
  nombre: string;
  /** Marca del producto, o el tema en el caso de un lote. */
  subtitulo: string;
  imagen: string;
  enlace: string;
  /** Piezas físicas que aporta una unidad de esta línea. */
  piezasPorUnidad: number;
  unitario: number;
  unitarioMenudeo: number;
  subtotal: number;
  subtotalMenudeo: number;
  stock: number;
  producto?: Producto;
  presentacion?: Presentacion;
}

export interface ResumenCarrito {
  lineas: LineaCarrito[];
  /** Piezas sueltas: las únicas que mueven la escalera de volumen. */
  piezasSueltas: number;
  /** Piezas físicas totales, incluyendo las que vienen dentro de paquetes. */
  piezasTotales: number;
  escalon: Escalon;
  siguiente: SiguienteEscalon | null;
  subtotalMenudeo: number;
  subtotal: number;
  ahorroVolumen: number;
  /** Piezas en el carrito que participan en el 3x2. */
  piezas3x2: number;
  /** Cuántas de esas salen gratis. */
  piezasGratis3x2: number;
  descuento3x2: number;
  cupon: string | null;
  descuentoCupon: number;
  /** Descuento extra por pagar con depósito o transferencia. */
  descuentoTransferencia: number;
  /**
   * La forma de pago que aplica, o `null` en el carrito, donde todavía no se ha
   * elegido. Puede diferir de la pedida: el contra entrega por encima del tope
   * se cobra con Clip.
   */
  metodo: IdPago | null;
  /** Costo del envío elegido (el estándar mientras no se elija otro). */
  envio: number;
  envioGratis: boolean;
  /**
   * Comisión del servicio de cobro en destino (pago contra entrega). En el
   * carrito es cero: todavía no se ha elegido cómo se paga.
   */
  comision: number;
  total: number;
  ahorroTotal: number;
  vacio: boolean;
}

export interface OpcionesResumen {
  metodo?: IdPago | null;
  envio?: IdEnvio | null;
}

/**
 * Cuántas unidades de una línea se pueden llegar a tener en el carrito.
 *
 * Vive aquí y no en la pantalla porque el tope tiene que valer para **todas**
 * las formas de agregar: la ficha, la tarjeta del catálogo y los sugeridos del
 * drawer. El control de cantidad ya no dejaba pasar del stock, pero pulsar
 * «Agregar al carrito» dos veces sumaba sobre lo que ya había: con 7 en
 * existencia se llegaba a 14 sin un solo aviso.
 *
 * Los lotes no tienen existencias propias —se arman al vender— y por eso
 * conservan el tope genérico que ya usaba el resumen.
 */
export function stockDisponible(productoId: string, ml: number): number {
  if (ml === ML_PAQUETE) {
    if (getLote(productoId)) return 99;
    return getSet(productoId)?.stock ?? 0;
  }
  const producto = getProductoPorId(productoId);
  if (!producto) return 0;
  return getPresentacion(producto, ml).stock;
}

/**
 * Una línea ya cotizada, con lo que hace falta para pintarla.
 *
 * La cuenta vive en `compartido/cotizacion.ts`; aquí solo se le pone nombre,
 * foto y enlace a cada línea.
 */
function lineaVisible(l: Cotizacion["lineas"][number]): LineaCarrito | null {
  const cifras = {
    item: l.item,
    piezasPorUnidad: l.piezasPorUnidad,
    unitario: l.unitario,
    unitarioMenudeo: l.unitarioMenudeo,
    subtotal: l.subtotal,
    subtotalMenudeo: l.subtotalMenudeo,
  };

  if (l.tipo === "paquete") {
    const lote = getLote(l.item.productoId);
    if (lote) {
      return {
        ...cifras,
        clave: `lote:${lote.slug}`,
        tipo: "lote",
        nombre: lote.nombre,
        subtitulo: `Lote ${lote.tema} · ${lote.piezas} piezas`,
        imagen: lote.imagen,
        enlace: `/lotes/${lote.slug}`,
        stock: 99,
      };
    }
    const set = getSet(l.item.productoId);
    if (!set) return null;
    return {
      ...cifras,
      clave: `set:${set.slug}`,
      tipo: "set",
      nombre: set.nombre,
      subtitulo: "Set de regalo",
      imagen: set.imagen,
      enlace: `/catalogo/sets`,
      stock: set.stock,
    };
  }

  const producto = getProductoPorId(l.item.productoId);
  if (!producto) return null;
  const presentacion = getPresentacion(producto, l.item.ml);
  return {
    ...cifras,
    clave: `${producto.id}:${l.item.ml}`,
    tipo: "producto",
    nombre: producto.nombre,
    subtitulo: `${presentacion.ml} ml · ${producto.concentracion}`,
    imagen: producto.imagenes[0]!,
    enlace: `/producto/${producto.slug}`,
    stock: presentacion.stock,
    producto,
    presentacion,
  };
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Calcula el carrito completo.
 *
 * Toda la aritmética —escalera, 3x2, cupón, transferencia, tope del 40%, envío y
 * comisión— la hace `cotizar`, la misma función con la que el servidor cobra.
 * El carrito se llama sin forma de pago (no hay descuento por transferencia ni
 * comisión todavía); el checkout pasa la elegida.
 */
export function resumenCarrito(
  items: ItemCarrito[],
  cupon: string | null = null,
  opciones: OpcionesResumen = {},
): ResumenCarrito {
  const c = cotizar(items, FUENTE_TIENDA, {
    cupon,
    metodo: opciones.metodo ?? null,
    envio: opciones.envio ?? null,
  });

  const lineas = c.lineas.flatMap((l) => {
    const visible = lineaVisible(l);
    return visible ? [visible] : [];
  });

  // Base sobre la que se mide "cuánto más ahorro si subo una pieza".
  const baseSueltos = redondear(
    lineas
      .filter((l) => l.tipo === "producto" && l.producto?.esMayoreoElegible)
      .reduce((n, l) => n + l.subtotalMenudeo, 0),
  );
  const precioReferencia =
    lineas.find((l) => l.tipo === "producto")?.unitarioMenudeo ?? 0;

  return {
    lineas,
    piezasSueltas: c.piezasSueltas,
    piezasTotales: c.piezasTotales,
    escalon: c.escalon,
    siguiente:
      c.piezasSueltas > 0
        ? siguienteEscalon(c.piezasSueltas, precioReferencia, baseSueltos)
        : null,
    subtotalMenudeo: c.subtotalMenudeo,
    subtotal: c.subtotal,
    ahorroVolumen: c.ahorroVolumen,
    piezas3x2: c.piezas3x2,
    piezasGratis3x2: c.piezasGratis3x2,
    descuento3x2: c.descuento3x2,
    cupon: c.cupon,
    descuentoCupon: c.descuentoCupon,
    descuentoTransferencia: c.descuentoTransferencia,
    metodo: c.metodo,
    envio: c.costoEnvio,
    envioGratis: c.envioGratis,
    comision: c.comision,
    total: c.total,
    ahorroTotal: c.ahorroTotal,
    vacio: lineas.length === 0,
  };
}

/** Mensaje de upsell: "Agrega 2 y bajas a $ 890.00 c/u — ahorras $ 340.00". */
export function mensajeSiguienteEscalon(
  resumen: ResumenCarrito,
): string | null {
  const s = resumen.siguiente;
  if (!s || s.faltan <= 0) return null;
  const piezas = s.faltan === 1 ? "1 pieza más" : `${s.faltan} piezas más`;
  return `Agrega ${piezas} y bajas al ${Math.round(s.escalon.descuento * 100)}% de descuento`;
}
