import type { ItemPedido } from "./cotizacion";
import type { IdEnvio, IdPago } from "./reglas";

/**
 * El contrato de los pedidos: lo que manda la tienda, lo que contesta el
 * servidor y lo que ven el cliente y el panel. Vive aquí para que los tres
 * lados no puedan desalinearse en silencio.
 *
 * Lo que **no** viaja en la solicitud es tan importante como lo que sí: ni el
 * folio ni el total. El folio lo asigna el servidor con un contador —dos
 * navegadores no pueden ponerse de acuerdo para no repetir— y el total lo
 * recalcula con los precios del catálogo.
 *
 * Este archivo no importa valores de ningún otro (solo tipos): lo cargan la
 * tienda, la Lambda empaquetada y un script que Node corre sin empaquetador.
 */

/* ── Estatus ──────────────────────────────────────────────────────────── */

/**
 * Los estatus de un pedido, en el orden en que avanza. **Una sola lista**: la
 * pinta la tienda, la valida la API y la cuenta el panel de ventas. Antes vivía
 * copiada en tres sitios y un estatus nuevo en uno rompía los otros dos.
 */
export const ESTATUS_PEDIDO = [
  "Pendiente",
  "Pagado",
  "En preparación",
  "En camino",
  "Entregado",
  "Cancelado",
] as const;
export type EstatusPedido = (typeof ESTATUS_PEDIDO)[number];

export function esEstatusPedido(v: unknown): v is EstatusPedido {
  return typeof v === "string" && (ESTATUS_PEDIDO as readonly string[]).includes(v);
}

/**
 * El estatus de una fila tal como esté guardada. Lo que no sea uno de los seis
 * —filas viejas, basura— se lee como «Pendiente»: es lo más prudente, porque
 * no cuenta como venta ni promete un envío que nadie hizo.
 */
export function estatusDe(v: unknown): EstatusPedido {
  return esEstatusPedido(v) ? v : "Pendiente";
}

/** Los que cuentan como venta hecha (ingreso, nivel de cliente, top de productos). */
export const ESTATUS_VENDIDO: readonly EstatusPedido[] = [
  "Pagado",
  "En preparación",
  "En camino",
  "Entregado",
];

export function esVendido(estatus: EstatusPedido): boolean {
  return ESTATUS_VENDIDO.includes(estatus);
}

/** Línea de tiempo que ve el cliente. Una etapa por estatus, en orden; «Cancelado» no es etapa. */
export const ETAPAS_SEGUIMIENTO: readonly {
  estatus: EstatusPedido;
  titulo: string;
  texto: string;
}[] = [
  { estatus: "Pendiente", titulo: "Pedido recibido", texto: "Lo registramos y esperamos tu pago." },
  { estatus: "Pagado", titulo: "Pago confirmado", texto: "Recibimos tu pago." },
  { estatus: "En preparación", titulo: "En preparación", texto: "Estamos surtiendo y empacando tu pedido." },
  { estatus: "En camino", titulo: "En camino", texto: "Tu paquete ya va con la paquetería." },
  { estatus: "Entregado", titulo: "Entregado", texto: "Tu pedido llegó." },
];

/**
 * Un cambio de estatus, con quién y cuándo.
 *
 * `por` es `"cliente"` (lo creó o lo canceló el comprador), `"tienda"` o, en
 * lo que ve el panel, el nombre del administrador que lo cambió. Al cliente se
 * le enseña `"tienda"` en vez del nombre, y sin la nota: la nota es para el
 * equipo, lo que se le quiere decir al cliente va en `notaCliente`.
 */
export interface CambioEstatus {
  estatus: EstatusPedido;
  /** ISO en UTC. */
  en: string;
  por: string;
  nota?: string;
}

/* ── Paqueterías ──────────────────────────────────────────────────────── */

export const PAQUETERIAS: readonly {
  id: string;
  nombre: string;
  /** URL de rastreo con `{guia}` donde va la guía; `null` si no hay página pública. */
  rastreo: string | null;
}[] = [
  { id: "estafeta", nombre: "Estafeta", rastreo: "https://www.estafeta.com/rastrear-envio?guias={guia}" },
  { id: "dhl", nombre: "DHL", rastreo: "https://www.dhl.com/mx-es/home/rastreo.html?tracking-id={guia}" },
  { id: "fedex", nombre: "FedEx", rastreo: "https://www.fedex.com/fedextrack/?trknbr={guia}" },
  { id: "paquetexpress", nombre: "Paquetexpress", rastreo: "https://www.paquetexpress.com.mx/rastreo/{guia}" },
  { id: "99minutos", nombre: "99 Minutos", rastreo: "https://tracking.99minutos.com/search/{guia}" },
  { id: "redpack", nombre: "Redpack", rastreo: null },
  { id: "propia", nombre: "Entrega propia", rastreo: null },
  { id: "otra", nombre: "Otra", rastreo: null },
];

