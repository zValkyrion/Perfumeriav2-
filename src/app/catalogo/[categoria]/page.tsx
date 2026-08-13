import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { VistaCatalogo } from "@/components/catalogo/vista-catalogo";
import { TarjetaSet } from "@/components/sets/tarjeta-set";
import { Contenedor } from "@/components/comunes/layout";
import { PRODUCTOS } from "@/data/productos";
import { SETS } from "@/data/sets";
import { CATEGORIAS, getCategoria } from "@/data/taxonomia";

export function generateStaticParams() {
  return [...CATEGORIAS.map((c) => ({ categoria: c.slug })), { categoria: "sets" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/catalogo/[categoria]">): Promise<Metadata> {
  const { categoria } = await params;

  if (categoria === "sets") {
    return {
      title: "Sets y estuches de regalo",
      description:
        "Estuches listos para regalar: dúos, tríos y el set descubrimiento de 5 miniaturas. Con caja, listón y tarjeta incluidos.",
    };
  }

  const cat = getCategoria(categoria);
  if (!cat) return {};

  return {
    title: cat.titulo,
    description: cat.descripcion,
  };
}

export default async function CategoriaPage({
  params,
}: PageProps<"/catalogo/[categoria]">) {
  const { categoria } = await params;

  // Los sets no son productos: tienen su propia rejilla.
  if (categoria === "sets") {
    return (
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
                <Link href="/catalogo">Catálogo</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Sets y regalos</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header className="mb-8 max-w-2xl">
          <p className="eyebrow mb-2">Listos para regalar</p>
          <h1 className="font-display text-[32px] leading-[1.05] tracking-tight lg:text-[44px]">
            Sets y estuches
          </h1>
          <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
            Vienen en caja rígida, con listón y tarjeta de dedicatoria escrita a
            mano. Si dudas del gusto de la otra persona, el Set Descubrimiento
            resuelve.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {SETS.map((set) => (
            <TarjetaSet key={set.slug} set={set} />
          ))}
        </div>
      </Contenedor>
    );
  }

  const cat = getCategoria(categoria);
  if (!cat) notFound();

  return (
    <VistaCatalogo
      base={PRODUCTOS.filter(cat.filtro)}
      eyebrow={cat.eyebrow}
      titulo={cat.titulo}
      descripcion={cat.descripcion}
      migas={[{ label: "Catálogo", href: "/catalogo" }, { label: cat.nombre }]}
    />
  );
}
