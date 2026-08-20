import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

/**
 * Carrito y pedidos de cada cliente de la tienda.
 *
 * Viven en la misma tabla que las fichas de proveedores, con otro prefijo de
 * clave. No es un atajo: son pocas filas, el patrón de acceso es siempre "todo
 * lo de este usuario", y una segunda tabla solo añadiría un recurso más que
 * desplegar y vigilar para el mismo resultado.
 *
 *   PK = USER#<sub>   SK = CARRITO         → el carrito, tal cual lo tiene la app
 *   PK = USER#<sub>   SK = PEDIDO#<folio>  → un pedido cerrado
 *
 * Estas filas **no llevan `GSI1PK`**, así que el índice `porFecha` —que es
 * disperso— no las ve y `GET /proveedores` sigue devolviendo solo fichas. Es lo
 * que mantiene separados los dos mundos dentro de la misma tabla.
 */

export type ItemCarrito = {
  productoId: string;
  ml: number;
  cantidad: number;
};

export type Carrito = {
  carrito: ItemCarrito[];
  /** "Guardado para después": mismo tipo de dato, misma fila. */
  guardados: ItemCarrito[];
  favoritos: string[];
  actualizadoEn: string;
};

export type Pedido = {
  folio: string;
  fecha: string;
  estatus: string;
  total: number;
  piezas: number;
  items: ItemCarrito[];
  guia?: string;
  paqueteria?: string;
};

/* ── Saneado ────────────────────────────────────────────────────────────────
   Todo lo que llega aquí lo escribió el navegador de alguien. Se recorta a la
   forma esperada antes de guardarlo: no por miedo a un ataque —cada quien solo
   puede escribir su propia partición— sino porque un objeto arbitrario acabaría
   pintándose en la pantalla de otro dispositivo del mismo dueño, y porque una
   fila de DynamoDB no puede pasar de 400 KB. */

const MAX_ITEMS = 200;
const MAX_FAVORITOS = 500;
const MAX_CANTIDAD = 999;

const texto = (v: unknown, largo: number): string =>
  typeof v === "string" ? v.slice(0, largo) : "";

const entero = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r < min || r > max ? null : r;
};

function sanearItems(v: unknown): ItemCarrito[] {
  if (!Array.isArray(v)) return [];
  const items: ItemCarrito[] = [];
  for (const bruto of v.slice(0, MAX_ITEMS)) {
    if (typeof bruto !== "object" || bruto === null) continue;
    const i = bruto as Record<string, unknown>;
    const productoId = texto(i.productoId, 120);
    // `ml: 0` no es un error: es la marca que usa la tienda para los paquetes
    // (lotes y sets), que viajan en la misma estructura con el slug del paquete
    // en `productoId`. Exigir un volumen positivo los borraría del carrito.
    const ml = entero(i.ml, 0, 100000);
    const cantidad = entero(i.cantidad, 1, MAX_CANTIDAD);
    // Una línea sin producto o sin cantidad no es un dato incompleto que
    // convenga conservar: es basura que rompería el carrito del otro aparato.
    if (!productoId || ml === null || cantidad === null) continue;
    items.push({ productoId, ml, cantidad });
  }
  return items;
}

function sanearFavoritos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [
    ...new Set(
      v
        .slice(0, MAX_FAVORITOS)
        .map((x) => texto(x, 120))
        .filter((x) => x !== ""),
    ),
  ];
}

export function sanearCarrito(cuerpo: unknown): Omit<Carrito, "actualizadoEn"> {
  const c = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<
    string,
    unknown
  >;
  return {
    carrito: sanearItems(c.carrito),
    guardados: sanearItems(c.guardados),
    favoritos: sanearFavoritos(c.favoritos),
  };
}

const ESTATUS = new Set([
  "Pendiente",
  "Pagado",
  "En camino",
  "Entregado",
  "Cancelado",
]);

/**
 * Sanea un pedido que manda la app.
 *
 * **El total llega del cliente y aquí se cree.** Hoy no hay cobro real: el
 * checkout es una demostración y el pedido es un comprobante, no un cargo. El
 * día que exista un pago de verdad, el precio tiene que calcularse en el
 * servidor a partir del catálogo — quien pueda editar su propio JavaScript
 * puede mandar un total de cero.
 */
export function sanearPedido(cuerpo: unknown): Pedido | null {
  const p = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<
    string,
    unknown
  >;
  const folio = texto(p.folio, 60).trim();
  if (!folio) return null;

  const items = sanearItems(p.items);
  const estatus = texto(p.estatus, 20);
  const total = Number(p.total);
  const piezas = entero(p.piezas, 0, MAX_ITEMS * MAX_CANTIDAD);

  const pedido: Pedido = {
    folio,
    fecha: texto(p.fecha, 30) || new Date().toISOString().slice(0, 10),
    estatus: ESTATUS.has(estatus) ? estatus : "Pendiente",
    total: Number.isFinite(total) && total >= 0 ? Math.round(total * 100) / 100 : 0,
    piezas: piezas ?? items.reduce((n, i) => n + i.cantidad, 0),
    items,
  };
  const guia = texto(p.guia, 60);
  const paqueteria = texto(p.paqueteria, 60);
  if (guia) pedido.guia = guia;
  if (paqueteria) pedido.paqueteria = paqueteria;
  return pedido;
}

/* ── Acceso a datos ─────────────────────────────────────────────────────── */

const VACIO: Carrito = {
  carrito: [],
  guardados: [],
  favoritos: [],
  actualizadoEn: "",
};

export async function leerCarrito(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
): Promise<Carrito> {
  const salida = await dynamo.send(
    new QueryCommand({
      TableName: tabla,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: { ":pk": `USER#${sub}`, ":sk": "CARRITO" },
    }),
  );
  const fila = salida.Items?.[0];
  if (!fila) return VACIO;
  return {
    carrito: sanearItems(fila.carrito),
    guardados: sanearItems(fila.guardados),
    favoritos: sanearFavoritos(fila.favoritos),
    actualizadoEn: String(fila.actualizadoEn ?? ""),
  };
}

export async function guardarCarrito(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
  contenido: Omit<Carrito, "actualizadoEn">,
): Promise<Carrito> {
  const actualizadoEn = new Date().toISOString();
  await dynamo.send(
    new PutCommand({
      TableName: tabla,
      Item: { PK: `USER#${sub}`, SK: "CARRITO", ...contenido, actualizadoEn },
    }),
  );
  return { ...contenido, actualizadoEn };
}

export async function listarPedidos(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
): Promise<Pedido[]> {
  const salida = await dynamo.send(
    new QueryCommand({
      TableName: tabla,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": `USER#${sub}`, ":sk": "PEDIDO#" },
    }),
  );
  return (salida.Items ?? [])
    .map((f) => f.pedido as Pedido)
    .filter((p): p is Pedido => Boolean(p?.folio))
    // Del más reciente al más viejo, que es como se lee la lista de pedidos.
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.folio.localeCompare(a.folio));
}

export async function guardarPedido(
  dynamo: DynamoDBDocumentClient,
  tabla: string,
  sub: string,
  pedido: Pedido,
): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: tabla,
      Item: {
        PK: `USER#${sub}`,
        SK: `PEDIDO#${pedido.folio}`,
        pedido,
        creadoEn: new Date().toISOString(),
      },
    }),
  );
}
