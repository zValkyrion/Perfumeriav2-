import {
  CUPONES,
  DESCUENTO_MAXIMO,
  DESCUENTO_TRANSFERENCIA,
  PIEZAS_ENVIO_GRATIS,
  TARIFAS_ENVIO,
  comisionDe,
  escalonPara,
  hayContraEntrega,
  type Escalon,
  type IdEnvio,
  type IdPago,
} from "./reglas";

/**
 * Cuánto cuesta un pedido.
 *
 * Es la misma función en el navegador y en el servidor. El navegador la usa
 * para enseñar el total mientras se arma el carrito; la Lambda la vuelve a
 * correr al recibir el pedido y **su resultado es el que se cobra**. Lo que
 * mande el navegador como total no se lee: cualquiera puede editar su propio
 * JavaScript y mandar un cero.
 *
 * No sabe de dónde salen los precios. Los pide a una `FuentePrecios`, que hoy
 * es el catálogo compilado en la tienda y mañana será la base de datos, sin que
 * esta función cambie.
 */

/**
 * Los paquetes (lotes y sets) viajan en la misma estructura que un perfume
 * suelto, con `ml: 0` como marca y el slug del paquete en `productoId`.
 */
export const ML_PAQUETE = 0;

export interface ItemPedido {
  productoId: string;
  ml: number;
  cantidad: number;
}

export interface PrecioProducto {
  /** Precio de lista de la presentación pedida. */
  precio: number;
  /** Si entra a la escalera de volumen (las ediciones limitadas no). */
  mayoreo: boolean;
  /** Si participa en el 3x2. */
  promo3x2: boolean;
}

export interface PrecioPaquete {
  precio: number;
  /** Valor a precio de lista de lo que trae; sirve para enseñar el ahorro. */
  referencia: number;
  /** Piezas físicas por unidad: cuentan para el envío gratis. */
  piezas: number;
}

export interface FuentePrecios {
  producto(id: string, ml: number): PrecioProducto | undefined;
  paquete(id: string): PrecioPaquete | undefined;
}

export interface OpcionesCotizacion {
  cupon?: string | null;
  /** Sin forma de pago elegida —el carrito— no hay descuento por pago ni comisión. */
  metodo?: IdPago | null;
  /** Sin envío elegido se cotiza el estándar, que es el que puede salir gratis. */
  envio?: IdEnvio | null;
}

export interface LineaCotizada {
  /** Posición del artículo en la lista que se cotizó. */
  indice: number;
  item: ItemPedido;
  tipo: "producto" | "paquete";
  piezasPorUnidad: number;
  unitario: number;
  unitarioMenudeo: number;
  subtotal: number;
  subtotalMenudeo: number;
  /** Descuento por volumen aplicado a la línea: 0 si no entra a la escalera. */
  descuentoVolumen: number;
  promo3x2: boolean;
}

