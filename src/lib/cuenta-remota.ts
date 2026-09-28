"use client";

import type { Direccion, ItemCarrito, Pedido } from "@/types";
import { tokenVigente } from "@/lib/sesion";
import type {
  PedidoDetalle,
  PedidoPublico,
  PedidoRegistrado,
  ResumenPedido,
  SolicitudPedido,
} from "../../compartido/pedido";
import type { SolicitudEntrada } from "../../compartido/tienda-admin";

/**
 * Carrito y pedidos guardados en el servidor, por usuario.
 *
 * Resuelve lo que el `localStorage` no puede: el carrito armado en el teléfono
 * mientras se veía el catálogo en el sofá aparece en la computadora al pagar, y
 * los pedidos dejan de ser una lista de muestra.
 *
 * **El servidor es la copia, no el jefe.** La tienda sigue funcionando entera
 * sin red y sin cuenta: el carrito vive en `localStorage` como siempre, y esto
 * solo entra cuando hay sesión. Si la API no responde, no pasa nada visible —
 * quien está comprando no tiene por qué enterarse de que hubo un reintento.
 */

const BASE = process.env.NEXT_PUBLIC_API ?? "";

export function haySincronizacion(): boolean {
  return BASE !== "";
}

export type CarritoRemoto = {
  carrito: ItemCarrito[];
  guardados: ItemCarrito[];
  favoritos: string[];
  actualizadoEn: string;
};

/**
 * El token de la sesión, renovado si estaba por vencer: dura una hora, y sin
 * esto quien dejaba la pestaña abierta perdía el carrito remoto en silencio.
 */
async function token(): Promise<string | null> {
  try {
    return await tokenVigente();
  } catch {
    return null;
  }
}

/**
 * Un fallo al hablar con el servidor, con el código HTTP en `estado`.
 *
 * `estado` 0 = no hubo respuesta (sin red, sin servidor configurado o se agotó
 * el tiempo); 401 = sin sesión o vencida; 404 = ese pedido no existe o no es
 * de esta cuenta; 409 = ya no se puede (p. ej. cancelar un pedido pagado). Las
 * pantallas lo usan para no presentar un error de red como «no hay pedidos».
 */
export class ErrorRemoto extends Error {
  constructor(
    mensaje: string,
    readonly estado = 0,
  ) {
    super(mensaje);
  }
}

/**
 * Una llamada a la API. Con `publica`, va aunque no haya sesión (y lleva el
 * token si lo hay); sin ella, exige sesión.
 */
