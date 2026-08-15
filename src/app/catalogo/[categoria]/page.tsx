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
import { Contenedor, Seccion } from "@/components/comunes/layout";
import { DatosEstructurados } from "@/components/comunes/datos-estructurados";
import { PRODUCTOS, porFamilia, precioDesde } from "@/data/productos";
import { SETS } from "@/data/sets";
import {
  CATEGORIAS,
  FAMILIAS,
  FAMILIA_POR_SLUG,
  type FamiliaInfo,
  getCategoria,
} from "@/data/taxonomia";
import { listaProductos, migasDePan } from "@/lib/jsonld";
import { descripcionCategoria, ogDe, tituloCategoria } from "@/lib/seo";

/**
 * Esta ruta atiende tres cosas distintas que comparten forma de listado: las
 * categorías comerciales, las nueve familias olfativas y los sets. Las
 * familias tenían slug desde siempre pero ninguna página: se enlazaban como
 * `/catalogo?familia=Amaderado`, un parámetro sobre HTML estático que para un
 * buscador es la misma URL con el mismo contenido. Ahora cada una es una
 * página propia, que es donde vive la consulta de cola larga.
 */
export function generateStaticParams() {
  return [
    ...CATEGORIAS.map((c) => ({ categoria: c.slug })),
    ...FAMILIAS.map((f) => ({ categoria: f.slug })),
    { categoria: "sets" },
  ];
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
      alternates: { canonical: "/catalogo/sets" },
    };
  }

  const familia = FAMILIA_POR_SLUG.get(categoria);
  if (familia) {
    const productos = porFamilia(familia.nombre);
    const desde = Math.min(...productos.map(precioDesde));

    return {
      title: tituloCategoria(familia, desde),
      description: descripcionCategoria(familia, productos.length, desde),
      alternates: { canonical: `/catalogo/${familia.slug}` },
      openGraph: {
        type: "website",
        title: tituloCategoria(familia, desde),
        description: familia.descripcion,
      },
    };
  }

  const cat = getCategoria(categoria);
  if (!cat) return {};

  const productos = PRODUCTOS.filter(cat.filtro);
  const desde = Math.min(...productos.map(precioDesde));

  return {
    title: tituloCategoria(cat, desde),
    description: descripcionCategoria(cat, productos.length, desde),
    alternates: { canonical: `/catalogo/${cat.slug}` },
    openGraph: {
      type: "website",
      title: tituloCategoria(cat, desde),
      description: cat.descripcion,
      images: [ogDe(`/categorias/${cat.slug}.webp`, cat.titulo)],
    },
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

  const familia = FAMILIA_POR_SLUG.get(categoria);
  if (familia) return <PaginaFamilia familia={familia} />;

  const cat = getCategoria(categoria);
  if (!cat) notFound();

  const productos = PRODUCTOS.filter(cat.filtro);

  return (
    <>
      <DatosEstructurados
        datos={migasDePan([
          { nombre: "Inicio", ruta: "/" },
          { nombre: "Catálogo", ruta: "/catalogo" },
          { nombre: cat.nombre, ruta: `/catalogo/${cat.slug}` },
        ])}
      />
      <DatosEstructurados datos={listaProductos(productos, cat.titulo)} />

      <VistaCatalogo
        base={productos}
        eyebrow={cat.eyebrow}
        titulo={cat.titulo}
        descripcion={cat.descripcion}
        migas={[{ label: "Catálogo", href: "/catalogo" }, { label: cat.nombre }]}
      />
    </>
  );
}

/**
 * Página de familia olfativa.
 *
 * La guía va **debajo** de la rejilla a propósito: quien ya sabe qué quiere
 * compra arriba sin leer, y quien no sabe encuentra la explicación sin que le
 * estorbe el catálogo. Al final, enlaces a las demás familias con anclas que
 * dicen a qué huele cada una —"perfumes gourmand: vainilla, caramelo y café"
 * en vez de "ver más"—, que es lo que un buscador puede usar para entender de
 * qué trata la página del otro lado.
 */
function PaginaFamilia({ familia }: { familia: FamiliaInfo }) {
  const productos = porFamilia(familia.nombre);
  const otras = FAMILIAS.filter((f) => f.slug !== familia.slug);

  return (
    <>
      <DatosEstructurados
        datos={migasDePan([
          { nombre: "Inicio", ruta: "/" },
          { nombre: "Catálogo", ruta: "/catalogo" },
          { nombre: familia.titulo, ruta: `/catalogo/${familia.slug}` },
        ])}
      />
      <DatosEstructurados datos={listaProductos(productos, familia.titulo)} />

      <VistaCatalogo
        base={productos}
        eyebrow="Familia olfativa"
        titulo={familia.titulo}
        descripcion={familia.descripcion}
        migas={[
          { label: "Catálogo", href: "/catalogo" },
          { label: familia.nombre },
        ]}
      />

      <Seccion denso className="border-border-soft border-t">
        <Contenedor>
          <div className="max-w-3xl">
            <h2 className="font-display text-2xl leading-tight lg:text-3xl">
              Cómo huele un {familia.nombre.toLowerCase()} y cuándo usarlo
            </h2>
            {familia.guia.map((parrafo) => (
              <p
                key={parrafo.slice(0, 40)}
                className="text-fg-muted mt-4 text-[15px] leading-relaxed"
              >
                {parrafo}
              </p>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="font-display mb-4 text-xl leading-tight lg:text-2xl">
              Las otras familias olfativas
            </h2>
            <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {otras.map((f) => (
                <li key={f.slug} className="text-[15px] leading-relaxed">
                  <Link
                    href={`/catalogo/${f.slug}`}
                    className="hover:text-gold underline-offset-4 hover:underline"
                  >
                    {f.titulo}
                  </Link>
                  <span className="text-fg-muted">: {f.descripcion}</span>
                </li>
              ))}
            </ul>
          </div>
        </Contenedor>
      </Seccion>
    </>
  );
}
