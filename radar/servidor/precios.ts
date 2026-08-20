import {
  AnalyzeDocumentCommand,
  TextractClient,
  type Block,
} from "@aws-sdk/client-textract";

/**
 * Lee la lista de precios desde la foto.
 *
 * Es el ahorro de tiempo más grande de toda la app: fotografiar la hoja que el
 * proveedor tiene pegada en el mostrador, en lugar de teclear veinte renglones
 * de pie en la calle mientras alguien espera.
 *
 * **Propone, no decide.** Devuelve lo que leyó y la persona asigna cada precio a
 * su presentación. Una lista de precios de mostrador tiene tachones, columnas
 * torcidas y abreviaturas que solo entiende quien la escribió; dar por bueno lo
 * que salga de aquí metería datos falsos en la comparación de proveedores, que
 * es justo lo que esta herramienta existe para evitar.
 */

const textract = new TextractClient({});

export type FilaLeida = {
  /** Lo que dice el renglón, tal cual. */
  texto: string;
  /** El número que parece un precio, si lo hay. */
  precio: number | null;
  /** Mililitros detectados en el texto, para sugerir la presentación. */
  ml: number | null;
};

export type Lectura = {
  filas: FilaLeida[];
  /** Cuántos renglones vio en total, aunque no todos traigan precio. */
  renglones: number;
};

export async function leerLista(bucket: string, clave: string): Promise<Lectura> {
  const salida = await textract.send(
    new AnalyzeDocumentCommand({
      Document: { S3Object: { Bucket: bucket, Name: clave } },
      // TABLES entiende la hoja cuando viene en columnas; si no hay tabla, los
      // bloques LINE siguen ahí y se usan esos. Una sola llamada cubre la lista
      // impresa prolija y la escrita a mano en una libreta.
      FeatureTypes: ["TABLES"],
    }),
  );

  const bloques = salida.Blocks ?? [];
  const porTabla = filasDeTabla(bloques);
  const filas = porTabla.length > 0 ? porTabla : filasDeLineas(bloques);

  return {
    filas: filas.filter((f) => f.texto.trim() !== ""),
    renglones: bloques.filter((b) => b.BlockType === "LINE").length,
  };
}

/** Reconstruye las filas de la tabla a partir de sus celdas. */
function filasDeTabla(bloques: Block[]): FilaLeida[] {
  const porId = new Map(bloques.map((b) => [b.Id ?? "", b]));
  const celdas = bloques.filter((b) => b.BlockType === "CELL");
  if (celdas.length === 0) return [];

  const filas = new Map<number, string[]>();
  for (const celda of celdas) {
    const fila = celda.RowIndex ?? 0;
    const texto = textoDe(celda, porId);
    if (!filas.has(fila)) filas.set(fila, []);
    filas.get(fila)!.push(texto);
  }

  return [...filas.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, celdas]) => interpretar(celdas.join(" ")));
}

function filasDeLineas(bloques: Block[]): FilaLeida[] {
  return bloques
    .filter((b) => b.BlockType === "LINE" && b.Text)
    .map((b) => interpretar(b.Text!));
}

function textoDe(bloque: Block, porId: Map<string, Block>): string {
  const hijos =
    bloque.Relationships?.find((r) => r.Type === "CHILD")?.Ids ?? [];
  return hijos
    .map((id) => porId.get(id)?.Text ?? "")
    .filter(Boolean)
    .join(" ");
}

/**
 * Saca el precio y el volumen de un renglón.
 *
 * El precio se busca **al final**: en una lista de precios el número que cierra
 * el renglón es el importe, mientras que los de en medio suelen ser el volumen
 * ("Sauvage 100 ml 450"). Buscar el primer número daría 100 en vez de 450.
 */
function interpretar(texto: string): FilaLeida {
  const limpio = texto.replace(/\s+/g, " ").trim();

  const ml = limpio.match(/(\d{1,4})\s*(?:ml|ML|mililitros)/);
  // Dos formas de escribir un importe, y el orden importa: primero la que lleva
  // separador de miles (1.500 / 1,500.50) y, si no, el número tal cual.
  //
  // La versión anterior solo tenía la primera y con `\d{1,3}` suelto: un precio
  // de 2800 escrito sin separador se leía como 280. Diez veces más barato de lo
  // que era, en el campo que decide con quién se compra.
  const numeros = [
    ...limpio.matchAll(
      /\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g,
    ),
  ];

  let precio: number | null = null;
  for (let i = numeros.length - 1; i >= 0; i--) {
    const crudo = numeros[i][1];
    // El volumen no es el precio: si este número es el de los mililitros, se
    // salta y se sigue buscando hacia atrás.
    if (ml && crudo === ml[1]) continue;
    const valor = Number(
      crudo.replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."),
    );
    if (Number.isFinite(valor) && valor > 0) {
      precio = valor;
      break;
    }
  }

  return {
    texto: limpio,
    precio,
    ml: ml ? Number(ml[1]) : null,
  };
}
