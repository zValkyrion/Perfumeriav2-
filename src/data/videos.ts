import type { Reseña } from "@/types";

export interface VideoCliente {
  id: string;
  autor: string;
  titulo: string;
  rating: number;
  poster: string;
  ciudad: string;
}

const CIUDADES = [
  "León, Gto.",
  "Guadalajara, Jal.",
  "CDMX",
  "Monterrey, N.L.",
  "Mérida, Yuc.",
  "Puebla, Pue.",
  "Tijuana, B.C.",
  "Querétaro, Qro.",
];

/**
 * Construye las tarjetas de video a partir de reseñas reales del catálogo.
 *
 * Vive en un módulo de servidor, no junto al componente: aquel lleva
 * `"use client"` y una función exportada desde ahí no puede invocarse durante
 * el renderizado en servidor.
 */
export function videosDesdeResenas(
  resenas: readonly Reseña[],
  posters: string[],
): VideoCliente[] {
  return resenas.slice(0, 8).map((r, i) => ({
    id: r.id,
    autor: r.autor,
    titulo: r.titulo,
    rating: r.rating,
    poster: posters[i % posters.length]!,
    ciudad: CIUDADES[i % CIUDADES.length]!,
  }));
}
