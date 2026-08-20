"use client";

import type { Map as MapaLeaflet } from "leaflet";

/**
 * Lo que comparten los dos mapas de la app: el de un punto arrastrable
 * (`mapa-punto.tsx`) y el de todos los proveedores (`mapa-todos.tsx`).
 *
 * Leaflet se importa siempre dentro de un `useEffect`: toca `window` al
 * cargarse y la app se prerenderiza en el build.
 */

export type Leaflet = typeof import("leaflet");

/**
 * Marcador redondo dibujado con HTML.
 *
 * `divIcon` en vez del marcador por defecto: los PNG que trae Leaflet se rompen
 * con cualquier empaquetador, y así además el pin se pinta con el color que le
 * toque —el de la marca en la captura, el del semáforo en el mapa de todos.
 */
export function iconoRedondo(L: Leaflet, color: string, tamano = 22) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${tamano}px;height:${tamano}px;border-radius:999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgb(0 0 0 / .45)"></span>`,
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2],
  });
}

/** Mapa con las teselas de OSM ya puestas. `onFallaTesela` avisa si no hay red. */
export function crearMapa(
  L: Leaflet,
  contenedor: HTMLElement,
  opciones: { centro: [number, number]; zoom: number; onFallaTesela?: () => void },
): MapaLeaflet {
  const m = L.map(contenedor, {
    center: opciones.centro,
    zoom: opciones.zoom,
    // El zoom con dos dedos ya funciona; la rueda solo estorba dentro de una
    // página que se recorre con scroll.
    scrollWheelZoom: false,
    attributionControl: true,
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  })
    .on("tileerror", () => opciones.onFallaTesela?.())
    .addTo(m);

  return m;
}
