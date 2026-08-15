import type { Metadata } from "next";
import { VistaCatalogo } from "@/components/catalogo/vista-catalogo";
import { DatosEstructurados } from "@/components/comunes/datos-estructurados";
import { PRODUCTOS } from "@/data/productos";
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
    </>
  );
}
