import type { FuentePrecios } from "./cotizacion";

/**
 * La forma del catálogo — un solo contrato para todos los que lo tocan.
 *
 * Se escribe en DynamoDB (`Elrey_catalogo`), lo sirve `GET /catalogo`, la
 * tienda lo compila en cada build y la Lambda cobra con él. Si cada uno tuviera
 * su propia idea de lo que es un producto, la ficha podría enseñar un precio que
 * el servidor no conoce.
 *
 * El identificador de un producto es su **código del catálogo en PDF** (`0001`,
 * `FT046`…): es el número que el cliente dicta por WhatsApp y el único que no
 * cambia al corregir un nombre o una marca.
 */

/* ── Vocabularios ─────────────────────────────────────────────────────── */

export const CONCENTRACIONES = [
  "Parfum",
  "Eau de Parfum",
  "Eau de Toilette",
  "Eau de Cologne",
  "Body Mist",
] as const;
export type Concentracion = (typeof CONCENTRACIONES)[number];

export const GENEROS = ["Hombre", "Mujer", "Unisex"] as const;
export type Genero = (typeof GENEROS)[number];

export const FAMILIAS = [
  "Amaderado",
  "Oriental",
  "Floral",
  "Cítrico",
  "Fougère",
  "Chipre",
  "Gourmand",
  "Acuático",
  "Especiado",
] as const;
export type FamiliaOlfativa = (typeof FAMILIAS)[number];

export const OCASIONES = [
  "Diario",
  "Noche",
  "Oficina",
  "Cita",
  "Evento",
  "Verano",
  "Invierno",
] as const;
export type Ocasion = (typeof OCASIONES)[number];

export const BADGES = [
  "Nuevo",
  "Más vendido",
  "Últimas piezas",
  "Edición limitada",
  "Importado",
  "3x2",
  "Exclusivo",
] as const;
export type Badge = (typeof BADGES)[number];

export type Intensidad = 1 | 2 | 3 | 4 | 5;

/* ── Registros ────────────────────────────────────────────────────────── */

export interface ImagenCatalogo {
  /**
   * Clave dentro del bucket de imágenes. La URL la arma quien la pinta: en
   * producción apunta a CloudFront y en desarrollo a una copia local.
   */
  clave: string;
  ancho: number;
  alto: number;
  /** Miniatura en base64 para el placeholder mientras carga. */
  blur: string;
}

export interface PresentacionCatalogo {
  ml: number;
  precio: number;
}

export interface ProductoCatalogo {
  codigo: string;
  /** Otros códigos con los que aparece en el PDF (filas con dos números). */
  codigosAlternos: string[];
  slug: string;
  nombre: string;
  /** `slug` de una marca. */
  marca: string;
  linea?: string;
  concentracion: Concentracion;
  genero: Genero;
  familia: FamiliaOlfativa;
  presentaciones: PresentacionCatalogo[];
  /** Rebaja vigente: 0.25 pinta el precio anterior tachado. */
  rebaja?: number;
  salida: string[];
  corazon: string[];
  fondo: string[];
  corta: string;
  larga: string;
  badges: Badge[];
  duracion: Intensidad;
  estela: Intensidad;
  ocasion: Ocasion[];
  destacado: boolean;
  anio?: number;
  origen?: string;
  agotado: boolean;
  /**
   * Si se publica. Un producto oculto sigue en la base —con su historia—, pero
   * no sale en la tienda ni se puede cobrar.
   */
  visible: boolean;
  imagenes: ImagenCatalogo[];
  /** Solo para el equipo: de dónde salió el dato y qué falta confirmar. */
  nota?: string;
}

export interface MarcaCatalogo {
  slug: string;
  nombre: string;
  pais: string;
  /** Solo si se sabe con certeza; una fecha inventada es peor que ninguna. */
  fundada?: number;
  firma: string;
  descripcion: string;
}

export interface SetCatalogo {
  codigo: string;
  slug: string;
  nombre: string;
  marca: string;
  precio: number;
  precioAnterior?: number;
  incluye: string[];
  descripcion: string;
  agotado: boolean;
  visible: boolean;
  imagenes: ImagenCatalogo[];
  nota?: string;
}

export interface LoteCatalogo {
  slug: string;
  nombre: string;
  tema: string;
  piezas: number;
  /** Precio del paquete, fijado a mano: es una decisión comercial. */
  precio: number;
  /** Códigos de los perfumes que trae; las piezas se reparten entre ellos. */
  modelos: string[];
  descripcion: string;
  incluye: string[];
  masVendido: boolean;
}

export interface Catalogo {
  version: 1;
  /** Cuándo se generó, en ISO. */
  generado: string;
  productos: ProductoCatalogo[];
  marcas: MarcaCatalogo[];
  sets: SetCatalogo[];
  lotes: LoteCatalogo[];
}

/* ── Utilidades ───────────────────────────────────────────────────────── */

/**
 * Lo que se puede enseñar fuera: sin productos ni sets ocultos, y sin las
 * notas internas. Es lo que devuelve `GET /catalogo`.
 */
export function catalogoPublico(c: Catalogo): Catalogo {
  const sinNota = <T extends { nota?: string }>(x: T): T => {
    const copia = { ...x };
    delete copia.nota;
    return copia;
  };
  return {
    ...c,
    productos: c.productos.filter((p) => p.visible).map(sinNota),
    sets: c.sets.filter((s) => s.visible).map(sinNota),
  };
}

