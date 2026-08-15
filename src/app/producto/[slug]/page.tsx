import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Contenedor, Seccion, TituloSeccion } from "@/components/comunes/layout";
import { DatosEstructurados } from "@/components/comunes/datos-estructurados";
import { Estrellas } from "@/components/comunes/estrellas";
import { BarraIntensidad, ChipFamilia } from "@/components/comunes/intensidad";
import { CompraProducto } from "@/components/producto/compra-producto";
import { Galeria } from "@/components/producto/galeria";
import { PiramideOlfativa } from "@/components/producto/piramide-olfativa";
import { ResenasProducto } from "@/components/producto/resenas-producto";
import { CarruselProductos } from "@/components/producto/carrusel-productos";
import { GridProductos } from "@/components/producto/grid-productos";
import { MARCAS_POR_SLUG } from "@/data/marcas";
import {
  PRODUCTOS,
  combinaCon,
  getProducto,
  precioDesde,
  relacionados,
} from "@/data/productos";
import { resenasDe } from "@/data/resenas";
import { FAMILIA_POR_NOMBRE } from "@/data/taxonomia";
import { numero } from "@/lib/format";
import { migasDePan, producto as productoJsonLd } from "@/lib/jsonld";
import { descripcionProducto, tituloProducto } from "@/lib/seo";

const DURACION: Record<number, string> = {
  1: "1 a 2 horas",
  2: "2 a 4 horas",
  3: "4 a 6 horas",
  4: "6 a 9 horas",
  5: "más de 10 horas",
};

const ESTELA: Record<number, string> = {
  1: "solo en tu piel",
  2: "a un brazo de distancia",
  3: "moderada",
  4: "se nota al entrar",
  5: "llena la habitación",
};

export function generateStaticParams() {
  return PRODUCTOS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const producto = getProducto(slug);
  if (!producto) return {};

  const marca = MARCAS_POR_SLUG.get(producto.marca)?.nombre ?? producto.marca;
  const desde = precioDesde(producto);

  return {
    title: tituloProducto(producto, marca),
    description: descripcionProducto(producto, desde),
    alternates: { canonical: `/producto/${producto.slug}` },
    openGraph: {
      type: "website",
      title: tituloProducto(producto, marca),
      description: producto.descripcionCorta,
      images: [
        {
          url: producto.imagenes[0]!,
          width: 900,
          height: 1200,
          alt: `${producto.nombre}, ${producto.concentracion.toLowerCase()} de ${marca}`,
        },
      ],
    },
  };
}

