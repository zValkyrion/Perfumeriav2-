import type { Metadata } from "next";
import { EN_PROMOCION, PROMO_3X2 } from "@/data/productos";

/**
 * Igual que en /buscar: la página lee `vista` de la URL y es de cliente, así
 * que el title y la description viven aquí. Sin este layout heredaba los de la
 * home y había tres rutas compitiendo con el mismo título.
 */
export const metadata: Metadata = {
  title: "Promociones y rebajas",
  // Sale del catálogo, igual que el encabezado de la página: decía «3x2 en
  // toda la tienda» aunque ningún modelo llevara la etiqueta.
  description:
    PROMO_3X2.length > 0
      ? `3x2 en ${PROMO_3X2.length} perfumes seleccionados y precio de mayoreo desde 3 piezas, con envío gratis.`
      : EN_PROMOCION.length > 0
        ? "Perfumes con precio rebajado y precio de mayoreo desde 3 piezas, con envío gratis."
        : "Precio de mayoreo desde 3 perfumes y envío gratis desde 3 piezas, en toda la tienda.",
  alternates: { canonical: "/promociones" },
};

export default function PromocionesLayout({
  children,
}: LayoutProps<"/promociones">) {
  return children;
}
