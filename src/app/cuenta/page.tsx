import type { Metadata } from "next";
import { VistaCuenta } from "@/components/cuenta/vista-cuenta";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: "Tus pedidos, direcciones, favoritos y nivel de cliente.",
  robots: { index: false, follow: true },
};

export default function CuentaPage() {
  return <VistaCuenta />;
}
