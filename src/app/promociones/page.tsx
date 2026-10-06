"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  EncabezadoCatalogo,
  EstadoVacio,
  RejillaCatalogo,
} from "@/components/catalogo/vista-catalogo";
import { Contenedor } from "@/components/comunes/layout";
import { EN_PROMOCION, PROMO_3X2, tieneRebaja } from "@/data/productos";
import { ESCALON_TOPE, ESCALONES, PIEZAS_ENVIO_GRATIS, pct } from "@/lib/volumen";

/**
 * El 3x2 solo se cobra en los modelos con la etiqueta «3x2» (`cotizar()` en
 * compartido/cotizacion.ts). Con el catálogo real ninguno la lleva, y esta
 * página decía «3x2 en toda la tienda · 0 modelos participan» sobre una
 * rejilla vacía. Ahora el texto sale de lo que hay: si el negocio etiqueta
 * modelos en el panel, vuelve solo.
 */
const HAY_3X2 = PROMO_3X2.length > 0;

/** El primer escalón con descuento: desde ahí hay precio de mayoreo. */
const PRIMER_MAYOREO = ESCALONES.find((e) => e.descuento > 0)!;

/** Lo que está vigente siempre, haya o no promoción: la escalera. */
const SIEMPRE = `Desde ${PRIMER_MAYOREO.min} perfumes tienes ${pct(PRIMER_MAYOREO.descuento)}% de descuento${
  PIEZAS_ENVIO_GRATIS === PRIMER_MAYOREO.min
    ? " y envío gratis"
    : `, y envío gratis desde ${PIEZAS_ENVIO_GRATIS} piezas`
}; desde ${ESCALON_TOPE.min}, ${pct(ESCALON_TOPE.descuento)}%.`;

/**
 * La rejilla es lo único que depende de `?vista=rebajas`, así que es lo único
 * que va dentro del Suspense.
 */
function RejillaPromociones() {
  const searchParams = useSearchParams();
  const rebajas = searchParams.get("vista") === "rebajas";

  // Memorizado: una lista nueva en cada render obligaba a la rejilla a
  // rehacer todo el filtrado aunque nada hubiera cambiado.
  const base = useMemo(
    () => (rebajas ? EN_PROMOCION.filter(tieneRebaja) : [...EN_PROMOCION]),
    [rebajas],
  );

  // Sin nada en promoción, el vacío lo dice tal cual en vez de sugerir que
  // sobran filtros: no hay filtro que quitar para que aparezca algo.
  return (
    <RejillaCatalogo
      base={base}
      vacioPersonalizado={
        base.length === 0 ? (
          <EstadoVacio
            conFiltros={false}
            titulo="Sin promociones por ahora"
            texto="El precio de mayoreo sí aplica siempre: baja solo al agregar piezas al carrito."
          />
        ) : undefined
      }
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
      {HAY_3X2 ? (
        <EncabezadoCatalogo
          eyebrow="Promoción vigente"
          titulo="3x2 en perfumes seleccionados"
          descripcion={`Llévate 3, paga 2: el de menor precio va por nuestra cuenta. ${PROMO_3X2.length} modelos participan, y el descuento por volumen se suma a partir de ${PRIMER_MAYOREO.min} piezas.`}
          migas={[{ label: "Promociones" }]}
        />
      ) : (
        <EncabezadoCatalogo
          eyebrow="Promociones"
          titulo={`Mayoreo desde ${PRIMER_MAYOREO.min} perfumes`}
          descripcion={`Por ahora no hay modelos en 3x2 ni con precio rebajado. ${SIEMPRE}`}
          migas={[{ label: "Promociones" }]}
        />
      )}

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
