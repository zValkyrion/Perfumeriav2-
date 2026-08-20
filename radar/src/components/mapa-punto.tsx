"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapaLeaflet, Marker } from "leaflet";
import { crearMapa, iconoRedondo } from "@/components/mapa-base";
import "leaflet/dist/leaflet.css";

/**
 * Mapa para colocar el punto a mano.
 *
 * Existe porque el GPS del navegador miente cuando no hay GPS de verdad: en una
 * laptop, o en un teléfono con la ubicación precisa apagada, la posición sale de
 * la IP o del wifi y puede caer a kilómetros — a veces en otra ciudad. El dato
 * automático es un punto de partida, no la verdad; quien está parado en la
 * puerta del local es el único que sabe dónde está.
 *
 * Leaflet se carga dentro de `useEffect` a propósito: toca `window` al importarse
 * y la app se prerenderiza en el build.
 */
export function MapaPunto({
  lat,
  lng,
  onCambio,
  soloLectura = false,
}: {
  lat: number | null;
  lng: number | null;
  onCambio?: (lat: number, lng: number) => void;
  /** La ficha guardada enseña el punto, no lo edita. */
  soloLectura?: boolean;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const marca = useRef<Marker | null>(null);
  const alCambiar = useRef(onCambio);
  const editable = !soloLectura;
  const [sinTeselas, setSinTeselas] = useState(false);

  // El callback cambia en cada render del padre; guardarlo en una ref evita
  // recrear el mapa entero por eso.
  useEffect(() => {
    alCambiar.current = onCambio;
  }, [onCambio]);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    let vivo = true;

    import("leaflet").then((L) => {
      if (!vivo || !contenedor.current) return;

      const centro: [number, number] = [lat ?? 19.4326, lng ?? -99.1332];
      const m = crearMapa(L, contenedor.current, {
        centro,
        zoom: lat === null ? 12 : 17,
        onFallaTesela: () => setSinTeselas(true),
      });

      const mk = L.marker(centro, {
        icon: iconoRedondo(L, "var(--color-gold)"),
        draggable: editable,
      }).addTo(m);
      if (editable) {
        mk.on("dragend", () => {
          const p = mk.getLatLng();
          alCambiar.current?.(p.lat, p.lng);
        });
        m.on("click", (e) => {
          mk.setLatLng(e.latlng);
          alCambiar.current?.(e.latlng.lat, e.latlng.lng);
        });
      }

      mapa.current = m;
      marca.current = mk;

      // El contenedor suele montarse con ancho 0 dentro de una tarjeta; sin esto
      // el mapa dibuja solo un cuadrante.
      setTimeout(() => m.invalidateSize(), 100);
    });

    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      marca.current = null;
    };
    // Solo al montar: las actualizaciones de posición van en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mover el punto desde fuera (botón de GPS) recentra el mapa.
  useEffect(() => {
    if (lat === null || lng === null || !mapa.current || !marca.current) return;
    marca.current.setLatLng([lat, lng]);
    mapa.current.setView([lat, lng], Math.max(mapa.current.getZoom(), 17));
  }, [lat, lng]);

  return (
    <div className="overflow-hidden rounded-lg border border-border-strong">
      <div ref={contenedor} className={soloLectura ? "h-40 w-full bg-bg" : "h-56 w-full bg-bg"} />
      {(!soloLectura || sinTeselas) && (
        <p className="border-t border-border-strong px-3 py-2 text-[12px] text-fg-subtle">
          {sinTeselas
            ? "Sin red: el mapa no carga. El punto guardado sigue intacto."
            : "Toca el mapa o arrastra el punto para corregir la ubicación."}
        </p>
      )}
    </div>
  );
}