/**
 * La paquetería por su `id` o por su nombre, sin distinguir mayúsculas. Se
 * guarda el `id`, pero los pedidos de muestra y lo que escriba un humano traen
 * el nombre («Estafeta»): los dos deben llevar al mismo sitio.
 */
export function paqueteriaDe(v: string | null | undefined) {
  if (!v) return null;
  const limpio = v.trim().toLowerCase();
  return (
    PAQUETERIAS.find((p) => p.id === limpio || p.nombre.toLowerCase() === limpio) ?? null
  );
}

/** El nombre para pintar; si no es de la lista, lo que venga escrito. */
export function nombrePaqueteria(v: string | null | undefined): string | null {
  if (!v) return null;
  return paqueteriaDe(v)?.nombre ?? v;
}

/** La página de rastreo de esa guía, o `null` si la paquetería no tiene una pública. */
export function urlRastreo(
  paqueteria: string | null | undefined,
  guia: string | null | undefined,
): string | null {
  const plantilla = paqueteriaDe(paqueteria)?.rastreo;
  const limpia = (guia ?? "").trim();
  if (!plantilla || !limpia) return null;
  return plantilla.replace("{guia}", encodeURIComponent(limpia));
}

/* ── Solicitud (POST /pedidos) ────────────────────────────────────────── */

export interface ContactoPedido {
  correo: string;
  nombre: string;
  telefono: string;
  calle: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  referencias: string;
}

/** Meses sin intereses que acepta Clip. 0 = pago de contado. */
export const PLAZOS_MSI = [0, 3, 6, 9, 12] as const;

/** Formato de la clave de idempotencia (la genera el checkout con `crypto.randomUUID()`). */
export const PATRON_CLAVE = /^[A-Za-z0-9-]{8,64}$/;

export interface SolicitudPedido {
  items: ItemPedido[];
  cupon: string | null;
  metodo: IdPago;
  envio: IdEnvio;
  contacto: ContactoPedido;
  /**
   * Clave de idempotencia: una por intento de compra, y la misma si se
   * reintenta. Si el servidor ya registró un pedido con ella, contesta ese
   * mismo pedido en vez de crear otro (ni gasta otro folio).
   */
  clave?: string;
  /** Meses sin intereses con Clip (0, 3, 6, 9 o 12). Lo demás se guarda como `null`. */
  plazo?: number | null;
}

export interface PedidoRegistrado {
  folio: string;
  fecha: string;
  /** El total que se cobra: el del servidor, no el que calculó el navegador. */
  total: number;
  comision: number;
  descuentoTransferencia: number;
  /** La forma de pago que aplica (el contra entrega sobre el tope pasa a Clip). */
  metodo: IdPago;
}

/* ── Lo que se lee de un pedido ───────────────────────────────────────── */

/** Una línea congelada al crear el pedido: lo que se cobró, con el nombre de ese momento. */
export interface LineaPedido {
  productoId: string;
  /** 0 = lote o set. */
  ml: number;
  cantidad: number;
  unitario: number;
  subtotal: number;
  /** Nombre del perfume (con su marca), del lote o del set, tal como se llamaba al comprarlo. */
  nombre: string;
  /** «100 ml», «Lote · 20 piezas» o «Set de regalo». */
  detalle: string;
}

export interface CifrasPedido {
  piezas: number;
  subtotalMenudeo: number;
  subtotal: number;
  ahorroVolumen: number;
  descuento3x2: number;
  descuentoCupon: number;
  descuentoTransferencia: number;
  costoEnvio: number;
  envioGratis: boolean;
  comision: number;
  total: number;
  /** Nombre del escalón («Mayoreo»…); vacío en pedidos heredados. */
  escalon: string;
  cupon: string | null;
}

