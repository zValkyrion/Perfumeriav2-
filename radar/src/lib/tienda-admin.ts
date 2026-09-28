"use client";

import type {
  CambioPedidoAdmin,
  EstatusPedido,
  PedidoAdmin,
  ResumenPedido,
} from "../../../compartido/pedido";
import type {
  CambioSolicitud,
  ClienteAdmin,
  Grupo,
  ResumenVentas,
  SolicitudAdmin,
} from "../../../compartido/tienda-admin";
import { ErrorGuardado } from "@/lib/catalogo-admin";
import { tokenVigente } from "@/lib/sesion";

/**
 * Cliente de `/admin/*` para la tienda: pedidos, ventas, clientes y
 * solicitudes. Los tipos vienen de `compartido/`, el mismo contrato que valida
 * la Lambda; el permiso también vive allí (grupo `admins`).
 *
 * **Errores.** Todo lo que falla lanza con el código HTTP en `estado` (0 = no
 * hubo respuesta: sin red o se agotó el tiempo), para que la pantalla distinga
 * «sin permiso» de «sin red» y nunca pinte un error como «no hay datos»:
 * - las lecturas lanzan `ErrorApi`;
 * - las escrituras lanzan `ErrorGuardado` (el mismo de `catalogo-admin.ts`):
 *   409 = otro lo cambió (recargar conservando lo tecleado), 422 = algo no es
 *   válido y `message` dice qué.
 */

export type {
  CambioPedidoAdmin,
  CambioSolicitud,
  ClienteAdmin,
  EstatusPedido,
  Grupo,
  PedidoAdmin,
  ResumenPedido,
  ResumenVentas,
  SolicitudAdmin,
};
export { ErrorGuardado };

export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    /** Código HTTP; 0 si no hubo respuesta. */
    readonly estado = 0,
  ) {
    super(mensaje);
  }
}

const BASE = process.env.NEXT_PUBLIC_API ?? "";

/**
 * Una llamada con el token renovado si estaba por vencer (dura una hora y el
 * panel se queda abierto toda la mañana). `escritura` decide qué error lanza.
 */
async function llamar<T>(
  ruta: string,
  token: string,
  init: RequestInit & { escritura?: boolean; msCorte?: number } = {},
): Promise<T> {
  const { escritura = false, msCorte = 20000, ...resto } = init;
  const Falla = escritura ? ErrorGuardado : ErrorApi;
  const fallar = (mensaje: string, estado: number) =>
    escritura ? new ErrorGuardado(mensaje, [], estado) : new ErrorApi(mensaje, estado);
  if (!BASE) throw fallar("El panel no tiene API configurada", 0);

  const vigente = await tokenVigente(token);
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), msCorte);
  try {
    const res = await fetch(`${BASE}${ruta}`, {
      ...resto,
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${vigente}` },
    });
    const cuerpo = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) throw fallar(cuerpo?.error ?? `El servidor respondió ${res.status}`, res.status);
    return cuerpo as T;
  } catch (e) {
    if (e instanceof Falla) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw fallar("El servidor no respondió a tiempo. Revisa la conexión y vuelve a intentarlo.", 0);
    }
    throw fallar("No hay conexión con el servidor. Revisa la red y vuelve a intentarlo.", 0);
  } finally {
    clearTimeout(corte);
  }
}

const consulta = (params: Record<string, string | null | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const texto = q.toString();
  return texto ? `?${texto}` : "";
};

/* ── Pedidos ──────────────────────────────────────────────────────────────── */

/**
 * `GET /admin/pedidos?desde=&hasta=` (fechas YYYY-MM-DD de México, las dos
 * inclusive; sin ellas, todos). Del más nuevo al más viejo. `truncado` si había
 * más de 5000.
 */
export function listarPedidosAdmin(token: string, rango: { desde?: string | null; hasta?: string | null } = {}) {
  return llamar<{ pedidos: ResumenPedido[]; truncado: boolean }>(
    `/admin/pedidos${consulta({ desde: rango.desde, hasta: rango.hasta })}`,
    token,
  );
}

/** `GET /admin/pedidos/{folio}`: 404 (`ErrorApi.estado`) si no existe. */
export function leerPedidoAdmin(token: string, folio: string) {
  return llamar<PedidoAdmin>(`/admin/pedidos/${encodeURIComponent(folio)}`, token);
}

/**
 * `PUT /admin/pedidos/{folio}`. Manda `actualizadoEn` tal como vino en el
 * `PedidoAdmin` que se está editando; lo que no se mande no se toca. Devuelve
 * el pedido ya cambiado (con el sello nuevo). 409 si otro lo cambió, 422 si
 * algo no es válido.
 */
export function cambiarPedidoAdmin(token: string, folio: string, cambio: CambioPedidoAdmin) {
  return llamar<PedidoAdmin>(`/admin/pedidos/${encodeURIComponent(folio)}`, token, {
    method: "PUT",
    body: JSON.stringify(cambio),
    escritura: true,
  });
}

/* ── Ventas ───────────────────────────────────────────────────────────────── */

/** `GET /admin/ventas?desde=&hasta=`. Sin rango: los últimos 30 días. Más de 400 días: 400. */
export function leerVentas(token: string, rango: { desde?: string | null; hasta?: string | null } = {}) {
  return llamar<ResumenVentas>(`/admin/ventas${consulta({ desde: rango.desde, hasta: rango.hasta })}`, token, {
    msCorte: 30000,
  });
}

/* ── Clientes ─────────────────────────────────────────────────────────────── */

/**
 * `GET /admin/clientes`: cuentas de Cognito unidas con quien compró sin cuenta.
 * `aviso` no es null si Cognito no respondió (entonces solo salen compradores).
 */
export function listarClientes(token: string) {
  return llamar<{ clientes: ClienteAdmin[]; aviso: string | null }>("/admin/clientes", token, {
    msCorte: 30000,
  });
}

/** `GET /admin/clientes/detalle?clave=`: la ficha y sus pedidos. 404 si no existe. */
export function leerCliente(token: string, clave: string) {
  return llamar<{ cliente: ClienteAdmin; pedidos: ResumenPedido[] }>(
    `/admin/clientes/detalle${consulta({ clave })}`,
    token,
  );
}

/**
 * `PUT /admin/clientes/grupos`. Devuelve los grupos con que queda la cuenta.
 * 400 si un admin intenta quitarse a sí mismo de `admins`. El cambio se nota
 * cuando esa persona vuelve a entrar.
 */
export function cambiarGrupo(token: string, sub: string, grupo: Grupo, accion: "agregar" | "quitar") {
  return llamar<{ grupos: string[] }>("/admin/clientes/grupos", token, {
    method: "PUT",
    body: JSON.stringify({ sub, grupo, accion }),
    escritura: true,
  });
}

/* ── Solicitudes ──────────────────────────────────────────────────────────── */

/** `GET /admin/solicitudes`: distribuidor, contacto y factura, de la más nueva a la más vieja. */
export function listarSolicitudes(token: string) {
  return llamar<{ solicitudes: SolicitudAdmin[] }>("/admin/solicitudes", token);
}

/** `PUT /admin/solicitudes/{id}` con `actualizadaEn` de lo que se vio. 409 / 422 como en pedidos. */
export function cambiarSolicitud(token: string, id: string, cambio: CambioSolicitud) {
  return llamar<SolicitudAdmin>(`/admin/solicitudes/${encodeURIComponent(id)}`, token, {
    method: "PUT",
    body: JSON.stringify(cambio),
    escritura: true,
  });
}
