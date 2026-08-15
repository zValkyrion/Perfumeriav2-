import { cn } from "@/lib/utils";

/**
 * Sticker: distintivo con aspecto de pegatina pegada sobre el producto.
 *
 * Borde blanco grueso, giro ligero y sombra propia. Es un recurso deliberado
 * de tienda de volumen —la etiqueta que se pega a mano en el mostrador—, justo
 * lo contrario del distintivo discreto de una marca de lujo.
 */
export type TonoSticker = "oferta" | "oro" | "verde" | "negro";

const TONOS: Record<TonoSticker, string> = {
  oferta: "bg-[#e02b20] text-white",
  oro: "bg-gold-gradient text-bg",
  verde: "bg-[#12855a] text-white",
  negro: "bg-[#14171a] text-white",
};

export function Sticker({
  children,
  tono = "oferta",
  giro = -8,
  redondo = false,
  className,
}: {
  children: React.ReactNode;
  tono?: TonoSticker;
  /** Grados de inclinación; alterna el signo entre stickers vecinos. */
  giro?: number;
  /** Círculo para cifras cortas (3x2, −40%), píldora para texto. */
  redondo?: boolean;
  className?: string;
}) {
  return (
    <span
      style={{ rotate: `${giro}deg` }}
      className={cn(
        "inline-grid place-items-center border-[3px] border-white text-center leading-none font-extrabold tracking-tight shadow-[0_3px_10px_rgb(0_0_0/0.28)] select-none",
        redondo
          ? "size-14 rounded-full text-[15px]"
          : "rounded-full px-3 py-1.5 text-[11px] uppercase",
        TONOS[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}
