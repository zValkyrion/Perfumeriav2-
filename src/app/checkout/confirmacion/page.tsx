import type { Metadata } from "next";
import { VistaConfirmacion } from "@/components/checkout/vista-confirmacion";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  description: "Gracias por tu compra en EL REY DE LOS PERFUMES.",
  robots: { index: false, follow: true },
};

export default function ConfirmacionPage() {
  return <VistaConfirmacion />;
}
