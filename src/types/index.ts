export type Concentracion =
  | "Parfum"
  | "Eau de Parfum"
  | "Eau de Toilette"
  | "Eau de Cologne"
  | "Body Mist";

export type Genero = "Hombre" | "Mujer" | "Unisex";

export type FamiliaOlfativa =
  | "Amaderado"
  | "Oriental"
  | "Floral"
  | "Cítrico"
  | "Fougère"
  | "Chipre"
  | "Gourmand"
  | "Acuático"
  | "Especiado";

export type Ocasion =
  | "Diario"
  | "Noche"
  | "Oficina"
  | "Cita"
  | "Evento"
  | "Verano"
  | "Invierno";

export type Badge =
  | "Nuevo"
  | "Más vendido"
  | "Últimas piezas"
  | "Edición limitada"
  | "Importado"
  | "3x2"
  | "Exclusivo";

export type Intensidad = 1 | 2 | 3 | 4 | 5;

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
  id: string;
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
  rating: number;
  totalReseñas: number;
  duracion: Intensidad;
  estela: Intensidad;
  ocasion: Ocasion[];
  esMayoreoElegible: boolean;
  destacado: boolean;
  /** Espectadores "en vivo": pseudo-aleatorio pero estable por producto (§10.14). */
  viendoAhora: number;
  /** Año de lanzamiento, para la ficha técnica. */
  anio: number;
  /** País de origen, para la ficha técnica. */
  origen: string;
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
  fundada: number;
  descripcion: string;
  firma: string;
}

export interface ItemCarrito {
  productoId: string;
  ml: number;
  cantidad: number;
}

export type EstatusPedido =
  | "Pendiente"
  | "Pagado"
  | "En camino"
  | "Entregado"
  | "Cancelado";

export interface Pedido {
  id: string;
  folio: string;
  fecha: string;
  estatus: EstatusPedido;
  total: number;
  piezas: number;
  items: ItemCarrito[];
  guia?: string;
  paqueteria?: string;
}

export interface Reseña {
  id: string;
  productoId: string;
  autor: string;
  rating: number;
  fecha: string;
  titulo: string;
  texto: string;
  verificada: boolean;
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

/** Escalón de precio por volumen (§3.1). */
export interface Escalon {
  min: number;
  max: number | null;
  descuento: number;
  etiqueta: string;
  nombre: string;
}

export interface CategoriaTienda {
  slug: string;
  nombre: string;
  titulo: string;
  descripcion: string;
  imagen: string;
}
