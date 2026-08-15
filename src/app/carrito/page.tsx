import type { Metadata } from "next";
import { VistaCarrito } from "@/components/carrito/vista-carrito";

export const metadata: Metadata = {
  title: "Tu carrito",
  description:
    "Revisa tu pedido. El precio por pieza baja automáticamente a partir de 3 piezas y el envío es gratis.",
  // Sin indexar, pero siguiendo enlaces: desde el carrito se llega al catálogo
  // y no hay razón para cortar ese flujo.
  robots: { index: false, follow: true },
};

export default function CarritoPage() {
  return <VistaCarrito />;
}
