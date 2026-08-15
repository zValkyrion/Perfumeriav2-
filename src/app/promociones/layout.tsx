import type { Metadata } from "next";

/**
 * Igual que en /buscar: la página lee `vista` de la URL y es de cliente, así
 * que el title y la description viven aquí. Sin este layout heredaba los de la
 * home y había tres rutas compitiendo con el mismo título.
 */
export const metadata: Metadata = {
  title: "Promociones y rebajas",
  description:
    "3x2 en toda la tienda y perfumes con precio rebajado. Promoción vigente con envío gratis desde 3 piezas.",
  alternates: { canonical: "/promociones" },
};

export default function PromocionesLayout({
  children,
}: LayoutProps<"/promociones">) {
  return children;
}
