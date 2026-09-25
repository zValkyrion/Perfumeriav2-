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
 * Lo comparten quien escribe (`scripts/catalogo-subir.ts` y el panel, vía la
 * Lambda) y quien lee, para que la forma de las filas no pueda desalinearse.
 * Sin dependencias: son solo claves, comparaciones y conversiones.
 *
 *   PK = PRODUCTO  SK = <código>   datos = ProductoCatalogo
 *   PK = MARCA     SK = <slug>     datos = MarcaCatalogo
 *   PK = SET       SK = <código>   datos = SetCatalogo
 *   PK = LOTE      SK = <slug>     datos = LoteCatalogo
 *   PK = META      SK = CATALOGO   cuándo cambió, cuándo se publicó y conteos
 *
 * **La tabla es la fuente de verdad.** La editan dos manos: el panel, fila por
 * fila, y la carga del CSV, a granel. Para que una no borre lo que hizo la
 * otra, cada fila que vino del CSV guarda en `fuente` lo que el CSV decía la
 * última vez; la carga siguiente solo aplica los campos que **el CSV cambió**
 * desde entonces (`fusionar`). Marcar un perfume agotado en el panel sobrevive
 * a que el Excel suba su precio.
 */
export const PARTICIONES = ["PRODUCTO", "MARCA", "SET", "LOTE"] as const;
export type Particion = (typeof PARTICIONES)[number];

export const META = { PK: "META", SK: "CATALOGO" } as const;

export type RegistroCatalogo = ProductoCatalogo | MarcaCatalogo | SetCatalogo | LoteCatalogo;

export interface FilaCatalogo {
  PK: Particion;
  SK: string;
  datos: RegistroCatalogo;
  huella?: string;
}

/** Una fila tal como está en la tabla, con lo que anotan la carga y el panel. */
export interface FilaGuardada {
  PK: string;
  SK: string;
  datos: RegistroCatalogo;
  /** Huella de `datos`: el panel la manda de vuelta para no pisar a otro. */
  huella?: string;
  /** Lo que decía el CSV en la última carga. Solo en filas que vinieron de él. */
  fuente?: RegistroCatalogo;
  editadoEn?: string;
  editadoPor?: string;
  /**
   * Borrada desde el panel. La fila se queda como marca para que la próxima
   * carga del CSV no la resucite; no se publica ni se cobra.
   */
  borrado?: boolean;
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
  filas: readonly { PK: string; SK: string; datos: unknown; borrado?: boolean }[],
  generado: string,
): Catalogo {
  const de = <T>(pk: Particion) =>
    filas
      .filter((f) => f.PK === pk && !f.borrado)
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

/* ── Comparar ─────────────────────────────────────────────────────────── */

/**
 * JSON con las claves ordenadas. Dos objetos iguales dan el mismo texto
 * aunque uno lo haya armado el lector del CSV y otro el panel, cada cual con
 * su orden de campos: sin esto, cada carga creería que todo cambió.
 */
export function estable(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(estable).join(",")}]`;
  if (valor !== null && typeof valor === "object") {
    const campos = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${campos.map(([k, v]) => `${JSON.stringify(k)}:${estable(v)}`).join(",")}}`;
  }
  return JSON.stringify(valor) ?? "null";
}

export const iguales = (a: unknown, b: unknown) => estable(a) === estable(b);

/* ── Fusionar el CSV con lo que hay ───────────────────────────────────── */

export interface Fusion<T> {
  datos: T;
  /** Campos que cambiaron en el CSV **y** en el panel, a valores distintos. */
  conflictos: string[];
}

