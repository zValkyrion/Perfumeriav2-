"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleArrowRight } from "lucide-react";

/**
 * Tipos de mayoreo, en círculos.
 *
 * Es la navegación principal de un mayorista: el cliente no llega buscando una
 * familia olfativa, llega buscando un **modo de comprar** —pacas, surtido,
 * paquetes—. Por eso va arriba del todo y por delante de cualquier navegación
 * por producto.
 *
 * El diseño copia la referencia del dueño (2026-10-05): disco gris claro con
 * borde fino, pictograma negro sólido con **sombra larga** en diagonal hasta el
 * borde del círculo, título grande en mayúsculas y «Ver colección» con flecha
 * en círculo. Carrusel con flechas amarillas a la derecha y barra de
 * desplazamiento negra debajo.
 *
 * Los pictogramas son SVG propios (no una fuente de iconos): así se puede
 * proyectar la sombra con la silueta exacta. La sombra son copias de la
 * silueta desplazadas en diagonal, recortadas por el círculo.
 */

interface Tipo {
  clave: string;
  titulo: string;
  href: string;
  /** Lo que lee un lector de pantalla además del título. */
  descripcion: string;
  /** La silueta negra (sin rellenos propios: el color lo pone quien la usa). */
  silueta: React.ReactNode;
  /** Detalles en blanco encima de la silueta (cintas, flechas, el «%»). */
  detalles?: React.ReactNode;
}

