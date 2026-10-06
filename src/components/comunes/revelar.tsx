"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

/*
 * Movimiento reducido: lo resuelve el CSS, no un `useReducedMotion`.
 *
 * Antes se ramificaba el árbol según ese hook. El HTML prerenderizado sale
 * siempre con la rama animada (`opacity: 0` en línea, porque el servidor no
 * conoce la preferencia) y en el cliente la primera pasada tomaba la rama
 * estática: React no corrige atributos al hidratar, así que el estilo en línea
 * se quedaba y el contenido no aparecía nunca. Ahora el árbol es el mismo en
 * servidor y cliente, y la regla `[data-revelar]` de globals.css fuerza
 * `opacity: 1` y quita el desplazamiento cuando se pide menos movimiento.
 */

/**
 * Entrada de sección: opacity 0→1 y y 16→0, 0.5s, easeOut, una sola vez (§6.7).
 * Con `prefers-reduced-motion` el contenido se ve tal cual desde el principio.
 */
export function Revelar({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      data-revelar=""
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

/** Igual que `Revelar`, pero escalona a sus hijos 60 ms (§6.7). */
export function RevelarLista({
  children,
  className,
  paso = 0.06,
}: {
  children: ReactNode[];
  className?: string;
  paso?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="oculto"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        visible: { transition: { staggerChildren: paso } },
      }}
    >
      {children.map((hijo, i) => (
        <motion.div
          key={i}
          data-revelar=""
          variants={{
            oculto: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {hijo}
        </motion.div>
      ))}
    </motion.div>
  );
}
