import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { BotonWhatsApp } from "@/components/layout/whatsapp";
import { DrawerCarrito } from "@/components/carrito/drawer-carrito";
import { SincronizarCuenta } from "@/components/cuenta/sincronizar-cuenta";
import { DatosEstructurados } from "@/components/comunes/datos-estructurados";
import { TransicionRuta } from "@/components/comunes/transicion-ruta";
import { MAS_VENDIDOS, indiceCompacto } from "@/data/productos";
import { organizacion, sitioWeb } from "@/lib/jsonld";
import { OG_POR_DEFECTO } from "@/lib/seo";
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
    default: "EL REY DE LOS PERFUMES — Perfumes al mayoreo y menudeo",
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
    // Imagen por defecto de las tarjetas de enlace. Las páginas con arte
    // propio —producto, lote, categoría— la sobrescriben con el suyo.
    images: [OG_POR_DEFECTO],
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
        {/* Limpia la colorimetría que dejó guardada el selector de pruebas.
            El selector ya no existe: sin esto, quien probó un tema en su
            momento se quedaría con él pegado para siempre y sin forma de
            volver. Se puede borrar esta línea dentro de unos meses. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{localStorage.removeItem('aura-tema')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="bg-bg text-fg flex min-h-full flex-col">
        {/* Identidad del sitio: se declara una sola vez, aquí. */}
        <DatosEstructurados datos={organizacion()} />
        <DatosEstructurados datos={sitioWeb()} />

        <a
          href="#contenido"
          className="focus:bg-gold focus:text-bg sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-100 focus:rounded-full focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
        >
          Saltar al contenido
        </a>

        {/* La cabecera es lo primero: la barra de cuenta atrás se retiró y la
            tira de promesas vive en la home, justo debajo del banner. */}
        <Header indice={indice} />

        <main id="contenido" className="flex-1 pb-16 md:pb-0">
          <TransicionRuta>{children}</TransicionRuta>
        </main>

        <Footer />
        <BottomNav />
        <BotonWhatsApp />
        <DrawerCarrito sugeridos={sugeridos} />
        {/* No pinta nada: mantiene el carrito de esta pestaña y el de la cuenta
            en el mismo sitio. Va en el layout porque el carrito se toca desde
            todo el sitio, no solo desde /carrito. */}
        <SincronizarCuenta />

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
