import {
  BatchGetCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { fuenteDeCatalogo } from "../../compartido/catalogo";
import { cotizar } from "../../compartido/cotizacion";
import { estatusDe, type CambioEstatus, type ResumenPedido } from "../../compartido/pedido";
import { catalogoVigente } from "./catalogo";
import type { Identidad } from "./identidad";
import {
  armarDetalle,
  armarDetalleCopia,
  armarPedidoNuevo,
  armarPublico,
  armarResumen,
  armarResumenCopia,
  fechaMexico,
  historialDe,
  nombradorDe,
  registradoDe,
  ultimos10,
  type FilaCopia,
  type FilaPedido,
} from "./pedidos-formas";
import { guardarPedido, sanearPedido, sanearSolicitud, siguienteFolio } from "./tienda";

/**
 * Los pedidos del lado del cliente: crear, «Mis pedidos», el detalle, cancelar
 * y el rastreo sin cuenta.
 *
 * `PEDIDO#<folio>/META` es la única fuente de verdad. La copia en `USER#<sub>`
 * solo dice «este folio es mío»: al leer se va siempre al META, así lo que
 * cambie el panel se ve en el acto.
 */

export type ContextoTienda = {
  dynamo: DynamoDBDocumentClient;
  tabla: string;
  tablaCatalogo: string;
};

/** Lo que el enrutador convierte en respuesta HTTP. */
export type Salida = { estado: number; cuerpo: unknown };

const NO_ENCONTRADO: Salida = { estado: 404, cuerpo: { error: "No encontramos ese pedido" } };

const claveMeta = (folio: string) => ({ PK: `PEDIDO#${folio}`, SK: "META" });

/** Un folio como lo manda la URL: acotado, sin nada que pueda romper una clave. */
export function folioDeRuta(crudo: string): string | null {
  let folio: string;
  try {
    folio = decodeURIComponent(crudo).trim();
  } catch {
    return null;
  }
  return /^[A-Za-z0-9-]{1,60}$/.test(folio) ? folio : null;
}

export function esCondicionFallida(e: unknown): boolean {
  return e instanceof Error && e.name === "ConditionalCheckFailedException";
}

/** Las razones de una transacción cancelada, en el orden de sus operaciones. */
function razonesDe(e: unknown): string[] | null {
  if (!(e instanceof Error) || e.name !== "TransactionCanceledException") return null;
  const razones = (e as Error & { CancellationReasons?: { Code?: string }[] }).CancellationReasons;
  return (razones ?? []).map((r) => r.Code ?? "None");
}

export async function leerMeta(ctx: ContextoTienda, folio: string): Promise<FilaPedido | null> {
  const r = await ctx.dynamo.send(new GetCommand({ TableName: ctx.tabla, Key: claveMeta(folio) }));
  const fila = r.Item as FilaPedido | undefined;
  return fila?.pedido?.folio ? fila : null;
}

async function leerCopia(ctx: ContextoTienda, sub: string, folio: string): Promise<FilaCopia | null> {
  const r = await ctx.dynamo.send(
    new GetCommand({ TableName: ctx.tabla, Key: { PK: `USER#${sub}`, SK: `PEDIDO#${folio}` } }),
  );
  const fila = r.Item as FilaCopia | undefined;
  return fila?.pedido?.folio ? fila : null;
}

/**
 * Lee muchos META de una vez. `BatchGet` acepta 100 claves por llamada y puede
 * devolver parte sin procesar si la tabla se satura: se reintenta eso mismo.
 */
export async function leerMetas(ctx: ContextoTienda, folios: string[]): Promise<Map<string, FilaPedido>> {
  const encontradas = new Map<string, FilaPedido>();
  for (let i = 0; i < folios.length; i += 100) {
    let pendientes: Record<string, unknown>[] = folios.slice(i, i + 100).map(claveMeta);
    for (let vuelta = 0; pendientes.length > 0 && vuelta < 5; vuelta++) {
      const r = await ctx.dynamo.send(
        new BatchGetCommand({ RequestItems: { [ctx.tabla]: { Keys: pendientes } } }),
      );
      for (const item of (r.Responses?.[ctx.tabla] ?? []) as FilaPedido[]) {
        if (item?.pedido?.folio) encontradas.set(item.pedido.folio, item);
      }
      pendientes = (r.UnprocessedKeys?.[ctx.tabla]?.Keys ?? []) as Record<string, unknown>[];
    }
    if (pendientes.length > 0) throw new Error("DynamoDB no terminó de leer los pedidos");
  }
  return encontradas;
}

/* ── Crear ────────────────────────────────────────────────────────────── */

/**
 * Registra un pedido de la tienda.
 *
 * **El total se calcula aquí**, con `cotizar` y los precios del catálogo. Lo que
 * el navegador creyó que costaba no se lee: cualquiera puede editar su propio
 * JavaScript y mandar un cero. El folio también sale de aquí, de un contador.
 *
 * El META, la copia en «Mis pedidos» y la clave de idempotencia se escriben en
 * **una transacción**: antes eran dos `Put` sueltos y, si el segundo fallaba o
 * el navegador cortaba a los 12 s, el cliente veía un folio local mientras el
 * negocio tenía el pedido con otro.
 */
export async function crearPedido(
  ctx: ContextoTienda,
  cuerpo: unknown,
  sesion: Identidad | null,
  /** `por`: el nombre de quien lo capturó desde el panel. Sin él, lo hizo el cliente. */
  opciones: { por?: string } = {},
): Promise<Salida> {
  const sub = sesion?.sub ?? null;

  // Camino antiguo: una pestaña abierta con el JavaScript de antes todavía
  // manda su propio folio y su total para «Mis pedidos». Se reconoce por no
  // traer `contacto`, que el contrato nuevo siempre lleva.
  const bruto = (cuerpo ?? {}) as { folio?: unknown; contacto?: unknown };
  if (typeof bruto.folio === "string" && bruto.contacto === undefined) {
    return caminoAntiguo(ctx, cuerpo, sub);
  }

  const solicitud = sanearSolicitud(cuerpo);
  if (!solicitud) {
    return {
      estado: 400,
      cuerpo: { error: "Pedido inválido: faltan artículos, forma de pago o nombre y teléfono" },
    };
  }

  // Un reintento con la misma clave es el mismo pedido: se contesta el que ya
  // se registró, sin crear otro ni gastar un folio del contador.
  if (solicitud.clave) {
    const previo = await pedidoDeClave(ctx, solicitud.clave);
    if (previo) return { estado: 200, cuerpo: registradoDe(previo.pedido) };
  }

  const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
  const cotizacion = cotizar(solicitud.items, fuenteDeCatalogo(catalogo), {
    cupon: solicitud.cupon,
    metodo: solicitud.metodo,
    envio: solicitud.envio,
  });
  if (cotizacion.lineas.length === 0) {
    return { estado: 422, cuerpo: { error: "Ningún artículo del pedido existe en el catálogo" } };
  }

  const ahora = new Date();
  const creadoEn = ahora.toISOString();
  const fecha = fechaMexico(ahora);
  const folio = await siguienteFolio(ctx.dynamo, ctx.tabla, fecha.slice(0, 4));
  const pedido = armarPedidoNuevo({
    folio,
    fecha,
    creadoEn,
    solicitud,
    cotizacion,
    nombrar: nombradorDe(catalogo),
    cliente: sub ? { sub, correo: sesion?.correo ?? null } : null,
    por: opciones.por,
  });

  const operaciones: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]> = [
    {
      Put: {
        TableName: ctx.tabla,
        Item: {
          ...claveMeta(folio),
          GSI1PK: "PEDIDOS",
          GSI1SK: `${creadoEn}#${folio}`,
          pedido,
          creadoEn,
        },
        // Si el contador se reiniciara por error, esto impide pisar una venta.
        ConditionExpression: "attribute_not_exists(PK)",
      },
    },
  ];
  if (sub) {
    operaciones.push({
      Put: {
        TableName: ctx.tabla,
        Item: {
          PK: `USER#${sub}`,
          SK: `PEDIDO#${folio}`,
          creadoEn,
          pedido: {
            folio,
            fecha,
            estatus: "Pendiente",
            total: cotizacion.total,
            piezas: cotizacion.piezasTotales,
            items: solicitud.items,
          },
        },
        ConditionExpression: "attribute_not_exists(PK)",
      },
    });
  }
  const indiceClave = operaciones.length;
  if (solicitud.clave) {
    operaciones.push({
      Put: {
        TableName: ctx.tabla,
        // Sin GSI1PK: no debe salir en ninguna lista del índice por fecha.
        Item: { PK: `IDEMPOTENCIA#${solicitud.clave}`, SK: "META", folio, creadoEn },
        ConditionExpression: "attribute_not_exists(PK)",
      },
    });
  }

  try {
    await ctx.dynamo.send(new TransactWriteCommand({ TransactItems: operaciones }));
  } catch (e) {
    // Dos reintentos simultáneos con la misma clave: el otro ganó. Se contesta
    // su pedido. Este caso sí deja un hueco en la numeración (el folio ya salió
    // del contador), que es mejor que un pedido duplicado.
    const razones = razonesDe(e);
    if (solicitud.clave && razones?.[indiceClave] === "ConditionalCheckFailed") {
      const ganador = await pedidoDeClave(ctx, solicitud.clave);
      if (ganador) return { estado: 200, cuerpo: registradoDe(ganador.pedido) };
    }
    throw e;
  }

  return { estado: 201, cuerpo: registradoDe(pedido) };
}

