"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Texto que se teclea solo dentro del buscador.
 *
 * Escribe en el nodo del DOM en lugar de pasar por estado: son varias
 * actualizaciones por segundo y hacerlo con `setState` provocaría otros tantos
 * renders. Con `prefers-reduced-motion` se queda quieto en la primera frase.
 */
export function PlaceholderAnimado({
  frases,
  className,
}: {
  frases: string[];
  className?: string;
}) {
  const nodo = useRef<HTMLSpanElement>(null);
  const reducido = useReducedMotion();

  useEffect(() => {
    const el = nodo.current;
    if (!el || reducido) return;

    let frase = 0;
    let letra = 0;
    let borrando = false;
    let temporizador: ReturnType<typeof setTimeout>;

    const paso = () => {
      const actual = frases[frase % frases.length]!;
      letra += borrando ? -1 : 1;
      el.textContent = actual.slice(0, letra);

      let espera = borrando ? 35 : 65;

      if (!borrando && letra === actual.length) {
        // Pausa larga al terminar de escribir: da tiempo a leerlo.
        espera = 1800;
        borrando = true;
      } else if (borrando && letra === 0) {
        borrando = false;
        frase += 1;
        espera = 350;
      }

      temporizador = setTimeout(paso, espera);
    };

    temporizador = setTimeout(paso, 600);
    return () => clearTimeout(temporizador);
  }, [frases, reducido]);

  return (
    <span aria-hidden className={className}>
      <span ref={nodo}>{frases[0]}</span>
      <span className="animate-shimmer text-gold ml-px inline-block">|</span>
    </span>
  );
}
