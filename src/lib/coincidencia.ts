/**
 * Motor de coincidencia del buscador. Vive aparte de los datos a propósito:
 * así el buscador del header puede reutilizarlo sobre un índice ligero sin
 * arrastrar las 52 fichas completas al bundle del cliente.
 */

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Distancia de edición acotada: si supera `limite`, corta y devuelve limite+1. */
export function distancia(a: string, b: string, limite = 2): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    let mejor = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      const valor = Math.min(
        actual[j - 1]! + 1,
        previa[j]! + 1,
        previa[j - 1]! + costo,
      );
      actual.push(valor);
      if (valor < mejor) mejor = valor;
    }
    if (mejor > limite) return limite + 1;
    previa = actual;
  }
  return previa[b.length]!;
}

/**
 * Puntúa un texto indexado contra una consulta ya normalizada. Acepta acentos
 * ausentes y hasta un error de dedo por palabra: "azafran" y "vetiber" siguen
 * encontrando resultado (§1.2.2, punto 11).
 */
export function puntuar(
  nombre: string,
  indice: string,
  consulta: string,
): number {
  const palabras = consulta.split(/\s+/).filter(Boolean);
  if (!palabras.length) return 0;

  let total = 0;
  for (const palabra of palabras) {
    if (nombre.startsWith(palabra)) total += 12;
    else if (nombre.includes(palabra)) total += 8;
    else if (indice.includes(palabra)) total += 4;
    else if (palabra.length >= 4) {
      const cercana = indice
        .split(/\s+/)
        .some((t) => t.length >= 4 && distancia(t, palabra, 1) <= 1);
      if (!cercana) return 0;
      total += 2;
    } else return 0;
  }
  return total;
}