async function pedidoDeClave(ctx: ContextoTienda, clave: string): Promise<FilaPedido | null> {
  const r = await ctx.dynamo.send(
    new GetCommand({ TableName: ctx.tabla, Key: { PK: `IDEMPOTENCIA#${clave}`, SK: "META" } }),
  );
  const folio = typeof r.Item?.folio === "string" ? r.Item.folio : null;
  return folio ? leerMeta(ctx, folio) : null;
}

/**
 * El contrato viejo (folio y total del navegador, sin contacto). Se acepta
 * como antes —solo con cuenta— para que esa compra no falle, pero **blindado**:
 *
 * - El estatus se fuerza a «Pendiente» y la guía y paquetería se descartan: si
 *   no, cualquiera se marcaba «Entregado» con guía inventada.
 * - No pisa una copia que ya exista.
 * - No se puede apuntar a un folio que tenga pedido del negocio: la copia es
 *   lo que prueba que un pedido es tuyo, y crearla para el folio de otro sería
 *   leer su dirección y su teléfono.
 */
async function caminoAntiguo(ctx: ContextoTienda, cuerpo: unknown, sub: string | null): Promise<Salida> {
  if (!sub) return { estado: 401, cuerpo: { error: "Sesión inválida o vencida" } };
  const copia = sanearPedido(cuerpo);
  if (!copia) return { estado: 400, cuerpo: { error: "Falta el folio del pedido" } };
  if (!/^[A-Za-z0-9-]{1,60}$/.test(copia.folio)) {
    return { estado: 400, cuerpo: { error: "Folio inválido" } };
  }
  if (await leerMeta(ctx, copia.folio)) {
    return { estado: 409, cuerpo: { error: "Ese folio ya es de un pedido registrado" } };
  }
  try {
    await guardarPedido(ctx.dynamo, ctx.tabla, sub, {
      folio: copia.folio,
      fecha: copia.fecha,
      estatus: "Pendiente",
      total: copia.total,
      piezas: copia.piezas,
      items: copia.items,
    });
  } catch (e) {
    // Ya estaba: el navegador reintentó. No se toca y se contesta igual.
    if (!esCondicionFallida(e)) throw e;
  }
  return { estado: 200, cuerpo: { ok: true, folio: copia.folio } };
}

