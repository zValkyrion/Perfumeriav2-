"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
 * Capa con desplazamiento parallax.
 *
 * Donde el navegador soporta animaciones ligadas al scroll, el trabajo lo hace
 * la clase `.capa-parallax` en CSS y corre en el compositor, sin JavaScript.
 * Donde no —hoy Safari y Firefox— entra este respaldo con un listener pasivo
 * limitado por `requestAnimationFrame`. La clase se aplica siempre para que el
 * HTML del servidor y el del cliente coincidan; es el efecto quien decide si
 * hace falta mover nada a mano.
 */
export function CapaParallax({
  desde,
  hasta,
  className,
  style,
}: {
  /** Desplazamiento inicial en % de la altura del elemento. */
  desde: number;
  hasta: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const nodo = useRef<HTMLDivElement>(null);
  const reducido = useReducedMotion();

  useEffect(() => {
    if (reducido) return;
    if (CSS.supports("animation-timeline: view()")) return;

    const el = nodo.current;
    if (!el) return;

    let pendiente = 0;

    const pintar = () => {
      pendiente = 0;
      const r = el.getBoundingClientRect();
      const alto = window.innerHeight;
      // Progreso de 0 a 1 mientras el elemento cruza la pantalla completa.
      const p = Math.min(1, Math.max(0, (alto - r.top) / (alto + r.height)));
      el.style.transform = `translateY(${(desde + (hasta - desde) * p).toFixed(2)}%)`;
    };

    const alMover = () => {
      if (!pendiente) pendiente = requestAnimationFrame(pintar);
    };

    pintar();
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    return () => {
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, [desde, hasta, reducido]);

  return (
    <div
      ref={nodo}
      aria-hidden
      className={cn("capa-parallax pointer-events-none absolute inset-0", className)}
      style={
        {
          ...style,
          "--desde": `${desde}%`,
          "--hasta": `${hasta}%`,
        } as React.CSSProperties
      }
    />
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
