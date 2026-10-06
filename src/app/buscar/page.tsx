"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { EstadoVacio, VistaCatalogo } from "@/components/catalogo/vista-catalogo";
import { PRODUCTOS, buscar } from "@/data/productos";

function BuscarContenido() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  // Memorizado por la consulta: una lista nueva en cada render invalidaba la
  // memoria de la rejilla y repetía la búsqueda y todo el filtrado.
  const base = useMemo(() => (q ? buscar(q, 200) : [...PRODUCTOS]), [q]);

  return (
    <VistaCatalogo
      base={base}
      eyebrow={q ? "Resultados de búsqueda" : "Explora"}
      titulo={q ? `“${q}”` : "Buscar perfumes"}
      descripcion={
        q
          ? `${base.length} ${base.length === 1 ? "resultado" : "resultados"} para tu búsqueda.`
          : "Escribe en el buscador del menú o explora el catálogo completo."
      }
      migas={[{ label: "Buscar" }]}
      vacioPersonalizado={
        q ? (
          <EstadoVacio
            conFiltros={false}
            titulo={`No encontramos “${q}”`}
            texto="Revisa la ortografía o prueba con una nota olfativa, una marca o una ocasión."
          />
        ) : undefined
      }
    />
  );
}

export default function BuscarPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center">Cargando búsqueda...</div>}>
      <BuscarContenido />
    </Suspense>
  );
}
