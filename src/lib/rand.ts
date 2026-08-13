/**
 * Pseudo-aleatorio determinista.
 *
 * Todo valor "vivo" del catálogo (stock, rating, espectadores) se deriva del
 * slug del producto, no de Math.random(). Así el servidor y el cliente pintan
 * exactamente el mismo número y no hay desajuste de hidratación ni cifras que
 * cambian en cada recarga — la escasez que mostramos es estable y honesta.
 */

/** FNV-1a de 32 bits. */
export function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Devuelve un flotante estable en [0, 1) a partir de una semilla textual. */
export function rand01(semilla: string): number {
  return hash(semilla) / 0x100000000;
}

/** Entero estable en [min, max] (ambos inclusive). */
export function randEntero(semilla: string, min: number, max: number): number {
  return min + Math.floor(rand01(semilla) * (max - min + 1));
}

/** Elemento estable de una lista. */
export function randDe<T>(semilla: string, lista: readonly T[]): T {
  return lista[randEntero(semilla, 0, lista.length - 1)]!;
}
