import { getLote } from "@/data/lotes";
import { getPresentacion, getProductoPorId } from "@/data/productos";
import { getSet } from "@/data/sets";
import type { Escalon, ItemCarrito, Presentacion, Producto } from "@/types";
import { CUPONES, PIEZAS_ENVIO_GRATIS, escalonPara, siguienteEscalon, type SiguienteEscalon } from "./volumen";

/**
 * El §4 fija `ItemCarrito` con tres campos, así que los paquetes (lotes y sets)
 * viajan en la misma estructura usando `ml: 0` como marca y el slug del paquete
 * en `productoId`. Evita inventar un tipo paralelo y mantiene el contrato.
 */
export const ML_PAQUETE = 0;

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
  cupon: string | null;
  descuentoCupon: number;
  envio: number;
  envioGratis: boolean;
  total: number;
  ahorroTotal: number;
  vacio: boolean;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula el carrito completo.
 *
 * Los lotes y sets no entran a la escalera de volumen porque ya vienen con un
 * descuento mayor —sumarlos haría que un solo lote de 24 regalara precio de
 * distribuidor a todo lo demás—, pero sí cuentan para el envío gratis.
 */
export function resumenCarrito(
  items: ItemCarrito[],
  cupon: string | null = null,
): ResumenCarrito {
  const sueltos = items.filter((i) => i.ml !== ML_PAQUETE);
  const piezasSueltas = sueltos.reduce((n, i) => n + i.cantidad, 0);
  const escalon = escalonPara(Math.max(1, piezasSueltas));

  const lineas: LineaCarrito[] = [];

  for (const item of items) {
    if (item.ml === ML_PAQUETE) {
      const lote = getLote(item.productoId);
      if (lote) {
        lineas.push({
          clave: `lote:${lote.slug}`,
          tipo: "lote",
          item,
          nombre: lote.nombre,
          subtitulo: `Lote ${lote.tema} · ${lote.piezas} piezas`,
          imagen: lote.imagen,
          enlace: `/lotes/${lote.slug}`,
          piezasPorUnidad: lote.piezas,
          unitario: lote.precio,
          unitarioMenudeo: lote.precio + lote.utilidadEstimada,
          subtotal: redondear(lote.precio * item.cantidad),
          subtotalMenudeo: redondear(
            (lote.precio + lote.utilidadEstimada) * item.cantidad,
          ),
          stock: 99,
        });
        continue;
      }

      const set = getSet(item.productoId);
      if (set) {
        lineas.push({
          clave: `set:${set.slug}`,
          tipo: "set",
          item,
          nombre: set.nombre,
          subtitulo: "Set de regalo",
          imagen: set.imagen,
          enlace: `/catalogo/sets`,
          piezasPorUnidad: 1,
          unitario: set.precio,
          unitarioMenudeo: set.precioAnterior ?? set.precio,
          subtotal: redondear(set.precio * item.cantidad),
          subtotalMenudeo: redondear(
            (set.precioAnterior ?? set.precio) * item.cantidad,
          ),
          stock: set.stock,
        });
      }
      continue;
    }

    const producto = getProductoPorId(item.productoId);
    if (!producto) continue;

    const presentacion = getPresentacion(producto, item.ml);
    // Las ediciones limitadas quedan fuera de la escalera de mayoreo.
    const descuento = producto.esMayoreoElegible ? escalon.descuento : 0;
    const unitario = redondear(presentacion.precio * (1 - descuento));

    lineas.push({
      clave: `${producto.id}:${item.ml}`,
      tipo: "producto",
      item,
      nombre: producto.nombre,
      subtitulo: `${presentacion.ml} ml · ${producto.concentracion}`,
      imagen: producto.imagenes[0]!,
      enlace: `/producto/${producto.slug}`,
      piezasPorUnidad: 1,
      unitario,
      unitarioMenudeo: presentacion.precio,
      subtotal: redondear(unitario * item.cantidad),
      subtotalMenudeo: redondear(presentacion.precio * item.cantidad),
      stock: presentacion.stock,
      producto,
      presentacion,
    });
  }

  const piezasTotales = lineas.reduce(
    (n, l) => n + l.piezasPorUnidad * l.item.cantidad,
    0,
  );

  const subtotalMenudeo = redondear(
    lineas.reduce((n, l) => n + l.subtotalMenudeo, 0),
  );
  const subtotal = redondear(lineas.reduce((n, l) => n + l.subtotal, 0));
  const ahorroVolumen = redondear(subtotalMenudeo - subtotal);

  const cuponValido = cupon && CUPONES[cupon] ? cupon : null;
  const descuentoCupon = cuponValido
    ? redondear(subtotal * CUPONES[cuponValido]!.descuento)
    : 0;

  const envioGratis = piezasTotales >= PIEZAS_ENVIO_GRATIS;
  const envio = lineas.length === 0 || envioGratis ? 0 : 149;

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
    piezasSueltas,
    piezasTotales,
    escalon,
    siguiente:
      piezasSueltas > 0
        ? siguienteEscalon(piezasSueltas, precioReferencia, baseSueltos)
        : null,
    subtotalMenudeo,
    subtotal,
    ahorroVolumen,
    cupon: cuponValido,
    descuentoCupon,
    envio,
    envioGratis,
    total: redondear(subtotal - descuentoCupon + envio),
    ahorroTotal: redondear(ahorroVolumen + descuentoCupon),
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
