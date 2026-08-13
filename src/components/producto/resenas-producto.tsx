"use client";

import { useMemo, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Estrellas } from "@/components/comunes/estrellas";
import { formatoFechaLarga, numero } from "@/lib/format";
import type { Reseña } from "@/types";
import { cn } from "@/lib/utils";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("");
}

/** Reseñas de la ficha (§10.11): resumen, filtro por estrellas y alta simulada. */
export function ResenasProducto({
  resenas,
  rating,
  total,
  nombreProducto,
}: {
  resenas: Reseña[];
  rating: number;
  total: number;
  nombreProducto: string;
}) {
  const [filtro, setFiltro] = useState<number | null>(null);
  const [abierto, setAbierto] = useState(false);

  const distribucion = useMemo(() => {
    // Las reseñas escritas son una muestra; la distribución se escala al total
    // declarado para que los porcentajes cuadren con el "(124)" de la tarjeta.
    const base: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of resenas) base[r.rating] = (base[r.rating] ?? 0) + 1;
    return base;
  }, [resenas]);

  const muestra = resenas.length || 1;
  const visibles = filtro
    ? resenas.filter((r) => r.rating === filtro)
    : resenas;

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
      <div>
        <div className="flex items-baseline gap-2">
          <span data-precio className="font-display text-5xl leading-none">
            {rating.toFixed(1)}
          </span>
          <span className="text-fg-subtle text-sm">de 5</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Estrellas valor={rating} tamano={16} />
          <span className="text-fg-muted text-sm">
            {numero(total)} reseñas
          </span>
        </div>

        <ul className="mt-5 space-y-1.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const cuenta = distribucion[n] ?? 0;
            const pct = (cuenta / muestra) * 100;
            const activo = filtro === n;
            return (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => setFiltro(activo ? null : n)}
                  aria-pressed={activo}
                  disabled={cuenta === 0}
                  className={cn(
                    "flex w-full items-center gap-2.5 py-1 text-xs transition-opacity disabled:opacity-40",
                    activo && "text-gold-light",
                  )}
                >
                  <span className="w-8 shrink-0 text-left" data-precio>
                    {n} ★
                  </span>
                  <span className="bg-surface-2 h-1.5 flex-1 overflow-hidden rounded-full">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        activo ? "bg-gold-gradient" : "bg-border-strong",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span data-precio className="text-fg-subtle w-6 shrink-0 text-right">
                    {cuenta}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {filtro ? (
          <button
            type="button"
            onClick={() => setFiltro(null)}
            className="text-fg-subtle hover:text-fg mt-3 text-xs underline underline-offset-4"
          >
            Ver todas las reseñas
          </button>
        ) : null}

        <Button
          variant="goldOutline"
          size="touch"
          className="mt-5 w-full"
          onClick={() => setAbierto(true)}
        >
          Escribir reseña
        </Button>
      </div>

      <div>
        {visibles.length === 0 ? (
          <p className="text-fg-muted border-border-soft rounded-md border border-dashed px-5 py-10 text-center text-sm">
            Todavía no hay reseñas de {filtro} estrellas para este perfume.
          </p>
        ) : (
          <ul className="divide-border-soft divide-y">
            {visibles.map((r) => (
              <li key={r.id} className="py-5 first:pt-0">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="bg-surface-2 text-gold-light border-border-strong grid size-9 shrink-0 place-items-center rounded-full border text-[11px] font-medium"
                  >
                    {iniciales(r.autor)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.autor}</p>
                    {r.verificada ? (
                      <p className="text-success inline-flex items-center gap-1 text-[11px]">
                        <BadgeCheck size={12} aria-hidden />
                        Compra verificada
                      </p>
                    ) : null}
                  </div>
                  <span className="text-fg-subtle ml-auto shrink-0 text-[11px]">
                    {formatoFechaLarga(r.fecha)}
                  </span>
                </div>

                <div className="mt-3">
                  <Estrellas valor={r.rating} />
                  <p className="font-display mt-1.5 text-lg leading-snug">
                    {r.titulo}
                  </p>
                  <p className="text-fg-muted mt-1.5 text-sm leading-relaxed">
                    {r.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModalReseña
        abierto={abierto}
        onCambio={setAbierto}
        nombreProducto={nombreProducto}
      />
    </div>
  );
}

function ModalReseña({
  abierto,
  onCambio,
  nombreProducto,
}: {
  abierto: boolean;
  onCambio: (v: boolean) => void;
  nombreProducto: string;
}) {
  const [estrellas, setEstrellas] = useState(5);

  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent className="bg-surface border-border-strong">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal">
            Escribe tu reseña
          </DialogTitle>
          <DialogDescription>
            Cuéntanos cómo te fue con {nombreProducto}. Se publica tras
            verificar la compra.
          </DialogDescription>
        </DialogHeader>

        <form
          id="form-resena"
          onSubmit={(e) => {
            e.preventDefault();
            onCambio(false);
            toast.success("¡Gracias por tu reseña!", {
              description: "La publicamos en cuanto verifiquemos tu compra.",
            });
          }}
          className="space-y-4"
        >
          <fieldset>
            <legend className="mb-2 text-sm">Tu calificación</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setEstrellas(n)}
                  aria-label={`${n} de 5 estrellas`}
                  aria-pressed={estrellas === n}
                  className="p-1"
                >
                  <Estrellas valor={estrellas >= n ? 1 : 0} tamano={24} />
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="resena-titulo" className="mb-1.5">
              Título
            </Label>
            <Input
              id="resena-titulo"
              required
              maxLength={60}
              placeholder="Resume tu experiencia"
            />
          </div>

          <div>
            <Label htmlFor="resena-texto" className="mb-1.5">
              Tu reseña
            </Label>
            <textarea
              id="resena-texto"
              required
              rows={4}
              maxLength={600}
              placeholder="¿Cuánto te duró? ¿Para qué ocasión lo usas?"
              className="border-border-strong focus-visible:border-gold placeholder:text-fg-subtle w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
        </form>

        <DialogFooter>
          <Button type="submit" form="form-resena" variant="gold" size="touch">
            Publicar reseña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
