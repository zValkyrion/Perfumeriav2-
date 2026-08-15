import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VistaCatalogo } from "@/components/catalogo/vista-catalogo";
import { DatosEstructurados } from "@/components/comunes/datos-estructurados";
import { listaProductos, migasDePan } from "@/lib/jsonld";
import { MARCAS, getMarca } from "@/data/marcas";
import { porMarca } from "@/data/productos";
import {
  OG_POR_DEFECTO,
  descripcionMarca,
  ogDe,
  tituloMarca,
} from "@/lib/seo";

export function generateStaticParams() {
  return MARCAS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/marca/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const marca = getMarca(slug);
  if (!marca) return {};

  return {
    title: tituloMarca(marca),
    description: descripcionMarca(marca, porMarca(marca.slug).length),
    alternates: { canonical: `/marca/${marca.slug}` },
    openGraph: {
      type: "website",
      title: tituloMarca(marca),
      // La firma de la casa dice más que los primeros 155 caracteres de la
      // descripción, que antes se cortaban a media palabra.
      description: marca.firma,
      images: [ogDe(OG_POR_DEFECTO.url, OG_POR_DEFECTO.alt)],
    },
  };
}

export default async function MarcaPage({
  params,
}: PageProps<"/marca/[slug]">) {
  const { slug } = await params;
  const marca = getMarca(slug);
  if (!marca) notFound();

  const productos = porMarca(slug);

  return (
    <>
      <DatosEstructurados
        datos={migasDePan([
          { nombre: "Inicio", ruta: "/" },
          { nombre: "Catálogo", ruta: "/catalogo" },
          { nombre: marca.nombre, ruta: `/marca/${marca.slug}` },
        ])}
      />
      <DatosEstructurados
        datos={listaProductos(productos, `Perfumes de ${marca.nombre}`)}
      />

      <VistaCatalogo
        base={productos}
        eyebrow={`${marca.pais} · desde ${marca.fundada}`}
        titulo={marca.nombre}
        descripcion={marca.descripcion}
        migas={[{ label: "Marcas", href: "/catalogo" }, { label: marca.nombre }]}
      />
    </>
  );
}
