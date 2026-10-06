import Image from "next/image";
import { blurDe } from "@/data/blur";
import { blurDeCatalogo } from "@/data/catalogo";
import { cn } from "@/lib/utils";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * `next/image` con el placeholder blur generado en tiempo de build. Evita el
 * salto de layout y el cuadro gris mientras carga (§15: CLS ≈ 0).
 *
 * Sobre el import de `@/data/catalogo`: no añade peso al JavaScript del
 * cliente. El catálogo ya viaja en el chunk del layout por otro camino —el
 * carrito (`store/tienda` → `lib/carrito` → `data/productos`) lo necesita para
 * cotizar en el navegador y el botón del carrito está en la cabecera de todas
 * las páginas—, así que quitarlo de aquí solo dejaría sin blur las fotos del
 * catálogo sin ahorrar un byte. Adelgazarlo de verdad pide sacar los `blur`
 * del JSON que llega al cliente, que es un cambio del script del catálogo.
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
  /** Imagen principal de la vista (LCP): se precarga desde el <head>. */
  priority?: boolean;
  quality?: number;
}) {
  // El arte generado trae su blur en `blur.ts`; las fotos del catálogo, dentro
  // del propio catálogo.
  const blur = blurDe(src) ?? blurDeCatalogo(src);
  const fullSrc =
    src.startsWith("/") && basePath && !src.startsWith(basePath)
      ? `${basePath}${src}`
      : src;

  return (
    <Image
      src={fullSrc}
      alt={alt}
      fill
      sizes={sizes}
      // Desde Next 16 `priority` está obsoleto y su sustituto es `preload`.
      // La prop de este componente conserva su nombre para no tocar a quien
      // ya la usa.
      preload={priority}
      quality={quality}
      placeholder={blur ? "blur" : "empty"}
      blurDataURL={blur}
      className={cn("object-cover", className)}
    />
  );
}
