"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { numero } from "@/lib/format";
import { cn } from "@/lib/utils";

const CURVA = [0.16, 1, 0.3, 1] as const;

/**
 * Titular que se revela palabra por palabra desde detrás de una máscara.
 *
 * Cada palabra vive dentro de un contenedor con `overflow: hidden` y sube a su
 * sitio; el escalonado guía la lectura. Es el gesto que mejor le sienta a una
 * serif grande, y por eso se reserva a los titulares principales: usado en
 * todas partes dejaría de significar nada.
 */
export function TituloRevelado({
  texto,
  className,
  paso = 0.055,
  as: Etiqueta = "h2",
}: {
  texto: string;
  className?: string;
  paso?: number;
  as?: "h1" | "h2" | "p";
}) {
  const reducido = useReducedMotion();
  const palabras = texto.split(" ");

  if (reducido) return <Etiqueta className={className}>{texto}</Etiqueta>;

  return (
    <Etiqueta className={className}>
      {/* El texto completo queda accesible; las palabras animadas se ocultan
          a la tecnología asistiva para que no se lea entrecortado. */}
      <span className="sr-only">{texto}</span>
      <span aria-hidden className="inline">
        {palabras.map((palabra, i) => (
          <span
            key={`${palabra}-${i}`}
            className="inline-block overflow-hidden align-bottom"
          >
            <motion.span
              className="inline-block"
              initial={{ y: "108%" }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: "-12%" }}
              transition={{ duration: 0.7, ease: CURVA, delay: i * paso }}
            >
              {palabra}
              {i < palabras.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </span>
    </Etiqueta>
  );
}

/**
 * Cortina que descubre una imagen de izquierda a derecha al entrar en pantalla,
 * mientras el contenido se desescala muy ligeramente. Sustituye al clásico
 * "fade in" y da sensación de material que se despliega.
 */
export function Cortina({
  children,
  className,
  retraso = 0,
}: {
  children: ReactNode;
  className?: string;
  retraso?: number;
}) {
  const reducido = useReducedMotion();

  if (reducido) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={cn("overflow-hidden", className)}
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      whileInView={{ clipPath: "inset(0 0% 0 0)" }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.9, ease: CURVA, delay: retraso }}
    >
      <motion.div
        initial={{ scale: 1.12 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 1.1, ease: CURVA, delay: retraso }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * Cifra grande que cuenta desde cero cuando entra en pantalla.
 *
 * Escribe en el nodo del DOM en lugar de en el estado: son decenas de
 * fotogramas y pasarlos por React costaría otros tantos renders.
 */
export function ContadorEnVista({
  valor,
  duracion = 1.6,
  className,
  sufijo = "",
  prefijo = "",
}: {
  valor: number;
  duracion?: number;
  className?: string;
  sufijo?: string;
  prefijo?: string;
}) {
  const nodo = useRef<HTMLSpanElement>(null);
  const contenedor = useRef<HTMLSpanElement>(null);
  const enVista = useInView(contenedor, { once: true, margin: "-20%" });
  const reducido = useReducedMotion();

  // `once: true` garantiza que esto solo se dispara una vez. No hay setState:
  // la cuenta se escribe directamente en el nodo, así que los ~90 fotogramas
  // no provocan un solo render de React.
  useEffect(() => {
    if (!enVista || reducido) return;
    const el = nodo.current;
    if (!el) return;

    const control = animate(0, valor, {
      duration: duracion,
      ease: CURVA,
      onUpdate: (v) => {
        el.textContent = `${prefijo}${numero(v)}${sufijo}`;
      },
    });

    return () => control.stop();
  }, [enVista, valor, duracion, reducido, prefijo, sufijo]);

  return (
    <span ref={contenedor} className={className} data-precio>
      <span ref={nodo}>{`${prefijo}${numero(valor)}${sufijo}`}</span>
    </span>
  );
}

/**
 * Inclinación 3D sutil siguiendo al puntero.
 *
 * Escribe variables CSS en el nodo desde el propio manejador, sin estado ni
 * re-render, así que sale gratis en cada movimiento del ratón. Se desactiva en
 * táctil (donde no hay puntero fino) y con `prefers-reduced-motion`.
 */
export function Tilt({
  children,
  className,
  intensidad = 6,
}: {
  children: ReactNode;
  className?: string;
  intensidad?: number;
}) {
  const nodo = useRef<HTMLDivElement>(null);
  const reducido = useReducedMotion();

  function mover(e: React.MouseEvent<HTMLDivElement>) {
    const el = nodo.current;
    if (!el || reducido) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--giro-x", `${(-y * intensidad).toFixed(2)}deg`);
    el.style.setProperty("--giro-y", `${(x * intensidad).toFixed(2)}deg`);
  }

  function soltar() {
    const el = nodo.current;
    if (!el) return;
    el.style.setProperty("--giro-x", "0deg");
    el.style.setProperty("--giro-y", "0deg");
  }

  return (
    <div
      ref={nodo}
      onMouseMove={mover}
      onMouseLeave={soltar}
      className={cn("tilt", className)}
    >
      {children}
    </div>
  );
}
