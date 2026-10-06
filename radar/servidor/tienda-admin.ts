import { randomUUID } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CambioEstatus, CotizacionAdmin, PedidoAdmin } from "../../compartido/pedido";
import { articulosEditables, contactoEditable, estatusDe } from "../../compartido/pedido";
import { fuenteDeCatalogo } from "../../compartido/catalogo";
import { cotizar, type ItemPedido } from "../../compartido/cotizacion";
import { cuentaDe, type PedidoTienda } from "./tienda";
import type { ClienteAdmin, SolicitudAdmin } from "../../compartido/tienda-admin";
import { catalogoVigente } from "./catalogo";
import { cuentaPorSub, esSub, listarCuentas, type ContextoCuentas } from "./cuentas";
import { crearPedido, esCondicionFallida, leerMeta, type ContextoTienda, type Salida } from "./pedidos";
import {
  armarAdmin,
  armarResumen,
  cifrasDe,
  claveCliente,
  lineasDe,
  sanearArticulos,
  esFecha,
  fechaMexico,
  historialDe,
  nombradorDe,
  sanearCambioAdmin,
  sanearCambioSolicitud,
  sanearSolicitudEntrada,
  sumarDias,
  type FilaPedido,
} from "./pedidos-formas";
import { clientesDe, resumenVentas, type CuentaCognito } from "./ventas";

/**
 * Lo que el panel hace con la tienda: pedidos, ventas, clientes y
 * solicitudes. Todo va detrás de `/admin/*`, que el enrutador ya cerró a
 * cuentas de Cognito del grupo `admins`.
 */

/** Tope de pedidos que se leen de una vez. A este volumen son años de ventas. */
const MAX_PEDIDOS = 5000;
const MAX_SOLICITUDES = 2000;
const MAX_DIAS_VENTAS = 400;

const OTRO_LO_CAMBIO = "Alguien más cambió este pedido. Recarga para ver lo último.";

/* ── Pedidos ──────────────────────────────────────────────────────────── */

/**
 * Los pedidos del índice por fecha, del más nuevo al más viejo.
 *
 * El rango es de calendario de México (`pedido.fecha`) y el índice ordena por
 * `creadoEn` en UTC: la consulta pide un día de margen a cada lado y el corte
 * fino se hace aquí con la fecha del pedido.
 */
export async function consultarPedidos(
  ctx: ContextoTienda,
  rango: { desde?: string | null; hasta?: string | null } = {},
  max = MAX_PEDIDOS,
): Promise<{ filas: FilaPedido[]; truncado: boolean }> {
  const { desde, hasta } = rango;
  const valores: Record<string, unknown> = { ":p": "PEDIDOS" };
  let condicion = "GSI1PK = :p";
  if (desde) valores[":a"] = sumarDias(desde, -1);
  // «~» ordena después de cualquier hora: incluye todo el día siguiente.
  if (hasta) valores[":b"] = `${sumarDias(hasta, 1)}~`;
  if (desde && hasta) condicion += " AND GSI1SK BETWEEN :a AND :b";
  else if (desde) condicion += " AND GSI1SK >= :a";
  else if (hasta) condicion += " AND GSI1SK <= :b";

  const filas: FilaPedido[] = [];
  let siguiente: Record<string, unknown> | undefined;
  let truncado = false;
  do {
    const r = await ctx.dynamo.send(
      new QueryCommand({
        TableName: ctx.tabla,
        IndexName: "porFecha",
        KeyConditionExpression: condicion,
        ExpressionAttributeValues: valores,
        ScanIndexForward: false,
        ExclusiveStartKey: siguiente,
      }),
    );
    for (const item of (r.Items ?? []) as FilaPedido[]) {
      if (filas.length >= max) {
        truncado = true;
        break;
      }
      if (item?.pedido?.folio) filas.push(item);
    }
    siguiente = r.LastEvaluatedKey;
    if (filas.length >= max && siguiente) truncado = true;
  } while (siguiente && !truncado);

  return {
    filas: filas.filter(
      (f) => (!desde || f.pedido.fecha >= desde) && (!hasta || f.pedido.fecha <= hasta),
    ),
    truncado,
  };
}

