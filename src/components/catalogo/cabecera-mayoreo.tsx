import { MessageCircle } from "lucide-react";
import { MARCA } from "@/data/contenido";
import { ESCALONES } from "@/lib/volumen";

/**
 * Cabecera del catálogo: la escalera de descuento, explicada antes de la
 * rejilla.
 *
 * Los porcentajes salen de `ESCALONES`, que es lo que aplica el carrito. Si un
 * día cambia la escalera, esta tabla cambia con ella: una tabla escrita a mano
 * que promete un 30% mientras el carrito descuenta otra cosa es la forma más
 * rápida de perder la venta en el checkout.
 */
export function CabeceraMayoreo() {
  // El primer escalón es menudeo (0%) y el último se cotiza: ninguno de los dos
  // va en la tabla de descuentos automáticos.
  const automaticos = ESCALONES.filter(
    (e) => e.descuento > 0 && e.max !== null,
  );

  const rango = (min: number, max: number | null) =>
    max === null ? `${min}+ perfumes` : `${min}-${max} perfumes`;

  return (
    <div className="mx-auto max-w-3xl text-center">
      <h1 className="titular-audaz">MAYOREO SURTIDO</h1>

      <p className="text-gold-light mt-3 text-[15px] font-extrabold tracking-[0.08em] uppercase lg:text-lg">
        Compra más, gana más
      </p>

      <p className="text-fg-muted mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed font-medium lg:text-base">
        En este modelo tú eliges tus perfumes favoritos y recibes descuentos
        automáticos directamente en tu carrito.
      </p>
      <p className="text-fg mt-2 text-[15px] leading-relaxed font-bold lg:text-base">
        Mientras más perfumes agregues, mayor será tu margen de ganancia 🚀
      </p>

      <ul className="border-border-soft bg-surface mx-auto mt-7 max-w-xl divide-y divide-[color:var(--color-border-soft)] overflow-hidden rounded-lg border text-left">
        {automaticos.map((e) => (
          <li
            key={e.min}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5"
          >
            <span className="text-[15px] font-bold">
              {rango(e.min, e.max)}
            </span>
            <span className="text-fg-muted text-[14px] font-semibold">
              <span className="text-gold-light">
                {Math.round(e.descuento * 100)}% de descuento
              </span>{" "}
              y envío gratis
            </span>
          </li>
        ))}
      </ul>

      <div className="border-gold/30 bg-gold-muted mx-auto mt-8 max-w-2xl rounded-lg border px-6 py-7">
        <p className="font-display text-xl leading-tight font-extrabold lg:text-2xl">
          ¿QUIERES DESCUENTOS MÁS ALTOS?
        </p>
        <p className="text-fg-muted mt-2.5 text-[15px] leading-relaxed font-medium">
          A partir de 20 perfumes accede a precios especiales para emprendedores
          de alto volumen.
        </p>

        <a
          href={MARCA.whatsappCotizacion}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25D366] px-6 text-sm font-bold text-[#04310f] transition-transform hover:scale-[1.02]"
        >
          <MessageCircle size={18} aria-hidden />
          Solicita cotización directa · {MARCA.whatsapp}
        </a>
      </div>
    </div>
  );
}
