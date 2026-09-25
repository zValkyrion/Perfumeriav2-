import {
  BADGES,
  CONCENTRACIONES,
  FAMILIAS,
  GENEROS,
  OCASIONES,
  type Catalogo,
  type ImagenCatalogo,
  type Intensidad,
  type LoteCatalogo,
  type MarcaCatalogo,
  type PresentacionCatalogo,
  type ProductoCatalogo,
  type SetCatalogo,
} from "./catalogo";
import type { Particion, RegistroCatalogo } from "./catalogo-tabla";

/**
 * Lo que el panel puede guardar en el catálogo.
 *
 * El navegador de un administrador no es de fiar más que cualquier otro: lo
 * que llega se revisa campo por campo, con las mismas reglas que el lector del
 * CSV, y se reconstruye desde cero —un campo que no está aquí no entra a la
 * tabla—. Los errores llevan el nombre del campo para que el formulario los
 * pinte junto a él.
 */

export type TipoRegistro = "producto" | "marca" | "set" | "lote";
export const TIPOS_REGISTRO: readonly TipoRegistro[] = ["producto", "marca", "set", "lote"];

export const PARTICION_DE: Record<TipoRegistro, Particion> = {
  producto: "PRODUCTO",
  marca: "MARCA",
  set: "SET",
  lote: "LOTE",
};

export const esTipoRegistro = (x: unknown): x is TipoRegistro =>
  typeof x === "string" && (TIPOS_REGISTRO as readonly string[]).includes(x);

/** Códigos del PDF (`0001`, `FT046`): lo que va en la clave y en la ruta de la foto. */
export const PATRON_CODIGO = /^[A-Za-z0-9][A-Za-z0-9-]{0,31}$/;
/** Direcciones públicas: minúsculas, números y guiones. */
export const PATRON_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export type Validacion<T> = { ok: true; valor: T } | { ok: false; errores: ErrorCampo[] };

/**
 * «Lattafa Yara» → `lattafa-yara`. La usan el lector del CSV y el panel: un
 * producto no puede estrenar dirección según por dónde entró.
 */
export function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

class Revisor {
  readonly errores: ErrorCampo[] = [];
  private readonly o: Record<string, unknown>;

  constructor(entrada: unknown) {
    this.o =
      entrada !== null && typeof entrada === "object" && !Array.isArray(entrada)
        ? (entrada as Record<string, unknown>)
        : {};
  }

  error(campo: string, mensaje: string) {
    this.errores.push({ campo, mensaje });
  }

  texto(campo: string, opciones: { obligatorio?: boolean; max?: number } = {}): string {
    const v = this.o[campo];
    const t = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
    if (v !== undefined && v !== null && typeof v !== "string" && typeof v !== "number") {
      this.error(campo, "tiene que ser texto");
    } else if (opciones.obligatorio && t === "") {
      this.error(campo, "no puede quedar vacío");
    } else if (t.length > (opciones.max ?? 200)) {
      this.error(campo, `pasa de ${opciones.max ?? 200} caracteres`);
    }
    return t;
  }

