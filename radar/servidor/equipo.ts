import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  esCorreoSuperadmin,
  esGrupoEquipo,
  type CuentaEquipo,
  type GrupoEquipo,
  type SolicitudEquipo,
  type VistaEquipo,
} from "../../compartido/equipo";
import {
  cambiarAcceso,
  crearCuenta,
  cuentaPorSub,
  esSub,
  listarCuentas,
  moverDeGrupo,
  type ContextoCuentas,
} from "./cuentas";
import type { Identidad } from "./identidad";
import { esCondicionFallida, type ContextoTienda, type Salida } from "./pedidos";
import type { CuentaCognito } from "./ventas";

/**
 * «Equipo y cuentas»: lo que solo hace el superadmin —ver todas las cuentas,
 * aceptar o rechazar a quien pide entrar al equipo, invitar por correo, dar y
 * quitar grupos, y cortar el acceso— y la solicitud que manda quien quiere
 * entrar.
 *
 * Todo `/superadmin/*` llega aquí ya filtrado por `esSuperadmin` en el
 * enrutador. Las solicitudes viven en `Elrey_proveedores`:
 *
 *   PK = EQUIPO#<sub>  SK = SOLICITUD   GSI1: EQUIPO / <creadaEn>#<sub>
 *
 * Una por cuenta: volver a pedirla la reescribe, no apila otra.
 */

const MAX_SOLICITUDES = 2000;

const claveSolicitud = (sub: string) => ({ PK: `EQUIPO#${sub}`, SK: "SOLICITUD" });

const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const texto = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const esEquipo = (grupos: string[]) => grupos.includes("admins") || grupos.includes("proveedores");

function cuentaEquipo(c: CuentaCognito): CuentaEquipo {
  return {
    sub: c.sub,
    nombre: c.nombre,
    correo: c.correo,
    telefono: c.telefono,
    grupos: c.grupos,
    registradoEn: c.registradoEn,
    estado: c.estado,
    habilitada: c.habilitada,
    superadmin: esCorreoSuperadmin(c.correo),
  };
}

/* ── Lo que ve el superadmin ──────────────────────────────────────────── */

async function listarSolicitudesEquipo(ctx: ContextoTienda): Promise<SolicitudEquipo[]> {
  const lista: SolicitudEquipo[] = [];
  let siguiente: Record<string, unknown> | undefined;
  do {
    const r = await ctx.dynamo.send(
      new QueryCommand({
        TableName: ctx.tabla,
        IndexName: "porFecha",
        KeyConditionExpression: "GSI1PK = :p",
        ExpressionAttributeValues: { ":p": "EQUIPO" },
        ScanIndexForward: false,
        ExclusiveStartKey: siguiente,
      }),
    );
    for (const item of r.Items ?? []) {
      if (item.solicitud?.sub && lista.length < MAX_SOLICITUDES) lista.push(item.solicitud);
    }
    siguiente = lista.length < MAX_SOLICITUDES ? r.LastEvaluatedKey : undefined;
  } while (siguiente);
  return lista;
}

/** `GET /superadmin/equipo`: todas las cuentas y todas las solicitudes. */
export async function vistaEquipo(ctx: ContextoTienda, cuentasCtx: ContextoCuentas): Promise<Salida> {
  const [cuentas, solicitudes] = await Promise.all([listarCuentas(cuentasCtx), listarSolicitudesEquipo(ctx)]);
  const cuerpo: VistaEquipo = { cuentas: cuentas.map(cuentaEquipo), solicitudes };
  return { estado: 200, cuerpo };
}

/* ── Grupos ───────────────────────────────────────────────────────────── */

/**
 * Marca como aceptada la solicitud pendiente de esa cuenta, si la hay. Se
 * llama al darle un grupo del equipo por cualquier camino: que la solicitud
 * siguiera «pendiente» con la persona ya dentro haría pensar que falta algo.
 */
