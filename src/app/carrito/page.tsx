import type { Metadata } from "next";
import { VistaCarrito } from "@/components/carrito/vista-carrito";

export const metadata: Metadata = {
  title: "Tu carrito",
  description:
    "Revisa tu pedido. El precio por pieza baja automáticamente a partir de 3 piezas y el envío es gratis.",
  robots: { index: false, follow: false },
};

export default function CarritoPage() {
  return <VistaCarrito />;
}