export interface Cotizacion {
  lineas: LineaCotizada[];
  /** Artículos que no existen en el catálogo: no se cobran ni cuentan piezas. */
  descartados: ItemPedido[];
  /** Piezas sueltas: las únicas que mueven la escalera de volumen. */
  piezasSueltas: number;
  /** Piezas físicas totales, incluyendo las que vienen dentro de paquetes. */
  piezasTotales: number;
  escalon: Escalon;
  subtotalMenudeo: number;
  subtotal: number;
  ahorroVolumen: number;
  piezas3x2: number;
  piezasGratis3x2: number;
  descuento3x2: number;
  cupon: string | null;
  descuentoCupon: number;
  /**
   * La forma de pago que de verdad aplica. Puede no ser la pedida: el contra
   * entrega por encima del tope se cobra con Clip.
   */
  metodo: IdPago | null;
  descuentoTransferencia: number;
  envio: IdEnvio;
  costoEnvio: number;
  envioGratis: boolean;
  comision: number;
  total: number;
  ahorroTotal: number;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * El 3x2: al llevar tres piezas participantes, la de menor precio no se cobra.
 *
 * Cuenta sobre todo el pedido, no por línea, y trabaja con el precio **ya
 * rebajado por volumen**: los términos dicen que las dos cosas se suman, y
 * regalarla a precio de lista pagaría el descuento dos veces.
 */
function calcular3x2(lineas: LineaCotizada[]) {
  const precios: number[] = [];
  for (const l of lineas) {
    if (!l.promo3x2) continue;
    for (let i = 0; i < l.item.cantidad; i++) precios.push(l.unitario);
  }
  precios.sort((a, b) => b - a);

  let descuento = 0;
  let gratis = 0;
  for (let i = 2; i < precios.length; i += 3) {
    descuento += precios[i]!;
    gratis++;
  }
  return { piezas: precios.length, gratis, descuento: redondear(descuento) };
}

export function cotizar(
  items: readonly ItemPedido[],
  fuente: FuentePrecios,
  opciones: OpcionesCotizacion = {},
): Cotizacion {
  const descartados: ItemPedido[] = [];

  // Primero se resuelven los precios: un artículo que ya no existe no puede
  // subir de escalón al resto del pedido.
  type Resuelto =
    | { item: ItemPedido; indice: number; paquete: PrecioPaquete }
    | { item: ItemPedido; indice: number; producto: PrecioProducto };

  const resueltos = items.flatMap((item, indice): Resuelto[] => {
    if (item.ml === ML_PAQUETE) {
      const paquete = fuente.paquete(item.productoId);
      if (paquete) return [{ item, indice, paquete }];
    } else {
      const producto = fuente.producto(item.productoId, item.ml);
      if (producto) return [{ item, indice, producto }];
    }
    descartados.push(item);
    return [];
  });

  const piezasSueltas = resueltos.reduce(
    (n, r) => n + ("producto" in r ? r.item.cantidad : 0),
    0,
  );
  const escalon = escalonPara(Math.max(1, piezasSueltas));

  const lineas: LineaCotizada[] = resueltos.map((r) => {
    const { item, indice } = r;

    // Los lotes y sets no entran a la escalera: ya traen un descuento mayor, y
    // sumarlos haría que un solo lote de 50 regalara precio de distribuidor a
    // todo lo demás. Sí cuentan para el envío gratis.
    if ("paquete" in r) {
      const { precio, referencia, piezas } = r.paquete;
      return {
        indice,
        item,
        tipo: "paquete",
        piezasPorUnidad: piezas,
        unitario: precio,
        unitarioMenudeo: referencia,
        subtotal: redondear(precio * item.cantidad),
        subtotalMenudeo: redondear(referencia * item.cantidad),
        descuentoVolumen: 0,
        promo3x2: false,
      };
    }

    const { precio, mayoreo, promo3x2 } = r.producto;
    const descuentoVolumen = mayoreo ? escalon.descuento : 0;
    const unitario = redondear(precio * (1 - descuentoVolumen));
    return {
      indice,
      item,
      tipo: "producto",
      piezasPorUnidad: 1,
      unitario,
      unitarioMenudeo: precio,
      subtotal: redondear(unitario * item.cantidad),
      subtotalMenudeo: redondear(precio * item.cantidad),
      descuentoVolumen,
      promo3x2,
    };
  });

  const piezasTotales = lineas.reduce(
    (n, l) => n + l.piezasPorUnidad * l.item.cantidad,
    0,
  );
  const subtotalMenudeo = redondear(lineas.reduce((n, l) => n + l.subtotalMenudeo, 0));
  const subtotal = redondear(lineas.reduce((n, l) => n + l.subtotal, 0));
  const ahorroVolumen = redondear(subtotalMenudeo - subtotal);

  const promo3x2 = calcular3x2(lineas);

  const cupon = opciones.cupon && CUPONES[opciones.cupon] ? opciones.cupon : null;
  let descuentoCupon = cupon ? redondear(subtotal * CUPONES[cupon]!.descuento) : 0;

  // La transferencia se descuenta sobre el precio de lista en los perfumes
  // sueltos —por eso se suma al volumen en vez de encadenarse— y sobre el
  // precio del paquete en lotes y sets, que no tienen precio de lista propio.
  let descuentoTransferencia =
    opciones.metodo === "transferencia"
      ? redondear(
          lineas.reduce(
            (n, l) =>
              n +
              DESCUENTO_TRANSFERENCIA *
                (l.tipo === "producto" ? l.subtotalMenudeo : l.subtotal),
            0,
          ),
        )
      : 0;

  // Tope del 40%. Si se pasa, cede primero el cupón —que es promoción de la
  // tienda en línea— y solo después la transferencia, que es regla del catálogo.
  const tope = redondear(DESCUENTO_MAXIMO * subtotalMenudeo);
  let exceso = redondear(ahorroVolumen + descuentoTransferencia + descuentoCupon - tope);
  if (exceso > 0) {
    const delCupon = Math.min(exceso, descuentoCupon);
    descuentoCupon = redondear(descuentoCupon - delCupon);
    exceso = redondear(exceso - delCupon);
    descuentoTransferencia = redondear(
      descuentoTransferencia - Math.min(exceso, descuentoTransferencia),
    );
  }

  const envio: IdEnvio = opciones.envio ?? "estandar";
  const envioGratis = piezasTotales >= PIEZAS_ENVIO_GRATIS;
  const costoEnvio =
    lineas.length === 0 || (envio === "estandar" && envioGratis)
      ? 0
      : TARIFAS_ENVIO[envio];

  const totalSinComision = redondear(
    subtotal - promo3x2.descuento - descuentoCupon - descuentoTransferencia + costoEnvio,
  );

  // El contra entrega por encima del tope no se ofrece: el pedido se cobra con
  // Clip, igual que hace el checkout al pintar las opciones.
  const metodo: IdPago | null =
    opciones.metodo === "contra" && !hayContraEntrega(totalSinComision)
      ? "clip"
      : (opciones.metodo ?? null);
  const comision = metodo ? comisionDe(metodo) : 0;

  return {
    lineas,
    descartados,
    piezasSueltas,
    piezasTotales,
    escalon,
    subtotalMenudeo,
    subtotal,
    ahorroVolumen,
    piezas3x2: promo3x2.piezas,
    piezasGratis3x2: promo3x2.gratis,
    descuento3x2: promo3x2.descuento,
    cupon,
    descuentoCupon,
    metodo,
    descuentoTransferencia,
    envio,
    costoEnvio,
    envioGratis,
    comision,
    total: redondear(totalSinComision + comision),
    ahorroTotal: redondear(
      ahorroVolumen + promo3x2.descuento + descuentoCupon + descuentoTransferencia,
    ),
  };
}