async function cerrarSolicitud(
  ctx: ContextoTienda,
  sub: string,
  estado: "aceptada" | "rechazada",
  grupo: GrupoEquipo | null,
  quien: string,
): Promise<SolicitudEquipo | null> {
  try {
    const r = await ctx.dynamo.send(
      new UpdateCommand({
        TableName: ctx.tabla,
        Key: claveSolicitud(sub),
        UpdateExpression: "SET #s.#estado = :estado, #s.#resueltaEn = :ahora, #s.#resueltaPor = :quien, #s.#grupo = :grupo",
        ConditionExpression: "attribute_exists(PK) AND #s.#estado = :pendiente",
        ExpressionAttributeNames: {
          "#s": "solicitud",
          "#estado": "estado",
          "#resueltaEn": "resueltaEn",
          "#resueltaPor": "resueltaPor",
          "#grupo": "grupo",
        },
        ExpressionAttributeValues: {
          ":estado": estado,
          ":ahora": new Date().toISOString(),
          ":quien": quien,
          ":grupo": grupo,
          ":pendiente": "pendiente",
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return (r.Attributes?.solicitud as SolicitudEquipo | undefined) ?? null;
  } catch (e) {
    if (esCondicionFallida(e)) return null;
    throw e;
  }
}

/**
 * Lo común a cambiar grupos y acceso: la cuenta existe, no es el superadmin
 * (su poder no se toca desde el panel) ni es uno mismo.
 */
async function cuentaEditable(
  cuentasCtx: ContextoCuentas,
  sub: unknown,
  sesion: Identidad,
): Promise<{ ok: true; cuenta: CuentaCognito } | { ok: false; salida: Salida }> {
  if (!esSub(sub)) return { ok: false, salida: { estado: 400, cuerpo: { error: "Falta el sub de la cuenta" } } };
  if (sub === sesion.sub) {
    return { ok: false, salida: { estado: 400, cuerpo: { error: "Tu propia cuenta no se cambia desde aquí." } } };
  }
  const cuenta = await cuentaPorSub(cuentasCtx, sub);
  if (!cuenta) return { ok: false, salida: { estado: 404, cuerpo: { error: "Esa cuenta no existe" } } };
  if (esCorreoSuperadmin(cuenta.correo)) {
    return {
      ok: false,
      salida: { estado: 400, cuerpo: { error: "Esa cuenta es superadmin: su permiso vive en el código, no en el panel." } },
    };
  }
  return { ok: true, cuenta };
}

/**
 * `PUT /superadmin/grupo` `{ sub, grupo, accion }`. Solo `proveedores` y
 * `admins`: `clientes` lo pone el registro y el superadmin no es un grupo. El
 * cambio se nota cuando esa persona vuelve a entrar (o al renovarse su sesión,
 * a más tardar en una hora).
 */
export async function cambiarGrupoEquipo(
  ctx: ContextoTienda,
  cuentasCtx: ContextoCuentas,
  cuerpo: unknown,
  sesion: Identidad,
): Promise<Salida> {
  const c = objeto(cuerpo);
  if (!esGrupoEquipo(c.grupo)) {
    return { estado: 400, cuerpo: { error: `Grupo desconocido: ${String(c.grupo)}` } };
  }
  if (c.accion !== "agregar" && c.accion !== "quitar") {
    return { estado: 400, cuerpo: { error: "La acción es «agregar» o «quitar»" } };
  }
  const editable = await cuentaEditable(cuentasCtx, c.sub, sesion);
  if (!editable.ok) return editable.salida;
  const { cuenta } = editable;

  const grupos = await moverDeGrupo(cuentasCtx, cuenta.usuario, c.grupo, c.accion);
  if (c.accion === "agregar") await cerrarSolicitud(ctx, cuenta.sub, "aceptada", c.grupo, sesion.evaluador);
  console.log("grupo", c.accion, c.grupo, "cuenta", cuenta.sub, cuenta.correo, "por", sesion.evaluador);
  return { estado: 200, cuerpo: { grupos } };
}

/**
 * `PUT /superadmin/acceso` `{ sub, habilitada }`. Cortar el acceso es la baja
 * de alguien del equipo sin borrar su cuenta: sus fichas siguen firmadas con
 * su nombre y se le puede devolver con un toque.
 */
export async function cambiarAccesoEquipo(
  cuentasCtx: ContextoCuentas,
  cuerpo: unknown,
  sesion: Identidad,
): Promise<Salida> {
  const c = objeto(cuerpo);
  if (typeof c.habilitada !== "boolean") {
    return { estado: 400, cuerpo: { error: "Falta decir si la cuenta queda habilitada" } };
  }
  const editable = await cuentaEditable(cuentasCtx, c.sub, sesion);
  if (!editable.ok) return editable.salida;
  await cambiarAcceso(cuentasCtx, editable.cuenta.usuario, c.habilitada);
  console.log("acceso", c.habilitada ? "devuelto" : "cortado", "cuenta", editable.cuenta.sub, editable.cuenta.correo, "por", sesion.evaluador);
  return { estado: 200, cuerpo: { habilitada: c.habilitada } };
}

/* ── Invitar ──────────────────────────────────────────────────────────── */

/**
 * `POST /superadmin/invitar` `{ correo, nombre, grupo }`: crea la cuenta, le
 * llega por correo una contraseña temporal y queda ya en su grupo. Si el
 * correo ya tiene cuenta (se registró en la tienda), 409: se le da el grupo
 * desde la lista, sin tocar su contraseña.
 */
export async function invitar(cuentasCtx: ContextoCuentas, cuerpo: unknown, sesion: Identidad): Promise<Salida> {
  const c = objeto(cuerpo);
  const correo = texto(c.correo, 254).toLowerCase();
  const nombre = texto(c.nombre, 80);
  if (!CORREO.test(correo)) return { estado: 422, cuerpo: { error: "Ese correo no parece válido" } };
  if (nombre.length < 2) return { estado: 422, cuerpo: { error: "Falta el nombre: es lo que firma cada ficha" } };
  if (!esGrupoEquipo(c.grupo)) return { estado: 422, cuerpo: { error: "Elige si entra como equipo o como administrador" } };

  const cuenta = await crearCuenta(cuentasCtx, correo, nombre);
  if (!cuenta) {
    return {
      estado: 409,
      cuerpo: { error: "Ya hay una cuenta con ese correo. Búscala en la lista y dale el permiso desde ahí." },
    };
  }
  const grupos = await moverDeGrupo(cuentasCtx, cuenta.usuario, c.grupo, "agregar");
  console.log("invitación", c.grupo, "cuenta", cuenta.sub, correo, "por", sesion.evaluador);
  return { estado: 201, cuerpo: { cuenta: cuentaEquipo({ ...cuenta, grupos }) } };
}

/* ── Solicitudes ──────────────────────────────────────────────────────── */

/**
 * `PUT /superadmin/solicitudes/<sub>` `{ decision, grupo? }`. Aceptar le da el
 * grupo (por defecto `proveedores`) y cierra la solicitud; rechazar solo la
 * cierra: la persona sigue siendo cliente de la tienda y puede volver a pedir.
 */
export async function resolverSolicitud(
  ctx: ContextoTienda,
  cuentasCtx: ContextoCuentas,
  sub: string,
  cuerpo: unknown,
  sesion: Identidad,
): Promise<Salida> {
  const c = objeto(cuerpo);
  if (c.decision !== "aceptar" && c.decision !== "rechazar") {
    return { estado: 400, cuerpo: { error: "La decisión es «aceptar» o «rechazar»" } };
  }
  const previa = await ctx.dynamo.send(new GetCommand({ TableName: ctx.tabla, Key: claveSolicitud(sub) }));
  const solicitud = previa.Item?.solicitud as SolicitudEquipo | undefined;
  if (!solicitud) return { estado: 404, cuerpo: { error: "No existe esa solicitud" } };
  if (solicitud.estado !== "pendiente") {
    return { estado: 409, cuerpo: { error: `Esa solicitud ya está ${solicitud.estado}. Recarga para ver lo último.` } };
  }

  if (c.decision === "rechazar") {
    const cerrada = await cerrarSolicitud(ctx, sub, "rechazada", null, sesion.evaluador);
    if (!cerrada) return { estado: 409, cuerpo: { error: "Alguien más la resolvió. Recarga para ver lo último." } };
    return { estado: 200, cuerpo: { solicitud: cerrada } };
  }

  let grupo: GrupoEquipo = "proveedores";
  if (c.grupo !== undefined) {
    if (!esGrupoEquipo(c.grupo)) return { estado: 400, cuerpo: { error: `Grupo desconocido: ${String(c.grupo)}` } };
    grupo = c.grupo;
  }

  const editable = await cuentaEditable(cuentasCtx, sub, sesion);
  if (!editable.ok) return editable.salida;
  const grupos = await moverDeGrupo(cuentasCtx, editable.cuenta.usuario, grupo, "agregar");
  const cerrada = await cerrarSolicitud(ctx, sub, "aceptada", grupo, sesion.evaluador);
  console.log("solicitud de equipo aceptada", grupo, "cuenta", sub, editable.cuenta.correo, "por", sesion.evaluador);
  return { estado: 200, cuerpo: { solicitud: cerrada, grupos } };
}

/** `GET /equipo/solicitud`: la de quien pregunta, o `null`. */
export async function miSolicitud(ctx: ContextoTienda, sesion: Identidad): Promise<Salida> {
  const r = await ctx.dynamo.send(new GetCommand({ TableName: ctx.tabla, Key: claveSolicitud(sesion.sub) }));
  return { estado: 200, cuerpo: { solicitud: (r.Item?.solicitud as SolicitudEquipo | undefined) ?? null } };
}

/**
 * `POST /equipo/solicitud` `{ mensaje? }`: una cuenta de la tienda pide entrar
 * al equipo. Nombre y correo salen del token, no del cuerpo: el superadmin
 * tiene que ver quién es de verdad, no lo que cada quien escriba.
 */
export async function pedirIngreso(ctx: ContextoTienda, cuerpo: unknown, sesion: Identidad): Promise<Salida> {
  if (esEquipo(sesion.grupos)) {
    return { estado: 409, cuerpo: { error: "Tu cuenta ya es del equipo. Sal y vuelve a entrar para que tu sesión lo traiga." } };
  }
  const previa = await ctx.dynamo.send(new GetCommand({ TableName: ctx.tabla, Key: claveSolicitud(sesion.sub) }));
  const anterior = previa.Item?.solicitud as SolicitudEquipo | undefined;
  if (anterior?.estado === "pendiente") return { estado: 200, cuerpo: { solicitud: anterior } };

  const mensaje = texto(objeto(cuerpo).mensaje, 500) || null;
  const creadaEn = new Date().toISOString();
  const solicitud: SolicitudEquipo = {
    sub: sesion.sub,
    nombre: sesion.evaluador,
    correo: sesion.correo ?? "",
    mensaje,
    estado: "pendiente",
    creadaEn,
    resueltaEn: null,
    resueltaPor: null,
    grupo: null,
  };
  await ctx.dynamo.send(
    new PutCommand({
      TableName: ctx.tabla,
      Item: {
        ...claveSolicitud(sesion.sub),
        // Su propia partición del índice: ni `PROVEEDORES` ni `PEDIDOS` ni
        // `SOLICITUDES` (las de la tienda).
        GSI1PK: "EQUIPO",
        GSI1SK: `${creadaEn}#${sesion.sub}`,
        solicitud,
      },
    }),
  );
  return { estado: 201, cuerpo: { solicitud } };
}
