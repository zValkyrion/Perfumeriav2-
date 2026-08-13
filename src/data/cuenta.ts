import type { Direccion, ItemCarrito, Pedido, Usuario } from "@/types";
import { calcularPrecio } from "@/lib/volumen";
import { getProducto, getPresentacion } from "./productos";

/** Usuario dummy siempre "logueado" (§13). No hay autenticación real. */
export const USUARIO: Usuario = {
  nombre: "Andrea Villaseñor",
  correo: "andrea.villasenor@ejemplo.mx",
  telefono: "477 218 4490",
  piezasCompradas: 47,
  desde: "2024-09-16",
};

export const DIRECCIONES: readonly Direccion[] = [
  {
    id: "d1",
    alias: "Casa",
    nombre: "Andrea Villaseñor",
    calle: "Blvd. Adolfo López Mateos 1842, int. 4",
    colonia: "Jardines del Moral",
    cp: "37160",
    ciudad: "León",
    estado: "Guanajuato",
    telefono: "477 218 4490",
    predeterminada: true,
  },
  {
    id: "d2",
    alias: "Local",
    nombre: "Andrea Villaseñor",
    calle: "Av. Insurgentes 233, local 12",
    colonia: "Centro",
    cp: "37000",
    ciudad: "León",
    estado: "Guanajuato",
    telefono: "477 555 1187",
    predeterminada: false,
  },
];

/* ── Pedidos de ejemplo ───────────────────────────────────────────────── */

interface SemillaPedido {
  folio: string;
  fecha: string;
  estatus: Pedido["estatus"];
  items: { slug: string; ml: number; cantidad: number }[];
  guia?: string;
  paqueteria?: string;
}

const SEMILLAS_PEDIDO: readonly SemillaPedido[] = [
  {
    folio: "AUR-2026-00847",
    fecha: "2026-08-09",
    estatus: "En camino",
    items: [
      { slug: "praline", ml: 100, cantidad: 4 },
      { slug: "frutos-del-septimo", ml: 100, cantidad: 4 },
      { slug: "cafe-de-olla", ml: 100, cantidad: 4 },
    ],
    guia: "7742 9981 3306",
    paqueteria: "Estafeta",
  },
  {
    folio: "AUR-2026-00612",
    fecha: "2026-06-24",
    estatus: "Entregado",
    items: [
      { slug: "azahar-de-marzo", ml: 100, cantidad: 6 },
      { slug: "monoi", ml: 200, cantidad: 6 },
    ],
    guia: "5518 2094 7731",
    paqueteria: "DHL",
  },
  {
    folio: "AUR-2026-00388",
    fecha: "2026-04-11",
    estatus: "Entregado",
    items: [
      { slug: "vetiver-haiti", ml: 100, cantidad: 2 },
      { slug: "sal-y-higuera", ml: 50, cantidad: 1 },
    ],
    guia: "9903 4417 2258",
    paqueteria: "99 Minutos",
  },
  {
    folio: "AUR-2026-00201",
    fecha: "2026-02-19",
    estatus: "Entregado",
    items: [
      { slug: "minuit-ambre", ml: 50, cantidad: 1 },
      { slug: "vanille-obscure", ml: 50, cantidad: 1 },
      { slug: "copal", ml: 100, cantidad: 1 },
    ],
    guia: "3320 7765 1194",
    paqueteria: "FedEx",
  },
  {
    folio: "AUR-2025-01984",
    fecha: "2025-12-02",
    estatus: "Cancelado",
    items: [{ slug: "nardo", ml: 50, cantidad: 1 }],
  },
];

function construirPedido(semilla: SemillaPedido, indice: number): Pedido {
  const detalle = semilla.items.flatMap((i) => {
    const producto = getProducto(i.slug);
    return producto ? [{ producto, ml: i.ml, cantidad: i.cantidad }] : [];
  });

  const piezas = detalle.reduce((n, d) => n + d.cantidad, 0);

  // El total respeta la misma escalera de volumen que el carrito en vivo.
  const total = detalle.reduce((suma, d) => {
    const { precio } = getPresentacion(d.producto, d.ml);
    return suma + calcularPrecio(precio, piezas).unitario * d.cantidad;
  }, 0);

  const items: ItemCarrito[] = detalle.map((d) => ({
    productoId: d.producto.id,
    ml: d.ml,
    cantidad: d.cantidad,
  }));

  return {
    id: `o${String(indice + 1).padStart(3, "0")}`,
    folio: semilla.folio,
    fecha: semilla.fecha,
    estatus: semilla.estatus,
    total: Math.round(total * 100) / 100,
    piezas,
    items,
    guia: semilla.guia,
    paqueteria: semilla.paqueteria,
  };
}

export const PEDIDOS: readonly Pedido[] = SEMILLAS_PEDIDO.map(construirPedido);

export const PEDIDOS_POR_FOLIO = new Map(PEDIDOS.map((p) => [p.folio, p]));

export function getPedido(folio: string): Pedido | undefined {
  return PEDIDOS_POR_FOLIO.get(folio);
}

/* ── Nivel de cliente gamificado (§13) ────────────────────────────────── */

export interface Nivel {
  nombre: string;
  desde: number;
  beneficio: string;
}

export const NIVELES: readonly Nivel[] = [
  { nombre: "Bronce", desde: 0, beneficio: "Envío gratis desde 3 piezas" },
  { nombre: "Plata", desde: 12, beneficio: "5% extra en lotes de mayoreo" },
  { nombre: "Oro", desde: 36, beneficio: "Preventa de ediciones limitadas" },
  {
    nombre: "Distribuidor",
    desde: 72,
    beneficio: "Precio distribuidor permanente y asesor asignado",
  },
] as const;

export function nivelDe(piezas: number): {
  actual: Nivel;
  siguiente: Nivel | null;
  progreso: number;
  faltan: number;
} {
  let actual = NIVELES[0]!;
  for (const n of NIVELES) if (piezas >= n.desde) actual = n;

  const siguiente = NIVELES[NIVELES.indexOf(actual) + 1] ?? null;
  if (!siguiente) return { actual, siguiente: null, progreso: 1, faltan: 0 };

  const tramo = siguiente.desde - actual.desde;
  return {
    actual,
    siguiente,
    progreso: Math.min(1, (piezas - actual.desde) / tramo),
    faltan: siguiente.desde - piezas,
  };
}

/** Etapas de rastreo para el timeline del pedido (§13). */
export const ETAPAS_RASTREO = [
  "Pedido confirmado",
  "En preparación",
  "Enviado",
  "En reparto",
  "Entregado",
] as const;

export function etapaActual(estatus: Pedido["estatus"]): number {
  switch (estatus) {
    case "Pendiente":
      return 0;
    case "Pagado":
      return 1;
    case "En camino":
      return 3;
    case "Entregado":
      return 4;
    case "Cancelado":
      return -1;
  }
}
