"use client";

import { useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, Play, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Imagen } from "@/components/comunes/imagen";
import { Estrellas } from "@/components/comunes/estrellas";
import type { VideoCliente } from "@/data/videos";
import { cn } from "@/lib/utils";

/**
 * Videos de clientes, en carrusel tipo coverflow.
 *
 * El del centro va a tamaño completo y los laterales se encogen y se apagan
 * según su distancia al foco, que es lo que crea la sensación de profundidad y
 * dirige la mirada a uno solo. Todo el desplazamiento es una única
 * `transform` sobre la fila: no hay scroll ni cálculo por fotograma.
 *
 * Los pósters son arte de producto y el reproductor está simulado: el proyecto
 * no incluye archivos de video, así que al pulsar se explica en vez de dejar un
 * botón que no hace nada.
 */
export function VideosClientes({ videos }: { videos: VideoCliente[] }) {
  const [activo, setActivo] = useState(Math.floor(videos.length / 2));
  const [abierto, setAbierto] = useState<VideoCliente | null>(null);

  const ir = (n: number) =>
    setActivo(Math.max(0, Math.min(videos.length - 1, n)));

  return (
    <>
      <div className="relative overflow-hidden py-4">
        <div
          className="flex items-center justify-center transition-transform duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          // Cada tarjeta ocupa 15rem de paso; centrar es desplazar la fila.
          style={{
            transform: `translateX(calc(${(videos.length - 1) / 2 - activo} * 15rem))`,
          }}
        >
          {videos.map((v, i) => {
            const distancia = Math.abs(i - activo);
            const esActivo = distancia === 0;

            return (
              <div
                key={v.id}
                className="w-60 shrink-0 px-2 transition-[transform,opacity] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transform: `scale(${esActivo ? 1 : distancia === 1 ? 0.82 : 0.68})`,
                  opacity: esActivo ? 1 : distancia === 1 ? 0.65 : 0.35,
                  zIndex: videos.length - distancia,
                }}
              >
                <button
                  type="button"
                  onClick={() => (esActivo ? setAbierto(v) : ir(i))}
                  aria-label={
                    esActivo
                      ? `Reproducir el video de ${v.autor}`
                      : `Ver el video de ${v.autor}`
                  }
                  className={cn(
                    "group/vid border-border-soft bg-surface block w-full overflow-hidden rounded-xl border text-left transition-shadow",
                    esActivo && "shadow-[0_18px_40px_rgb(0_0_0/0.28)]",
                  )}
                >
                  <span className="bg-bg relative block aspect-9/16 overflow-hidden">
                    <Imagen
                      src={v.poster}
                      alt=""
                      sizes="240px"
                      className="transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/vid:scale-105"
                    />

                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                    {esActivo ? (
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="relative grid size-14 place-items-center rounded-full bg-white/95 transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/vid:scale-110">
                          <span className="absolute inset-0 rounded-full ring-2 ring-white/60 transition-all duration-500 group-hover/vid:scale-[1.35] group-hover/vid:opacity-0" />
                          <Play
                            size={20}
                            className="ml-0.5 fill-black text-black"
                            aria-hidden
                          />
                        </span>
                      </span>
                    ) : null}

                    <span className="absolute inset-x-0 bottom-0 p-3">
                      <Estrellas valor={v.rating} tamano={12} />
                      <span className="mt-1 block truncate text-[13px] font-semibold text-white">
                        {v.autor}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-white/70">
                        <BadgeCheck size={11} aria-hidden />
                        {v.ciudad}
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <Flecha lado="izq" onClick={() => ir(activo - 1)} deshabilitado={activo === 0} />
        <Flecha
          lado="der"
          onClick={() => ir(activo + 1)}
          deshabilitado={activo === videos.length - 1}
        />

        <div className="mt-5 flex justify-center gap-1.5">
          {videos.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => ir(i)}
              aria-label={`Ver el video ${i + 1} de ${videos.length}`}
              aria-current={i === activo}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === activo ? "bg-gold w-6" : "bg-border-strong w-1.5",
              )}
            />
          ))}
        </div>
      </div>

      <Dialog open={Boolean(abierto)} onOpenChange={() => setAbierto(null)}>
        <DialogContent className="bg-surface border-border-strong">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-normal">
              <Video size={18} className="text-gold" aria-hidden />
              Video de {abierto?.autor}
            </DialogTitle>
            <DialogDescription>{abierto?.titulo}</DialogDescription>
          </DialogHeader>

          <div className="border-border-soft bg-bg grid aspect-video place-items-center rounded-md border">
            <p className="text-fg-subtle max-w-xs px-6 text-center text-sm leading-relaxed">
              Aquí se reproduciría el video del cliente. Esta demostración no
              incluye archivos de video: al conectar la tienda real basta con
              sustituir este bloque por el reproductor.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Flecha({
  lado,
  onClick,
  deshabilitado,
}: {
  lado: "izq" | "der";
  onClick: () => void;
  deshabilitado: boolean;
}) {
  const Icono = lado === "izq" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={lado === "izq" ? "Video anterior" : "Video siguiente"}
      className={cn(
        "border-border-strong bg-surface/90 text-fg absolute top-1/2 z-30 grid size-11 -translate-y-1/2 place-items-center rounded-full border backdrop-blur-md transition-all hover:scale-105 disabled:pointer-events-none disabled:opacity-0",
        lado === "izq" ? "left-3 lg:left-8" : "right-3 lg:right-8",
      )}
    >
      <Icono size={20} aria-hidden />
    </button>
  );
}
