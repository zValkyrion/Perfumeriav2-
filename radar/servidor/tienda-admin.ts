import { randomUUID } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CambioEstatus, PedidoAdmin } from "../../compartido/pedido";
import { estatusDe } from "../../compartido/pedido";
import {
  GRUPOS,
  type ClienteAdmin,
  type Grupo,
  type SolicitudAdmin,
} from "../../compartido/tienda-admin";
import { catalogoVigente } from "./catalogo";
import { cuentaPorSub, esSub, listarCuentas, moverDeGrupo, type ContextoCuentas } from "./cuentas";
import type { Identidad } from "./identidad";
import { esCondicionFallida, leerMeta, type ContextoTienda, type Salida } from "./pedidos";
import {
  armarAdmin,
  armarResumen,
  claveCliente,
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
  if (cambiaEstatus || cambio.nota) {
    // Una nota sin cambio de estatus también queda en el historial, con el
    // estatus de ahora: lo que el admin escribió no se tira.
    const entrada: CambioEstatus = {
      estatus: cambiaEstatus ? cambio.estatus! : actual,
      en: ahora,
      por: quien,
      ...(cambio.nota ? { nota: cambio.nota } : {}),
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
    const catalogo = await catalogoVigente(ctx.dynamo, ctx.tablaCatalogo);
    const nuevo: PedidoAdmin = armarAdmin(r.Attributes as FilaPedido, nombradorDe(catalogo));
    return { estado: 200, cuerpo: nuevo };
  } catch (e) {
    if (esCondicionFallida(e)) return { estado: 409, cuerpo: { error: OTRO_LO_CAMBIO } };
    throw e;
  }
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

/**
 * Agrega o quita a una cuenta de un grupo. El cambio se nota cuando esa
 * persona vuelve a entrar (su token lleva los grupos de cuando lo recibió).
 *
 * Un admin no puede quitarse a sí mismo de `admins`: con un solo toque se
 * quedaría sin panel y sin forma de deshacerlo desde aquí.
 */
export async function cambiarGrupo(
  cuentasCtx: ContextoCuentas,
  cuerpo: unknown,
  sesion: Identidad,
): Promise<Salida> {
  const c = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>;
  if (!esSub(c.sub)) return { estado: 400, cuerpo: { error: "Falta el sub de la cuenta" } };
  if (!(GRUPOS as readonly unknown[]).includes(c.grupo)) {
    return { estado: 400, cuerpo: { error: `Grupo desconocido: ${String(c.grupo)}` } };
  }
  if (c.accion !== "agregar" && c.accion !== "quitar") {
    return { estado: 400, cuerpo: { error: "La acción es «agregar» o «quitar»" } };
  }
  if (c.sub === sesion.sub && c.grupo === "admins" && c.accion === "quitar") {
    return { estado: 400, cuerpo: { error: "No puedes quitarte a ti mismo de admins. Pídeselo a otro administrador." } };
  }
  const cuenta = await cuentaPorSub(cuentasCtx, c.sub);
  if (!cuenta) return { estado: 404, cuerpo: { error: "Esa cuenta no existe" } };
  const grupos = await moverDeGrupo(cuentasCtx, cuenta.usuario, c.grupo as Grupo, c.accion);
  console.log("grupo", c.accion, c.grupo, "cuenta", c.sub, cuenta.correo, "por", sesion.evaluador);
  return { estado: 200, cuerpo: { grupos } };
}

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
