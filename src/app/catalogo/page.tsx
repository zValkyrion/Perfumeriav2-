import type { Metadata } from "next";
import Link from "next/link";
import { VistaCatalogo } from "@/components/catalogo/vista-catalogo";
import { DatosEstructurados } from "@/components/comunes/datos-estructurados";
import { Contenedor, Seccion } from "@/components/comunes/layout";
import { PRODUCTOS } from "@/data/productos";
import { FAMILIAS } from "@/data/taxonomia";
import { listaProductos, migasDePan } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Catálogo completo de perfumes",
  description: `Los ${PRODUCTOS.length} perfumes del catálogo: diseñador, árabes, nicho e inspirados. Filtra por familia olfativa, precio, marca y ocasión. Mayoreo desde 3 piezas.`,
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
        eyebrow="Todo el catálogo"
        titulo="Perfumes"
        descripcion="Cincuenta y dos fragancias de doce casas. Desde 3 piezas el precio baja 15% y el envío corre por nuestra cuenta."
        migas={[{ label: "Catálogo" }]}
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
