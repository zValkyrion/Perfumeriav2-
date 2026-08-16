import type { Metadata } from "next";
import Link from "next/link";
import { AcordeonFAQ } from "@/components/comunes/acordeon-faq";
import {
  Contenedor,
  Seccion,
  TituloSeccion,
} from "@/components/comunes/layout";
import { Tilt } from "@/components/comunes/efectos";
import { BarraAnuncios } from "@/components/layout/barra-anuncios";
// EN PAUSA (ver más abajo): Banner3x2, DestacadoLote y SelectorPresentaciones.
// import { Banner3x2 } from "@/components/home/banner-3x2";
// import { DestacadoLote } from "@/components/home/destacado-lote";
// import { SelectorPresentaciones } from "@/components/home/selector-presentaciones";
// import { BloqueFrasco } from "@/components/home/bloque-frasco";
// import { FranjaNewsletter } from "@/components/home/franja-newsletter";
// import { PasosEnvio } from "@/components/home/pasos-envio";
import { BannerPaquete } from "@/components/home/banner-paquete";
import { BannerEmprende } from "@/components/home/banner-emprende";
import { Hero } from "@/components/home/hero";
import { PruebaSocial } from "@/components/home/prueba-social";
import { ResenasVertical } from "@/components/home/resenas-vertical";
import { TiposCompra } from "@/components/home/tipos-compra";
import { ValoresClave } from "@/components/home/valores-clave";
import { VideosClientes } from "@/components/home/videos-clientes";
import { RESEÑAS_DESTACADAS } from "@/data/resenas";
import { videosDesdeResenas } from "@/data/videos";
import { TarjetaLote } from "@/components/lotes/tarjeta-lote";
import { CarruselProductos } from "@/components/producto/carrusel-productos";
// import { GridProductos } from "@/components/producto/grid-productos";
import { FAQ_HOME } from "@/data/contenido";
import { LOTES_DESTACADOS } from "@/data/lotes";
import { MAS_VENDIDOS } from "@/data/productos";

// Title y description los pone el layout: la home es la única página donde el
// texto por defecto es el correcto. Aquí solo falta el canonical.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * Home con estructura de mayorista.
 *
 * El orden no sigue el de una tienda de menudeo (marca → categorías → producto)
 * sino el de un mayorista: primero el **modo de compra** (3x2, lotes, surtido),
 * enseguida el lote grande con su utilidad, y solo después el producto suelto.
 * Quien llega aquí busca margen, no inspiración.
 */
