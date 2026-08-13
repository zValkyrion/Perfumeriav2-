import Link from "next/link";
import { Imagen } from "@/components/comunes/imagen";
import { CATEGORIAS } from "@/data/taxonomia";

const EN_HOME = [
  "hombre",
  "mujer",
  "unisex",
  "arabes",
  "nicho",
  "sets",
] as const;

/** Compra por categoría (§8.3). Carrusel de 2.2 tarjetas en móvil. */
export function Categorias({ conteos }: { conteos: Record<string, number> }) {
  const tarjetas = EN_HOME.map((slug) => {
    if (slug === "sets") {
      return {
        slug: "sets",
        nombre: "Sets y regalos",
        href: "/catalogo/sets",
        imagen: "/sets/set-descubrimiento.webp",
        conteo: conteos.sets ?? 0,
      };
    }
    const cat = CATEGORIAS.find((c) => c.slug === slug)!;
    return {
      slug: cat.slug,
      nombre: cat.nombre,
      href: `/catalogo/${cat.slug}`,
      imagen: `/categorias/${cat.slug}.webp`,
      conteo: conteos[cat.slug] ?? 0,
    };
  });

  return (
    <div className="snap-row -mx-4 flex gap-3 px-4 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible lg:px-0">
      {tarjetas.map((t, i) => (
        <Link
          key={t.slug}
          href={t.href}
          style={{ animationDelay: `${i * 70}ms` }}
          className="group border-border-soft animate-subir relative w-[45%] shrink-0 overflow-hidden rounded-md border sm:w-[30%] lg:w-full"
        >
          <div className="relative aspect-4/5 overflow-hidden">
            <Imagen
              src={t.imagen}
              alt=""
              sizes="(max-width: 1024px) 45vw, 16vw"
              className="transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
            {/* Velo dorado al hover, en vez de un simple oscurecido */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-0 transition-opacity duration-400 group-hover:opacity-100"
              style={{
                backgroundImage:
                  "linear-gradient(to top, rgba(201,162,39,0.28), transparent 60%)",
              }}
            />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="font-display text-[17px] leading-tight">{t.nombre}</p>
            <p className="text-fg-subtle text-[11px]">{t.conteo} productos</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
