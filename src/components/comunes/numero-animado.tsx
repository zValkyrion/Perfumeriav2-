"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { numero, precio, precioMXN } from "@/lib/format";

/**
 * El formato se elige con una cadena, no con una función.
 *
 * Pasarlo como callback obligaría al consumidor a memoizarlo para que el
 * efecto no se reejecutase en cada render, y guardarlo en un ref sería mutar
 * durante el render. Con tres formatos cerrados el problema desaparece.
 */
const FORMATOS = {
  precio,
  moneda: precioMXN,
  entero: numero,
} as const;

export type FormatoNumero = keyof typeof FORMATOS;

/**
 * Cifra que cuenta hasta su nuevo valor (§6.7).
 *
 * Escribe directamente en el nodo del DOM en vez de pasar por `setState`: son
 * ~30 fotogramas por cambio y hacerlo con estado provocaría otros tantos
 * renders en cascada. El valor correcto va en el HTML inicial, así que el
 * servidor pinta la cifra buena aunque el JavaScript nunca llegue.
 */
export function NumeroAnimado({
  valor,
  formato = "precio",
  duracion = 0.5,
  className,
}: {
  valor: number;
  formato?: FormatoNumero;
  duracion?: number;
  className?: string;
}) {
  const nodo = useRef<HTMLSpanElement>(null);
  const anterior = useRef(valor);
  const reducido = useReducedMotion();

  useEffect(() => {
    const el = nodo.current;
    const desde = anterior.current;
    anterior.current = valor;
    if (!el) return;

    const dar = FORMATOS[formato];

    // Sin movimiento o sin cambio real: se escribe el valor final y ya.
    if (reducido || desde === valor) {
      el.textContent = dar(valor);
      return;
    }

    const control = animate(desde, valor, {
      duration: duracion,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = dar(v);
      },
    });

    return () => control.stop();
  }, [valor, formato, duracion, reducido]);

  return (
    <span ref={nodo} data-precio className={className}>
      {FORMATOS[formato](valor)}
    </span>
  );
}
