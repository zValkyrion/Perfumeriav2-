"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  EncabezadoCatalogo,
  RejillaCatalogo,
} from "@/components/catalogo/vista-catalogo";
import { Contenedor } from "@/components/comunes/layout";
import { EN_PROMOCION, PROMO_3X2, tieneRebaja } from "@/data/productos";

/**
 * La rejilla es lo único que depende de `?vista=rebajas`, así que es lo único
 * que va dentro del Suspense.
 */
function RejillaPromociones() {
  const searchParams = useSearchParams();
  const rebajas = searchParams.get("vista") === "rebajas";

  return (
    <RejillaCatalogo
      base={rebajas ? EN_PROMOCION.filter(tieneRebaja) : [...EN_PROMOCION]}
    />
  );
}

/**
 * El encabezado describe siempre la promoción 3x2, que es la vista canónica de
 * `/promociones`. Antes dependía del parámetro y por eso la URL indexable
 * llegaba al rastreador con "Cargando..." en lugar del h1. La vista de rebajas
 * sigue cambiando la rejilla.
 */
export default function PromocionesPage() {
  return (
    <Contenedor className="py-6 lg:py-10">
      <EncabezadoCatalogo
        eyebrow="Promoción vigente"
        titulo="3x2 en toda la tienda"
        descripcion={`Llévate 3, paga 2: el de menor precio va por nuestra cuenta. ${PROMO_3X2.length} modelos participan, y el descuento por volumen se suma a partir de 3 piezas.`}
        migas={[{ label: "Promociones" }]}
      />

      <Suspense
        fallback={
          <div className="py-10 text-center">Cargando promociones...</div>
        }
      >
        <RejillaPromociones />
      </Suspense>
    </Contenedor>
  );
}
