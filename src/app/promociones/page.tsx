"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VistaCatalogo } from "@/components/catalogo/vista-catalogo";
import { EN_PROMOCION, PROMO_3X2, tieneRebaja } from "@/data/productos";

function PromocionesContenido() {
  const searchParams = useSearchParams();
  const vista = searchParams.get("vista");
  const rebajas = vista === "rebajas";
  const base = rebajas
    ? EN_PROMOCION.filter(tieneRebaja)
    : [...EN_PROMOCION];

  return (
    <VistaCatalogo
      base={base}
      eyebrow={rebajas ? "Precio rebajado" : "Promoción vigente"}
      titulo={rebajas ? "Rebajas" : "3x2 en toda la tienda"}
      descripcion={
        rebajas
          ? "Los perfumes con precio rebajado ahora mismo. El descuento por volumen se aplica encima de la rebaja."
          : `Llévate 3, paga 2: el de menor precio va por nuestra cuenta. ${PROMO_3X2.length} modelos participan, y el descuento por volumen se suma a partir de 3 piezas.`
      }
      migas={[{ label: "Promociones" }]}
    />
  );
}

export default function PromocionesPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center">Cargando promociones...</div>}>
      <PromocionesContenido />
    </Suspense>
  );
}
