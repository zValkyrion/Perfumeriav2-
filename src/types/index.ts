// Los vocabularios los fija el contrato del catálogo, que comparten la tienda,
// la base de datos y la API.
export type {
  Badge,
  Concentracion,
  FamiliaOlfativa,
  Genero,
  Intensidad,
  Ocasion,
} from "../../compartido/catalogo";
import type {
  Badge,
  Concentracion,
  FamiliaOlfativa,
  Genero,
  Intensidad,
  Ocasion,
} from "../../compartido/catalogo";

export interface Nota {
  tipo: "salida" | "corazon" | "fondo";
  nombre: string;
}

export interface Presentacion {
  ml: number;
  precio: number;
  precioAnterior?: number;
  stock: number;
  sku: string;
}

export interface Producto {
  /** El código del catálogo en PDF: estable, y el que se dicta por WhatsApp. */
  id: string;
  codigo: string;
  agotado: boolean;
  slug: string;
  nombre: string;
  marca: string;
  linea?: string;
  concentracion: Concentracion;
  genero: Genero;
  familia: FamiliaOlfativa;
  notas: Nota[];
  descripcionCorta: string;
  descripcionLarga: string;
  presentaciones: Presentacion[];
  imagenes: string[];
  badges: Badge[];
  // Sin calificación, reseñas ni «N personas viendo»: no hay de dónde sacarlos
  // y antes se inventaban al azar por slug (MEMORIA §0.3).
  duracion: Intensidad;
  estela: Intensidad;
  ocasion: Ocasion[];
  esMayoreoElegible: boolean;
  destacado: boolean;
  /** Año de lanzamiento, si se conoce. Sin él, la ficha no inventa uno. */
  anio?: number;
  /** País de origen, si se conoce. */
  origen?: string;
}

export interface Lote {
  id: string;
  slug: string;
  nombre: string;
  piezas: number;
  precio: number;
  precioIndividualEquivalente: number;
  utilidadEstimada: number;
  incluye: string[];
  imagen: string;
  masVendido?: boolean;
  /** Slugs de los perfumes que trae el lote (§11). */
  productos: string[];
  descripcion: string;
  tema: string;
}

export interface SetRegalo {
  id: string;
  slug: string;
  nombre: string;
  precio: number;
  precioAnterior?: number;
  incluye: string[];
  imagen: string;
  descripcion: string;
  stock: number;
}

export interface Marca {
  slug: string;
  nombre: string;
  pais: string;
  /** Solo si se sabe con certeza. */
  fundada?: number;
  descripcion: string;
  firma: string;
}

export interface ItemCarrito {
  productoId: string;
  ml: number;
  cantidad: number;
}

// El vocabulario y las formas del pedido las fija `compartido/pedido.ts`, el
// mismo contrato que valida la API: un estatus nuevo llega a los dos lados.
export type {
  CambioEstatus,
  CifrasPedido,
  EstatusPedido,
  LineaPedido,
  PedidoDetalle,
  PedidoPublico,
  ResumenPedido,
} from "../../compartido/pedido";
import type { EstatusPedido } from "../../compartido/pedido";
import type { IdEnvio, IdPago } from "../../compartido/reglas";

/**
 * Un pedido en las listas de la tienda. Los pedidos de muestra y las copias
 * viejas de «Mis pedidos» traen solo lo básico; lo que manda hoy el servidor
 * (`ResumenPedido`) trae además los campos opcionales.
 */
export interface Pedido {
  /** Solo lo tienen los pedidos de muestra; el servidor no lo manda. */
  id?: string;
  folio: string;
  fecha: string;
  estatus: EstatusPedido;
  total: number;
  piezas: number;
  items: ItemCarrito[];
  guia?: string | null;
  paqueteria?: string | null;
  creadoEn?: string;
  metodo?: IdPago | null;
  envio?: IdEnvio | null;
  escalon?: string | null;
  nombre?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  estado?: string;
  conCuenta?: boolean;
}

export interface Direccion {
  id: string;
  alias: string;
  nombre: string;
  calle: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  telefono: string;
  predeterminada: boolean;
}

export interface Usuario {
  nombre: string;
  correo: string;
  telefono: string;
  piezasCompradas: number;
  desde: string;
}

/** Escalón de precio por volumen (§3.1). Lo define la regla compartida con el servidor. */
export type { Escalon } from "../../compartido/reglas";

export interface CategoriaTienda {
  slug: string;
  nombre: string;
  titulo: string;
  descripcion: string;
  imagen: string;
}
