import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Wordmark de EL REY DE LOS PERFUMES: serif con el punto dorado (§7.2).
 */
export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string | null;
}) {
  // Wordmark corto y muy pesado: es texto real, así que escala perfecto, pesa
  // cero y lo lee un lector de pantalla. El nombre largo queda para el título
  // de la página y el pie.
  const marca = (
    <span
      className={cn(
        "font-sans inline-flex items-baseline text-2xl leading-none font-extrabold tracking-[-0.03em] sm:text-[28px]",
        className,
      )}
    >
      ElRey
      <span aria-hidden className="text-gold ml-[2px] text-[1.1em] leading-none">
        .
      </span>
    </span>
  );

  if (!href) return marca;

  return (
    <Link href={href} aria-label="EL REY DE LOS PERFUMES — ir al inicio" className="shrink-0">
      {marca}
    </Link>
  );
}
