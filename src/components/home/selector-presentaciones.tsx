import Link from "next/link";
import { Contenedor } from "@/components/comunes/layout";
import { PRODUCTOS } from "@/data/productos";

/**
 * Buscar por presentación.
 *
 * Es el equivalente al selector de tallas de una tienda de calzado: el atajo
 * por el atributo que de verdad condiciona la compra. En perfumería no es la
 * talla sino los mililitros, porque separan al que se da un gusto (30–50 ml)
 * del que compra para revender (100–200 ml).
 */
const GRUPOS = [
  {
    titulo: "Para uso personal",
    nota: "Cabe en la bolsa y cuesta menos",
    mls: [30, 50],
  },
  {
    titulo: "Para revender o durar",
    nota: "Mejor precio por mililitro",
    mls: [100, 200],
  },
];

export function SelectorPresentaciones() {
  const conteo = (ml: number) =>
    PRODUCTOS.filter((p) => p.presentaciones.some((v) => v.ml === ml)).length;

  return (
    <Contenedor>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {GRUPOS.map((g, gi) => (
          <div
            key={g.titulo}
            style={{ animationDelay: `${gi * 120}ms` }}
            className="border-border-soft bg-surface animate-subir rounded-lg border p-5 lg:p-7"
          >
            <p className="font-display text-xl leading-tight">{g.titulo}</p>
            <p className="text-fg-subtle mt-1 text-[13px]">{g.nota}</p>

            <ul className="mt-5 grid grid-cols-2 gap-3">
              {g.mls.map((ml) => (
                <li key={ml}>
                  <Link
                    href={`/catalogo?ml=${ml}`}
                    className="group border-border-strong hover:border-gold hover:bg-gold-muted flex flex-col items-center justify-center rounded-md border py-5 transition-colors"
                  >
                    <span
                      data-precio
                      className="font-display group-hover:text-gold-light text-2xl transition-colors"
                    >
                      {ml}
                      <span className="text-fg-subtle ml-0.5 text-sm">ml</span>
                    </span>
                    <span className="text-fg-subtle mt-0.5 text-[11px]">
                      {conteo(ml)} modelos
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Contenedor>
  );
}
