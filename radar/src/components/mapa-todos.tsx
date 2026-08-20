"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapaLeaflet, LayerGroup } from "leaflet";
import { crearMapa, iconoRedondo } from "@/components/mapa-base";
import { COLOR_SEMAFORO, ETIQUETA_SEMAFORO, analizar } from "@/lib/analisis";
import type { Proveedor } from "@/lib/tipos";
import "leaflet/dist/leaflet.css";

const RUTA = process.env.NEXT_PUBLIC_RUTA ?? "";

/**
 * Todos los proveedores en un mapa, cada uno del color de su semáforo.
 *
 * Es la vista que la lista no puede dar: dos proveedores buenos a media cuadra
 * uno del otro se visitan en el mismo viaje, y eso solo se ve en el mapa. El
 * color va del semáforo porque la pregunta al mirarlo es "¿a cuál voy?", no
 * "¿cuánto sacó?".
 *
 * Quien no tenga ubicación no aparece: inventarle un punto lo pondría en un
 * lugar donde no está, que es peor que faltar.
 */
export function MapaTodos({ proveedores }: { proveedores: Proveedor[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const capa = useRef<LayerGroup | null>(null);
  const [sinTeselas, setSinTeselas] = useState(false);

  const conUbicacion = proveedores.filter((p) => p.lat !== null && p.lng !== null);
  const sinUbicacion = proveedores.length - conUbicacion.length;

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    let vivo = true;

    import("leaflet").then((L) => {
      if (!vivo || !contenedor.current) return;
      const m = crearMapa(L, contenedor.current, {
        centro: [19.4326, -99.1332],
        zoom: 4,
        onFallaTesela: () => setSinTeselas(true),
      });
      mapa.current = m;
      capa.current = L.layerGroup().addTo(m);
      // El contenedor se monta con ancho 0 dentro de una tarjeta; sin esto el
      // mapa dibuja solo un cuadrante.
      setTimeout(() => m.invalidateSize(), 100);
    });

    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      capa.current = null;
    };
    // Solo al montar: los marcadores se repintan en el efecto de abajo.
  }, []);

  // Repintar en vez de añadir: la lista cambia al filtrar y los marcadores
  // viejos se quedarían encima de los nuevos.
  useEffect(() => {
    let vivo = true;
    import("leaflet").then((L) => {
      const m = mapa.current;
      const g = capa.current;
      if (!vivo || !m || !g) return;
      g.clearLayers();

      const puntos: [number, number][] = [];
      for (const p of conUbicacion) {
        const { score, semaforo } = analizar(p);
        const color =
          semaforo === null ? "var(--color-fg-subtle)" : COLOR_SEMAFORO[semaforo];
        const punto: [number, number] = [p.lat!, p.lng!];
        puntos.push(punto);
        L.marker(punto, { icon: iconoRedondo(L, color, 18) })
          .bindPopup(
            `<strong>${escapar(p.nombre || "Sin nombre")}</strong><br>` +
              `${score ?? "—"}/100 · ${semaforo ? ETIQUETA_SEMAFORO[semaforo] : "Sin evaluar"}<br>` +
              `<a href="${RUTA}/ficha/?id=${encodeURIComponent(p.id)}">Abrir ficha</a>`,
          )
          .addTo(g);
      }

      // Encuadrar en lo que hay: un mapa centrado en México con los proveedores
      // en Dubái no serviría de nada.
      if (puntos.length === 1) m.setView(puntos[0], 15);
      else if (puntos.length > 1) m.fitBounds(puntos, { padding: [30, 30] });
    });
    return () => {
      vivo = false;
    };
    // `conUbicacion` se recalcula en cada render; la dependencia real es la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedores]);

  return (
    <div className="overflow-hidden rounded-lg border border-border-strong">
      <div ref={contenedor} className="h-72 w-full bg-bg" />
      <p className="border-t border-border-strong px-3 py-2 text-[12px] text-fg-subtle">
        {sinTeselas
          ? "Sin red: el mapa no carga. Los puntos guardados siguen intactos."
          : `${conUbicacion.length} en el mapa` +
            (sinUbicacion > 0 ? ` · ${sinUbicacion} sin ubicación` : "")}
      </p>
    </div>
  );
}

/** El nombre del proveedor entra en el HTML del popup y es texto libre. */
function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