/** `?desde=&hasta=` validado. Vacío = sin límite por ese lado. */
function rangoDe(q: Record<string, string | undefined>):
  | { ok: true; desde: string | null; hasta: string | null }
  | { ok: false; salida: Salida } {
  const desde = q.desde || null;
  const hasta = q.hasta || null;
  for (const [nombre, v] of [["desde", desde], ["hasta", hasta]] as const) {
    if (v !== null && !esFecha(v)) {
      return { ok: false, salida: { estado: 400, cuerpo: { error: `«${nombre}» tiene que ser una fecha AAAA-MM-DD` } } };
    }
  }
  if (desde && hasta && desde > hasta) {
    return { ok: false, salida: { estado: 400, cuerpo: { error: "«desde» va antes que «hasta»" } } };
  }
  return { ok: true, desde, hasta };
}

export async function listarPedidosAdmin(
  ctx: ContextoTienda,
  q: Record<string, string | undefined>,
): Promise<Salida> {
  const rango = rangoDe(q);
  if (!rango.ok) return rango.salida;
  const { filas, truncado } = await consultarPedidos(ctx, rango);
  return { estado: 200, cuerpo: { pedidos: filas.map(armarResumen), truncado } };
}

export async function pedidoAdmin(ctx: ContextoTienda, folio: string): Promise<Salida> {
  const meta = await leerMeta(ctx, folio);
  if (!meta) return { estado: 404, cuerpo: { error: `No existe el pedido ${folio}` } };
  const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
  return { estado: 200, cuerpo: armarAdmin(meta, nombradorDe(catalogo)) };
}

/**
 * Cambia estatus, guía, paquetería y notas de un pedido.
 *
 * **No pisa a otro administrador**: la escritura exige que el pedido siga
 * como lo vio quien lo edita (`actualizadoEn`). Si alguien lo cambió en medio
 * —otro admin, o el cliente al cancelar— responde 409 y el panel recarga.
 * Las filas de antes no tienen sello: para ellas vale lo que el panel recibió
 * como `actualizadoEn` (su `creadoEn`) mientras nadie las haya tocado.
 *
 * Las cifras (`cuenta`) no se tocan nunca: son lo que se cobró.
 */
