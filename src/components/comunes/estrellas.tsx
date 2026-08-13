import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { numero } from "@/lib/format";

/** Estrellas con relleno parcial. Decorativas: el valor va en el texto. */
export function Estrellas({
  valor,
  tamano = 14,
  className,
}: {
  valor: number;
  tamano?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex items-center gap-[2px]", className)}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const relleno = Math.max(0, Math.min(1, valor - i));
        return (
          <span
            key={i}
            className="relative inline-block"
            style={{ width: tamano, height: tamano }}
          >
            <Star
              size={tamano}
              className="text-border-strong absolute inset-0"
              strokeWidth={1.5}
            />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${relleno * 100}%` }}
            >
              <Star
                size={tamano}
                className="text-gold fill-gold"
                strokeWidth={1.5}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Rating compacto para la tarjeta: `4.8 ★ (124)`. */
export function RatingCompacto({
  valor,
  total,
  className,
}: {
  valor: number;
  total: number;
  className?: string;
}) {
  return (
    <span
      className={cn("text-fg-muted inline-flex items-center gap-1 text-xs", className)}
    >
      <Star size={12} className="text-gold fill-gold" aria-hidden />
      <span data-precio className="text-fg font-medium">
        {valor.toFixed(1)}
      </span>
      <span className="text-fg-subtle">({numero(total)})</span>
      <span className="sr-only">
        de 5 estrellas, {numero(total)} reseñas
      </span>
    </span>
  );
}
