/**
 * CSV armado en el navegador, para abrir en Excel.
 *
 * Mismo criterio que el de la vista de conjunto (`app/admin/page.tsx`):
 * celdas siempre entre comillas, saltos de línea de Windows y la marca de orden
 * de bytes al principio. La marca se construye con su código y no se escribe
 * como carácter: es invisible y un editor se la llevaría sin que nadie note que
 * los acentos dejaron de abrirse bien en Excel.
 */

const BOM = String.fromCharCode(0xfeff);

export type Celda = string | number | null | undefined;

/**
 * Una celda. Los nombres y direcciones llevan comas; una sola coma sin escapar
 * corre todas las columnas de la fila. Una celda que empieza por `=`, `+`, `-`
 * o `@` se abriría en Excel como fórmula (un nombre de cliente puede ser
 * cualquier cosa): se le antepone un apóstrofo. Los números van tal cual, con
 * punto decimal, para que la hoja pueda sumarlos.
 */
export function celda(valor: Celda): string {
  if (valor === null || valor === undefined) return '""';
  if (typeof valor === "number") return Number.isFinite(valor) ? `"${valor}"` : '""';
  const texto = /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function aCsv(filas: readonly (readonly Celda[])[]): string {
  return BOM + filas.map((f) => f.map(celda).join(",")).join("\r\n");
}

/** Baja el archivo. */
export function descargarCsv(nombre: string, filas: readonly (readonly Celda[])[]): void {
  const url = URL.createObjectURL(new Blob([aCsv(filas)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari necesita que la URL siga viva un momento después del clic.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