export async function cambiarPedidoAdmin(
  ctx: ContextoTienda,
  folio: string,
  cuerpo: unknown,
  quien: string,
): Promise<Salida> {
  const saneado = sanearCambioAdmin(cuerpo);
  if (!saneado.ok) return { estado: 422, cuerpo: { error: saneado.error } };
  const cambio = saneado.valor;

  const meta = await leerMeta(ctx, folio);
  if (!meta) return { estado: 404, cuerpo: { error: `No existe el pedido ${folio}` } };
  const p = meta.pedido;

  // El sello contra el que se escribe.
  const sello = p.actualizadoEn ?? null;
  if (sello !== null ? cambio.actualizadoEn !== sello : cambio.actualizadoEn !== null && cambio.actualizadoEn !== meta.creadoEn) {
    return { estado: 409, cuerpo: { error: OTRO_LO_CAMBIO } };
  }

  const ahora = new Date().toISOString();
  const nombres: Record<string, string> = { "#p": "pedido", "#act": "actualizadoEn" };
  const valores: Record<string, unknown> = { ":ahora": ahora };
  const sets: string[] = ["#p.#act = :ahora"];

  const actual = estatusDe(p.estatus);
  const cambiaEstatus = cambio.estatus !== undefined && cambio.estatus !== actual;

  // Lo que se edita del pedido en sí. Se valida contra el estatus **actual**
  // (no el que se pide en el mismo cambio): primero se corrige, después se
  // mueve.
  const notasAuto: string[] = [];
  if (cambio.contacto) {
    if (!contactoEditable(actual)) {
      return { estado: 409, cuerpo: { error: `Un pedido «${actual}» ya no cambia de datos de entrega.` } };
    }
    nombres["#sol"] = "solicitud";
    nombres["#con"] = "contacto";
    valores[":contacto"] = cambio.contacto;
    sets.push("#p.#sol.#con = :contacto");
    notasAuto.push("Datos de entrega corregidos.");
  }

  let recotizado: PedidoTienda["cuenta"] | null = null;
  if (cambio.articulos) {
    if (!articulosEditables(actual)) {
      return {
        estado: 409,
        cuerpo: { error: `Los artículos solo se cambian mientras el pedido está «Pendiente»; este está «${actual}».` },
      };
    }
    const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
    const a = cambio.articulos;
    const cotizacion = cotizar(a.items, fuenteDeCatalogo(catalogo), { cupon: a.cupon, metodo: a.metodo, envio: a.envio });
    if (cotizacion.lineas.length === 0) {
      return { estado: 422, cuerpo: { error: "Ningún artículo existe (o está disponible) en el catálogo" } };
    }
    recotizado = cuentaDe(cotizacion, nombradorDe(catalogo));
    nombres["#sol"] = "solicitud";
    nombres["#items"] = "items";
    nombres["#met"] = "metodo";
    nombres["#env"] = "envio";
    nombres["#cup"] = "cupon";
    nombres["#pla"] = "plazo";
    nombres["#cuenta"] = "cuenta";
    valores[":items"] = a.items;
    valores[":met"] = a.metodo;
    valores[":env"] = a.envio;
    valores[":cup"] = a.cupon;
    // Los meses sin intereses solo existen con Clip: al cambiar de forma de
    // pago se van. Con Clip se conservan los que había.
    valores[":pla"] = a.metodo === "clip" ? (p.solicitud?.plazo ?? null) : null;
    valores[":cuenta"] = recotizado;
    sets.push(
      "#p.#sol.#items = :items",
      "#p.#sol.#met = :met",
      "#p.#sol.#env = :env",
      "#p.#sol.#cup = :cup",
      "#p.#sol.#pla = :pla",
      "#p.#cuenta = :cuenta",
    );
    const antes = p.cuenta?.total ?? 0;
    notasAuto.push(
      `Artículos modificados: ${recotizado.piezasTotales} piezas, total ${pesos(antes)} → ${pesos(recotizado.total)}.`,
    );
  }

  const nota = [cambio.nota, ...notasAuto].filter(Boolean).join("\n");
  if (cambiaEstatus || nota) {
    // Una nota sin cambio de estatus también queda en el historial, con el
    // estatus de ahora: lo que el admin escribió no se tira. Las correcciones
    // del pedido dejan la suya sola, para que se vea quién cambió qué.
    const entrada: CambioEstatus = {
      estatus: cambiaEstatus ? cambio.estatus! : actual,
      en: ahora,
      por: quien,
      ...(nota ? { nota } : {}),
    };
    nombres["#hist"] = "historial";
    valores[":base"] = historialDe({ ...p, historial: undefined }, meta.creadoEn);
    valores[":cambio"] = [entrada];
    sets.push("#p.#hist = list_append(if_not_exists(#p.#hist, :base), :cambio)");
  }
  if (cambiaEstatus) {
    nombres["#est"] = "estatus";
    valores[":est"] = cambio.estatus;
    sets.push("#p.#est = :est");
  }
  for (const campo of ["guia", "paqueteria", "notaInterna", "notaCliente"] as const) {
    if (cambio[campo] === undefined) continue;
    nombres[`#${campo}`] = campo;
    valores[`:${campo}`] = cambio[campo];
    sets.push(`#p.#${campo} = :${campo}`);
  }

  let condicion: string;
  if (sello !== null) {
    condicion = "#p.#act = :visto";
    valores[":visto"] = sello;
  } else {
    condicion = "attribute_not_exists(#p.#act)";
  }

  try {
    const r = await ctx.dynamo.send(
      new UpdateCommand({
        TableName: ctx.tabla,
        Key: { PK: `PEDIDO#${folio}`, SK: "META" },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: condicion,
        ExpressionAttributeNames: nombres,
        ExpressionAttributeValues: valores,
        ReturnValues: "ALL_NEW",
      }),
    );
    if (cambiaEstatus) {
      // Queda en los registros de la Lambda: quién movió qué, aunque se borre la fila.
      console.log("pedido", folio, "de", actual, "a", cambio.estatus, "por", quien);
    }
    if (recotizado) {
      console.log("pedido", folio, "artículos cambiados por", quien, "total", recotizado.total);
      await actualizarCopia(ctx, p, recotizado, cambio.articulos!.items);
    }
    const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
    const nuevo: PedidoAdmin = armarAdmin(r.Attributes as FilaPedido, nombradorDe(catalogo));
    return { estado: 200, cuerpo: nuevo };
  } catch (e) {
    if (esCondicionFallida(e)) return { estado: 409, cuerpo: { error: OTRO_LO_CAMBIO } };
    throw e;
  }
}

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

