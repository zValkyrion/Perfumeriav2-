import { cn } from "@/lib/utils";

/**
 * Wordmark de EL REY DE LOS PERFUMES, el mismo de la landing (§7.2): serif no,
 * sans muy pesado y el punto en el color de marca. Es texto real — escala
 * perfecto, pesa cero y lo lee un lector de pantalla.
 *
 * El nombre largo se reserva para el título de la página; en una barra de 375px
 * no cabe sin partirse en tres líneas.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline text-xl leading-none font-extrabold tracking-[-0.03em]",
        className,
      )}
    >
      ElRey
      <span aria-hidden className="ml-[2px] text-[1.1em] leading-none text-gold">
        .
      </span>
      <span className="sr-only"> — EL REY DE LOS PERFUMES</span>
    </span>
  );
}
