import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, TrendingUp, Truck } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Contenedor, Seccion, TituloSeccion } from "@/components/comunes/layout";
import { Imagen } from "@/components/comunes/imagen";
import { DatosEstructurados } from "@/components/comunes/datos-estructurados";
import { Precio, PrecioAnterior, Descuento } from "@/components/comunes/precio";
import { BotonAgregarLote } from "@/components/lotes/boton-agregar-lote";
import { TarjetaLote } from "@/components/lotes/tarjeta-lote";
import { GridProductos } from "@/components/producto/grid-productos";
import { LOTES, getLote, valorMenudeoLote } from "@/data/lotes";
import { getProducto } from "@/data/productos";
import { precioRedondo } from "@/lib/format";
import { migasDePan } from "@/lib/jsonld";
import { descripcionLote, ogDe, tituloLote } from "@/lib/seo";

export function generateStaticParams() {
  return LOTES.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/lotes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lote = getLote(slug);
  if (!lote) return {};

  return {
    title: tituloLote(lote),
    description: descripcionLote(lote),
    alternates: { canonical: `/lotes/${lote.slug}` },
    openGraph: {
      type: "website",
      title: tituloLote(lote),
      description: lote.descripcion,
      images: [ogDe(lote.imagen, `${lote.nombre}, lote de mayoreo`)],
    },
  };
}

export default async function LoteDetallePage({
  params,
}: PageProps<"/lotes/[slug]">) {
  const { slug } = await params;
  const lote = getLote(slug);
  if (!lote) notFound();

  const incluidos = lote.productos
    .map((s) => getProducto(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const valorMenudeo = valorMenudeoLote(lote);
  const descuento = 1 - lote.precio / valorMenudeo;
  const porModelo = Math.round(lote.piezas / lote.productos.length);
  const otros = LOTES.filter((l) => l.slug !== lote.slug).slice(0, 3);

  return (
    <>
      <DatosEstructurados
        datos={migasDePan([
          { nombre: "Inicio", ruta: "/" },
          { nombre: "Lotes de mayoreo", ruta: "/lotes" },
          { nombre: lote.nombre, ruta: `/lotes/${lote.slug}` },
        ])}
      />

      <Contenedor className="py-6 lg:py-10">
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
                <Link href="/lotes">Lotes</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{lote.nombre}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
          <div className="bg-surface border-border-soft relative aspect-4/3 overflow-hidden rounded-lg border lg:sticky lg:top-24">
            <Imagen
              src={lote.imagen}
              alt={`${lote.nombre}: ${lote.piezas} perfumes surtidos`}
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
            {lote.masVendido ? (
              <span className="bg-gold-gradient text-bg absolute top-4 left-4 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase">
                Más vendido
              </span>
            ) : null}
          </div>

          <div className="mt-7 lg:mt-0">
            <p className="eyebrow mb-2">
              Lote {lote.tema} · {lote.piezas} piezas
            </p>
            <h1 className="font-display text-[30px] leading-[1.05] tracking-tight text-balance lg:text-[40px]">
              {lote.nombre}
            </h1>

            <p className="text-fg-muted mt-4 text-[15px] leading-relaxed">
              {lote.descripcion}
            </p>

            <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <Precio
                valor={lote.precio}
                moneda
                className="text-[32px] leading-none font-medium"
              />
              <PrecioAnterior valor={valorMenudeo} />
              <Descuento fraccion={descuento} />
            </div>

            <p className="text-fg-muted mt-2 text-sm">
              Te sale a{" "}
              <Precio
                valor={lote.precioIndividualEquivalente}
                className="text-fg font-medium"
              />{" "}
              por pieza · {lote.productos.length} modelos, {porModelo} de cada uno
            </p>

            <div className="border-success/25 bg-success/10 mt-5 rounded-md border px-4 py-3.5">
              <p className="text-success flex items-center gap-2 text-sm font-medium">
                <TrendingUp size={16} aria-hidden />
                Ganas hasta {precioRedondo(lote.utilidadEstimada)} MXN
              </p>
              <p className="text-fg-muted mt-1 text-[13px] leading-relaxed">
                Si vendes las {lote.piezas} piezas al precio de menudeo que
                publicamos en esta tienda.
              </p>
            </div>

            <ul className="mt-6 space-y-2">
              {lote.incluye.map((i) => (
                <li key={i} className="text-fg-muted flex items-start gap-2.5 text-sm">
                  <Check size={16} className="text-gold mt-0.5 shrink-0" aria-hidden />
                  {i}
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <BotonAgregarLote
                slug={lote.slug}
                nombre={lote.nombre}
                precioLote={lote.precio}
                className="w-full"
              />
            </div>

            <p className="text-fg-muted mt-4 flex items-center justify-center gap-2 text-[13px]">
              <Truck size={15} className="text-gold" aria-hidden />
              Envío gratis · Llega en 2 a 5 días · Cambios sin costo 30 días
            </p>
          </div>
        </div>
      </Contenedor>

      <Seccion denso className="border-border-soft border-t">
        <Contenedor>
          <TituloSeccion
            eyebrow={`${lote.productos.length} modelos incluidos`}
            titulo="Qué trae este lote"
            descripcion={`Cada modelo viene ${porModelo} ${porModelo === 1 ? "vez" : "veces"}. Son los que mejor rotan en su categoría.`}
          />
          <GridProductos productos={incluidos} />
        </Contenedor>
      </Seccion>

      <Seccion denso className="border-border-soft border-t">
        <Contenedor>
          <TituloSeccion
            eyebrow="Otras opciones"
            titulo="Compara con otros lotes"
            enlace="/lotes"
          />
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            {otros.map((l) => (
              <TarjetaLote key={l.slug} lote={l} />
            ))}
          </div>
        </Contenedor>
      </Seccion>
    </>
  );
}
