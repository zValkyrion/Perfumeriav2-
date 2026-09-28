"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getLote } from "@/data/lotes";
import { getProductoPorId } from "@/data/productos";
import { getSet } from "@/data/sets";
import { ML_PAQUETE, stockDisponible } from "@/lib/carrito";
import { useTienda } from "@/store/tienda";
import type { ItemPedido } from "../../../compartido/cotizacion";

/** El nombre con el que la tienda de hoy conoce un artículo, o `null` si ya no lo conoce. */
function nombreEnCatalogo(i: ItemPedido): string | null {
  if (i.ml === ML_PAQUETE) {
    return getLote(i.productoId)?.nombre ?? getSet(i.productoId)?.nombre ?? null;
  }
  const p = getProductoPorId(i.productoId);
  // La presentación también tiene que seguir existiendo: `getPresentacion`
  // cae a la principal si no la encuentra, y se agregaría un tamaño que ya no
  // se vende con las existencias de otro.
  return p && p.presentaciones.some((v) => v.ml === i.ml) ? `${p.nombre} ${i.ml} ml` : null;
}

/**
 * «Volver a pedir»: mete en el carrito lo de un pedido anterior y lleva al
 * carrito.
 *
 * Es la función que más tiempo le ahorra a un revendedor que resurte lo mismo
 * cada mes. Pasa por `agregar` —el mismo camino que la ficha—, así que respeta
 * el tope de existencias; y **dice** lo que no pudo agregar (agotado, retirado
 * o con menos piezas de las que se pidieron) en vez de desaparecerlo, que es lo
 * que haría pensar al cliente que el carrito se equivocó.
 *
 * Los precios son los de hoy: el pedido viejo es la lista de qué comprar, no
 * un precio que se sostenga. El carrito lo cotiza como cualquier otro.
 *
 * `nombres` (clave `productoId|ml`) sirve para nombrar lo retirado con el
 * nombre congelado del pedido; sin él se dice «un artículo retirado».
 */
export function useVolverAPedir() {
  const router = useRouter();
  const agregar = useTienda((s) => s.agregar);

  return (items: readonly ItemPedido[], nombres?: ReadonlyMap<string, string>) => {
    const avisos: string[] = [];
    let agregadas = 0;

    for (const i of items) {
      if (!(i.cantidad > 0)) continue;
      const conocido = nombreEnCatalogo(i);
      const nombre =
        nombres?.get(`${i.productoId}|${i.ml}`) ?? conocido ?? "Un artículo retirado del catálogo";
      if (!conocido) {
        avisos.push(`${nombre}: ya no está a la venta`);
        continue;
      }
      // Lo que cabe según las existencias, descontando lo que ya estaba en el
      // carrito: `agregar` topa igual, pero así se puede avisar con la cifra.
      const enCarrito =
        useTienda
          .getState()
          .carrito.find((c) => c.productoId === i.productoId && c.ml === i.ml)?.cantidad ?? 0;
      const cabe = Math.max(0, stockDisponible(i.productoId, i.ml) - enCarrito);
      const pon = Math.min(i.cantidad, cabe);
      if (pon <= 0) {
        avisos.push(
          enCarrito > 0 ? `${nombre}: ya tienes en el carrito todo lo disponible` : `${nombre}: agotado`,
        );
        continue;
      }
      agregar(i.productoId, i.ml, pon);
      agregadas += pon;
      if (pon < i.cantidad) avisos.push(`${nombre}: solo había ${pon} de ${i.cantidad}`);
    }

    const detalle = avisos.length > 0 ? avisos.join(" · ") : undefined;
    if (agregadas === 0) {
      toast.error("No pudimos agregar nada de este pedido", { description: detalle });
      return;
    }
    toast.success(
      `Agregamos ${agregadas} ${agregadas === 1 ? "unidad" : "unidades"} a tu carrito`,
      {
        description: detalle ?? "Con los precios de hoy. Revisa y confirma tu pedido.",
        // Con avisos hay algo que leer: que no se esfume antes de terminarlo.
        duration: detalle ? 10000 : undefined,
      },
    );
    router.push("/carrito");
  };
}
