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
  const marca = (
    <span
      className={cn(
        "font-display inline-flex items-baseline text-lg font-medium tracking-[0.1em] sm:text-xl md:text-2xl leading-none",
        className,
      )}
    >
      EL REY DE LOS PERFUMES
      <span aria-hidden className="text-gold ml-[2px] text-[1.2em] leading-none">
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
