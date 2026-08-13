import type { SetRegalo } from "@/types";
import { randEntero } from "@/lib/rand";
import { getProducto, precioDesde } from "./productos";

interface SemillaSet {
  slug: string;
  nombre: string;
  descripcion: string;
  modelos: string[];
  extras: string[];
  descuento: number;
}

const SEMILLAS_SET: readonly SemillaSet[] = [
  {
    slug: "set-descubrimiento",
    nombre: "Set Descubrimiento · 5 miniaturas",
    descripcion:
      "Cinco de nuestras fragancias más pedidas en formato de 10 ml, dentro de un estuche negro con cierre imantado. Es la forma barata de averiguar cuál te queda antes de comprar el frasco grande.",
    modelos: [
      "noir-absolu",
      "rose-cendree",
      "vetiver-haiti",
      "sal-y-higuera",
      "praline",
    ],
    extras: [
      "5 miniaturas de 10 ml",
      "Estuche rígido con cierre imantado",
      "Ficha olfativa de cada fragancia",
      "Cupón de $ 300.00 para tu siguiente compra",
    ],
    descuento: 0.62,
  },
  {
    slug: "set-para-el",
    nombre: "Set Para Él · Vetiver Haití",
    descripcion:
      "El clásico de Vetiver House en 100 ml acompañado de su bruma corporal cítrica. Un regalo seguro para quien usa perfume a diario y no quiere complicaciones.",
    modelos: ["vetiver-haiti", "bruma-citrica"],
    extras: [
      "Vetiver Haití 100 ml",
      "Bruma Cítrica 200 ml",
      "Caja de regalo AURA con listón",
      "Tarjeta de dedicatoria escrita a mano",
    ],
    descuento: 0.18,
  },
  {
    slug: "set-para-ella",
    nombre: "Set Para Ella · Tuberosa Blanca",
    descripcion:
      "Tuberosa Blanca en 50 ml con la bruma de frambuesa a juego. El estuche más regalado en mayo y diciembre, y el que menos devoluciones tiene de todo el catálogo.",
    modelos: ["tuberosa-blanca", "bruma-de-frambuesa"],
    extras: [
      "Tuberosa Blanca 50 ml",
      "Bruma de Frambuesa 200 ml",
      "Caja de regalo AURA con listón",
      "Tarjeta de dedicatoria escrita a mano",
    ],
    descuento: 0.18,
  },
  {
    slug: "set-noche",
    nombre: "Set Noche · Dúo Oriental",
    descripcion:
      "Minuit Ambré y Vainilla Obscure, las dos piezas con las que Nuit Royale se hizo un nombre. Pensado para regalar a quien ya tiene perfumes y presume de nariz.",
    modelos: ["minuit-ambre", "vanille-obscure"],
    extras: [
      "Minuit Ambré 50 ml",
      "Vainilla Obscure 50 ml",
      "Estuche forrado en negro mate",
      "Ficha olfativa de ambas fragancias",
    ],
    descuento: 0.2,
  },
  {
    slug: "set-arabe",
    nombre: "Set Árabe · Iniciación al Oud",
    descripcion:
      "Oud & Rosa y Ámbar Gris en 50 ml, los dos más accesibles de la escuela del Golfo. Es la manera correcta de entrar al oud sin gastar de más en el primer intento.",
    modelos: ["oud-y-rosa", "ambar-gris"],
    extras: [
      "Oud & Rosa 50 ml",
      "Ámbar Gris 50 ml",
      "Estuche con interior de terciopelo",
      "Guía impresa de aplicación y dosificación",
    ],
    descuento: 0.2,
  },
  {
    slug: "set-verano",
    nombre: "Set Verano · Trío Solar",
    descripcion:
      "Sal y Higuera, Monoi y Costa Amalfi: los tres de Solaris que mejor aguantan el calor mexicano. Se agota todos los años entre abril y julio.",
    modelos: ["sal-y-higuera", "monoi", "costa-amalfi"],
    extras: [
      "Sal y Higuera 50 ml",
      "Monoi 100 ml",
      "Costa Amalfi 100 ml",
      "Neceser impermeable AURA",
    ],
    descuento: 0.24,
  },
] as const;

function construirSet(semilla: SemillaSet): SetRegalo {
  const valor = semilla.modelos.reduce((suma, slug) => {
    const producto = getProducto(slug);
    return suma + (producto ? precioDesde(producto) : 0);
  }, 0);

  const precio = Math.round((valor * (1 - semilla.descuento)) / 10) * 10 - 10;

  return {
    id: semilla.slug,
    slug: semilla.slug,
    nombre: semilla.nombre,
    precio,
    precioAnterior: Math.round(valor / 10) * 10,
    incluye: [...semilla.extras],
    imagen: `/sets/${semilla.slug}.webp`,
    descripcion: semilla.descripcion,
    stock: randEntero(`${semilla.slug}-stock`, 5, 40),
  };
}

export const SETS: readonly SetRegalo[] = SEMILLAS_SET.map(construirSet);

export const SETS_POR_SLUG = new Map(SETS.map((s) => [s.slug, s]));

export function getSet(slug: string): SetRegalo | undefined {
  return SETS_POR_SLUG.get(slug);
}

/** Modelos que incluye cada set, para pintarlos en el detalle. */
export const MODELOS_DE_SET = new Map(
  SEMILLAS_SET.map((s) => [s.slug, [...s.modelos]]),
);
