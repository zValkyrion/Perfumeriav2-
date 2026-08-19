"use client";

/** Ubicación: GPS del dispositivo y, si hay red, dirección legible. */

export type Ubicacion = {
  lat: number;
  lng: number;
  precision: number;
};

export function ubicacionActual(): Promise<Ubicacion> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este dispositivo no reporta ubicación"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
        }),
      (err) => {
        const motivos: Record<number, string> = {
          1: "Permiso de ubicación denegado",
          2: "Sin señal de GPS ahora mismo",
          3: "El GPS tardó demasiado",
        };
        reject(new Error(motivos[err.code] ?? "No se pudo obtener la ubicación"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}

export type Direccion = {
  texto: string;
  ciudad: string;
  pais: string;
};

/**
 * Dirección legible a partir de las coordenadas (Nominatim / OpenStreetMap).
 *
 * Falla en silencio a propósito: sin red se guardan las coordenadas y la ficha
 * sigue siendo válida. La dirección se rellena al sincronizar, o a mano.
 */
export async function direccionDe(lat: number, lng: number): Promise<Direccion | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("accept-language", "es");

    const ctrl = new AbortController();
    const corte = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(corte);
    if (!res.ok) return null;

    const datos = await res.json();
    const a = datos.address ?? {};
    return {
      texto: datos.display_name ?? "",
      ciudad: a.city ?? a.town ?? a.village ?? a.county ?? "",
      pais: a.country ?? "",
    };
  } catch {
    return null;
  }
}

/** Enlace para abrir el punto en el mapa del teléfono. */
export function enlaceMapa(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

/** Distancia en metros entre dos puntos (Haversine). Sirve para duplicados. */
export function distancia(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