  numero(
    campo: string,
    opciones: { obligatorio?: boolean; min?: number; max?: number; entero?: boolean } = {},
  ): number | undefined {
    const v = this.o[campo];
    if (v === undefined || v === null || v === "") {
      if (opciones.obligatorio) this.error(campo, "no puede quedar vacío");
      return undefined;
    }
    const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n)) {
      this.error(campo, "tiene que ser un número");
      return undefined;
    }
    if (opciones.entero && !Number.isInteger(n)) {
      this.error(campo, "tiene que ser un número entero");
      return undefined;
    }
    if (opciones.min !== undefined && n < opciones.min) {
      this.error(campo, `no puede ser menor que ${opciones.min}`);
      return undefined;
    }
    if (opciones.max !== undefined && n > opciones.max) {
      this.error(campo, `no puede ser mayor que ${opciones.max}`);
      return undefined;
    }
    return n;
  }

  booleano(campo: string, defecto: boolean): boolean {
    const v = this.o[campo];
    if (v === undefined || v === null) return defecto;
    if (typeof v !== "boolean") {
      this.error(campo, "tiene que ser sí o no");
      return defecto;
    }
    return v;
  }

  opcion<T extends string>(campo: string, lista: readonly T[]): T | undefined {
    const v = this.o[campo];
    if (typeof v === "string" && (lista as readonly string[]).includes(v)) return v as T;
    this.error(campo, v === undefined || v === "" ? "elige una opción" : `«${String(v)}» no es una opción válida`);
    return undefined;
  }

  opciones<T extends string>(campo: string, lista: readonly T[]): T[] {
    const v = this.o[campo];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) {
      this.error(campo, "tiene que ser una lista");
      return [];
    }
    const fuera = v.filter((x) => !(lista as readonly unknown[]).includes(x));
    if (fuera.length > 0) this.error(campo, `no son opciones válidas: ${fuera.join(", ")}`);
    // En el orden del vocabulario, sin repetidos.
    return lista.filter((x) => v.includes(x));
  }

  lista(campo: string, opciones: { max?: number; largo?: number } = {}): string[] {
    const v = this.o[campo];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
      this.error(campo, "tiene que ser una lista de textos");
      return [];
    }
    const limpia = [...new Set(v.map((x: string) => x.trim()).filter((x) => x !== ""))];
    if (limpia.length > (opciones.max ?? 20)) {
      this.error(campo, `admite hasta ${opciones.max ?? 20} elementos`);
    }
    if (limpia.some((x) => x.length > (opciones.largo ?? 80))) {
      this.error(campo, `cada elemento admite hasta ${opciones.largo ?? 80} caracteres`);
    }
    return limpia;
  }

  crudo(campo: string): unknown {
    return this.o[campo];
  }

  resultado<T>(valor: T): Validacion<T> {
    return this.errores.length > 0 ? { ok: false, errores: this.errores } : { ok: true, valor };
  }
}

/* ── Piezas comunes ───────────────────────────────────────────────────── */

const PATRON_BLUR = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;

/**
 * Las fotos solo pueden apuntar a la carpeta de **este** registro y con
 * nombre de huella: nada de rutas arbitrarias dentro del bucket.
 */
function imagenes(r: Revisor, carpeta: "productos" | "sets", codigo: string): ImagenCatalogo[] {
  const v = r.crudo("imagenes");
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > 8) {
    r.error("imagenes", "tiene que ser una lista de hasta 8 fotos");
    return [];
  }
  const patron = new RegExp(`^${carpeta}/${codigo.replace(/[-]/g, "\\-")}/[0-9a-f]{12,64}\\.(webp|jpg)$`);
  const salida: ImagenCatalogo[] = [];
  for (const i of v as Record<string, unknown>[]) {
    const clave = typeof i?.clave === "string" ? i.clave : "";
    const ancho = Number(i?.ancho);
    const alto = Number(i?.alto);
    const blur = typeof i?.blur === "string" ? i.blur : "";
    if (!patron.test(clave)) {
      r.error("imagenes", `la foto «${clave}» no es de este registro`);
      continue;
    }
    if (![ancho, alto].every((n) => Number.isInteger(n) && n > 0 && n <= 4000)) {
      r.error("imagenes", "las medidas de la foto no son válidas");
      continue;
    }
    // Vacía vale: una foto cargada por su clave desde un CSV exportado puede no
    // traer miniatura, y la tienda la enseña sin difuminado mientras carga.
    if (blur.length > 4000 || (blur !== "" && !PATRON_BLUR.test(blur))) {
      r.error("imagenes", "la miniatura de la foto no es válida");
      continue;
    }
    salida.push({ clave, ancho, alto, blur });
  }
  return salida;
}