/**
 * Fusión a tres bandas, campo por campo.
 *
 * - `base`: lo que decía el CSV la vez anterior.
 * - `csv`: lo que dice ahora.
 * - `actual`: lo que hay en la tabla, con lo que haya tocado el panel.
 *
 * Un campo que el CSV no cambió se queda como está en la tabla. Uno que cambió
 * se toma del CSV. Si los dos lo cambiaron a valores distintos gana el CSV —es
 * la edición explícita más reciente— y se reporta. Sin `base` (una fila creada
 * en el panel que ahora aparece en el CSV) no hay forma de saber quién cambió
 * qué: gana el CSV y cada diferencia se reporta.
 */
export function fusionar<T extends object>(
  base: T | undefined,
  csv: T,
  actual: T,
): Fusion<T> {
  const b = base as Record<string, unknown> | undefined;
  const c = csv as Record<string, unknown>;
  const a = actual as Record<string, unknown>;
  const campos = [...new Set([...Object.keys(c), ...Object.keys(a), ...Object.keys(b ?? {})])];

  const datos: Record<string, unknown> = {};
  const conflictos: string[] = [];
  for (const k of campos) {
    const cambioCsv = b === undefined ? !iguales(c[k], a[k]) : !iguales(c[k], b[k]);
    const cambioPanel = b === undefined ? cambioCsv : !iguales(a[k], b[k]);
    const valor = cambioCsv ? c[k] : a[k];
    if (cambioCsv && cambioPanel && !iguales(c[k], a[k])) conflictos.push(k);
    // Un opcional que queda vacío se omite, igual que lo omite el lector.
    if (valor !== undefined) datos[k] = valor;
  }
  return { datos: datos as T, conflictos };
}

export interface Escritura {
  PK: Particion;
  SK: string;
  datos: RegistroCatalogo;
  fuente: RegistroCatalogo;
  /** Lo que había, para escribir solo si nadie lo cambió en medio. */
  previa?: FilaGuardada;
}

export interface PlanCarga {
  escribir: Escritura[];
  /** Filas que vinieron del CSV y ya no están en él. */
  borrar: FilaGuardada[];
  conflictos: { clave: string; campos: string[] }[];
  /** Filas con cambios del panel que la carga respetó. */
  respetadas: string[];
  /** Borradas en el panel que siguen en el CSV (y el CSV las cambió). */
  borradasEnPanel: string[];
}

const claveDe = (f: { PK: string; SK: string }) => `${f.PK}#${f.SK}`;

/**
 * Una `larga` igual a la `corta` no es un texto propio: es la que deducen el
 * lector del CSV (columna vacía), el panel (campo vacío) y el exportador (que
 * la vuelve a dejar vacía). Se fusiona como vacía y se deduce otra vez al
 * final; si no, llenar la corta en el Excel parecería un cambio de la larga y
 * pisaría la que se escribió en el panel.
 */
function sinLargaDeducida(pk: string, x: RegistroCatalogo): RegistroCatalogo;
function sinLargaDeducida(pk: string, x: RegistroCatalogo | undefined): RegistroCatalogo | undefined;
function sinLargaDeducida(pk: string, x: RegistroCatalogo | undefined) {
  if (pk !== "PRODUCTO" || !x) return x;
  const p = x as ProductoCatalogo;
  return p.larga === p.corta ? { ...p, larga: "" } : p;
}

const sinFotos = (x: RegistroCatalogo) =>
  !("imagenes" in x) || !Array.isArray(x.imagenes) || x.imagenes.length === 0;

function conLargaDeducida(pk: string, x: RegistroCatalogo): RegistroCatalogo {
  if (pk !== "PRODUCTO") return x;
  const p = x as ProductoCatalogo;
  return p.larga ? p : { ...p, larga: p.corta };
}

/**
 * Qué hay que escribir y borrar para llevar el CSV a la tabla sin pisar lo
 * que se editó en el panel.
 *
 * Las filas cargadas antes de que existiera el panel no traen `fuente`: como
 * nadie pudo editarlas, lo que tienen **es** lo último que dijo el CSV. La
 * primera carga les anota la `fuente` y a partir de ahí se fusionan.
 */