/* ── «Mis pedidos» ────────────────────────────────────────────────────── */

async function copiasDe(ctx: ContextoTienda, sub: string): Promise<FilaCopia[]> {
  const copias: FilaCopia[] = [];
  let desde: Record<string, unknown> | undefined;
  do {
    const r = await ctx.dynamo.send(
      new QueryCommand({
        TableName: ctx.tabla,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `USER#${sub}`, ":sk": "PEDIDO#" },
        ExclusiveStartKey: desde,
      }),
    );
    for (const f of (r.Items ?? []) as FilaCopia[]) if (f?.pedido?.folio) copias.push(f);
    desde = r.LastEvaluatedKey;
  } while (desde);
  return copias;
}

/**
 * «Mis pedidos», con el estatus de ahora: cada copia se resuelve contra su
 * META. Los folios heredados que no tienen META se enseñan tal como se
 * guardaron.
 */
export async function misPedidos(ctx: ContextoTienda, sub: string): Promise<ResumenPedido[]> {
  const copias = await copiasDe(ctx, sub);
  const metas = await leerMetas(ctx, copias.map((c) => c.pedido.folio));
  return copias
    .map((c) => {
      const meta = metas.get(c.pedido.folio);
      return meta && esDuenoDe(meta, sub, c) ? armarResumen(meta) : armarResumenCopia(c);
    })
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn) || b.folio.localeCompare(a.folio));
}

/**
 * ¿Es de este cliente?
 *
 * Los pedidos nuevos guardan quién compró (`cliente`): eso decide. Los de
 * antes no lo tienen; ahí decide la copia en «Mis pedidos», pero solo si cuadra
 * con el pedido (misma fecha y total). Así una copia plantada a mano con el
 * folio de otra persona —el camino antiguo aceptaba cualquier folio— no abre
 * su dirección ni su teléfono.
 */
function esDuenoDe(meta: FilaPedido, sub: string, copia: FilaCopia | null): boolean {
  const p = meta.pedido;
  if (p.cliente !== undefined) return p.cliente?.sub === sub;
  return (
    copia !== null &&
    copia.pedido.fecha === p.fecha &&
    Math.abs((copia.pedido.total ?? -1) - (p.cuenta?.total ?? -2)) < 0.01
  );
}

