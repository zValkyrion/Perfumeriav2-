import { BadgeCheck } from "lucide-react";
import { Estrellas } from "@/components/comunes/estrellas";
import { Contenedor } from "@/components/comunes/layout";
import { MARCA } from "@/data/contenido";
import { RESEÑAS_DESTACADAS } from "@/data/resenas";
import { getProductoPorId } from "@/data/productos";
import { formatoFechaCorta, numero } from "@/lib/format";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("");
}

/**
 * Prueba social (§8.10). Los avatares son iniciales sobre color de marca, no
 * retratos de banco de imágenes: inventar caras es justo la señal de plantilla
 * que el §1.3 prohíbe.
 */
export function PruebaSocial() {
  return (
    <Contenedor>
      <div className="mb-8 text-center lg:mb-12">
        <p className="eyebrow mb-3">Lo que dicen quienes ya compraron</p>
        <h2 className="font-display text-[26px] leading-tight tracking-tight lg:text-[40px]">
          +{numero(MARCA.clientes)} clientes y revendedores satisfechos
        </h2>
        <div className="mt-3 flex items-center justify-center gap-2.5">
          <Estrellas valor={MARCA.ratingGlobal} tamano={18} />
          <span data-precio className="text-gold-light font-medium">
            {MARCA.ratingGlobal}
          </span>
          <span className="text-fg-subtle text-sm">de 5 en promedio</span>
        </div>
      </div>

      <ul className="snap-row -mx-4 gap-4 px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
        {RESEÑAS_DESTACADAS.map((r) => {
          const producto = getProductoPorId(r.productoId);
          return (
            <li
              key={r.id}
              className="border-border-soft bg-surface flex w-[85%] shrink-0 flex-col rounded-md border p-5 sm:w-[60%] lg:w-auto"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="bg-surface-2 text-gold-light border-border-strong grid size-10 shrink-0 place-items-center rounded-full border text-xs font-medium"
                >
                  {iniciales(r.autor)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.autor}</p>
                  <p className="text-success inline-flex items-center gap-1 text-[11px]">
                    <BadgeCheck size={12} aria-hidden />
                    Compra verificada
                  </p>
                </div>
              </div>

              <div className="mt-3.5 flex items-center gap-2">
                <Estrellas valor={r.rating} />
                <span className="text-fg-subtle text-[11px]">
                  {formatoFechaCorta(r.fecha)}
                </span>
              </div>

              <p className="font-display mt-2.5 text-lg leading-snug">
                {r.titulo}
              </p>
              <p className="text-fg-muted mt-1.5 line-clamp-5 text-[13px] leading-relaxed">
                {r.texto}
              </p>

              {producto ? (
                <p className="text-fg-subtle mt-auto pt-3 text-[11px]">
                  Sobre{" "}
                  <span className="text-fg-muted">{producto.nombre}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Contenedor>
  );
}
