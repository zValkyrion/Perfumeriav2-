/**
 * Lectura y escritura de los CSV del catálogo, con validación fila por fila.
 *
 * Vive aparte porque lo usan tres programas: `npm run catalogo` (genera la copia
 * local), `npm run catalogo:subir` (carga DynamoDB y S3) y las pruebas. Si cada
 * uno leyera el CSV a su manera, el mismo archivo podría pasar en uno y fallar
 * en otro.
 */

/**
 * Lector de CSV con comillas, saltos de línea dentro de celda y separador
 * variable.
 *
 * Se escribe aquí en vez de traer una dependencia porque son cuarenta líneas y
 * el formato no va a cambiar. Lo que sí cambia es lo que escupe Excel: en
 * español guarda con punto y coma, y a veces con BOM delante. Las dos cosas se
 * detectan solas — pedirle a alguien que reconfigure Excel antes de mandar su
 * lista de precios es una forma segura de no recibirla nunca.
 */
export function leerCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const sep = detectarSeparador(limpio);

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]!;

    if (entreComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        celda += c;
      }
      continue;
    }

    if (c === '"') {
      entreComillas = true;
    } else if (c === sep) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n") {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else if (c !== "\r") {
      celda += c;
    }
  }

  if (celda !== "" || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }

  // Una fila totalmente vacía es la línea en blanco del final, no un producto.
  return filas.filter((f) => f.some((c) => c.trim() !== ""));
}

/** Coma o punto y coma, según cuál aparezca más en la cabecera. */
function detectarSeparador(texto: string): string {
  const cabecera = texto.slice(0, texto.indexOf("\n") + 1 || texto.length);
  const comas = (cabecera.match(/,/g) ?? []).length;
  const puntoYComa = (cabecera.match(/;/g) ?? []).length;
  return puntoYComa > comas ? ";" : ",";
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
  return "﻿" + filas.map((f) => f.map(celdaCSV).join(",")).join("\r\n") + "\r\n";
}

/** Un problema concreto, con su archivo, su fila y su columna. */
export interface Problema {
  archivo: string;
  fila: number;
  columna: string;
  mensaje: string;
}

/**
 * Lee celdas de un CSV por nombre de columna y anota lo que no cuadra, sin
 * detenerse: al final se enseñan todos los problemas juntos, con la fila tal
 * como la numera Excel.
 */
export class Lector {
  private readonly indice: Map<string, number>;

  constructor(
    cabecera: string[],
    private readonly problemas: Problema[],
    private readonly archivo: string,
  ) {
    this.indice = new Map(
      cabecera.map((c, i) => [c.trim().toLowerCase(), i] as const),
    );
  }

  private anotar(fila: number, columna: string, mensaje: string) {
    this.problemas.push({ archivo: this.archivo, fila, columna, mensaje });
  }

  /** Columnas que trae el archivo pero que nadie va a leer. Suele ser una errata. */
  columnasDesconocidas(conocidas: readonly string[]): string[] {
    return [...this.indice.keys()].filter(
      (c) => c !== "" && !conocidas.includes(c),
    );
  }

  exigirColumnas(obligatorias: readonly string[]) {
    for (const c of obligatorias) {
      if (!this.indice.has(c)) this.anotar(1, c, "falta esta columna en la cabecera");
    }
  }

  private crudo(fila: string[], columna: string): string {
    const i = this.indice.get(columna);
    return i === undefined ? "" : (fila[i] ?? "").trim();
  }

  texto(fila: string[], columna: string, n: number, obligatorio = false): string {
    const valor = this.crudo(fila, columna);
    if (obligatorio && valor === "") this.anotar(n, columna, "falta un dato obligatorio");
    return valor;
  }