function presentaciones(r: Revisor): PresentacionCatalogo[] {
  const v = r.crudo("presentaciones");
  if (!Array.isArray(v) || v.length === 0) {
    r.error("presentaciones", "hace falta al menos un tamaño con su precio");
    return [];
  }
  if (v.length > 6) r.error("presentaciones", "admite hasta 6 tamaños");
  const salida: PresentacionCatalogo[] = [];
  for (const p of v as Record<string, unknown>[]) {
    const ml = Number(p?.ml);
    // Se redondea antes de validar: 0.004 pasaría «mayor que cero» y se
    // guardaría como un precio de $0.
    const precio = Math.round(Number(p?.precio) * 100) / 100;
    if (!Number.isInteger(ml) || ml < 1 || ml > 1000) {
      r.error("presentaciones", "cada tamaño va en mililitros enteros, de 1 a 1000");
      continue;
    }
    if (!Number.isFinite(precio) || precio <= 0 || precio > 1_000_000) {
      r.error("presentaciones", `el precio de ${ml} ml no es válido`);
      continue;
    }
    if (salida.some((x) => x.ml === ml)) {
      r.error("presentaciones", `el tamaño de ${ml} ml está repetido`);
      continue;
    }
    salida.push({ ml, precio });
  }
  return salida.sort((a, b) => a.ml - b.ml);
}

/**
 * Productos, sets y lotes comparten un solo espacio de direcciones. Sets y
 * lotes, además, viajan en el carrito con el slug como identificador: si un
 * lote tomara el slug de un set, el cobro encontraría el lote y el set se
 * vendería al precio del lote.
 */
function slugLibre(
  r: Revisor,
  slug: string,
  catalogo: Catalogo,
  propio: { tipo: "producto" | "set" | "lote"; codigo: string },
) {
  const ocupado =
    catalogo.productos.find(
      (p) => p.slug === slug && !(propio.tipo === "producto" && p.codigo === propio.codigo),
    ) ??
    catalogo.sets.find((s) => s.slug === slug && !(propio.tipo === "set" && s.codigo === propio.codigo)) ??
    // Un lote es su slug: el único lote con ese slug es él mismo.
    catalogo.lotes.find((l) => l.slug === slug && propio.tipo !== "lote");
  if (ocupado) {
    r.error("slug", `la dirección «${slug}» ya es de ${ocupado.nombre}`);
  }
}

function revisarSlug(r: Revisor, slug: string) {
  if (!PATRON_SLUG.test(slug)) {
    r.error("slug", "solo minúsculas, números y guiones: «lattafa-yara»");
  }
}

const intensidad = (n: number | undefined) => (n ?? 3) as Intensidad;

/* ── Registros ────────────────────────────────────────────────────────── */

export function validarProducto(
  entrada: unknown,
  catalogo: Catalogo,
  codigo: string,
): Validacion<ProductoCatalogo> {
  const r = new Revisor(entrada);
  if (!PATRON_CODIGO.test(codigo)) r.error("codigo", "solo letras, números y guiones");
  if (r.texto("codigo") !== codigo) r.error("codigo", "no coincide con el registro que se guarda");

  const nombre = r.texto("nombre", { obligatorio: true, max: 120 });
  const slug = r.texto("slug", { obligatorio: true, max: 120 });
  revisarSlug(r, slug);
  slugLibre(r, slug, catalogo, { tipo: "producto", codigo });

  const marca = r.texto("marca", { obligatorio: true, max: 80 });
  if (marca && !catalogo.marcas.some((m) => m.slug === marca)) {
    r.error("marca", `la marca «${marca}» no existe: créala primero`);
  }
  const alternos = r.lista("codigosAlternos", { max: 10, largo: 32 });
  if (alternos.some((c) => !PATRON_CODIGO.test(c))) {
    r.error("codigosAlternos", "solo letras, números y guiones");
  }

  const linea = r.texto("linea", { max: 80 });
  const concentracion = r.opcion("concentracion", CONCENTRACIONES);
  const genero = r.opcion("genero", GENEROS);
  const familia = r.opcion("familia", FAMILIAS);
  const lista = presentaciones(r);
  const rebaja = r.numero("rebaja", { min: 0, max: 0.9 });
  const salida = r.lista("salida", { max: 12, largo: 60 });
  const corazon = r.lista("corazon", { max: 12, largo: 60 });
  const fondo = r.lista("fondo", { max: 12, largo: 60 });
  const corta = r.texto("corta", { max: 400 });
  const larga = r.texto("larga", { max: 4000 });
  const badges = r.opciones("badges", BADGES);
  const duracion = r.numero("duracion", { min: 1, max: 5, entero: true });
  const estela = r.numero("estela", { min: 1, max: 5, entero: true });
  const ocasion = r.opciones("ocasion", OCASIONES);
  const destacado = r.booleano("destacado", false);
  const anio = r.numero("anio", { min: 1900, max: 2100, entero: true });
  const origen = r.texto("origen", { max: 60 });
  const agotado = r.booleano("agotado", false);
  const visible = r.booleano("visible", true);
  const fotos = imagenes(r, "productos", codigo);
  const nota = r.texto("nota", { max: 1000 });

  return r.resultado<ProductoCatalogo>({
    codigo,
    codigosAlternos: alternos,
    slug,
    nombre,
    marca,
    ...(linea ? { linea } : {}),
    concentracion: concentracion!,
    genero: genero!,
    familia: familia!,
    presentaciones: lista,
    ...(rebaja ? { rebaja } : {}),
    salida,
    corazon,
    fondo,
    corta,
    larga: larga || corta,
    badges,
    duracion: intensidad(duracion),
    estela: intensidad(estela),
    ocasion,
    destacado,
    ...(anio ? { anio } : {}),
    ...(origen ? { origen } : {}),
    agotado,
    visible,
    imagenes: fotos,
    ...(nota ? { nota } : {}),
  });
}