/** La presentación que se vende por defecto: 100 ml si existe, si no la mayor. */
export function presentacionBase(
  p: Pick<ProductoCatalogo, "presentaciones">,
): PresentacionCatalogo {
  return (
    p.presentaciones.find((v) => v.ml === 100) ??
    [...p.presentaciones].sort((a, b) => b.ml - a.ml)[0]!
  );
}

export function precioMinimo(p: Pick<ProductoCatalogo, "presentaciones">): number {
  return Math.min(...p.presentaciones.map((v) => v.precio));
}

/**
 * Lo que vale un lote a precio de lista: sus piezas repartidas entre los
 * modelos, ciclando la lista. Es la referencia del ahorro que se le promete al
 * revendedor; un modelo que ya no existe cuenta cero.
 */
export function valorLote(
  lote: LotePrecio,
  porCodigo: ReadonlyMap<string, Pick<ProductoCatalogo, "presentaciones">>,
): number {
  let suma = 0;
  for (let i = 0; i < lote.piezas; i++) {
    const producto = porCodigo.get(lote.modelos[i % lote.modelos.length]!);
    if (producto) suma += precioMinimo(producto);
  }
  return suma;
}

/* ── Disponibilidad en vivo ───────────────────────────────────────────── */

/** De un producto, solo lo que decide si se vende y a cuánto. */
export type ProductoPrecio = Pick<
  ProductoCatalogo,
  "codigo" | "presentaciones" | "badges" | "agotado" | "visible" | "rebaja"
>;
export type SetPrecio = Pick<
  SetCatalogo,
  "codigo" | "slug" | "precio" | "precioAnterior" | "agotado" | "visible"
>;
export type LotePrecio = Pick<LoteCatalogo, "slug" | "precio" | "piezas" | "modelos">;

/**
 * Lo que la tienda consulta al abrirse (`GET /disponibilidad`): qué se vende y
 * a cuánto, **ahora**.
 *
 * La tienda es estática y se compila con el catálogo de ese momento. Sin esto,
 * marcar un perfume como agotado en el panel no llegaría hasta el siguiente
 * build, y un precio cambiado se enseñaría viejo mientras el servidor ya cobra
 * el nuevo. Es una fracción del catálogo —sin textos ni fotos— para que pedirla
 * en cada visita no cueste.
 */
export interface Disponibilidad {
  generado: string;
  productos: ProductoPrecio[];
  sets: SetPrecio[];
  lotes: LotePrecio[];
}

/** Las etiquetas que cambian lo que se cobra; las demás son solo de vitrina. */
const BADGES_DE_PRECIO: readonly Badge[] = ["Edición limitada", "3x2"];

export function disponibilidadDe(c: Catalogo): Disponibilidad {
  return {
    generado: c.generado,
    productos: c.productos
      .filter((p) => p.visible)
      .map((p) => ({
        codigo: p.codigo,
        presentaciones: p.presentaciones,
        badges: p.badges.filter((b) => BADGES_DE_PRECIO.includes(b)),
        agotado: p.agotado,
        visible: true,
        ...(p.rebaja ? { rebaja: p.rebaja } : {}),
      })),
    sets: c.sets
      .filter((s) => s.visible)
      .map((s) => ({
        codigo: s.codigo,
        slug: s.slug,
        precio: s.precio,
        ...(s.precioAnterior ? { precioAnterior: s.precioAnterior } : {}),
        agotado: s.agotado,
        visible: true,
      })),
    lotes: c.lotes.map((l) => ({
      slug: l.slug,
      precio: l.precio,
      piezas: l.piezas,
      modelos: l.modelos,
    })),
  };
}

/**
 * Los precios de un catálogo, en la forma que pide `cotizar`.
 *
 * Lo oculto y lo agotado **no se cobra**: el carrito ya no deja agregarlo, y el
 * servidor tampoco lo acepta aunque alguien lo mande a mano. Acepta el catálogo
 * completo o solo su `Disponibilidad`: los dos cobran igual.
 */
export function fuenteDeCatalogo(c: {
  productos: readonly ProductoPrecio[];
  sets: readonly SetPrecio[];
  lotes: readonly LotePrecio[];
}): FuentePrecios {
  const todos = new Map(c.productos.map((p) => [p.codigo, p]));
  const vendibles = new Map(
    c.productos.filter((p) => p.visible && !p.agotado).map((p) => [p.codigo, p]),
  );
  const sets = new Map(
    c.sets.filter((s) => s.visible && !s.agotado).map((s) => [s.slug, s]),
  );
  const lotes = new Map(c.lotes.map((l) => [l.slug, l]));

  return {
    producto(id, ml) {
      const p = vendibles.get(id);
      if (!p) return undefined;
      // Una presentación que ya no existe cae en la principal, igual que en la
      // ficha: un carrito guardado hace un mes no se rompe por eso.
      const presentacion =
        p.presentaciones.find((v) => v.ml === ml) ?? presentacionBase(p);
      return {
        precio: presentacion.precio,
        mayoreo: !p.badges.includes("Edición limitada"),
        promo3x2: p.badges.includes("3x2"),
      };
    },

    paquete(id) {
      const lote = lotes.get(id);
      if (lote) {
        return { precio: lote.precio, referencia: valorLote(lote, todos), piezas: lote.piezas };
      }
      const set = sets.get(id);
      if (set) {
        return { precio: set.precio, referencia: set.precioAnterior ?? set.precio, piezas: 1 };
      }
      return undefined;
    },
  };
}