/** El detalle de un pedido para su dueño. 404 (no 403) a quien no lo es: no se confirma que exista. */
export async function pedidoDelCliente(ctx: ContextoTienda, sub: string, folio: string): Promise<Salida> {
  const [meta, copia] = await Promise.all([leerMeta(ctx, folio), leerCopia(ctx, sub, folio)]);
  if (meta) {
    if (!esDuenoDe(meta, sub, copia)) return NO_ENCONTRADO;
    const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
    return { estado: 200, cuerpo: armarDetalle(meta, nombradorDe(catalogo)) };
  }
  if (copia) {
    const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
    return { estado: 200, cuerpo: armarDetalleCopia(copia, nombradorDe(catalogo)) };
  }
  return NO_ENCONTRADO;
}

/**
 * El cliente cancela su pedido. Solo mientras está «Pendiente»: la condición va
 * **en la escritura**, así que si el panel lo marcó pagado un segundo antes,
 * esto responde 409 en vez de cancelar un pedido que ya se cobró.
 */
export async function cancelarPedido(ctx: ContextoTienda, sub: string, folio: string): Promise<Salida> {
  const [meta, copia] = await Promise.all([leerMeta(ctx, folio), leerCopia(ctx, sub, folio)]);
  if (!meta || !esDuenoDe(meta, sub, copia)) return NO_ENCONTRADO;
  if (estatusDe(meta.pedido.estatus) !== "Pendiente") return noCancelable(meta);

  const en = new Date().toISOString();
  const cambio: CambioEstatus = { estatus: "Cancelado", en, por: "cliente" };
  try {
    const r = await ctx.dynamo.send(
      new UpdateCommand({
        TableName: ctx.tabla,
        Key: claveMeta(folio),
        UpdateExpression:
          "SET #p.#est = :cancelado, #p.#hist = list_append(if_not_exists(#p.#hist, :base), :cambio), #p.#act = :en",
        ConditionExpression: "#p.#est = :pendiente",
        ExpressionAttributeNames: { "#p": "pedido", "#est": "estatus", "#hist": "historial", "#act": "actualizadoEn" },
        ExpressionAttributeValues: {
          ":cancelado": "Cancelado",
          ":pendiente": "Pendiente",
          ":cambio": [cambio],
          // Las filas de antes no tienen historial: se empieza por su alta.
          ":base": historialDe({ ...meta.pedido, historial: undefined }, meta.creadoEn),
          ":en": en,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
    return { estado: 200, cuerpo: armarDetalle(r.Attributes as FilaPedido, nombradorDe(catalogo)) };
  } catch (e) {
    if (!esCondicionFallida(e)) throw e;
    const ahora = await leerMeta(ctx, folio);
    return ahora ? noCancelable(ahora) : NO_ENCONTRADO;
  }
}

function noCancelable(meta: FilaPedido): Salida {
  const estatus = estatusDe(meta.pedido.estatus);
  return {
    estado: 409,
    cuerpo: {
      error:
        estatus === "Cancelado"
          ? "Este pedido ya estaba cancelado."
          : `Este pedido ya no se puede cancelar: está «${estatus}». Escríbenos por WhatsApp.`,
      estatus,
    },
  };
}

/* ── Rastreo sin cuenta ───────────────────────────────────────────────── */

const SIN_COINCIDENCIA: Salida = {
  estado: 404,
  cuerpo: { error: "No encontramos un pedido con ese folio y teléfono" },
};

/**
 * `POST /pedidos/consulta { folio, telefono }`: casi todos compran sin cuenta
 * y también tienen que poder seguir su pedido.
 *
 * El folio inexistente y el teléfono equivocado responden **el mismo** 404:
 * distinguirlos le diría a quien prueba folios cuáles existen. Se comparan los
 * últimos 10 dígitos, escriba el teléfono con o sin +52, espacios o guiones.
 */
export async function consultarPedido(ctx: ContextoTienda, cuerpo: unknown): Promise<Salida> {
  const c = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>;
  const folio = typeof c.folio === "string" ? folioDeRuta(c.folio.toUpperCase()) : null;
  const telefono = typeof c.telefono === "string" ? ultimos10(c.telefono) : "";
  if (!folio || telefono.length < 10) {
    return { estado: 400, cuerpo: { error: "Escribe el folio y el teléfono a 10 dígitos" } };
  }
  const meta = await leerMeta(ctx, folio);
  if (!meta) return SIN_COINCIDENCIA;
  const delPedido = ultimos10(meta.pedido.solicitud?.contacto?.telefono ?? "");
  if (delPedido.length < 10 || delPedido !== telefono) return SIN_COINCIDENCIA;
  const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
  return { estado: 200, cuerpo: armarPublico(meta, nombradorDe(catalogo)) };
}
