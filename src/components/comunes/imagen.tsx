import Image from "next/image";
import { blurDe } from "@/data/blur";
import { cn } from "@/lib/utils";

/**
 * `next/image` con el placeholder blur generado en tiempo de build. Evita el
 * salto de layout y el cuadro gris mientras carga (§15: CLS ≈ 0).
 */
export function Imagen({
  src,
  alt,
  sizes,
  className,
  priority = false,
  quality,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  quality?: number;
}) {
  const blur = blurDe(src);

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      quality={quality}
      placeholder={blur ? "blur" : "empty"}
      blurDataURL={blur}
      className={cn("object-cover", className)}
    />
  );
}