export function validarMarca(
  entrada: unknown,
  _catalogo: Catalogo,
  slug: string,
): Validacion<MarcaCatalogo> {
  const r = new Revisor(entrada);
  revisarSlug(r, slug);
  if (r.texto("slug") !== slug) r.error("slug", "no coincide con el registro que se guarda");
  const nombre = r.texto("nombre", { obligatorio: true, max: 80 });
  const pais = r.texto("pais", { max: 60 });
  const fundada = r.numero("fundada", { min: 1500, max: 2100, entero: true });
  const firma = r.texto("firma", { max: 200 });
  const descripcion = r.texto("descripcion", { max: 2000 });
  return r.resultado<MarcaCatalogo>({
    slug,
    nombre,
    pais,
    ...(fundada ? { fundada } : {}),
    firma,
    descripcion,
  });
}

export function validarSet(
  entrada: unknown,
  catalogo: Catalogo,
  codigo: string,
): Validacion<SetCatalogo> {
  const r = new Revisor(entrada);
  if (!PATRON_CODIGO.test(codigo)) r.error("codigo", "solo letras, números y guiones");
  if (r.texto("codigo") !== codigo) r.error("codigo", "no coincide con el registro que se guarda");
  const nombre = r.texto("nombre", { obligatorio: true, max: 120 });
  const slug = r.texto("slug", { obligatorio: true, max: 120 });
  revisarSlug(r, slug);
  slugLibre(r, slug, catalogo, { tipo: "set", codigo });
  const marca = r.texto("marca", { max: 80 });
  if (marca && !catalogo.marcas.some((m) => m.slug === marca)) {
    r.error("marca", `la marca «${marca}» no existe: créala primero`);
  }
  const precio = r.numero("precio", { obligatorio: true, min: 1, max: 1_000_000 });
  const precioAnterior = r.numero("precioAnterior", { min: 1, max: 1_000_000 });
  const incluye = r.lista("incluye", { max: 12, largo: 120 });
  const descripcion = r.texto("descripcion", { max: 2000 });
  const agotado = r.booleano("agotado", false);
  const visible = r.booleano("visible", true);
  const fotos = imagenes(r, "sets", codigo);
  const nota = r.texto("nota", { max: 1000 });
  return r.resultado<SetCatalogo>({
    codigo,
    slug,
    nombre,
    marca,
    precio: precio ?? 0,
    ...(precioAnterior ? { precioAnterior } : {}),
    incluye,
    descripcion,
    agotado,
    visible,
    imagenes: fotos,
    ...(nota ? { nota } : {}),
  });
}

