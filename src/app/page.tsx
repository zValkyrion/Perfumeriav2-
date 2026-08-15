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
import { Banner3x2 } from "@/components/home/banner-3x2";
import { BannerPaquete } from "@/components/home/banner-paquete";
import { BannerEmprende } from "@/components/home/banner-emprende";
import { BloqueFrasco } from "@/components/home/bloque-frasco";
import { DestacadoLote } from "@/components/home/destacado-lote";
import { FranjaNewsletter } from "@/components/home/franja-newsletter";
import { Hero } from "@/components/home/hero";
import { PasosEnvio } from "@/components/home/pasos-envio";
import { PruebaSocial } from "@/components/home/prueba-social";
import { SelectorPresentaciones } from "@/components/home/selector-presentaciones";
import { TiposCompra } from "@/components/home/tipos-compra";
import { TiraGarantias } from "@/components/home/tira-garantias";
import { ValoresClave } from "@/components/home/valores-clave";
import { VideosClientes } from "@/components/home/videos-clientes";
import { RESEÑAS_DESTACADAS } from "@/data/resenas";
import { videosDesdeResenas } from "@/data/videos";
import { TarjetaLote } from "@/components/lotes/tarjeta-lote";
import { CarruselProductos } from "@/components/producto/carrusel-productos";
import { GridProductos } from "@/components/producto/grid-productos";
import { FAQ_HOME } from "@/data/contenido";
import { LOTES_DESTACADOS } from "@/data/lotes";
import {
  MAS_VENDIDOS,
  NOVEDADES,
  PRODUCTOS,
  precioDesde,
} from "@/data/productos";

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
  const desde = Math.min(...PRODUCTOS.map(precioDesde));

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
      <Hero precioDesde={desde} />

      {/* 2 · Tira de promesas en movimiento, justo bajo el banner */}
      <BarraAnuncios />

      {/* 3 · Promesas detalladas */}
      <TiraGarantias />

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

      {/* 4b · El lote grande, con la utilidad como titular */}
      <Seccion denso className="border-border-soft border-t">
        <DestacadoLote />
      </Seccion>

      {/* 5 · Videos de clientes: la prueba social que más convierte */}
      <Seccion denso className="bg-surface/40 border-border-soft border-y">
        <Contenedor>
          <TituloSeccion
            eyebrow="Lo cuentan ellos"
            titulo="Clientes que ya lo probaron"
            descripcion="Revendedoras y clientes grabando lo que recibieron, sin guion."
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
            revelado
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

      {/* 7 · Promoción 3x2 */}
      <Banner3x2 />

      {/* 8 · Atajo por presentación (el "selector de tallas" del perfume) */}
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

      {/* 9 · Lotes destacados */}
      <Seccion denso revelar>
        <Contenedor>
          <TituloSeccion
            revelado
            eyebrow="Ya armados"
            titulo="Lotes de mayoreo"
            descripcion="Surtidos balanceados por rotación. La utilidad supone que vendes al precio de menudeo publicado aquí."
            enlace="/lotes"
          />
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            {LOTES_DESTACADOS.map((lote) => (
              <Tilt key={lote.slug} className="h-full">
                <TarjetaLote lote={lote} destacada={lote.masVendido} />
              </Tilt>
            ))}
          </div>
        </Contenedor>
      </Seccion>

      {/* 10 · Novedades */}
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

      {/* 11 · El frasco en 3D: la prueba de calidad 1:1 */}
      <Seccion>
        <BloqueFrasco />
      </Seccion>

      {/* 12 · Captación de revendedores */}
      <BannerEmprende />

      {/* 12b · Barra de confianza, justo después de proponer el negocio */}
      <Seccion denso className="bg-surface/50 border-border-soft border-b">
        <ValoresClave />
      </Seccion>

      {/* 13 · Cómo recibes tu pedido */}
      <Seccion revelar>
        <PasosEnvio />
      </Seccion>

      {/* 14 · Valores */}
      <Seccion denso revelar className="border-border-soft border-t">
        <ValoresClave />
      </Seccion>

      {/* 15 · Preguntas frecuentes */}
      <Seccion revelar className="border-border-soft border-t">
        <Contenedor>
          <div className="grid gap-8 lg:grid-cols-[380px_1fr] lg:gap-16">
            <div>
              <TituloSeccion
                eyebrow="Antes de que preguntes"
                titulo="Preguntas frecuentes"
                className="mb-4"
              />
              <p className="text-fg-muted text-sm leading-relaxed">
                ¿No encuentras lo que buscas?{" "}
                <Link
                  href="/contacto"
                  className="text-gold-light hover:text-gold underline underline-offset-4"
                >
                  Escríbenos
                </Link>{" "}
                y te contesta una persona, normalmente en menos de una hora.
              </p>
            </div>

            <AcordeonFAQ items={FAQ_HOME} />
          </div>
        </Contenedor>
      </Seccion>

      {/* 16 · Newsletter */}
      <FranjaNewsletter />
    </>
  );
}
