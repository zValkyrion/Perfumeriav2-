"use client";

import type {
  ArticulosPedido,
  CambioPedidoAdmin,
  ContactoPedido,
  CotizacionAdmin,
  EstatusPedido,
  PedidoAdmin,
  PedidoRegistrado,
  ResumenPedido,
  SolicitudPedido,
} from "../../../compartido/pedido";
import type { Catalogo } from "../../../compartido/catalogo";
import type { IdEnvio, IdPago } from "../../../compartido/reglas";
import type {
  CambioSolicitud,
  ClienteAdmin,
  Grupo,
  ResumenVentas,
  SolicitudAdmin,
} from "../../../compartido/tienda-admin";
import type {
  CuentaEquipo,
  GrupoEquipo,
  Invitacion,
  SolicitudEquipo,
  VistaEquipo,
} from "../../../compartido/equipo";
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
  ArticulosPedido,
  Catalogo,
  ContactoPedido,
  CotizacionAdmin,
  IdEnvio,
  IdPago,
  CambioPedidoAdmin,
  CambioSolicitud,
  ClienteAdmin,
  CuentaEquipo,
  EstatusPedido,
  Grupo,
  GrupoEquipo,
  SolicitudEquipo,
  VistaEquipo,
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

/**
 * `POST /admin/cotizar`: lo que costaría con estos artículos y condiciones,
 * con los precios de ahora y sin guardar nada. 422 si no hay artículos o la
 * forma de pago no existe.
 */
export function cotizarPedido(token: string, articulos: ArticulosPedido) {
  return llamar<CotizacionAdmin>("/admin/cotizar", token, {
    method: "POST",
    body: JSON.stringify(articulos),
    msCorte: 15000,
  });
}

/**
 * `POST /admin/pedidos`: registra un pedido que llegó por WhatsApp o en
 * persona. Devuelve el folio y el total del servidor. La `clave` evita que un
 * doble clic cree dos pedidos.
 */
export function crearPedidoAdmin(token: string, solicitud: SolicitudPedido & { clave: string }) {
  return llamar<PedidoRegistrado>("/admin/pedidos", token, {
    method: "POST",
    body: JSON.stringify(solicitud),
    escritura: true,
  });
}

/**
 * El catálogo publicado (`GET /catalogo`, público y en caché un minuto):
 * para elegir artículos al capturar o editar un pedido. Se guarda en memoria
 * mientras la pestaña viva: pesa cientos de KB y no cambia a cada momento.
 */
let catalogoEnMemoria: Promise<Catalogo> | null = null;
export function leerCatalogoPublico(): Promise<Catalogo> {
  if (!BASE) return Promise.reject(new ErrorApi("El panel no tiene API configurada", 0));
  catalogoEnMemoria ??= fetch(`${BASE}/catalogo`)
    .then((r) => {
      if (!r.ok) throw new ErrorApi(`El catálogo respondió ${r.status}`, r.status);
      return r.json() as Promise<Catalogo>;
    })
    .catch((e) => {
      catalogoEnMemoria = null;
      throw e instanceof ErrorApi ? e : new ErrorApi("No se pudo leer el catálogo. Revisa la conexión.", 0);
    });
  return catalogoEnMemoria;
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

/* ── Equipo y cuentas (solo superadmin) ───────────────────────────────────── */

/** `GET /superadmin/equipo`: todas las cuentas de Cognito y las solicitudes para entrar al equipo. */
export function leerEquipo(token: string) {
  return llamar<VistaEquipo>("/superadmin/equipo", token, { msCorte: 30000 });
}

/**
 * `PUT /superadmin/grupo`. Devuelve los grupos con que queda la cuenta. 400 si
 * es la propia cuenta o la del superadmin. El cambio se nota cuando esa
 * persona vuelve a entrar.
 */
export function cambiarGrupo(token: string, sub: string, grupo: GrupoEquipo, accion: "agregar" | "quitar") {
  return llamar<{ grupos: string[] }>("/superadmin/grupo", token, {
    method: "PUT",
    body: JSON.stringify({ sub, grupo, accion }),
    escritura: true,
  });
}

/** `PUT /superadmin/acceso`: cortar (`false`) o devolver (`true`) el acceso. */
export function cambiarAcceso(token: string, sub: string, habilitada: boolean) {
  return llamar<{ habilitada: boolean }>("/superadmin/acceso", token, {
    method: "PUT",
    body: JSON.stringify({ sub, habilitada }),
    escritura: true,
  });
}

/** `POST /superadmin/invitar`. 409 si ya hay cuenta con ese correo; 422 si algo no es válido. */
export function invitarAlEquipo(token: string, invitacion: Invitacion) {
  return llamar<{ cuenta: CuentaEquipo }>("/superadmin/invitar", token, {
    method: "POST",
    body: JSON.stringify(invitacion),
    escritura: true,
  });
}

/** `PUT /superadmin/solicitudes/{sub}`: aceptar (con grupo) o rechazar. 409 si ya se resolvió. */
export function resolverSolicitudEquipo(
  token: string,
  sub: string,
  decision: { decision: "aceptar"; grupo: GrupoEquipo } | { decision: "rechazar" },
) {
  return llamar<{ solicitud: SolicitudEquipo | null; grupos?: string[] }>(
    `/superadmin/solicitudes/${encodeURIComponent(sub)}`,
    token,
    { method: "PUT", body: JSON.stringify(decision), escritura: true },
  );
}

/* ── Pedir entrar al equipo (cualquier cuenta) ────────────────────────────── */

/** `GET /equipo/solicitud`: la solicitud de quien pregunta, o `null`. */
export function leerMiSolicitud(token: string) {
  return llamar<{ solicitud: SolicitudEquipo | null }>("/equipo/solicitud", token);
}

/** `POST /equipo/solicitud`. 409 si la cuenta ya es del equipo. */
export function pedirEntrarAlEquipo(token: string, mensaje: string) {
  return llamar<{ solicitud: SolicitudEquipo }>("/equipo/solicitud", token, {
    method: "POST",
    body: JSON.stringify({ mensaje }),
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