export default function Home() {
  // Los pósters de los videos salen del arte de producto ya generado.
  const videos = videosDesdeResenas(
    RESEÑAS_DESTACADAS,
    MAS_VENDIDOS.slice(0, 5).map((p) => p.imagenes[1]!),
  );

  return (
    <>
      {/* El FAQPage de estas preguntas vive en /faq, que es su página. La home
          muestra el acordeón pero no vuelve a marcarlo. */}

      {/* El hero es una imagen sin texto, así que la home no tenía h1: ni el
          rastreador ni un lector de pantalla sabían de qué trata la página.
          Este encabezado no se ve, pero es el único de nivel 1 del documento. */}
      <h1 className="sr-only">
        Perfumes al mayoreo y menudeo en México — EL REY DE LOS PERFUMES
      </h1>

      {/* 1 · Portada con la promesa y el precio de entrada */}
      <Hero />

      {/* 2 · Tira de promesas en movimiento, justo bajo el banner. Debajo ya no
          va la rejilla de garantías: repetía las mismas cuatro promesas que la
          tira acababa de pasar y empujaba los tipos de mayoreo fuera de vista.
          Las promesas completas siguen en `ValoresClave`, más abajo. */}
      <BarraAnuncios />

      {/* 3 · Tipos de compra: la navegación real de un mayorista */}
      <Seccion denso>
        <Contenedor>
          <TituloSeccion
            titulo="TIPOS DE MAYOREO"
            enlace="/catalogo"
            enlaceTexto="Ver todo"
          />
          <TiposCompra />
        </Contenedor>
      </Seccion>

      {/* 4 · Paquete estrella */}
      <Seccion denso>
        <BannerPaquete />
      </Seccion>

      {/* 4b · El lote grande, con la utilidad como titular.
          EN PAUSA — el bloque sigue funcionando; solo está fuera de la home.
          Para recuperarlo, descomenta esto y su import.
      <Seccion denso className="border-border-soft border-t">
        <DestacadoLote />
      </Seccion>
      */}

      {/* 5 · Videos de clientes: la prueba social que más convierte */}
      <Seccion denso className="bg-surface/40 border-border-soft border-y">
        <Contenedor>
          <TituloSeccion
            centrado
            eyebrow="Lo cuentan ellos"
            sobretitulo="⭐️⭐️⭐️⭐️⭐️"
            titulo="Confianza en todo México"
          />
        </Contenedor>
        <VideosClientes videos={videos} />
      </Seccion>

      {/* 6 · Prueba social escrita */}
      <Seccion denso revelar>
        <PruebaSocial />
      </Seccion>

      {/* 6 · Surtido: producto suelto con precio por pieza */}
      <Seccion denso id="mas-vendidos">
        <Contenedor>
          <TituloSeccion
            centrado
            eyebrow="Los que más rotan"
            titulo="MAYOREO SURTIDO"
            descripcion="Desde 3 perfumes obtén precio de mayoreo + Envío gratis 🚚✨"
            enlace="/catalogo"
            enlaceTexto="Ver perfumes"
          />
          <CarruselProductos
            productos={MAS_VENDIDOS.slice(0, 10)}
            prioritarios={2}
          />
        </Contenedor>
      </Seccion>

      {/* 7 y 8 · EN PAUSA — la franja del 3x2 y el atajo por presentación.
          Los componentes siguen en su sitio; solo no se pintan en la home.
      <Banner3x2 />

      <Seccion denso revelar>
        <Contenedor>
          <TituloSeccion
            eyebrow="Por tamaño"
            titulo="Elige tu presentación"
            descripcion="Los frascos grandes siempre salen mejor por mililitro; los pequeños se venden más rápido."
            className="mb-6"
          />
        </Contenedor>
        <SelectorPresentaciones />
      </Seccion>
      */}

      {/* 9 · Los cinco paquetes */}
      <Seccion denso revelar>
        <Contenedor>
          <TituloSeccion centrado titulo="PAQUETES EMPRENDEDORES" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {LOTES_DESTACADOS.map((lote) => (
              <Tilt key={lote.slug} className="h-full">
                <TarjetaLote lote={lote} destacada={lote.masVendido} />
              </Tilt>
            ))}
          </div>
        </Contenedor>
      </Seccion>

      {/* 10 · EN PAUSA — Novedades.
      <Seccion denso>
        <Contenedor>
          <TituloSeccion
            eyebrow="Recién llegados"
            titulo="Novedades"
            enlace="/catalogo?orden=novedades"
          />
          <GridProductos productos={NOVEDADES.slice(0, 8)} maxMovil={6} />
        </Contenedor>
      </Seccion>
      */}

      {/* 11 · EN PAUSA — el frasco en 3D.
      <Seccion>
        <BloqueFrasco />
      </Seccion>
      */}

      {/* 12 · Captación de revendedores */}
      <BannerEmprende />

      {/* 12b · Barra de confianza, justo después de proponer el negocio */}
      <Seccion denso className="bg-surface/50 border-border-soft border-b">
        <ValoresClave />
      </Seccion>

      {/* 13 · Reseñas en columna. Antes iban aquí los tres pasos de "así
          recibes tu pedido"; el testimonio cierra mejor que la logística. */}
      <Seccion revelar>
        <ResenasVertical />
      </Seccion>

      {/* 14 · Valores */}
      <Seccion denso revelar className="border-border-soft border-t">
        <ValoresClave />
      </Seccion>

      {/* 15 · Preguntas frecuentes */}
      <Seccion revelar className="border-border-soft border-t">
        <Contenedor>
          <TituloSeccion centrado titulo="PREGUNTAS FRECUENTES" />

          <div className="mx-auto max-w-3xl">
            <AcordeonFAQ items={FAQ_HOME} />

            <p className="text-fg-muted mt-8 text-center text-sm leading-relaxed font-medium">
              ¿No encuentras lo que buscas?{" "}
              <Link
                href="/contacto"
                className="text-gold-light hover:text-gold font-semibold underline underline-offset-4"
              >
                Escríbenos
              </Link>{" "}
              y te contesta una persona, normalmente en menos de una hora.
            </p>
          </div>
        </Contenedor>
      </Seccion>

      {/* 16 · EN PAUSA — la franja del newsletter.
      <FranjaNewsletter />
      */}
    </>
  );
}