/** Lo que ve el dueño del pedido (y base de lo que ve el admin). */
export interface PedidoDetalle {
  folio: string;
  /** YYYY-MM-DD en calendario de México. */
  fecha: string;
  creadoEn: string;
  /** Sello de concurrencia: lo que el panel manda de vuelta al cambiar el pedido. */
  actualizadoEn: string;
  estatus: EstatusPedido;
  historial: CambioEstatus[];
  guia: string | null;
  /** `id` de `PAQUETERIAS` (o el texto que hubiera en pedidos viejos). */
  paqueteria: string | null;
  urlRastreo: string | null;
  /** Mensaje del negocio para el cliente. */
  notaCliente: string | null;
  /** `null` en pedidos heredados, que no guardaron la forma de pago. */
  metodo: IdPago | null;
  /** Meses sin intereses con Clip. */
  plazo: number | null;
  envio: IdEnvio | null;
  contacto: ContactoPedido;
  lineas: LineaPedido[];
  cifras: CifrasPedido;
  /** `true` solo si el estatus es «Pendiente». */
  cancelable: boolean;
  /**
   * `true` en los folios de la fórmula vieja (847–1346) que solo existen como
   * copia en «Mis pedidos»: sin dirección, sin desglose y con las líneas a $0
   * porque ese dato no se guardó. Se enseña lo que hay, sin inventar el resto.
   */
  heredado: boolean;
}

export interface PedidoAdmin extends PedidoDetalle {
  cliente: { sub: string | null; correoCuenta: string | null };
  notaInterna: string | null;
}

/** Fila de listas (admin y «Mis pedidos»). */
export interface ResumenPedido {
  folio: string;
  fecha: string;
  creadoEn: string;
  estatus: EstatusPedido;
  total: number;
  piezas: number;
  metodo: IdPago | null;
  envio: IdEnvio | null;
  escalon: string | null;
  nombre: string;
  telefono: string;
  correo: string;
  ciudad: string;
  estado: string;
  guia: string | null;
  paqueteria: string | null;
  conCuenta: boolean;
  /** Para «Volver a pedir». */
  items: ItemPedido[];
}

/** Rastreo sin cuenta (`POST /pedidos/consulta`): sin dirección completa. */
export interface PedidoPublico {
  folio: string;
  fecha: string;
  estatus: EstatusPedido;
  historial: CambioEstatus[];
  guia: string | null;
  paqueteria: string | null;
  urlRastreo: string | null;
  notaCliente: string | null;
  metodo: IdPago | null;
  plazo: number | null;
  envio: IdEnvio | null;
  lineas: LineaPedido[];
  cifras: CifrasPedido;
  /** Solo el primer nombre. */
  nombre: string;
  ciudad: string;
  estado: string;
}

/**
 * Lo que se cobra de un pedido: los artículos y las condiciones que mueven el
 * total. Al cambiarlo desde el panel, el servidor vuelve a cotizar con los
 * precios de ahora — el total nunca lo pone el navegador.
 */
export interface ArticulosPedido {
  items: ItemPedido[];
  metodo: IdPago;
  envio: IdEnvio;
  cupon: string | null;
}

/**
 * Cuerpo de `PUT /admin/pedidos/{folio}`. Lo que no venga no se toca.
 *
 * `contacto` se puede corregir mientras el pedido no esté entregado ni
 * cancelado. `articulos` solo mientras siga **Pendiente**: después ya se
 * cobró, y cambiar el total de algo pagado descuadra la venta.
 */
export interface CambioPedidoAdmin {
  estatus?: EstatusPedido;
  /** Va al historial con el cambio de estatus (o sola, con el estatus actual). */
  nota?: string;
  guia?: string | null;
  paqueteria?: string | null;
  notaInterna?: string | null;
  notaCliente?: string | null;
  contacto?: ContactoPedido;
  articulos?: ArticulosPedido;
  /** Lo último que vio el admin (`PedidoAdmin.actualizadoEn`); 409 si otro lo cambió. */
  actualizadoEn: string | null;
}

/** ¿Se pueden cambiar sus artículos? Solo antes de cobrarlo. */
export const articulosEditables = (estatus: EstatusPedido) => estatus === "Pendiente";

/** ¿Se pueden corregir nombre, teléfono y dirección? Mientras siga vivo. */
export const contactoEditable = (estatus: EstatusPedido) =>
  estatus !== "Entregado" && estatus !== "Cancelado";

/** Respuesta de `POST /admin/cotizar`: lo que costaría, sin guardar nada. */
export interface CotizacionAdmin {
  lineas: LineaPedido[];
  cifras: CifrasPedido;
  /** Artículos que no existen (o están agotados u ocultos): no se cobran. */
  descartados: number;
  /** La forma de pago que aplica (el contra entrega sobre el tope pasa a Clip). */
  metodo: IdPago | null;
}