/**
 * La copia del pedido en «Mis pedidos» (`USER#<sub>`) guarda artículos, total
 * y piezas para la lista y para «Volver a pedir». Si el pedido cambió de
 * artículos, se pone al día; si el cliente no tiene cuenta o la copia ya no
 * existe, no hay nada que hacer. Un fallo aquí no deshace el cambio: «Mis
 * pedidos» lee estatus y cifras del META, y lo que quedaría desfasado es solo
 * el botón de volver a pedir.
 */
async function actualizarCopia(
  ctx: ContextoTienda,
  p: PedidoTienda,
  cuenta: PedidoTienda["cuenta"],
  items: ItemPedido[],
): Promise<void> {
  const sub = p.cliente?.sub;
  if (!sub) return;
  try {
    await ctx.dynamo.send(
      new UpdateCommand({
        TableName: ctx.tabla,
        Key: { PK: `USER#${sub}`, SK: `PEDIDO#${p.folio}` },
        UpdateExpression: "SET #p.#total = :total, #p.#piezas = :piezas, #p.#items = :items",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeNames: { "#p": "pedido", "#total": "total", "#piezas": "piezas", "#items": "items" },
        ExpressionAttributeValues: { ":total": cuenta.total, ":piezas": cuenta.piezasTotales, ":items": items },
      }),
    );
  } catch (e) {
    if (!esCondicionFallida(e)) console.error("no se pudo poner al día la copia de", p.folio, e);
  }
}

/**
 * `POST /admin/cotizar`: lo que costaría un pedido con estos artículos y
 * condiciones, con los precios de ahora y sin guardar nada. Es lo que el panel
 * enseña mientras se arma o se edita un pedido: la cuenta la hace `cotizar`,
 * la misma función que cobra, para que lo que se ve sea lo que se guarda.
 */
export async function cotizarAdmin(ctx: ContextoTienda, cuerpo: unknown): Promise<Salida> {
  const a = sanearArticulos(cuerpo);
  if (!a.ok) return { estado: 422, cuerpo: { error: a.error } };
  const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
  const { items, cupon, metodo, envio } = a.valor;
  const cotizacion = cotizar(items, fuenteDeCatalogo(catalogo), { cupon, metodo, envio });
  const cuenta = cuentaDe(cotizacion, nombradorDe(catalogo));
  const comoPedido = { cuenta } as PedidoTienda;
  const salida: CotizacionAdmin = {
    lineas: lineasDe(comoPedido),
    cifras: cifrasDe(comoPedido),
    descartados: cuenta.descartados,
    metodo: cotizacion.metodo,
  };
  return { estado: 200, cuerpo: salida };
}

