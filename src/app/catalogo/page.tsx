import type { Metadata } from "next";
import Link from "next/link";
import { CabeceraMayoreo } from "@/components/catalogo/cabecera-mayoreo";
import { VistaCatalogo } from "@/components/catalogo/vista-catalogo";
import { DatosEstructurados } from "@/components/comunes/datos-estructurados";
import { Contenedor, Seccion } from "@/components/comunes/layout";
import { PRODUCTOS } from "@/data/productos";
import { FAMILIAS } from "@/data/taxonomia";
import { listaProductos, migasDePan } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Mayoreo surtido de perfumes",
  description: `Los ${PRODUCTOS.length} perfumes del catálogo: diseñador, árabes, nicho e inspirados. Elige los que quieras y el descuento baja solo: 10% desde 3 piezas, 30% desde 10, con envío gratis.`,
  alternates: { canonical: "/catalogo" },
};

export default function CatalogoPage() {
  return (
    <>
      <DatosEstructurados
        datos={migasDePan([
          { nombre: "Inicio", ruta: "/" },
          { nombre: "Catálogo", ruta: "/catalogo" },
        ])}
      />
      <DatosEstructurados
        datos={listaProductos(PRODUCTOS, "Catálogo completo de perfumes")}
      />

      <VistaCatalogo
        base={[...PRODUCTOS]}
        titulo="Mayoreo surtido"
        migas={[{ label: "Mayoreo surtido" }]}
        encabezado={<CabeceraMayoreo />}
      />

      {/* Enlaza el catálogo con las nueve familias. Las anclas dicen a qué
          huele cada una en vez de "ver más": es lo único que el buscador puede
          leer para saber de qué trata la página de destino. */}
      <Seccion denso className="border-border-soft border-t">
        <Contenedor>
          <h2 className="font-display mb-4 text-xl leading-tight lg:text-2xl">
            Buscar por familia olfativa
          </h2>
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {FAMILIAS.map((f) => (
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
        </Contenedor>
      </Seccion>
    </>
  );
}
