"use client";

import { useRef } from "react";
import { useReducedMotion } from "framer-motion";

/* Medidas del frasco, en píxeles. Todo lo demás se deriva de aquí. */
const C = { ancho: 168, alto: 214, fondo: 96 }; // cuerpo
const T = { ancho: 96, alto: 62, fondo: 58 }; // tapa
const N = { ancho: 54, alto: 30, fondo: 40 }; // cuello

const VIDRIO_FRENTE =
  "linear-gradient(115deg, rgba(255,255,255,.20) 0%, rgba(201,162,39,.55) 38%, rgba(90,68,10,.85) 100%)";
const VIDRIO_LADO =
  "linear-gradient(115deg, rgba(255,255,255,.10) 0%, rgba(140,111,20,.75) 45%, rgba(30,22,4,.92) 100%)";
const ORO = "linear-gradient(135deg, #6E570F 0%, #E8C766 45%, #C9A227 100%)";
const ORO_LADO = "linear-gradient(135deg, #4d3c0a 0%, #C9A227 55%, #8C6F14 100%)";

/** Una caja de 4 caras + tapa superior, en 3D. */
function Caja({
  ancho,
  alto,
  fondo,
  frente,
  lado,
  arriba,
  y = 0,
  children,
}: {
  ancho: number;
  alto: number;
  fondo: number;
  frente: string;
  lado: string;
  arriba: string;
  /** Desplazamiento vertical respecto al centro de la escena. */
  y?: number;
  children?: React.ReactNode;
}) {
  const caras = [
    { t: `translateZ(${fondo / 2}px)`, w: ancho, h: alto, bg: frente },
    { t: `rotateY(180deg) translateZ(${fondo / 2}px)`, w: ancho, h: alto, bg: lado },
    { t: `rotateY(-90deg) translateZ(${fondo / 2}px)`, w: fondo, h: alto, bg: lado },
    { t: `rotateY(90deg) translateZ(${fondo / 2}px)`, w: fondo, h: alto, bg: lado },
    {
      t: `rotateX(90deg) translateZ(${alto / 2}px)`,
      w: ancho,
      h: fondo,
      bg: arriba,
    },
  ];

  return (
    <div
      className="absolute top-1/2 left-1/2"
      style={{
        transformStyle: "preserve-3d",
        transform: `translate(-50%, -50%) translateY(${y}px)`,
        width: ancho,
        height: alto,
      }}
    >
      {caras.map((c, i) => (
        <div
          key={i}
          className="cara-3d rounded-[3px]"
          style={{
            width: c.w,
            height: c.h,
            backgroundImage: c.bg,
            left: `${(ancho - c.w) / 2}px`,
            top: `${(alto - c.h) / 2}px`,
            transform: c.t,
          }}
        />
      ))}
      {children}
    </div>
  );
}

/**
 * Frasco de perfume en CSS 3D, girable con el puntero, el dedo o el teclado.
 *
 * No es una imagen ni un visor WebGL: son cinco caras por caja compuestas en
 * el espacio, así que pesa cero kilobytes extra y se ve nítido en cualquier
 * pantalla. El giro se escribe directamente en el nodo, sin estado de React,
 * porque un arrastre son decenas de eventos por segundo.
 */
export function Frasco3D() {
  const auto = useRef<HTMLDivElement>(null);
  const manual = useRef<HTMLDivElement>(null);
  const arrastre = useRef({ activo: false, x: 0, y: 0, gy: 0, gx: -8 });
  const reducido = useReducedMotion();

  function aplicar() {
    const el = manual.current;
    if (!el) return;
    el.style.setProperty("--gy", `${arrastre.current.gy}deg`);
    el.style.setProperty("--gx", `${arrastre.current.gx}deg`);
  }

  function pausar(quieto: boolean) {
    auto.current?.setAttribute("data-quieto", String(quieto));
  }

  function alPulsar(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current.activo = true;
    arrastre.current.x = e.clientX;
    arrastre.current.y = e.clientY;
    pausar(true);
  }

  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    if (!a.activo) return;
    a.gy += (e.clientX - a.x) * 0.55;
    // La inclinación se limita: si se puede volcar del todo, se ve el truco.
    a.gx = Math.max(-32, Math.min(20, a.gx - (e.clientY - a.y) * 0.25));
    a.x = e.clientX;
    a.y = e.clientY;
    aplicar();
  }

  function alSoltar(e: React.PointerEvent<HTMLDivElement>) {
    arrastre.current.activo = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!reducido) pausar(false);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLDivElement>) {
    const paso = e.shiftKey ? 25 : 10;
    if (e.key === "ArrowLeft") arrastre.current.gy -= paso;
    else if (e.key === "ArrowRight") arrastre.current.gy += paso;
    else if (e.key === "ArrowUp")
      arrastre.current.gx = Math.max(-32, arrastre.current.gx - 5);
    else if (e.key === "ArrowDown")
      arrastre.current.gx = Math.min(20, arrastre.current.gx + 5);
    else return;

    e.preventDefault();
    pausar(true);
    aplicar();
  }

  return (
    <div
      className="escena-3d relative grid h-[380px] w-full cursor-grab place-items-center touch-none select-none active:cursor-grabbing lg:h-[440px]"
      onPointerDown={alPulsar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onKeyDown={alTeclear}
      onFocus={() => pausar(true)}
      onBlur={() => !reducido && pausar(false)}
      tabIndex={0}
      role="img"
      aria-label="Frasco de perfume en tres dimensiones. Arrástralo o usa las flechas del teclado para girarlo."
    >
      {/* Charco de luz bajo el frasco */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-24 w-72 translate-y-[120px] rounded-[50%]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(201,162,39,.32), transparent 70%)",
        }}
      />

      <div
        ref={auto}
        className="giro-auto"
        data-quieto={reducido ? "true" : "false"}
      >
        <div ref={manual} className="giro-manual relative size-0">
          <Caja
            ancho={C.ancho}
            alto={C.alto}
            fondo={C.fondo}
            frente={VIDRIO_FRENTE}
            lado={VIDRIO_LADO}
            arriba={VIDRIO_LADO}
          >
            {/* Placa grabada sobre la cara frontal */}
            <div
              aria-hidden
              className="cara-3d grid place-items-center rounded-sm border border-[#C9A227]/70"
              style={{
                width: C.ancho * 0.58,
                height: C.alto * 0.24,
                left: C.ancho * 0.21,
                top: C.alto * 0.45,
                transform: `translateZ(${C.fondo / 2 + 1}px)`,
                background: "rgba(10,10,11,.35)",
              }}
            >
              <span className="font-display text-[11px] tracking-[0.28em] text-[#E8C766]">
                AURA
              </span>
            </div>
          </Caja>

          <Caja
            ancho={N.ancho}
            alto={N.alto}
            fondo={N.fondo}
            frente={ORO_LADO}
            lado={ORO_LADO}
            arriba={ORO}
            y={-(C.alto / 2 + N.alto / 2)}
          />

          <Caja
            ancho={T.ancho}
            alto={T.alto}
            fondo={T.fondo}
            frente={ORO}
            lado={ORO_LADO}
            arriba={ORO}
            y={-(C.alto / 2 + N.alto + T.alto / 2)}
          />
        </div>
      </div>

      <p className="text-fg-subtle pointer-events-none absolute bottom-2 text-[11px]">
        Arrástralo para girarlo
      </p>
    </div>
  );
}