  numero(
    fila: string[],
    columna: string,
    n: number,
    opciones: { obligatorio?: boolean; min?: number; max?: number } = {},
  ): number | undefined {
    // Una lista de precios trae «$ 1,290.00» tal cual sale del sistema de quien
    // la manda. Exigir el número pelado obligaría a limpiar el archivo a mano.
    const bruto = this.crudo(fila, columna).replace(/[$\s,]/g, "");
    if (bruto === "") {
      if (opciones.obligatorio) this.anotar(n, columna, "falta un dato obligatorio");
      return undefined;
    }
    const valor = Number(bruto);
    if (!Number.isFinite(valor)) {
      this.anotar(n, columna, `«${this.crudo(fila, columna)}» no es un número`);
      return undefined;
    }
    if (opciones.min !== undefined && valor < opciones.min) {
      this.anotar(n, columna, `${valor} es menor que el mínimo (${opciones.min})`);
      return undefined;
    }
    if (opciones.max !== undefined && valor > opciones.max) {
      this.anotar(n, columna, `${valor} pasa del máximo (${opciones.max})`);
      return undefined;
    }
    return valor;
  }

  /** Lista separada por `|`, sin huecos. */
  lista(fila: string[], columna: string): string[] {
    return this.crudo(fila, columna)
      .split("|")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  /**
   * Valor de un vocabulario cerrado. No adivina ni corrige: «amaderado» pasa
   * —solo cambia la caja— pero «Amaderada» se detiene y enseña las opciones.
   * Aceptar parecidos es cómo un catálogo acaba con dos familias que son la
   * misma escrita distinto.
   */
  opcion<T extends string>(
    fila: string[],
    columna: string,
    n: number,
    validos: readonly T[],
    obligatorio = true,
  ): T | undefined {
    const valor = this.crudo(fila, columna);
    if (valor === "") {
      if (obligatorio) this.anotar(n, columna, `falta. Opciones: ${validos.join(", ")}`);
      return undefined;
    }
    const encontrado = validos.find((v) => v.toLowerCase() === valor.toLowerCase());
    if (!encontrado) {
      this.anotar(n, columna, `«${valor}» no existe. Opciones: ${validos.join(", ")}`);
    }
    return encontrado;
  }

  opciones<T extends string>(
    fila: string[],
    columna: string,
    n: number,
    validos: readonly T[],
  ): T[] {
    const salida: T[] = [];
    for (const valor of this.lista(fila, columna)) {
      const encontrado = validos.find((v) => v.toLowerCase() === valor.toLowerCase());
      if (encontrado) salida.push(encontrado);
      else this.anotar(n, columna, `«${valor}» no existe. Opciones: ${validos.join(", ")}`);
    }
    return salida;
  }

  /** «si», «sí», «x», «1»… Una celda vacía es no. */
  siNo(fila: string[], columna: string): boolean {
    return /^(s[íi]|x|1|true|verdadero)$/i.test(this.crudo(fila, columna));
  }

  /**
   * Como `siNo`, pero con valor por defecto cuando la celda está vacía. Sirve
   * para `visible`: una fila nueva sin la columna llena se publica.
   */
  siNoConDefecto(fila: string[], columna: string, defecto: boolean): boolean {
    const valor = this.crudo(fila, columna);
    if (valor === "") return defecto;
    return /^(s[íi]|x|1|true|verdadero)$/i.test(valor);
  }
}

/**
 * `Héliotrope 7` → `heliotrope-7`.
 *
 * Solo se usa cuando la columna `slug` viene vacía. El slug es la dirección
 * pública del producto y una vez publicada no se cambia sin romper enlaces y
 * perder el posicionamiento acumulado.
 */
export function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `"30:390|100:790"` → `[{ml: 30, precio: 390}, {ml: 100, precio: 790}]`. */
export function leerPrecios(
  bruto: string,
  n: number,
  problemas: Problema[],
  archivo: string,
): { ml: number; precio: number }[] {
  const salida: { ml: number; precio: number }[] = [];
  for (const par of bruto.split("|").map((v) => v.trim()).filter(Boolean)) {
    const [ml, precio] = par.split(":").map((v) => v.trim());
    const nMl = Number(ml);
    const nPrecio = Number((precio ?? "").replace(/[$\s,]/g, ""));
    if (!Number.isFinite(nMl) || nMl <= 0 || !Number.isFinite(nPrecio) || nPrecio <= 0) {
      problemas.push({
        archivo,
        fila: n,
        columna: "precios",
        mensaje: `«${par}» no tiene la forma 100:1290`,
      });
      continue;
    }
    salida.push({ ml: nMl, precio: nPrecio });
  }
  return salida;
}
