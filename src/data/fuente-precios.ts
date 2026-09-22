import type { FuentePrecios } from "../../compartido/cotizacion";
import { getLote, valorMenudeoLote } from "./lotes";
import { getPresentacion, getProductoPorId } from "./productos";
import { getSet } from "./sets";

/**
 * Los precios del catálogo compilado, en la forma que pide `cotizar`.
 *
 * Lo usan el carrito del navegador y la Lambda de `radar/servidor`, que al
 * desplegarse desde el mismo commit cobran exactamente lo que la tienda enseña.
 * Por eso todo lo que este archivo importa va con rutas relativas: en `radar/`
 * el alias `@/` apunta a otra carpeta.
 *
 * Cuando el catálogo pase a la base de datos, la Lambda dejará de usar esta
 * fuente y leerá la suya de DynamoDB; `cotizar` no cambia.
 */
export const FUENTE_TIENDA: FuentePrecios = {
  producto(id, ml) {
    const producto = getProductoPorId(id);
    if (!producto) return undefined;
    // Una presentación que ya no existe cae en la principal, igual que en la
    // ficha: el carrito guardado de hace un mes no se rompe por eso.
    const presentacion = getPresentacion(producto, ml);
    return {
      precio: presentacion.precio,
      mayoreo: producto.esMayoreoElegible,
      promo3x2: producto.badges.includes("3x2"),
    };
  },

  paquete(id) {
    const lote = getLote(id);
    if (lote) {
      return { precio: lote.precio, referencia: valorMenudeoLote(lote), piezas: lote.piezas };
    }
    const set = getSet(id);
    if (set) {
      return { precio: set.precio, referencia: set.precioAnterior ?? set.precio, piezas: 1 };
    }
    return undefined;
  },
};
