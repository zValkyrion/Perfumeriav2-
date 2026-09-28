import type { EstatusPedido } from "./pedido";
import type { IdEnvio, IdPago } from "./reglas";

/**
 * El contrato de la administración de la tienda: ventas, clientes y
 * solicitudes. Lo comparten la Lambda (`/admin/*`, `POST /solicitudes`), el
 * panel y los formularios de la tienda.
 *
 * Solo tipos y tablas de etiquetas, sin importar valores: lo cargan los dos
 * programas y un script que Node corre sin empaquetador.
 */

/* ── Etiquetas ────────────────────────────────────────────────────────── */

export const ETIQUETAS_METODO: Record<IdPago, string> = {
  clip: "Clip",
  transferencia: "Transferencia",
  contra: "Contra entrega",
};

export const ETIQUETAS_ENVIO: Record<IdEnvio, string> = {
  estandar: "Estándar",
  express: "Express",
  "mismo-dia": "Mismo día",
};

/** Los grupos de Cognito que el panel puede asignar. */
export const GRUPOS = ["admins", "proveedores", "clientes"] as const;
export type Grupo = (typeof GRUPOS)[number];

/* ── Ventas (GET /admin/ventas) ───────────────────────────────────────── */

export interface ResumenVentas {
  /** YYYY-MM-DD, calendario de México, los dos inclusive. */
  desde: string;
  hasta: string;
  /** Todos los pedidos del rango, de cualquier estatus. */
  pedidos: number;
  vendidos: number;
  pendientes: number;
  cancelados: number;
  /** Suma del total de los pedidos en `ESTATUS_VENDIDO`. */
  ingresos: number;
  /** Suma del total de los «Pendiente». */
  porCobrar: number;
  /** ingresos / vendidos (0 si no hay). */
  ticketPromedio: number;
  /** Piezas de los pedidos vendidos. */
  piezas: number;
  /** **Todos** los días del rango, también los que quedaron en cero. */
  porDia: { fecha: string; pedidos: number; vendidos: number; ingresos: number; piezas: number }[];
  /** Los seis estatus, siempre, en el orden de `ESTATUS_PEDIDO`. */
  porEstatus: { estatus: EstatusPedido; pedidos: number; total: number }[];
  /** Estos tres desgloses cuentan solo pedidos vendidos. */
  porMetodo: { clave: string; etiqueta: string; pedidos: number; ingresos: number }[];
  porEnvio: { clave: string; etiqueta: string; pedidos: number; ingresos: number }[];
  porEscalon: { clave: string; etiqueta: string; pedidos: number; ingresos: number }[];
  /** 15, por ingresos (subtotal de la línea, antes de descuentos del pedido). */
  topProductos: { productoId: string; ml: number; nombre: string; piezas: number; ingresos: number }[];
  /** 10, por ingresos. `clave` es la de `ClienteAdmin`. */
  topClientes: {
    clave: string;
    nombre: string;
    telefono: string;
    correo: string;
    pedidos: number;
    ingresos: number;
  }[];
  /** Lo concedido en pedidos vendidos del rango. */
  descuentos: { volumen: number; transferencia: number; cupon: number; tresPorDos: number };
  /**
   * Clientes con al menos un pedido vendido en el rango: recurrentes si en
   * todo el histórico tienen 2 o más pedidos vendidos, nuevos si no.
   */
  clientesNuevos: number;
  clientesRecurrentes: number;
  /** `true` si había más de 5000 pedidos y las cifras no los incluyen todos. */
  truncado: boolean;
}

/* ── Clientes (GET /admin/clientes) ───────────────────────────────────── */

export interface ClienteAdmin {
  /** `sub` de Cognito si tiene cuenta (o compró con ella); si no, `tel:<10 dígitos>`. */
  clave: string;
  sub: string | null;
  nombre: string;
  correo: string;
  telefono: string;
  grupos: string[];
  registradoEn: string | null;
  /** "CONFIRMED", "UNCONFIRMED"… `null` sin cuenta. */
  estadoCuenta: string | null;
  pedidos: number;
  pedidosVendidos: number;
  /** Piezas de pedidos vendidos: las que cuentan para el nivel. */
  piezas: number;
  ingresos: number;
  /** Fecha (YYYY-MM-DD) de su último pedido, de cualquier estatus. */
  ultimoPedido: string | null;
  ciudad: string | null;
  /** Nombre del nivel (`nivelDePiezas(piezas)`). */
  nivel: string;
}

/* ── Solicitudes (POST /solicitudes, /admin/solicitudes) ──────────────── */

export const TIPOS_SOLICITUD = ["distribuidor", "contacto", "factura"] as const;
export type TipoSolicitud = (typeof TIPOS_SOLICITUD)[number];

export interface SolicitudEntrada {
  tipo: TipoSolicitud;
  nombre: string;
  telefono: string;
  correo?: string;
  ciudad?: string;
  negocio?: string;
  mensaje?: string;
  volumen?: string;
  // factura:
  folio?: string;
  rfc?: string;
  razonSocial?: string;
  regimen?: string;
  cpFiscal?: string;
  usoCfdi?: string;
}

export const ESTADOS_SOLICITUD = ["nueva", "en proceso", "cerrada", "descartada"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export interface SolicitudAdmin extends SolicitudEntrada {
  id: string;
  creadaEn: string;
  actualizadaEn: string;
  estado: EstadoSolicitud;
  nota: string | null;
  /** `sub` de quien la mandó con sesión iniciada. */
  sub: string | null;
}

/** Cuerpo de `PUT /admin/solicitudes/{id}`. */
export interface CambioSolicitud {
  estado?: EstadoSolicitud;
  nota?: string | null;
  /** Lo último que vio el admin; 409 si otro la cambió. */
  actualizadaEn: string;
}
