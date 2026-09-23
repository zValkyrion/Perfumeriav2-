import type {
  Catalogo,
  LoteCatalogo,
  MarcaCatalogo,
  ProductoCatalogo,
  SetCatalogo,
} from "./catalogo";
import type { RegistroCatalogo } from "./catalogo-tabla";
import type { ErrorCampo, TipoRegistro } from "./validar-catalogo";

/**
 * El contrato de `/admin/*`: lo que la Lambda devuelve y lo que el panel manda.
 *
 * El panel lo importa solo como tipos. El vocabulario (familias, géneros…)
 * viaja en la respuesta en vez de importarse, para que el panel no pueda
 * ofrecer una opción que el servidor ya no acepta.
 */

export interface EstadoRegistro {
  /** Se devuelve al guardar: si otro lo cambió en medio, el guardado se rechaza. */
  huella: string;
  editadoEn?: string;
  editadoPor?: string;
  /** Vino del CSV: la próxima carga podría cambiarlo si su fila cambia. */
  deCsv: boolean;
}

export interface Vocabulario {
  concentraciones: readonly string[];
  generos: readonly string[];
  familias: readonly string[];
  ocasiones: readonly string[];
  badges: readonly string[];
}

export interface CorridaPublicacion {
  estado: "en_cola" | "en_curso" | "terminada";
  resultado: "exito" | "fallo" | "cancelada" | null;
  iniciada: string;
  url: string;
}

export interface EstadoPublicacion {
  /** Cuándo cambió el catálogo por última vez, por el panel o por el CSV. */
  cambiado: string | null;
  /** El catálogo con que se compiló la tienda que está publicada. */
  publicado: string | null;
  publicadoEn: string | null;
  /** Hay cambios que la tienda compilada todavía no enseña. */
  pendiente: boolean;
  /** Última vez que se pidió publicar, y quién. */
  pedidaEn: string | null;
  pedidaPor: string | null;
  /** Hay token de GitHub: se puede publicar desde aquí y en automático. */
  automatica: boolean;
  corrida: CorridaPublicacion | null;
}

export interface CatalogoAdmin {
  /** Completo: con lo oculto y las notas internas. */
  catalogo: Catalogo;
  /** Por `claveRegistro(tipo, id)`. */
  registros: Record<string, EstadoRegistro>;
  publicacion: EstadoPublicacion;
  vocabulario: Vocabulario;
}

export type DatosDe<T extends TipoRegistro> = T extends "producto"
  ? ProductoCatalogo
  : T extends "marca"
    ? MarcaCatalogo
    : T extends "set"
      ? SetCatalogo
      : LoteCatalogo;

/** `PUT /admin/catalogo/<tipo>/<id>`. `huella: null` es un alta. */
export interface GuardarRegistro {
  datos: unknown;
  huella: string | null;
}

export interface RegistroGuardado {
  huella: string;
  sinCambios: boolean;
  /** Lo que quedó en la tabla, ya limpio: textos recortados, tamaños en orden. */
  datos: RegistroCatalogo;
  editadoEn?: string;
  editadoPor?: string;
}

/** Respuesta 422: qué campo no pasó y por qué. */
export interface RechazoValidacion {
  error: string;
  errores: ErrorCampo[];
}

/** `POST /admin/imagenes`: pide dónde subir una foto ya procesada. */
export interface SolicitudImagen {
  tipo: "producto" | "set";
  codigo: string;
  /** SHA-256 del archivo, en hexadecimal: la foto se guarda con su huella. */
  sha256: string;
  formato: "webp" | "jpeg";
}

export interface ImagenAutorizada {
  url: string;
  clave: string;
  /** Hay que mandarlas tal cual en el PUT: van firmadas. */
  cabeceras: Record<string, string>;
}

export const claveRegistro = (tipo: TipoRegistro, id: string) => `${tipo}:${id}`;
