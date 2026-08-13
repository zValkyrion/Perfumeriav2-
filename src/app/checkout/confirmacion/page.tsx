import type { Metadata } from "next";
import { VistaConfirmacion } from "@/components/checkout/vista-confirmacion";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  description: "Gracias por tu compra en AURA Perfumes.",
  robots: { index: false, follow: false },
};

export default function ConfirmacionPage() {
  return <VistaConfirmacion />;
}
