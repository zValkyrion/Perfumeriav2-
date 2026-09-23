import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
} from "../../compartido/catalogo";
import { COLUMNAS_PRODUCTO } from "../../compartido/catalogo-csv";
import { Lector, aSlug, leerCSV, leerPrecios, type Problema } from "./csv";
import { claveImagen, medidas, procesarFoto, type TipoImagen } from "./imagenes";

/**
 * Del CSV al catálogo: la única forma de leer `catalogo/`.
 *
 * Nada de lo que falte se rellena a ojo. Una fila sin familia o con una marca
 * que no existe se anota con su archivo, fila y columna, y quien llama decide
 * —casi siempre, no escribir nada—. Un catálogo con la familia inventada manda
 * perfumes a la página de categoría equivocada y nadie se entera hasta que un
 * cliente lo dice.
 */

// Las columnas las fija `compartido/catalogo-csv.ts`, que también las escribe.
export {
  COLUMNAS_LOTE,
  COLUMNAS_MARCA,
  COLUMNAS_PRODUCTO,
  COLUMNAS_SET,
} from "../../compartido/catalogo-csv";

/**
 * Precio de un tamaño que la lista no trae, relativo al de 100 ml. Solo se usa
 * cuando el CSV declara un tamaño en `mls` sin su cifra en `precios`: en
 * perfumería el frasco grande siempre sale más barato por mililitro.
 */
const RATIO_ML: Record<number, number> = { 30: 0.45, 50: 0.68, 100: 1, 200: 1.6 };

function precioBonito(valor: number): number {
  const r = Math.round(valor / 10) * 10;
  return r % 100 === 0 ? r - 10 : r;
}

/** Una foto del catálogo: de dónde sale y bajo qué clave se publica. */
export interface FotoFuente {
  clave: string;
  ruta: string;
  tipo: TipoImagen;
  codigo: string;
  /** El WebP ya procesado, si esta lectura tuvo que generarlo. */
  datos?: Buffer;
}

export interface Lectura {
  catalogo: Catalogo;
  fotos: FotoFuente[];
  problemas: Problema[];
  /** Cosas que no detienen la carga pero conviene saber (fotos que faltan). */
  avisos: string[];
}

const EXTENSIONES = [".jpg", ".jpeg", ".png", ".webp"];

function buscarFoto(carpeta: string, codigo: string): string | undefined {
  for (const ext of EXTENSIONES) {
    const ruta = join(carpeta, `${codigo}${ext}`);
    if (existsSync(ruta)) return ruta;
  }
  return undefined;
}

async function leerArchivo(ruta: string): Promise<string[][] | null> {
  if (!existsSync(ruta)) return null;
  return leerCSV(await readFile(ruta, "utf8"));
}

/**
 * Lee `catalogo/` y devuelve el catálogo con sus imágenes.
 *
 * `previo` es la versión anterior del catálogo —la copia local o lo que hay en
 * DynamoDB—. Una foto cuya clave ya estaba ahí conserva su miniatura sin volver
 * a procesarse, que es lo que hace que la carga de cientos de productos tarde
 * segundos y no minutos.
 */