export function validarLote(
  entrada: unknown,
  catalogo: Catalogo,
  slug: string,
): Validacion<LoteCatalogo> {
  const r = new Revisor(entrada);
  revisarSlug(r, slug);
  slugLibre(r, slug, catalogo, { tipo: "lote", codigo: slug });
  if (r.texto("slug") !== slug) r.error("slug", "no coincide con el registro que se guarda");
  const nombre = r.texto("nombre", { obligatorio: true, max: 120 });
  const tema = r.texto("tema", { max: 60 });
  const piezas = r.numero("piezas", { obligatorio: true, min: 1, max: 500, entero: true });
  const precio = r.numero("precio", { obligatorio: true, min: 1, max: 1_000_000 });
  const modelos = r.lista("modelos", { max: 50, largo: 32 });
  if (modelos.length === 0) r.error("modelos", "un lote necesita al menos un modelo");
  const faltan = modelos.filter((m) => !catalogo.productos.some((p) => p.codigo === m));
  if (faltan.length > 0) r.error("modelos", `no existen: ${faltan.join(", ")}`);
  const descripcion = r.texto("descripcion", { max: 2000 });
  const incluye = r.lista("incluye", { max: 12, largo: 120 });
  const masVendido = r.booleano("masVendido", false);
  return r.resultado<LoteCatalogo>({
    slug,
    nombre,
    tema: tema || "Mixto",
    piezas: piezas ?? 0,
    precio: precio ?? 0,
    modelos,
    descripcion,
    incluye,
    masVendido,
  });
}

export function validarRegistro(
  tipo: TipoRegistro,
  entrada: unknown,
  catalogo: Catalogo,
  id: string,
): Validacion<RegistroCatalogo> {
  switch (tipo) {
    case "producto":
      return validarProducto(entrada, catalogo, id);
    case "marca":
      return validarMarca(entrada, catalogo, id);
    case "set":
      return validarSet(entrada, catalogo, id);
    case "lote":
      return validarLote(entrada, catalogo, id);
  }
}

/**
 * Referencias rotas y direcciones repetidas en un catálogo ya armado.
 *
 * El panel revisa registro por registro y el lector del CSV, el CSV contra sí
 * mismo. Ninguno ve la mezcla de los dos: un producto dado de alta en el panel
 * con una marca que después se quita del CSV, o un slug del CSV que ya usa algo
 * creado en el panel. Esto revisa el resultado.
 */
export function incoherencias(c: Catalogo): string[] {
  const salida: string[] = [];
  const marcas = new Set(c.marcas.map((m) => m.slug));
  const codigos = new Set(c.productos.map((p) => p.codigo));
  for (const p of c.productos) {
    if (!marcas.has(p.marca)) salida.push(`perfume ${p.codigo}: la marca «${p.marca}» no existe`);
  }
  for (const s of c.sets) {
    if (s.marca && !marcas.has(s.marca)) salida.push(`set ${s.codigo}: la marca «${s.marca}» no existe`);
  }
  for (const l of c.lotes) {
    const faltan = l.modelos.filter((m) => !codigos.has(m));
    if (faltan.length > 0) salida.push(`lote ${l.slug}: sus modelos ${faltan.join(", ")} no existen`);
  }
  const duenos = new Map<string, string>();
  for (const [slug, quien] of [
    ...c.productos.map((p) => [p.slug, `el perfume ${p.codigo}`] as const),
    ...c.sets.map((s) => [s.slug, `el set ${s.codigo}`] as const),
    ...c.lotes.map((l) => [l.slug, `el lote ${l.slug}`] as const),
  ]) {
    const otro = duenos.get(slug);
    if (otro) salida.push(`«${slug}» es la dirección de dos registros: ${otro} y ${quien}`);
    else duenos.set(slug, quien);
  }
  return salida;
}

/**
 * Lo que se rompería al borrar un registro. Una marca con perfumes o un
 * perfume que forma parte de un lote no se borran: la ficha o el lote se
 * quedarían apuntando a nada.
 */
export function quienUsa(tipo: TipoRegistro, id: string, catalogo: Catalogo): string[] {
  if (tipo === "marca") {
    return [
      ...catalogo.productos.filter((p) => p.marca === id).map((p) => `${p.codigo} ${p.nombre}`),
      ...catalogo.sets.filter((s) => s.marca === id).map((s) => `set ${s.nombre}`),
    ];
  }
  if (tipo === "producto") {
    return catalogo.lotes.filter((l) => l.modelos.includes(id)).map((l) => `lote ${l.nombre}`);
  }
  return [];
}