export function planDeCarga(
  existentes: readonly FilaGuardada[],
  deseadas: readonly FilaCatalogo[],
): PlanCarga {
  const porClave = new Map(existentes.map((f) => [claveDe(f), f]));
  const plan: PlanCarga = {
    escribir: [],
    borrar: [],
    conflictos: [],
    respetadas: [],
    borradasEnPanel: [],
  };

  for (const d of deseadas) {
    const clave = claveDe(d);
    const e = porClave.get(clave);
    if (!e) {
      plan.escribir.push({ PK: d.PK, SK: d.SK, datos: d.datos, fuente: d.datos });
      continue;
    }

    const base = e.fuente ?? (e.editadoEn === undefined ? e.datos : undefined);
    const csvCambio = base === undefined || !iguales(d.datos, base);

    if (e.borrado) {
      // Borrar en el panel es una decisión sobre la fila entera: la carga no
      // la resucita. Si el CSV la cambió, se avisa para que alguien decida.
      if (csvCambio) {
        plan.borradasEnPanel.push(clave);
        plan.escribir.push({ PK: d.PK, SK: d.SK, datos: e.datos, fuente: d.datos, previa: e });
      }
      continue;
    }

    if (!csvCambio) {
      if (e.fuente === undefined) {
        // Fila de antes del panel: solo se le anota de dónde vino.
        plan.escribir.push({ PK: d.PK, SK: d.SK, datos: e.datos, fuente: d.datos, previa: e });
      } else if (!iguales(e.datos, d.datos)) {
        plan.respetadas.push(clave);
      }
      continue;
    }

    // Algo creado en el panel que llega en un CSV sin foto (exportado antes de
    // que existiera la columna `foto`) no dice «quita la foto»: el CSV no
    // tenía cómo expresarla. Se conserva la del panel.
    const csv =
      base === undefined && sinFotos(d.datos) && !sinFotos(e.datos)
        ? ({ ...d.datos, imagenes: (e.datos as { imagenes: unknown[] }).imagenes } as RegistroCatalogo)
        : d.datos;
    const f = fusionar(
      sinLargaDeducida(d.PK, base),
      sinLargaDeducida(d.PK, csv),
      sinLargaDeducida(d.PK, e.datos),
    );
    const datos = conLargaDeducida(d.PK, f.datos);
    if (f.conflictos.length > 0) plan.conflictos.push({ clave, campos: f.conflictos });
    else if (!iguales(datos, d.datos)) plan.respetadas.push(clave);
    plan.escribir.push({ PK: d.PK, SK: d.SK, datos, fuente: d.datos, previa: e });
  }

  const enCsv = new Set(deseadas.map(claveDe));
  for (const e of existentes) {
    if (enCsv.has(claveDe(e))) continue;
    // Solo se borra lo que vino del CSV. Lo creado en el panel no está en el
    // CSV porque nunca estuvo, no porque alguien lo haya quitado.
    const vinoDelCsv = e.fuente !== undefined || e.editadoEn === undefined;
    if (vinoDelCsv) plan.borrar.push(e);
  }

  return plan;
}

/**
 * La tabla tal como quedaría después de aplicar el plan. La fusión decide
 * fila por fila; las referencias entre filas —la marca de un producto, los
 * modelos de un lote, las direcciones— solo se pueden revisar sobre el
 * resultado completo, porque lo del panel y lo del CSV se mezclan.
 */
export function filasTrasPlan(
  existentes: readonly FilaGuardada[],
  plan: PlanCarga,
): FilaGuardada[] {
  const porClave = new Map(existentes.map((f) => [claveDe(f), f]));
  for (const f of plan.borrar) porClave.delete(claveDe(f));
  for (const e of plan.escribir) {
    porClave.set(claveDe(e), { ...e.previa, PK: e.PK, SK: e.SK, datos: e.datos, fuente: e.fuente });
  }
  return [...porClave.values()];
}
