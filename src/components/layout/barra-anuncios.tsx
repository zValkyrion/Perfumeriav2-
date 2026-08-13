"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { ANUNCIOS } from "@/data/contenido";

const CLAVE = "aura-anuncios-cerrado";

/**
 * sessionStorage tratado como store externo.
 *
 * `useSyncExternalStore` da un snapshot distinto para servidor (siempre
 * visible) y cliente (lo que diga sessionStorage), que es justo lo que hace
 * falta para no romper la hidratación — y sin un efecto que llame a setState.
 */
const escuchas = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}

function leerCliente() {
  return sessionStorage.getItem(CLAVE) === "1";
}

function leerServidor() {
  return false;
}

function cerrarAnuncios() {
  sessionStorage.setItem(CLAVE, "1");
  for (const avisar of escuchas) avisar();
}

/** Marquee de anuncios (§7.1). Se cierra con ✕ y recuerda el cierre. */
export function BarraAnuncios() {
  const cerrado = useSyncExternalStore(suscribir, leerCliente, leerServidor);

  if (cerrado) return null;

  const tira = [...ANUNCIOS, ...ANUNCIOS];

  return (
    <div className="border-border-soft bg-bg relative z-50 h-9 border-b">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent, #C9A227 35%, #E8C766 50%, #C9A227 65%, transparent)",
        }}
      />

      <div className="group relative flex h-full items-center overflow-hidden">
        {/* La tira se duplica: al desplazar -50% el bucle es continuo. */}
        <div className="animate-marquee flex shrink-0 items-center gap-8 pr-8 group-hover:[animation-play-state:paused]">
          {tira.map((texto, i) => (
            <span
              key={i}
              className="text-fg flex shrink-0 items-center gap-8 text-[11px] font-medium tracking-[0.14em] whitespace-nowrap uppercase sm:text-xs"
            >
              {texto}
              <span aria-hidden className="text-gold">
                ·
              </span>
            </span>
          ))}
        </div>
        <div
          aria-hidden
          className="animate-marquee flex shrink-0 items-center gap-8 pr-8 group-hover:[animation-play-state:paused]"
        >
          {tira.map((texto, i) => (
            <span
              key={i}
              className="text-fg flex shrink-0 items-center gap-8 text-[11px] font-medium tracking-[0.14em] whitespace-nowrap uppercase sm:text-xs"
            >
              {texto}
              <span className="text-gold">·</span>
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={cerrarAnuncios}
        aria-label="Cerrar avisos"
        className="from-bg via-bg text-fg-subtle hover:text-fg absolute inset-y-0 right-0 grid w-11 place-items-center bg-gradient-to-l to-transparent pl-3"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
