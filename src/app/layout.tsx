import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BarraContador } from "@/components/layout/barra-contador";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { BotonWhatsApp } from "@/components/layout/whatsapp";
import { DrawerCarrito } from "@/components/carrito/drawer-carrito";
import { SelectorTemas } from "@/components/comunes/selector-temas";
import { TransicionRuta } from "@/components/comunes/transicion-ruta";
import { MAS_VENDIDOS, indiceCompacto } from "@/data/productos";
import { SITIO_URL } from "@/lib/sitio";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  // 700 y 800 los usa el tema de mayoreo, que pone los titulares en sans.
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  // El 700 es lo que habilita la tipografía audaz de los titulares ancla; los
  // pesos ligeros siguen ahí para el resto de títulos (§6.2).
  weight: ["300", "400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // El canonical NO va aquí: en el layout lo heredaría toda ruta que no lo
  // sobrescriba y el sitio entero se autodeclararía como la home. Cada página
  // pone el suyo.
  metadataBase: new URL(SITIO_URL),
  title: {
    default: "EL REY DE LOS PERFUMES — Perfumería fina al mayoreo y menudeo",
    template: "%s | EL REY DE LOS PERFUMES",
  },
  description:
    "Perfumes 100% originales al mejor precio de México. Menudeo y mayoreo desde 3 piezas, envío gratis y hasta 6 meses sin intereses.",
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "EL REY DE LOS PERFUMES",
    title: "EL REY DE LOS PERFUMES — El lujo tiene un aroma.",
    description:
      "Perfumes 100% originales al mejor precio de México. Menudeo y mayoreo desde 3 piezas.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // El índice de búsqueda y los sugeridos se calculan en el servidor y viajan
  // como props: el cliente recibe datos ligeros, no el catálogo entero.
  const indice = indiceCompacto();
  const sugeridos = MAS_VENDIDOS.slice(0, 8);

  return (
    <html
      lang="es-MX"
      // Tema por defecto: mayoreo (claro, acento rojo, sans). El selector de
      // pruebas puede cambiarlo y el script de abajo restaura lo guardado.
      data-tema="mayoreo"
      className={`dark ${inter.variable} ${cormorant.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* TEMPORAL (pruebas de tema): aplica la colorimetría guardada antes
            del primer pintado para que no se vea el cambio de color. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aura-tema');if(!t)return;if(t==='oro'){delete document.documentElement.dataset.tema}else{document.documentElement.dataset.tema=t}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-bg text-fg flex min-h-full flex-col">
        <a
          href="#contenido"
          className="focus:bg-gold focus:text-bg sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100 focus:rounded-full focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
        >
          Saltar al contenido
        </a>

        {/* Arriba del todo va la urgencia con plazo real; la tira de promesas
            se movió a la home, justo debajo del banner. */}
        <BarraContador />
        <Header indice={indice} />

        <main id="contenido" className="flex-1 pb-16 md:pb-0">
          <TransicionRuta>{children}</TransicionRuta>
        </main>

        <Footer />
        <BottomNav />
        <BotonWhatsApp />
        <DrawerCarrito sugeridos={sugeridos} />
        {/* TEMPORAL: selector de colorimetrías. Borra esta línea, el
            componente y el bloque "TEMAS DE PRUEBA" de globals.css. */}
        <SelectorTemas />

        <Toaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: "!bg-surface-2 !border-border !text-fg",
            },
          }}
        />
      </body>
    </html>
  );
}