/**
 * `POST /admin/pedidos`: el equipo registra un pedido que llegó por WhatsApp,
 * teléfono o en persona. Pasa por el mismo camino que la tienda —saneado,
 * cotización en el servidor, folio del contador, clave de idempotencia— y el
 * historial dice quién lo capturó.
 */
export async function crearPedidoAdmin(ctx: ContextoTienda, cuerpo: unknown, quien: string): Promise<Salida> {
  return crearPedido(ctx, cuerpo, null, { por: quien });
}

/* ── Ventas ───────────────────────────────────────────────────────────── */

export async function ventas(ctx: ContextoTienda, q: Record<string, string | undefined>): Promise<Salida> {
  const hoy = fechaMexico(new Date());
  const desde = q.desde || sumarDias(hoy, -29);
  const hasta = q.hasta || hoy;
  const rango = rangoDe({ desde, hasta });
  if (!rango.ok) return rango.salida;
  const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000 + 1;
  if (dias > MAX_DIAS_VENTAS) {
    return { estado: 400, cuerpo: { error: `El rango no puede pasar de ${MAX_DIAS_VENTAS} días` } };
  }
  // Se leen todos (no solo el rango): «recurrente» se mide contra el histórico.
  const [{ filas, truncado }, catalogo] = await Promise.all([
    consultarPedidos(ctx),
    catalogoVigente(ctx.dynamo, ctx.tablaCatalogo),
  ]);
  return {
    estado: 200,
    cuerpo: resumenVentas(filas, desde, hasta, { nombrar: nombradorDe(catalogo), truncado }),
  };
}

/* ── Clientes ─────────────────────────────────────────────────────────── */

export async function clientes(ctx: ContextoTienda, cuentasCtx: ContextoCuentas): Promise<Salida> {
  const [{ filas }, cuentas] = await Promise.all([
    consultarPedidos(ctx),
    listarCuentas(cuentasCtx).then(
      (c) => ({ ok: true as const, c }),
      (e: unknown) => {
        console.error("no se pudieron leer las cuentas de Cognito", e);
        return { ok: false as const, c: [] as CuentaCognito[] };
      },
    ),
  ]);
  // Sin Cognito todavía se puede enseñar a quien compró; se avisa, no se
  // disfraza de «no hay cuentas».
  return {
    estado: 200,
    cuerpo: {
      clientes: clientesDe(filas, cuentas.c),
      aviso: cuentas.ok ? null : "No se pudieron leer las cuentas registradas: solo salen los compradores.",
    },
  };
}

export async function detalleCliente(
  ctx: ContextoTienda,
  cuentasCtx: ContextoCuentas,
  clave: string,
): Promise<Salida> {
  if (!clave) return { estado: 400, cuerpo: { error: "Falta la clave del cliente" } };
  const esTel = clave.startsWith("tel:") || clave.startsWith("folio:");
  const [{ filas }, cuenta] = await Promise.all([
    consultarPedidos(ctx),
    esTel || !esSub(clave) ? Promise.resolve(null) : cuentaPorSub(cuentasCtx, clave),
  ]);
  const suyas = filas.filter((f) => claveCliente(f.pedido) === clave);
  if (!cuenta && suyas.length === 0) {
    return { estado: 404, cuerpo: { error: "No encontramos a ese cliente" } };
  }
  const [cliente] = clientesDe(suyas, cuenta ? [cuenta] : []).filter((c: ClienteAdmin) => c.clave === clave);
  return { estado: 200, cuerpo: { cliente, pedidos: suyas.map(armarResumen) } };
}

// Los grupos ya no se cambian aquí: desde el 2026-10-05 los reparte solo el
// superadmin, en `equipo.ts` (`PUT /superadmin/grupo`).

/* ── Solicitudes ──────────────────────────────────────────────────────── */

/**
 * `POST /solicitudes` (pública): «Quiero ser distribuidor», contacto y
 * factura. Si quien la manda tiene sesión, se guarda su `sub` para ligarla a
 * su cuenta.
 */