const TIPOS: Tipo[] = [
  {
    clave: "pacas",
    titulo: "Pacas",
    href: "/lotes",
    descripcion: "Paquetes armados de 10 a 50 piezas",
    silueta: (
      <>
        {/* Cajas: dos abajo, dos arriba */}
        <rect x="14" y="50" width="34" height="27" rx="1.5" />
        <rect x="52" y="50" width="34" height="27" rx="1.5" />
        <rect x="20" y="22" width="30" height="27" rx="1.5" />
        <rect x="52" y="27" width="26" height="22" rx="1.5" />
        {/* Tarima */}
        <rect x="9" y="78" width="82" height="5" rx="1" />
        <rect x="9" y="88" width="82" height="4" rx="1" />
        <rect x="12" y="83" width="9" height="5" />
        <rect x="45.5" y="83" width="9" height="5" />
        <rect x="79" y="83" width="9" height="5" />
      </>
    ),
    detalles: (
      <g fill="#fff">
        {/* Cinta y flecha «este lado arriba» de cada caja */}
        {[
          [31, 50, 27],
          [69, 50, 27],
          [35, 22, 27],
          [65, 27, 22],
        ].map(([cx, y, alto]) => (
          <g key={`${cx}-${y}`}>
            <rect x={cx - 3} y={y} width="6" height={alto * 0.22} />
            <path d={`M${cx} ${y + alto * 0.42} l-3.2 3.6 h2.1 v4.6 h2.2 v-4.6 h2.1 z`} />
            <rect x={cx - 4.5} y={y + alto * 0.78} width="9" height="1.6" />
          </g>
        ))}
      </g>
    ),
  },
  {
    clave: "surtido",
    titulo: "Mayoreo surtido",
    href: "/catalogo",
    descripcion: "Arma tu pedido: desde 3 piezas hay precio de mayoreo",
    silueta: (
      // Etiqueta de precio inclinada, con su ojal y su hilo
      <g transform="rotate(24 50 54)">
        <path d="M35 34 L50 18 L65 34 L65 86 Q65 90 61 90 L39 90 Q35 90 35 86 Z" />
        <path d="M50 18 C56 8 66 8 68 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    ),
    detalles: (
      <g transform="rotate(24 50 54)" fill="#fff">
        <circle cx="50" cy="30" r="3.6" />
        <text x="50" y="72" textAnchor="middle" fontSize="27" fontWeight="900" fontFamily="Arial, Helvetica, sans-serif">
          %
        </text>
      </g>
    ),
  },
  {
    clave: "paquetes",
    titulo: "Paquetes",
    href: "/lotes",
    descripcion: "Paquetes emprendedores ya armados",
    silueta: (
      <>
        {/* Caja en perspectiva: tapa y dos caras */}
        <path d="M50 16 L84 30 L50 44 L16 30 Z" />
        <path d="M14 34 L47.5 48.5 L47.5 86 L14 71.5 Z" />
        <path d="M52.5 48.5 L86 34 L86 71.5 L52.5 86 Z" />
      </>
    ),
    detalles: (
      <g fill="#fff">
        {/* Cinta sobre la tapa y bajando por la cara izquierda */}
        <path d="M33 23 L41 19.6 L67 30.6 L59 34 Z" />
        <path d="M23 38 L31 41.4 L31 52 L27 50.2 L27 48.6 L23 46.8 Z" />
        {/* Etiqueta en la cara derecha */}
        <path d="M62 64 L77 57.5 L77 60.5 L62 67 Z" />
        <path d="M62 70 L72 65.7 L72 68.7 L62 73 Z" />
      </g>
    ),
  },
  {
    clave: "hombre",
    titulo: "Hombre",
    href: "/catalogo/hombre",
    descripcion: "Perfumes para hombre",
    silueta: (
      <>
        <circle cx="50" cy="17" r="9.5" />
        <rect x="35" y="30" width="30" height="35" rx="6" />
        <rect x="26" y="31" width="7.5" height="31" rx="3.75" />
        <rect x="66.5" y="31" width="7.5" height="31" rx="3.75" />
        <rect x="37" y="58" width="11.5" height="36" rx="4" />
        <rect x="51.5" y="58" width="11.5" height="36" rx="4" />
      </>
    ),
  },
  {
    clave: "mujer",
    titulo: "Mujer",
    href: "/catalogo/mujer",
    descripcion: "Perfumes para mujer",
    silueta: (
      <>
        <circle cx="50" cy="17" r="9.5" />
        <path d="M40 30 L60 30 Q64 30 65 34 L73 66 L27 66 L35 34 Q36 30 40 30 Z" />
        <rect x="24" y="32" width="7" height="27" rx="3.5" transform="rotate(14 27.5 32)" />
        <rect x="69" y="32" width="7" height="27" rx="3.5" transform="rotate(-14 72.5 32)" />
        <rect x="40" y="64" width="8.5" height="30" rx="3.5" />
        <rect x="51.5" y="64" width="8.5" height="30" rx="3.5" />
      </>
    ),
  },
  {
    clave: "disenador",
    titulo: "Diseñador",
    href: "/catalogo/disenador",
    descripcion: "Inspirados en casas europeas",
    silueta: (
      <>
        {/* Frasco de perfume con tapa y atomizador */}
        <rect x="41" y="10" width="18" height="13" rx="2.5" />
        <rect x="45" y="23" width="10" height="7" />
        <rect x="27" y="30" width="46" height="60" rx="9" />
      </>
    ),
    detalles: (
      <g fill="#fff">
        <rect x="36" y="50" width="28" height="20" rx="2" />
        <rect x="33" y="36" width="5" height="11" rx="2.5" opacity="0.85" />
      </g>
    ),
  },
  {
    clave: "arabes",
    titulo: "Árabes",
    href: "/catalogo/arabes",
    descripcion: "Oud, azafrán y especias",
    silueta: (
      <>
        {/* Media luna y estrella */}
        <path
          fillRule="evenodd"
          d="M47 16 A34 34 0 1 0 47 88 A34 34 0 1 0 47 16 Z M60 22 A27 27 0 1 1 60 76 A27 27 0 1 1 60 22 Z"
        />
        <path d="M76 36 L79.2 45 L88.6 45.3 L81.2 51.1 L83.8 60.2 L76 54.9 L68.2 60.2 L70.8 51.1 L63.4 45.3 L72.8 45 Z" />
      </>
    ),
  },
];

/** Cuántas copias forman la sombra larga, y cuánto avanza cada una. */
const PASOS_SOMBRA = 64;
const AVANCE_SOMBRA = 1.4;

function Pictograma({ tipo }: { tipo: Tipo }) {
  const recorte = `recorte-tipo-${tipo.clave}`;
  const silueta = `silueta-tipo-${tipo.clave}`;
  return (
    <svg viewBox="0 0 200 200" className="block h-full w-full" aria-hidden>
      <defs>
        <clipPath id={recorte}>
          <circle cx="100" cy="100" r="99" />
        </clipPath>
        <g id={silueta}>{tipo.silueta}</g>
      </defs>
      <circle cx="100" cy="100" r="99" fill="#f2f2f2" />
      <g clipPath={`url(#${recorte})`}>
        {/* El pictograma ocupa el centro: 100 unidades propias → 128 del disco
            (casi dos tercios del círculo, como en la referencia) */}
        <g transform="translate(36 34) scale(1.28)">
          {/* Sombra larga: la silueta repetida en diagonal, en gris */}
          <g fill="#dcdcdc" color="#dcdcdc">
            {Array.from({ length: PASOS_SOMBRA }, (_, i) => (
              <use
                key={i}
                href={`#${silueta}`}
                transform={`translate(${(i + 1) * AVANCE_SOMBRA} ${(i + 1) * AVANCE_SOMBRA})`}
              />
            ))}
          </g>
          {/* La silueta en negro y sus detalles en blanco */}
          <g fill="#000" color="#000">
            <use href={`#${silueta}`} />
          </g>
          {tipo.detalles}
        </g>
      </g>
      {/* Borde fino del disco */}
      <circle cx="100" cy="100" r="99" fill="none" stroke="#5c5c5c" strokeWidth="1" />
    </svg>
  );
}

export function TiposCompra() {
  const pista = useRef<HTMLDivElement>(null);
  const [barra, setBarra] = useState({ ancho: 1, inicio: 0, alInicio: true, alFinal: false });

  // La barra de abajo y las flechas siguen al desplazamiento real del carrusel.
  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    const total = el.scrollWidth;
    const visible = el.clientWidth;
    const max = Math.max(1, total - visible);
    const ancho = total > 0 ? Math.min(1, visible / total) : 1;
    setBarra({
      ancho,
      inicio: (el.scrollLeft / max) * (1 - ancho),
      alInicio: el.scrollLeft <= 2,
      alFinal: el.scrollLeft >= max - 2,
    });
  }, []);

  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    // El ajuste de «snap» puede dejarlo movido unos píxeles al cargar, y eso
    // corta el primer círculo: se arranca siempre desde el principio.
    el.scrollLeft = 0;
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    el.addEventListener("scroll", medir, { passive: true });
    return () => {
      obs.disconnect();
      el.removeEventListener("scroll", medir);
    };
  }, [medir]);

  const mover = (direccion: 1 | -1) => {
    const el = pista.current;
    if (!el) return;
    // Un «paso» es casi la pantalla visible, dejando asomar el siguiente círculo.
    el.scrollBy({ left: direccion * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const hayDesplazamiento = barra.ancho < 0.999;

  return (
    <div>
      <div className="flex items-center gap-4 lg:gap-6">
        <div
          ref={pista}
          className="-mx-4 flex min-w-0 flex-1 snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto scroll-smooth px-4 pt-2 pb-3 lg:scroll-px-0 [scrollbar-width:none] sm:gap-8 lg:mx-0 lg:gap-9 lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {TIPOS.map((t) => (
            <Link
              key={t.clave}
              href={t.href}
              aria-label={`${t.titulo}: ${t.descripcion}`}
              className="group/tipo flex w-[150px] shrink-0 snap-start flex-col items-center text-center sm:w-[180px] lg:w-[212px]"
            >
              <span className="block aspect-square w-full transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/tipo:scale-[1.03]">
                <Pictograma tipo={t} />
              </span>
              <span className="text-fg mt-5 block text-[17px] leading-tight font-extrabold tracking-tight uppercase sm:text-[19px] lg:mt-6 lg:text-[21px]">
                {t.titulo}
              </span>
              <span className="text-fg mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium lg:text-[14px]">
                Ver colección
                <CircleArrowRight
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden
                  className="transition-transform duration-200 group-hover/tipo:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>

        {/* Flechas amarillas, a la derecha y centradas con los círculos */}
        {hayDesplazamiento && (
          // Centro del círculo (mitad de su ancho + 8 px de aire arriba) menos la
          // mitad del par de flechas (92 px).
          <div className="hidden shrink-0 flex-col gap-3 self-start sm:mt-[52px] sm:flex lg:mt-[68px]">
            <button
              type="button"
              onClick={() => mover(1)}
              disabled={barra.alFinal}
              aria-label="Ver más tipos de mayoreo"
              className="grid h-10 w-10 place-items-center rounded-full bg-[#ffc20e] text-black transition-opacity hover:brightness-95 disabled:opacity-40"
            >
              <ChevronRight size={22} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => mover(-1)}
              disabled={barra.alInicio}
              aria-label="Ver los tipos anteriores"
              className="grid h-10 w-10 place-items-center rounded-full bg-[#ffc20e] text-black transition-opacity hover:brightness-95 disabled:opacity-40"
            >
              <ChevronLeft size={22} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>

      {/* Barra de desplazamiento: riel fino, guía negra y topes en las orillas */}
      {hayDesplazamiento && (
        <div className="mt-4 flex items-center gap-2 sm:pr-16" aria-hidden>
          <button type="button" tabIndex={-1} onClick={() => mover(-1)} className="text-fg grid h-4 w-3 place-items-center">
            <span className="h-0 w-0 border-y-[4px] border-r-[5px] border-y-transparent border-r-current" />
          </button>
          <div className="relative h-1.5 flex-1">
            <span
              className="absolute inset-y-0 rounded-full bg-black transition-[left] duration-150"
              style={{ width: `${barra.ancho * 100}%`, left: `${barra.inicio * 100}%` }}
            />
          </div>
          <button type="button" tabIndex={-1} onClick={() => mover(1)} className="text-fg grid h-4 w-3 place-items-center">
            <span className="h-0 w-0 border-y-[4px] border-l-[5px] border-y-transparent border-l-current" />
          </button>
        </div>
      )}
    </div>
  );
}
