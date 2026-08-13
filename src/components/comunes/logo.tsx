import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Wordmark de AURA: serif con el punto dorado (§7.2). Es texto real, no una
 * imagen — escala perfecto, pesa cero y lo lee un lector de pantalla.
 */
export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string | null;
}) {
  const marca = (
    <span
      className={cn(
        "font-display inline-flex items-baseline text-2xl leading-none font-normal tracking-[0.22em] sm:text-[26px]",
        className,
      )}
    >
      AURA
      <span aria-hidden className="text-gold ml-[3px] text-[1.4em] leading-none">
        .
      </span>
    </span>
  );

  if (!href) return marca;

  return (
    <Link href={href} aria-label="AURA Perfumes — ir al inicio" className="shrink-0">
      {marca}
    </Link>
  );
}
