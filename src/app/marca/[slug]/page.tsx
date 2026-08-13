import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VistaCatalogo } from "@/components/catalogo/vista-catalogo";
import { MARCAS, getMarca } from "@/data/marcas";
import { porMarca } from "@/data/productos";

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
    title: `${marca.nombre} — ${marca.firma}`,
    description: marca.descripcion.slice(0, 155),
  };
}

export default async function MarcaPage({
  params,
}: PageProps<"/marca/[slug]">) {
  const { slug } = await params;
  const marca = getMarca(slug);
  if (!marca) notFound();

  return (
    <VistaCatalogo
      base={porMarca(slug)}
      eyebrow={`${marca.pais} · desde ${marca.fundada}`}
      titulo={marca.nombre}
      descripcion={marca.descripcion}
      migas={[{ label: "Marcas", href: "/catalogo" }, { label: marca.nombre }]}
    />
  );
}
