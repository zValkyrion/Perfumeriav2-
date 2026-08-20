import type { Metadata } from "next";
import { VistaConfirmacion } from "@/components/checkout/vista-confirmacion";

// El título no puede depender del contenido —la página es estática— y esta
// ruta también se abre sin pedido reciente, cuando alguien vuelve por el
// historial. «Tu pedido» es cierto en los dos casos; «Pedido confirmado»
// contradecía a la propia pantalla cuando no había ninguno.
export const metadata: Metadata = {
  title: "Tu pedido",
  description: "Gracias por tu compra en EL REY DE LOS PERFUMES.",
  robots: { index: false, follow: true },
};

export default function ConfirmacionPage() {
  return <VistaConfirmacion />;
}
