"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Entrada de sección: opacity 0→1 y y 16→0, 0.5s, easeOut, una sola vez (§6.7).
 * Con `prefers-reduced-motion` no anima nada y renderiza el contenido tal cual.
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
  const reducido = useReducedMotion();

  if (reducido) return <div className={className}>{children}</div>;

  return (
    <motion.div
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
  const reducido = useReducedMotion();

  if (reducido) return <div className={className}>{children}</div>;

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