export async function crearSolicitud(
  ctx: ContextoTienda,
  cuerpo: unknown,
  sub: string | null,
): Promise<Salida> {
  const saneado = sanearSolicitudEntrada(cuerpo);
  if (!saneado.ok) return { estado: 400, cuerpo: { error: saneado.error } };
  const creadaEn = new Date().toISOString();
  const id = randomUUID();
  const solicitud: SolicitudAdmin = {
    ...saneado.valor,
    id,
    creadaEn,
    actualizadaEn: creadaEn,
    estado: "nueva",
    nota: null,
    sub,
  };
  await ctx.dynamo.send(
    new PutCommand({
      TableName: ctx.tabla,
      Item: {
        PK: `SOLICITUD#${id}`,
        SK: "META",
        // Su propia partición del índice: ni `PROVEEDORES` ni `PEDIDOS`.
        GSI1PK: "SOLICITUDES",
        GSI1SK: `${creadaEn}#${id}`,
        solicitud,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );
  return { estado: 201, cuerpo: { ok: true, id } };
}

export async function listarSolicitudes(ctx: ContextoTienda): Promise<Salida> {
  const solicitudes: SolicitudAdmin[] = [];
  let siguiente: Record<string, unknown> | undefined;
  do {
    const r = await ctx.dynamo.send(
      new QueryCommand({
        TableName: ctx.tabla,
        IndexName: "porFecha",
        KeyConditionExpression: "GSI1PK = :p",
        ExpressionAttributeValues: { ":p": "SOLICITUDES" },
        ScanIndexForward: false,
        ExclusiveStartKey: siguiente,
      }),
    );
    for (const item of r.Items ?? []) {
      if (item.solicitud?.id && solicitudes.length < MAX_SOLICITUDES) solicitudes.push(item.solicitud);
    }
    siguiente = solicitudes.length < MAX_SOLICITUDES ? r.LastEvaluatedKey : undefined;
  } while (siguiente);
  return { estado: 200, cuerpo: { solicitudes } };
}

export async function cambiarSolicitud(ctx: ContextoTienda, id: string, cuerpo: unknown): Promise<Salida> {
  const saneado = sanearCambioSolicitud(cuerpo);
  if (!saneado.ok) return { estado: 422, cuerpo: { error: saneado.error } };
  const { estado, nota, actualizadaEn } = saneado.valor;
  const clave = { PK: `SOLICITUD#${id}`, SK: "META" };

  const previa = await ctx.dynamo.send(new GetCommand({ TableName: ctx.tabla, Key: clave }));
  if (!previa.Item?.solicitud) return { estado: 404, cuerpo: { error: "No existe esa solicitud" } };

  const ahora = new Date().toISOString();
  const nombres: Record<string, string> = { "#s": "solicitud", "#act": "actualizadaEn" };
  const valores: Record<string, unknown> = { ":ahora": ahora, ":visto": actualizadaEn };
  const sets = ["#s.#act = :ahora"];
  if (estado !== undefined) {
    nombres["#estado"] = "estado";
    valores[":estado"] = estado;
    sets.push("#s.#estado = :estado");
  }
  if (nota !== undefined) {
    nombres["#nota"] = "nota";
    valores[":nota"] = nota;
    sets.push("#s.#nota = :nota");
  }
  try {
    const r = await ctx.dynamo.send(
      new UpdateCommand({
        TableName: ctx.tabla,
        Key: clave,
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "#s.#act = :visto",
        ExpressionAttributeNames: nombres,
        ExpressionAttributeValues: valores,
        ReturnValues: "ALL_NEW",
      }),
    );
    return { estado: 200, cuerpo: r.Attributes?.solicitud as SolicitudAdmin };
  } catch (e) {
    if (esCondicionFallida(e)) {
      return { estado: 409, cuerpo: { error: "Alguien más cambió esta solicitud. Recarga para ver lo último." } };
    }
    throw e;
  }
}
