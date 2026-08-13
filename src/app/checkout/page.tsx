import type { Metadata } from "next";
import { VistaCheckout } from "@/components/checkout/vista-checkout";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Completa tu pedido en tres pasos.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <VistaCheckout />;
}