export async function leerCatalogo(opciones: {
  carpeta: string;
  previo?: Catalogo;
}): Promise<Lectura> {
  const { carpeta, previo } = opciones;
  const problemas: Problema[] = [];
  const avisos: string[] = [];
  const fotos: FotoFuente[] = [];
  const carpetaFotos = join(carpeta, "fotos");

  const imagenesPrevias = new Map<string, ImagenCatalogo>();
  // `?? []`: el previo puede venir de la tabla, y una fila a medio escribir no
  // debe tumbar la carga que justamente la va a corregir.
  for (const p of [...(previo?.productos ?? []), ...(previo?.sets ?? [])]) {
    for (const i of p.imagenes ?? []) imagenesPrevias.set(i.clave, i);
  }

  async function imagenDe(tipo: TipoImagen, codigo: string): Promise<ImagenCatalogo[]> {
    const ruta = buscarFoto(carpetaFotos, codigo);
    if (!ruta) return [];
    const origen = await readFile(ruta);
    const clave = claveImagen(tipo, codigo, origen);
    const guardada = imagenesPrevias.get(clave);
    if (guardada) {
      fotos.push({ clave, ruta, tipo, codigo });
      return [guardada];
    }
    const hecha = await procesarFoto(origen, tipo);
    fotos.push({ clave, ruta, tipo, codigo, datos: hecha.datos });
    return [{ clave, ancho: hecha.ancho, alto: hecha.alto, blur: hecha.blur }];
  }

  /* ── Marcas ── */
  const marcas: MarcaCatalogo[] = [];
  const filasMarca = await leerArchivo(join(carpeta, "marcas.csv"));
  if (!filasMarca) {
    problemas.push({ archivo: "marcas.csv", fila: 0, columna: "-", mensaje: "no existe" });
  } else {
    const cabecera = filasMarca.shift() ?? [];
    const l = new Lector(cabecera, problemas, "marcas.csv");
    l.exigirColumnas(["slug", "nombre"]);
    const vistos = new Set<string>();
    filasMarca.forEach((fila, i) => {
      const n = i + 2; // +1 por la cabecera, +1 porque Excel cuenta desde 1
      const nombre = l.texto(fila, "nombre", n, true);
      const slug = l.texto(fila, "slug", n) || aSlug(nombre);
      if (vistos.has(slug)) {
        problemas.push({ archivo: "marcas.csv", fila: n, columna: "slug", mensaje: `«${slug}» está repetido` });
        return;
      }
      vistos.add(slug);
      const fundada = l.numero(fila, "fundada", n, { min: 1500, max: 2100 });
      marcas.push({
        slug,
        nombre,
        pais: l.texto(fila, "pais", n),
        ...(fundada ? { fundada } : {}),
        firma: l.texto(fila, "firma", n),
        descripcion: l.texto(fila, "descripcion", n),
      });
    });
  }
  const slugsMarca = new Set(marcas.map((m) => m.slug));

  /* ── Productos ── */
  const productos: ProductoCatalogo[] = [];
  const filasProd = await leerArchivo(join(carpeta, "productos.csv"));
  if (!filasProd) {
    problemas.push({ archivo: "productos.csv", fila: 0, columna: "-", mensaje: "no existe" });
  } else {
    const cabecera = filasProd.shift() ?? [];
    const l = new Lector(cabecera, problemas, "productos.csv");
    l.exigirColumnas(["codigo", "nombre", "marca", "concentracion", "genero", "familia"]);
    const desconocidas = l.columnasDesconocidas(COLUMNAS_PRODUCTO);
    if (desconocidas.length > 0) {
      avisos.push(`productos.csv: columnas que no se leen (¿errata?): ${desconocidas.join(", ")}`);
    }

    const codigos = new Set<string>();
    const slugs = new Set<string>();
    for (const [i, fila] of filasProd.entries()) {
      const n = i + 2;
      const codigo = l.texto(fila, "codigo", n, true);
      const nombre = l.texto(fila, "nombre", n, true);
      const slug = l.texto(fila, "slug", n) || aSlug(nombre);
      if (!codigo || !slug) continue;
      if (codigos.has(codigo)) {
        problemas.push({ archivo: "productos.csv", fila: n, columna: "codigo", mensaje: `«${codigo}» está repetido` });
        continue;
      }
      if (slugs.has(slug)) {
        problemas.push({
          archivo: "productos.csv",
          fila: n,
          columna: "slug",
          mensaje: `«${slug}» está repetido. Dos productos no pueden compartir dirección`,
        });
        continue;
      }
      codigos.add(codigo);
      slugs.add(slug);

      const marca = l.texto(fila, "marca", n, true);
      if (marca && !slugsMarca.has(marca)) {
        problemas.push({
          archivo: "productos.csv",
          fila: n,
          columna: "marca",
          mensaje: `la marca «${marca}» no está en marcas.csv. Agrégala ahí primero`,
        });
      }

      const base = l.numero(fila, "precio_100ml", n, { min: 1 });
      const explicitos = leerPrecios(l.texto(fila, "precios", n), n, problemas, "productos.csv");
      const mls = l.lista(fila, "mls").map(Number).filter((v) => Number.isFinite(v) && v > 0);
      const presentaciones: PresentacionCatalogo[] = [...explicitos];
      for (const ml of mls.length > 0 ? mls : explicitos.length > 0 ? [] : [100]) {
        if (presentaciones.some((p) => p.ml === ml)) continue;
        if (base === undefined) {
          problemas.push({
            archivo: "productos.csv",
            fila: n,
            columna: "precio_100ml",
            mensaje: `el tamaño de ${ml} ml no tiene precio: ponlo en «precios» o llena «precio_100ml»`,
          });
          continue;
        }
        presentaciones.push({
          ml,
          precio: ml === 100 ? base : precioBonito(base * (RATIO_ML[ml] ?? 1)),
        });
      }
      presentaciones.sort((a, b) => a.ml - b.ml);
      if (presentaciones.length === 0) continue;

      const concentracion = l.opcion(fila, "concentracion", n, CONCENTRACIONES);
      const genero = l.opcion(fila, "genero", n, GENEROS);
      const familia = l.opcion(fila, "familia", n, FAMILIAS);
      const rebaja = l.numero(fila, "rebaja", n, { min: 0, max: 0.9 });
      const duracion = l.numero(fila, "duracion", n, { min: 1, max: 5 });
      const estela = l.numero(fila, "estela", n, { min: 1, max: 5 });
      const anio = l.numero(fila, "anio", n, { min: 1900, max: 2100 });
      if (!concentracion || !genero || !familia) continue;

      const visible = l.siNoConDefecto(fila, "visible", true);
      const imagenes = await imagenDe("producto", codigo);
      if (imagenes.length === 0 && visible) {
        avisos.push(`productos.csv fila ${n}: ${codigo} (${nombre}) no tiene foto en catalogo/fotos/`);
      }

      const corta = l.texto(fila, "corta", n);
      const origen = l.texto(fila, "origen", n);
      const linea = l.texto(fila, "linea", n);
      const nota = l.texto(fila, "nota", n);
      productos.push({
        codigo,
        codigosAlternos: l.lista(fila, "codigos_alternos"),
        slug,
        nombre,
        marca,
        ...(linea ? { linea } : {}),
        concentracion,
        genero,
        familia,
        presentaciones,
        ...(rebaja ? { rebaja } : {}),
        salida: l.lista(fila, "salida"),
        corazon: l.lista(fila, "corazon"),
        fondo: l.lista(fila, "fondo"),
        corta,
        // La descripción larga cae en la corta y no en un texto de relleno.
        larga: l.texto(fila, "larga", n) || corta,
        badges: l.opciones(fila, "badges", n, BADGES),
        duracion: (duracion ?? 3) as Intensidad,
        estela: (estela ?? 3) as Intensidad,
        ocasion: l.opciones(fila, "ocasion", n, OCASIONES),
        destacado: l.siNo(fila, "destacado"),
        ...(anio ? { anio } : {}),
        ...(origen ? { origen } : {}),
        agotado: l.siNo(fila, "agotado"),
        visible,
        imagenes,
        ...(nota ? { nota } : {}),
      });
    }
  }
  const porCodigo = new Map(productos.map((p) => [p.codigo, p]));

  /* ── Sets ── */
  const sets: SetCatalogo[] = [];
  const filasSet = await leerArchivo(join(carpeta, "sets.csv"));
  if (filasSet) {
    const cabecera = filasSet.shift() ?? [];
    const l = new Lector(cabecera, problemas, "sets.csv");
    l.exigirColumnas(["codigo", "nombre", "precio"]);
    const vistos = new Set<string>();
    for (const [i, fila] of filasSet.entries()) {
      const n = i + 2;
      const codigo = l.texto(fila, "codigo", n, true);
      const nombre = l.texto(fila, "nombre", n, true);
      const slug = l.texto(fila, "slug", n) || aSlug(`set ${nombre}`);
      const precio = l.numero(fila, "precio", n, { obligatorio: true, min: 1 });
      if (!codigo || !slug || precio === undefined) continue;
      if (vistos.has(slug) || productos.some((p) => p.slug === slug)) {
        problemas.push({ archivo: "sets.csv", fila: n, columna: "slug", mensaje: `«${slug}» está repetido` });
        continue;
      }
      vistos.add(slug);
      const marca = l.texto(fila, "marca", n);
      if (marca && !slugsMarca.has(marca)) {
        problemas.push({ archivo: "sets.csv", fila: n, columna: "marca", mensaje: `la marca «${marca}» no está en marcas.csv` });
      }
      const precioAnterior = l.numero(fila, "precio_anterior", n, { min: 1 });
      const visible = l.siNoConDefecto(fila, "visible", true);
      const imagenes = await imagenDe("set", codigo);
      if (imagenes.length === 0 && visible) {
        avisos.push(`sets.csv fila ${n}: ${codigo} (${nombre}) no tiene foto en catalogo/fotos/`);
      }
      const nota = l.texto(fila, "nota", n);
      sets.push({
        codigo,
        slug,
        nombre,
        marca,
        precio,
        ...(precioAnterior ? { precioAnterior } : {}),
        incluye: l.lista(fila, "incluye"),
        descripcion: l.texto(fila, "descripcion", n),
        agotado: l.siNo(fila, "agotado"),
        visible,
        imagenes,
        ...(nota ? { nota } : {}),
      });
    }
  }

  /* ── Lotes ── */
  const lotes: LoteCatalogo[] = [];
  const filasLote = await leerArchivo(join(carpeta, "lotes.csv"));
  if (filasLote) {
    const cabecera = filasLote.shift() ?? [];
    const l = new Lector(cabecera, problemas, "lotes.csv");
    l.exigirColumnas(["slug", "nombre", "piezas", "precio", "modelos"]);
    for (const [i, fila] of filasLote.entries()) {
      const n = i + 2;
      const nombre = l.texto(fila, "nombre", n, true);
      const slug = l.texto(fila, "slug", n) || aSlug(nombre);
      const piezas = l.numero(fila, "piezas", n, { obligatorio: true, min: 1 });
      const precio = l.numero(fila, "precio", n, { obligatorio: true, min: 1 });
      const modelos = l.lista(fila, "modelos");
      if (modelos.length === 0) {
        problemas.push({ archivo: "lotes.csv", fila: n, columna: "modelos", mensaje: "un lote necesita al menos un modelo" });
      }
      for (const m of modelos) {
        const p = porCodigo.get(m);
        if (!p) {
          problemas.push({ archivo: "lotes.csv", fila: n, columna: "modelos", mensaje: `el código «${m}» no está en productos.csv` });
        } else if (!p.visible || p.agotado) {
          avisos.push(`lotes.csv fila ${n}: el modelo ${m} (${p.nombre}) está ${p.agotado ? "agotado" : "oculto"}`);
        }
      }
      if (!slug || piezas === undefined || precio === undefined) continue;
      lotes.push({
        slug,
        nombre,
        tema: l.texto(fila, "tema", n) || "Mixto",
        piezas,
        precio,
        modelos,
        descripcion: l.texto(fila, "descripcion", n),
        incluye: l.lista(fila, "incluye"),
        masVendido: l.siNo(fila, "mas_vendido"),
      });
    }
  }

  return {
    catalogo: {
      version: 1,
      generado: new Date().toISOString(),
      productos,
      marcas,
      sets,
      lotes,
    },
    fotos,
    problemas,
    avisos,
  };
}

/** El WebP de una foto: el que ya se generó en la lectura, o uno nuevo. */
export async function datosDeFoto(f: FotoFuente): Promise<Buffer> {
  if (f.datos) return f.datos;
  return (await procesarFoto(await readFile(f.ruta), f.tipo)).datos;
}

/** Medidas de una imagen según su tipo, para quien necesite el lienzo. */
export { medidas };

/**
 * Huella del contenido del catálogo, sin la fecha de generación. Sirve para
 * saber si algo cambió de verdad antes de escribir un archivo o una tabla.
 */
export function sinFecha(c: Catalogo): Omit<Catalogo, "generado"> {
  const copia: Partial<Catalogo> = { ...c };
  delete copia.generado;
  return copia as Omit<Catalogo, "generado">;
}