export default async function ProductoPage({
  params,
}: PageProps<"/producto/[slug]">) {
  const { slug } = await params;
  const producto = getProducto(slug);
  if (!producto) notFound();

  const marca = MARCAS_POR_SLUG.get(producto.marca);
  const nombreMarca = marca?.nombre ?? producto.marca;
  const resenas = resenasDe(producto.id);
  const combina = combinaCon(producto, 4);
  const similares = relacionados(producto, 10);

  return (
    <>
      {/* El JSON-LD de producto no lleva precio, disponibilidad ni
          calificación: esos tres datos son sintéticos en este catálogo y
          marcarlos como reales es lo que Google castiga. Ver src/lib/jsonld.ts. */}
      <DatosEstructurados datos={productoJsonLd(producto, nombreMarca)} />
      <DatosEstructurados
        datos={migasDePan([
          { nombre: "Inicio", ruta: "/" },
          { nombre: "Catálogo", ruta: "/catalogo" },
          { nombre: nombreMarca, ruta: `/marca/${producto.marca}` },
          { nombre: producto.nombre, ruta: `/producto/${producto.slug}` },
        ])}
      />

      <Contenedor className="py-5 lg:py-8">
        <Breadcrumb className="mb-5">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Inicio</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/catalogo">Catálogo</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/marca/${producto.marca}`}>{nombreMarca}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{producto.nombre}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="lg:grid lg:grid-cols-[55fr_45fr] lg:items-start lg:gap-12">
          <div className="lg:sticky lg:top-24">
            <Galeria
              imagenes={producto.imagenes}
              nombre={producto.nombre}
              marca={nombreMarca}
            />
          </div>

          <div className="mt-7 lg:mt-0">
            <Link
              href={`/marca/${producto.marca}`}
              className="text-fg-subtle hover:text-gold-light text-[11px] tracking-[0.18em] uppercase"
            >
              {nombreMarca}
            </Link>

            <h1 className="font-display mt-2 text-[32px] leading-[1.05] tracking-tight text-balance lg:text-[42px]">
              {producto.nombre}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a
                href="#resenas"
                className="hover:text-gold-light flex items-center gap-2 text-sm"
              >
                <Estrellas valor={producto.rating} />
                <span data-precio className="font-medium">
                  {producto.rating.toFixed(1)}
                </span>
                <span className="text-fg-subtle">
                  ({numero(producto.totalReseñas)} reseñas)
                </span>
              </a>
              {/* El chip de familia lleva a su página: es el enlace que conecta
                  la ficha con la landing de cola larga de su familia. */}
              <Link
                href={`/catalogo/${FAMILIA_POR_NOMBRE.get(producto.familia)?.slug ?? ""}`}
                aria-label={`Ver todos los perfumes de la familia ${producto.familia.toLowerCase()}`}
              >
                <ChipFamilia familia={producto.familia} />
              </Link>
            </div>

            <p className="text-fg-muted mt-4 text-[15px] leading-relaxed">
              {producto.descripcionCorta}.
            </p>

            <div className="mt-6">
              <CompraProducto producto={producto} />
            </div>
          </div>
        </div>
      </Contenedor>

      {/* 8 · Pirámide olfativa */}
      <Seccion denso className="border-border-soft border-t">
        <Contenedor>
          <TituloSeccion
            eyebrow="Cómo evoluciona"
            titulo="Pirámide olfativa"
            className="mb-5"
          />
          <PiramideOlfativa notas={producto.notas} />

          {/* 9 · Barras de intensidad */}
          <div className="mt-8 grid max-w-2xl gap-5 sm:grid-cols-2">
            <BarraIntensidad
              etiqueta="Duración en piel"
              valor={producto.duracion}
              descripcion={DURACION[producto.duracion]!}
            />
            <BarraIntensidad
              etiqueta="Proyección"
              valor={producto.estela}
              descripcion={ESTELA[producto.estela]!}
            />
          </div>
        </Contenedor>
      </Seccion>

      {/* 10 · Acordeones */}
      <Seccion denso>
        <Contenedor>
          <div className="max-w-3xl">
            <Accordion type="single" collapsible defaultValue="descripcion">
              <AccordionItem value="descripcion" className="border-border-soft">
                <AccordionTrigger className="py-5 text-[15px] hover:no-underline">
                  Descripción
                </AccordionTrigger>
                <AccordionContent className="text-fg-muted space-y-4 pb-5 text-sm leading-relaxed">
                  {producto.descripcionLarga.split("\n\n").map((parrafo, i) => (
                    <p key={i}>{parrafo}</p>
                  ))}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="aplicar" className="border-border-soft">
                <AccordionTrigger className="py-5 text-[15px] hover:no-underline">
                  Cómo aplicar
                </AccordionTrigger>
                <AccordionContent className="text-fg-muted space-y-3 pb-5 text-sm leading-relaxed">
                  <p>
                    Aplica sobre piel limpia e hidratada, a unos 15 cm, en los
                    puntos donde late el pulso: cuello, muñecas e interior de
                    los codos. El calor del cuerpo es lo que hace subir las
                    notas.
                  </p>
                  <p>
                    No frotes las muñecas después de aplicar: rompe las
                    moléculas más volátiles y te comes la salida. Con la
                    proyección de este perfume,{" "}
                    {producto.estela >= 4
                      ? "dos disparos son suficientes"
                      : "tres o cuatro disparos funcionan bien"}
                    .
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="envios" className="border-border-soft">
                <AccordionTrigger className="py-5 text-[15px] hover:no-underline">
                  Envíos y devoluciones
                </AccordionTrigger>
                <AccordionContent className="text-fg-muted space-y-3 pb-5 text-sm leading-relaxed">
                  <p>
                    Envío gratis a todo México desde 3 piezas; abajo de eso,
                    $ 149.00 MXN. Entrega en 2 a 5 días hábiles con guía de
                    rastreo el mismo día del envío.
                  </p>
                  <p>
                    Tienes 30 días naturales para devolverlo si conserva al
                    menos el 90% de su contenido. Nosotros pagamos la guía de
                    retorno.{" "}
                    <Link
                      href="/devoluciones"
                      className="text-gold-light underline underline-offset-4"
                    >
                      Ver política completa
                    </Link>
                    .
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ficha" className="border-border-soft">
                <AccordionTrigger className="py-5 text-[15px] hover:no-underline">
                  Ficha técnica
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <dl className="divide-border-soft grid divide-y text-sm">
                    {[
                      ["Marca", nombreMarca],
                      ["Línea", producto.linea ?? "Colección regular"],
                      ["Concentración", producto.concentracion],
                      ["Familia olfativa", producto.familia],
                      ["Género", producto.genero],
                      ["Origen", producto.origen],
                      ["Año de lanzamiento", String(producto.anio)],
                      [
                        "Presentaciones",
                        producto.presentaciones
                          .map((p) => `${p.ml} ml`)
                          .join(" · "),
                      ],
                      [
                        "SKU",
                        producto.presentaciones.map((p) => p.sku).join(" · "),
                      ],
                      ["Ocasión", producto.ocasion.join(" · ")],
                    ].map(([k, v]) => (
                      <div key={k} className="grid grid-cols-2 gap-4 py-2.5">
                        <dt className="text-fg-subtle">{k}</dt>
                        <dd className="text-fg-muted">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </Contenedor>
      </Seccion>

      {/* 11 · Reseñas */}
      <Seccion id="resenas" className="border-border-soft border-t">
        <Contenedor>
          <TituloSeccion
            eyebrow="Opiniones reales"
            titulo="Lo que dicen quienes lo compraron"
          />
          <ResenasProducto
            resenas={resenas}
            rating={producto.rating}
            total={producto.totalReseñas}
            nombreProducto={producto.nombre}
          />
        </Contenedor>
      </Seccion>

      {/* 12 · Combina bien con */}
      {combina.length > 0 ? (
        <Seccion denso className="border-border-soft border-t">
          <Contenedor>
            <TituloSeccion
              eyebrow="Para la misma ocasión"
              titulo="Combina bien con"
              descripcion="Otras familias olfativas que funcionan en los mismos momentos que este perfume."
            />
            <GridProductos productos={combina} />
          </Contenedor>
        </Seccion>
      ) : null}

      {/* 13 · También te puede interesar */}
      <Seccion denso>
        <Contenedor>
          <TituloSeccion
            eyebrow={`Más ${producto.familia.toLowerCase()}`}
            titulo="También te puede interesar"
            enlace={`/catalogo/${FAMILIA_POR_NOMBRE.get(producto.familia)?.slug ?? ""}`}
          />
          <CarruselProductos productos={similares} />
        </Contenedor>
      </Seccion>
    </>
  );
}
