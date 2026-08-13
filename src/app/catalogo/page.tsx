import type { Metadata } from "next";
import { VistaCatalogo } from "@/components/catalogo/vista-catalogo";
import { PRODUCTOS } from "@/data/productos";

export const metadata: Metadata = {
  title: "Catálogo completo",
  description:
    "Los 52 perfumes de AURA: diseñador, árabes, nicho e inspirados. Filtra por familia olfativa, precio, marca y ocasión. Mayoreo desde 3 piezas.",
};

export default function CatalogoPage() {
  return (
    <VistaCatalogo
      base={[...PRODUCTOS]}
      eyebrow="Todo el catálogo"
      titulo="Perfumes"
      descripcion="Cincuenta y dos fragancias de doce casas. Desde 3 piezas el precio baja 15% y el envío corre por nuestra cuenta."
      migas={[{ label: "Catálogo" }]}
    />
  );
}
