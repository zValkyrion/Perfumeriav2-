import Link from "next/link";
import { AcordeonFAQ, FAQJsonLd } from "@/components/comunes/acordeon-faq";
import {
  Contenedor,
  Seccion,
  TituloSeccion,
} from "@/components/comunes/layout";
import { Tilt } from "@/components/comunes/efectos";
import { Banner3x2 } from "@/components/home/banner-3x2";
import { BloqueFrasco } from "@/components/home/bloque-frasco";
import { BloqueMayoreo } from "@/components/home/bloque-mayoreo";
import { Categorias } from "@/components/home/categorias";
import { Familias } from "@/components/home/familias";
import { FranjaNewsletter } from "@/components/home/franja-newsletter";
import { Hero } from "@/components/home/hero";
import { MarcasCarrusel } from "@/components/home/marcas-carrusel";
import { PasosEnvio } from "@/components/home/pasos-envio";
import { PruebaSocial } from "@/components/home/prueba-social";
import { TiraGarantias } from "@/components/home/tira-garantias";
import { TarjetaLote } from "@/components/lotes/tarjeta-lote";
import { CarruselProductos } from "@/components/producto/carrusel-productos";
import { GridProductos } from "@/components/producto/grid-productos";
import { FAQ_HOME } from "@/data/contenido";
import { LOTES_DESTACADOS } from "@/data/lotes";
import { SETS } from "@/data/sets";
import {
  MAS_VENDIDOS,
  NOVEDADES,
  PRODUCTOS,
  precioDesde,
} from "@/data/productos";
import { CATEGORIAS, FAMILIAS } from "@/data/taxonomia";

export default function Home() {
  const desde = Math.min(...PRODUCTOS.map(precioDesde));

  const conteosCategoria: Record<string, number> = {
    ...Object.fromEntries(
      CATEGORIAS.map((c) => [c.slug, PRODUCTOS.filter(c.filtro).length]),
    ),
    sets: SETS.length,
  };

  const conteosFamilia = Object.fromEntries(
    FAMILIAS.map((f) => [
      f.nombre,
      PRODUCTOS.filter((p) => p.familia === f.nombre).length,
    ]),
  );

  return (
    <>
      <FAQJsonLd items={FAQ_HOME} />

      {/* 1 · Hero */}
      <Hero precioDesde={desde} />

      {/* 2 · Garantías */}
      <TiraGarantias />

      {/* 3 · Compra por categoría */}
      <Seccion denso revelar>
        <Contenedor>
          <TituloSeccion
            eyebrow="Encuentra el tuyo"
            titulo="Compra por categoría"
            enlace="/catalogo"
            enlaceTexto="Ver todo"
          />
          <Categorias conteos={conteosCategoria} />
        </Contenedor>
      </Seccion>

      {/* 4 · Más vendidos */}
      <Seccion denso id="mas-vendidos">
        <Contenedor>
          <TituloSeccion
            revelado
            eyebrow="Los que no fallan"
            titulo="Más vendidos"
            descripcion="Los diez perfumes que más salen de nuestra bodega, ordenados por número de reseñas reales."
            enlace="/catalogo?orden=vendidos"
          />
          <CarruselProductos
            productos={MAS_VENDIDOS.slice(0, 10)}
            prioritarios={2}
          />
        </Contenedor>
      </Seccion>

      {/* 5 · Banner 3x2 */}
      <Banner3x2 />

      {/* 5b · El frasco en 3D, la única pieza manipulable de la home */}
      <Seccion>
        <BloqueFrasco />
      </Seccion>

      {/* 6 · Mayoreo */}
      <Seccion revelar>
        <BloqueMayoreo />
      </Seccion>

      {/* 7 · Familias olfativas */}
      <Seccion denso revelar>
        <Contenedor>
          <TituloSeccion
            eyebrow="Por carácter"
            titulo="Explora por familia olfativa"
            descripcion="Si ya sabes qué te gusta oler, este es el camino corto."
          />
          <Familias conteos={conteosFamilia} />
        </Contenedor>
      </Seccion>

      {/* 8 · Novedades */}
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

      {/* 9 · Lotes destacados */}
      <Seccion revelar>
        <Contenedor>
          <TituloSeccion
            revelado
            eyebrow="Para revender"
            titulo="Lotes de mayoreo"
            descripcion="Precio de distribuidor, envío gratis y material de venta incluido. La utilidad estimada asume que vendes al precio de menudeo publicado aquí."
            enlace="/lotes"
          />
          {/* Las tarjetas de lote se inclinan siguiendo al puntero: son la
              pieza de mayor ticket de la home y aguantan bien el gesto. */}
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            {LOTES_DESTACADOS.map((lote) => (
              <Tilt key={lote.slug} className="h-full">
                <TarjetaLote lote={lote} destacada={lote.masVendido} />
              </Tilt>
            ))}
          </div>
        </Contenedor>
      </Seccion>

      {/* 10 · Prueba social */}
      <Seccion revelar className="bg-surface/40 border-border-soft border-y">
        <PruebaSocial />
      </Seccion>

      {/* 11 · Así recibes tu pedido */}
      <Seccion revelar>
        <PasosEnvio />
      </Seccion>

      {/* 12 · Marcas */}
      <Seccion denso className="border-border-soft border-t">
        <Contenedor>
          <p className="eyebrow mb-6 text-center">Nuestras doce casas</p>
        </Contenedor>
        <MarcasCarrusel />
      </Seccion>

      {/* 13 · Preguntas frecuentes */}
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

      {/* 14 · Newsletter */}
      <FranjaNewsletter />
    </>
  );
}
