import type { Catalogo } from "./catalogo";

/**
 * El catálogo en el formato de `catalogo/*.csv`.
 *
 * Lo escriben `npm run catalogo:exportar` y el botón «Exportar» del panel, y
 * lo lee `scripts/catalogo/leer.ts`. Tiene que ser un solo formato: un CSV
 * bajado del panel, editado en Excel y puesto en `catalogo/` tiene que cargar
 * sin que se pierda ni se invente nada.
 */

export const COLUMNAS_PRODUCTO = [
  "codigo",
  "codigos_alternos",
  "slug",
  "nombre",
  "marca",
  "linea",
  "concentracion",
  "genero",
  "familia",
  "precio_100ml",
  "precios",
  "rebaja",
  "mls",
  "salida",
  "corazon",
  "fondo",
  "corta",
  "larga",
  "badges",
  "duracion",
  "estela",
  "ocasion",
  "destacado",
  "anio",
  "origen",
  "agotado",
  "visible",
  "nota",
] as const;

export const COLUMNAS_MARCA = ["slug", "nombre", "pais", "fundada", "firma", "descripcion"] as const;

export const COLUMNAS_SET = [
  "codigo",
  "slug",
  "nombre",
  "marca",
  "precio",
  "precio_anterior",
  "incluye",
  "descripcion",
  "agotado",
  "visible",
  "nota",
] as const;

export const COLUMNAS_LOTE = [
  "slug",
  "nombre",
  "tema",
  "piezas",
  "precio",
  "modelos",
  "descripcion",
  "incluye",
  "mas_vendido",
] as const;

export type ArchivoCsv = "productos" | "marcas" | "sets" | "lotes";
export const ARCHIVOS_CSV: readonly ArchivoCsv[] = ["productos", "marcas", "sets", "lotes"];

const lista = (v: readonly string[] | undefined) => (v ?? []).join("|");
const siNo = (v: boolean) => (v ? "si" : "");

/** Las filas de un archivo, con la cabecera primero. */
export function filasCsv(c: Catalogo, archivo: ArchivoCsv): string[][] {
  switch (archivo) {
    case "productos":
      return [
        [...COLUMNAS_PRODUCTO],
        ...c.productos.map((p) => {
          const cien = p.presentaciones.find((v) => v.ml === 100);
          return [
            p.codigo,
            lista(p.codigosAlternos),
            p.slug,
            p.nombre,
            p.marca,
            p.linea ?? "",
            p.concentracion,
            p.genero,
            p.familia,
            cien ? String(cien.precio) : "",
            p.presentaciones.map((v) => `${v.ml}:${v.precio}`).join("|"),
            p.rebaja ? String(p.rebaja) : "",
            p.presentaciones.map((v) => v.ml).join("|"),
            lista(p.salida),
            lista(p.corazon),
            lista(p.fondo),
            p.corta,
            // La larga vacía cae en la corta al leer: no se escribe dos veces.
            p.larga === p.corta ? "" : p.larga,
            lista(p.badges),
            String(p.duracion),
            String(p.estela),
            lista(p.ocasion),
            siNo(p.destacado),
            p.anio ? String(p.anio) : "",
            p.origen ?? "",
            siNo(p.agotado),
            p.visible ? "si" : "no",
            p.nota ?? "",
          ];
        }),
      ];
    case "marcas":
      return [
        [...COLUMNAS_MARCA],
        ...c.marcas.map((m) => [
          m.slug,
          m.nombre,
          m.pais,
          m.fundada ? String(m.fundada) : "",
          m.firma,
          m.descripcion,
        ]),
      ];
    case "sets":
      return [
        [...COLUMNAS_SET],
        ...c.sets.map((s) => [
          s.codigo,
          s.slug,
          s.nombre,
          s.marca,
          String(s.precio),
          s.precioAnterior ? String(s.precioAnterior) : "",
          lista(s.incluye),
          s.descripcion,
          siNo(s.agotado),
          s.visible ? "si" : "no",
          s.nota ?? "",
        ]),
      ];
    case "lotes":
      return [
        [...COLUMNAS_LOTE],
        ...c.lotes.map((l) => [
          l.slug,
          l.nombre,
          l.tema,
          String(l.piezas),
          String(l.precio),
          lista(l.modelos),
          l.descripcion,
          lista(l.incluye),
          siNo(l.masVendido),
        ]),
      ];
  }
}

function celdaCSV(valor: string): string {
  return /["\n\r,;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/**
 * Escribe el CSV con BOM y separado por comas.
 *
 * El BOM no es decorativo: sin él, Excel abre el archivo en la codificación del
 * sistema y cada acento se convierte en un símbolo raro.
 */
export function escribirCSV(filas: string[][]): string {
  return "\uFEFF" + filas.map((f) => f.map(celdaCSV).join(",")).join("\r\n") + "\r\n";
}