async function llamar<T>(
  ruta: string,
  opciones: RequestInit & { publica?: boolean } = {},
): Promise<T> {
  const { publica = false, ...init } = opciones;
  if (!BASE) throw new ErrorRemoto("Sin servidor", 0);
  const t = await token();
  if (!t && !publica) throw new ErrorRemoto("Sin sesión", 401);

  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${BASE}${ruta}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        ...(t ? { authorization: `Bearer ${t}` } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const detalle = await res.json().catch(() => null);
      throw new ErrorRemoto(detalle?.error ?? `El servidor respondió ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ErrorRemoto) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ErrorRemoto("El servidor no respondió a tiempo", 0);
    }
    throw new ErrorRemoto("No hay conexión con el servidor", 0);
  } finally {
    clearTimeout(corte);
  }
}

function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  return llamar<T>(ruta, opciones);
}

export function leerCarritoRemoto() {
  return pedir<CarritoRemoto>("/carrito");
}

export function guardarCarritoRemoto(contenido: {
  carrito: ItemCarrito[];
  guardados: ItemCarrito[];
  favoritos: string[];
}) {
  return pedir<CarritoRemoto>("/carrito", {
    method: "PUT",
    body: JSON.stringify(contenido),
  });
}

export function leerDireccionesRemotas() {
  return pedir<{ direcciones: Direccion[] }>("/direcciones");
}

/**
 * Guarda la libreta entera, no dirección por dirección.
 *
 * Son pocas y siempre se editan mirando la lista completa; además, la regla de
 * «una sola predeterminada» se resuelve así en un único sitio —el servidor— en
 * vez de repartirla entre varias llamadas que pueden cruzarse.
 */
export function guardarDireccionesRemotas(direcciones: Direccion[]) {
  return pedir<{ direcciones: Direccion[] }>("/direcciones", {
    method: "PUT",
    body: JSON.stringify({ direcciones }),
  });
}

/**
 * La forma de antes de «Mis pedidos». Se queda mientras la pantalla de la
 * cuenta no pase a `leerPedidosCliente`: el servidor ya manda `ResumenPedido`,
 * que es un `Pedido` con más campos.
 */
export function leerPedidosRemotos() {
  return pedir<{ pedidos: Pedido[] }>("/pedidos");
}

/* ── Pedidos del cliente ────────────────────────────────────────────────── */

/**
 * «Mis pedidos», con el estatus de ahora (el servidor lee cada pedido del
 * negocio, así que un cambio del panel se ve en el acto). Del más nuevo al
 * más viejo. Lanza `ErrorRemoto` si falla: la pantalla debe ofrecer
 * «Reintentar», nunca decir que no hay pedidos.
 */
export async function leerPedidosCliente(): Promise<ResumenPedido[]> {
  return (await pedir<{ pedidos: ResumenPedido[] }>("/pedidos")).pedidos;
}

/**
 * El detalle de un pedido de esta cuenta. `ErrorRemoto.estado` 404 si no
 * existe **o no es suyo** (el servidor no distingue, a propósito).
 * `heredado: true` en folios viejos que solo guardaron lo básico.
 */
export function leerPedidoCliente(folio: string): Promise<PedidoDetalle> {
  return pedir<PedidoDetalle>(`/pedidos/${encodeURIComponent(folio)}`);
}

/**
 * Cancela un pedido propio mientras está «Pendiente». Devuelve el pedido ya
 * cancelado. `ErrorRemoto.estado` 409 si ya no se puede (se pagó o ya estaba
 * cancelado); el mensaje del servidor lo explica y se puede enseñar tal cual.
 */
export function cancelarPedidoCliente(folio: string): Promise<PedidoDetalle> {
  return pedir<PedidoDetalle>(`/pedidos/${encodeURIComponent(folio)}/cancelar`, { method: "POST" });
}

/**
 * Rastreo sin cuenta: folio y el teléfono con que se hizo el pedido (en
 * cualquier formato; se comparan los últimos 10 dígitos). No pide sesión.
 * `ErrorRemoto.estado` 404 con «No encontramos un pedido con ese folio y
 * teléfono» tanto si el folio no existe como si el teléfono no es; 400 si
 * falta alguno de los dos.
 */
export function consultarPedido(entrada: { folio: string; telefono: string }): Promise<PedidoPublico> {
  return llamar<PedidoPublico>("/pedidos/consulta", {
    method: "POST",
    publica: true,
    body: JSON.stringify({ folio: entrada.folio.trim(), telefono: entrada.telefono }),
  });
}

/**
 * «Quiero ser distribuidor», contacto o factura. No pide sesión; si la hay, el
 * token viaja y la solicitud queda ligada a la cuenta. `ErrorRemoto.estado`
 * 400 con un mensaje que se puede enseñar tal cual («Falta tu nombre», «El RFC
 * no tiene un formato válido»…); 0 si no hubo servidor o red: entonces toca
 * ofrecer WhatsApp, nunca fingir que se envió.
 */
export function enviarSolicitud(entrada: SolicitudEntrada): Promise<{ ok: true; id: string }> {
  return llamar<{ ok: true; id: string }>("/solicitudes", {
    method: "POST",
    publica: true,
    body: JSON.stringify(entrada),
  });
}

/**
 * Borra el carrito, las direcciones y «Mis pedidos» del servidor. Se llama
 * antes de eliminar la cuenta, mientras el token todavía sirve. Los pedidos del
 * negocio se conservan: son ventas.
 */
export function borrarDatosRemotos() {
  return pedir<{ ok: true }>("/cuenta", { method: "DELETE" });
}

/**
 * Registra el pedido en el servidor, que pone el folio y el total.
 *
 * A diferencia del resto de este archivo **no exige sesión**: casi todos los
 * pedidos llegan sin cuenta. Si la hay, el token viaja igual y el servidor
 * liga el pedido a la cuenta y a «Mis pedidos».
 *
 * `solicitud.clave` (opcional, `crypto.randomUUID()` una vez por intento de
 * compra) hace el reintento seguro: con la misma clave el servidor contesta el
 * pedido que ya registró (200, mismo folio) en vez de crear otro. Por eso, si
 * esto falla por red (`ErrorRemoto.estado` 0 o 5xx), se reintenta **con la
 * misma clave** antes de caer al folio local. `solicitud.plazo`: meses sin
 * intereses con Clip (0, 3, 6, 9 o 12).
 *
 * Lanza `ErrorRemoto` si no hay servidor configurado (estado 0), no contesta
 * (0), o rechaza el pedido (400 datos incompletos, 422 nada del carrito existe
 * ya). Quien llama decide qué hacer; el checkout no deja a nadie sin comprar.
 */
export function registrarPedido(solicitud: SolicitudPedido): Promise<PedidoRegistrado> {
  return llamar<PedidoRegistrado>("/pedidos", {
    method: "POST",
    publica: true,
    body: JSON.stringify(solicitud),
  });
}

/* ── Fusión ─────────────────────────────────────────────────────────────── */

const clave = (i: ItemCarrito) => `${i.productoId}|${i.ml}`;

/**
 * Junta dos carritos sumando cantidades.
 *
 * **Suma, no reemplaza**, y esa es la decisión importante. Quien mete tres
 * frascos sin haber entrado y luego inicia sesión no espera que desaparezcan;
 * quien tenía un carrito guardado de la semana pasada tampoco espera perderlo.
 * De las dos formas de equivocarse —dejar de más o borrar de menos— solo una es
 * reversible con un clic, y es la de dejar de más.
 */
export function fusionarItems(
  local: ItemCarrito[],
  remoto: ItemCarrito[],
): ItemCarrito[] {
  const suma = new Map<string, ItemCarrito>();
  for (const i of [...remoto, ...local]) {
    const k = clave(i);
    const previo = suma.get(k);
    suma.set(k, previo ? { ...previo, cantidad: previo.cantidad + i.cantidad } : { ...i });
  }
  return [...suma.values()];
}

/** Los favoritos son un conjunto: unión, sin duplicados. */
export function fusionarFavoritos(local: string[], remoto: string[]): string[] {
  return [...new Set([...remoto, ...local])];
}
