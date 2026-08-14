"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Palette, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ⚠ BLOQUE TEMPORAL DE PRUEBA ⚠
 *
 * Selector de colorimetrías para comparar temas antes de decidir. Para
 * eliminarlo basta con borrar este archivo, su línea en `app/layout.tsx` y el
 * bloque "TEMAS DE PRUEBA" de `globals.css`. Nada más del sitio depende de él.
 */

export const CLAVE_TEMA = "aura-tema";

export interface Tema {
  id: string;
  nombre: string;
  nota: string;
  fondo: string;
  acento: string;
  texto: string;
}

export const TEMAS: Tema[] = [
  {
    id: "oro",
    nombre: "Oro sobre negro",
    nota: "El original. Máximo contraste y lujo clásico.",
    fondo: "#0A0A0B",
    acento: "#C9A227",
    texto: "#F5F5F4",
  },
  {
    id: "champan",
    nombre: "Champán",
    nota: "Más cremoso y cálido. Menos agresivo que el oro puro.",
    fondo: "#100C07",
    acento: "#D9BD7F",
    texto: "#F7F1E6",
  },
  {
    id: "platino",
    nombre: "Platino",
    nota: "Frío y mineral. Se aleja del cliché de perfumería.",
    fondo: "#0B0C0D",
    acento: "#B9C2CC",
    texto: "#F2F4F6",
  },
  {
    id: "cobre",
    nombre: "Cobre",
    nota: "Terroso y especiado. Encaja con el catálogo árabe.",
    fondo: "#0E0907",
    acento: "#C87A41",
    texto: "#F7EEE7",
  },
  {
    id: "esmeralda",
    nombre: "Esmeralda",
    nota: "Verde botella con oro. Muy perfumería clásica.",
    fondo: "#060B09",
    acento: "#C9A227",
    texto: "#EEF5F1",
  },
  {
    id: "borgona",
    nombre: "Borgoña",
    nota: "Vino con oro rosado. El más femenino.",
    fondo: "#0C0507",
    acento: "#D99A7C",
    texto: "#F8ECEC",
  },
  {
    id: "marfil",
    nombre: "Marfil (claro)",
    nota: "Experimento en claro. El sitio se diseñó en oscuro: revisa el hero.",
    fondo: "#F6F3EC",
    acento: "#B08D1E",
    texto: "#1B1710",
  },
];

/* ── El tema como store externo, para no duplicarlo en estado de React ── */

const escuchas = new Set<() => void>();

function suscribir(alCambiar: () => void) {
  escuchas.add(alCambiar);
  return () => {
    escuchas.delete(alCambiar);
  };
}

const leerCliente = () => document.documentElement.dataset.tema ?? "oro";
const leerServidor = () => "oro";

function aplicarTema(id: string) {
  const raiz = document.documentElement;
  if (id === "oro") delete raiz.dataset.tema;
  else raiz.dataset.tema = id;

  try {
    localStorage.setItem(CLAVE_TEMA, id);
  } catch {
    // Modo privado o almacenamiento lleno: el tema sigue aplicado en la sesión.
  }
  for (const avisar of escuchas) avisar();
}

export function SelectorTemas() {
  const [abierto, setAbierto] = useState(false);
  const actual = useSyncExternalStore(suscribir, leerCliente, leerServidor);

  return (
    <div className="fixed bottom-20 left-4 z-40 md:bottom-6">
      {abierto ? (
        <div className="border-border-strong bg-surface/95 animate-escala mb-3 w-[17.5rem] rounded-lg border p-3 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Probar colorimetría</p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar selector de temas"
              className="text-fg-subtle hover:text-fg grid size-7 place-items-center rounded-full"
            >
              <X size={14} aria-hidden />
            </button>
          </div>

          <ul className="max-h-[60dvh] space-y-1 overflow-y-auto">
            {TEMAS.map((t) => {
              const activo = t.id === actual;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => aplicarTema(t.id)}
                    aria-pressed={activo}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md border px-2.5 py-2 text-left transition-colors",
                      activo
                        ? "border-gold bg-gold-muted"
                        : "border-transparent hover:bg-surface-2",
                    )}
                  >
                    <span
                      aria-hidden
                      className="border-border-strong grid size-9 shrink-0 place-items-center rounded-full border"
                      style={{ background: t.fondo }}
                    >
                      <span
                        className="size-4 rounded-full"
                        style={{ background: t.acento }}
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium">
                        {t.nombre}
                        {activo ? (
                          <Check size={13} className="text-gold-light" aria-hidden />
                        ) : null}
                      </span>
                      <span className="text-fg-subtle block text-[11px] leading-snug">
                        {t.nota}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="text-fg-subtle border-border-soft mt-2 border-t pt-2 text-[10px] leading-snug">
            Bloque temporal de pruebas. Tu elección se guarda en este navegador.
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label="Probar otra colorimetría"
        className="border-border-strong bg-surface/90 text-fg-muted hover:text-gold-light grid size-12 place-items-center rounded-full border backdrop-blur-xl transition-colors active:scale-95"
      >
        <Palette size={20} aria-hidden />
      </button>
    </div>
  );
}
