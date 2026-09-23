import type {
  Catalogo,
  LoteCatalogo,
  MarcaCatalogo,
  ProductoCatalogo,
  SetCatalogo,
} from "./catalogo";

/**
 * Cómo se guarda el catálogo en la tabla `Elrey_catalogo`.
 *
 * Lo comparten quien escribe (`scripts/catalogo-subir.ts`) y quien lee (la
 * Lambda), para que la forma de las filas no pueda desalinearse. Sin
 * dependencias de AWS: son solo claves y conversiones.
 *
 *   PK = PRODUCTO  SK = <código>   datos = ProductoCatalogo
 *   PK = MARCA     SK = <slug>     datos = MarcaCatalogo
 *   PK = SET       SK = <código>   datos = SetCatalogo
 *   PK = LOTE      SK = <slug>     datos = LoteCatalogo
 *   PK = META      SK = CATALOGO   generado, huella y conteos de la última carga
 *
 * Cada fila lleva además la `huella` de sus datos: la carga compara huellas y
 * solo reescribe lo que cambió.
 */
export const PARTICIONES = ["PRODUCTO", "MARCA", "SET", "LOTE"] as const;
export type Particion = (typeof PARTICIONES)[number];

export const META = { PK: "META", SK: "CATALOGO" } as const;

export interface FilaCatalogo {
  PK: Particion;
  SK: string;
  datos: ProductoCatalogo | MarcaCatalogo | SetCatalogo | LoteCatalogo;
  huella?: string;
}

/** Las filas que debe tener la tabla para guardar este catálogo. */
export function filasDe(c: Catalogo): FilaCatalogo[] {
  return [
    ...c.productos.map((d) => ({ PK: "PRODUCTO" as const, SK: d.codigo, datos: d })),
    ...c.marcas.map((d) => ({ PK: "MARCA" as const, SK: d.slug, datos: d })),
    ...c.sets.map((d) => ({ PK: "SET" as const, SK: d.codigo, datos: d })),
    ...c.lotes.map((d) => ({ PK: "LOTE" as const, SK: d.slug, datos: d })),
  ];
}

/** El catálogo a partir de las filas de la tabla, en un orden estable. */
export function catalogoDeFilas(
  filas: readonly { PK: string; SK: string; datos: unknown }[],
  generado: string,
): Catalogo {
  const de = <T>(pk: Particion) =>
    filas
      .filter((f) => f.PK === pk)
      .sort((a, b) => a.SK.localeCompare(b.SK))
      .map((f) => f.datos as T);
  return {
    version: 1,
    generado,
    productos: de<ProductoCatalogo>("PRODUCTO"),
    marcas: de<MarcaCatalogo>("MARCA"),
    sets: de<SetCatalogo>("SET"),
    lotes: de<LoteCatalogo>("LOTE"),
  };
}
