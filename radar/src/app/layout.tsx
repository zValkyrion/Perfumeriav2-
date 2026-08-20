import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RegistrarSW } from "@/components/registrar-sw";
import "./globals.css";

// El tema que sirve la tienda pone Inter también en los titulares; una sola
// familia basta y es una petición de red menos en la calle.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Radar de Proveedores — EL REY DE LOS PERFUMES",
  description: "Captura y evaluación de proveedores de perfumería en campo.",
  // Herramienta interna: no tiene por qué aparecer en buscadores.
  robots: { index: false, follow: false },
  manifest: "/radar/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Radar", statusBarStyle: "default" },
  icons: { icon: "/radar/icono-192.png", apple: "/radar/icono-180.png" },
};

export const viewport: Viewport = {
  themeColor: "#e02b20",
  // La barra de acciones vive pegada abajo; sin esto queda bajo el notch.
  viewportFit: "cover",
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="mx-auto min-h-dvh max-w-2xl">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
