import { BadgeCheck } from "lucide-react";
import { Estrellas } from "@/components/comunes/estrellas";
import { Contenedor, TituloSeccion } from "@/components/comunes/layout";
import { RESEÑAS_VERTICALES } from "@/data/resenas";
import { getProductoPorId } from "@/data/productos";
import { formatoFechaCorta } from "@/lib/format";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("");
}

/**
 * Reseñas en columna, al final de la home.
 *
 * La rejilla de tres de más arriba se lee de un vistazo, casi como un logotipo
 * de confianza. Esta va en vertical y a un ancho de lectura: quien llegó hasta
 * aquí ya está decidiendo, y lo que necesita es leer testimonios completos, uno
 * detrás de otro, no otro mosaico.
 */
export function ResenasVertical() {
  return (
    <Contenedor>
      <TituloSeccion centrado titulo="LO QUE CUENTAN QUIENES REVENDEN" />

      <ul className="mx-auto flex max-w-2xl flex-col gap-4">
        {RESEÑAS_VERTICALES.map((r) => {
          const producto = getProductoPorId(r.productoId);
          return (
            <li
              key={r.id}
              className="border-border-soft bg-surface rounded-md border p-5 lg:p-6"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="bg-surface-2 text-gold-light border-border-strong grid size-10 shrink-0 place-items-center rounded-full border text-xs font-semibold"
                >
                  {iniciales(r.autor)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.autor}</p>
                  <p className="text-success inline-flex items-center gap-1 text-[11px]">
                    <BadgeCheck size={12} aria-hidden />
                    Compra verificada
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Estrellas valor={r.rating} />
                  <span className="text-fg-subtle text-[11px]">
                    {formatoFechaCorta(r.fecha)}
                  </span>
                </div>
              </div>

              <p className="font-display mt-4 text-lg leading-snug font-bold">
                {r.titulo}
              </p>
              <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                {r.texto}
              </p>

              {producto ? (
                <p className="text-fg-subtle mt-3 text-[11px]">
                  Sobre <span className="text-fg-muted">{producto.nombre}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Contenedor>
  );
}
