import type { Catalogo } from "../../compartido/catalogo";
import type { Cotizacion } from "../../compartido/cotizacion";
import {
  esEstatusPedido,
  estatusDe,
  paqueteriaDe,
  urlRastreo,
  type ArticulosPedido,
  type CambioEstatus,
  type CambioPedidoAdmin,
  type CifrasPedido,
  type CobroPedido,
  type ContactoPedido,
  type LineaPedido,
  type PedidoAdmin,
  type PedidoDetalle,
  type PedidoPublico,
  type PedidoRegistrado,
  type ResumenPedido,
  type SolicitudPedido,
} from "../../compartido/pedido";
import {
  ESTADOS_SOLICITUD,
  TIPOS_SOLICITUD,
  type CambioSolicitud,
  type EstadoSolicitud,
  type SolicitudEntrada,
  type TipoSolicitud,
} from "../../compartido/tienda-admin";
import { cuentaDe, sanearSolicitud, type Nombrador, type Pedido, type PedidoTienda } from "./tienda";

/**
 * Funciones puras de los pedidos: armar lo que ve cada quien a partir de la
 * fila guardada, sanear lo que llega y las cuentas de fechas.
 *
 * No hablan con AWS a propósito. Así se prueban sin tabla (`pruebas-locales/`)
 * y la lógica de «qué se enseña a quién» queda en un solo sitio, lejos de las
 * consultas.
 */

/** `PEDIDO#<folio>/META` tal como se lee de la tabla. */
export type FilaPedido = { PK: string; SK: string; creadoEn: string; pedido: PedidoTienda };
/** `USER#<sub>/PEDIDO#<folio>`: la copia de «Mis pedidos». */
export type FilaCopia = { PK: string; SK: string; creadoEn?: string; pedido: Pedido };

/* ── Fechas ───────────────────────────────────────────────────────────── */

/** Fecha de calendario en México: un pedido de las 8 pm no es de mañana. */
export function fechaMexico(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(ahora);
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD que existe de verdad (no 2026-02-31). */
export function esFecha(v: unknown): v is string {
  if (typeof v !== "string" || !FECHA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Suma días a una fecha de calendario. Trabaja en UTC para no tropezar con horarios. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Todos los días entre dos fechas, las dos inclusive. */
export function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  return dias;
}

/* ── Teléfonos y clientes ─────────────────────────────────────────────── */

export const soloDigitos = (v: string) => v.replace(/\D/g, "");

/** Los últimos 10 dígitos: el número mexicano sin lada de país, escriba como lo escriba. */
export function ultimos10(telefono: string): string {
  return soloDigitos(telefono).slice(-10);
}

/**
 * La clave con que el panel agrupa a un comprador: su `sub` si compró con
 * cuenta; si no, su teléfono. El teléfono es lo único obligatorio del contacto
 * y es por donde se cierra la venta (WhatsApp), así que identifica mejor que
 * el correo, que casi nadie escribe igual dos veces.
 */
export function claveCliente(p: PedidoTienda): string {
  if (p.cliente?.sub) return p.cliente.sub;
  const tel = ultimos10(p.solicitud?.contacto?.telefono ?? "");
  return tel ? `tel:${tel}` : `folio:${p.folio}`;
}

/* ── Nombres de las líneas ────────────────────────────────────────────── */

/**
 * Nombre y presentación con el catálogo de ahora. Al crear el pedido se
 * congelan en la cuenta; para los pedidos de antes, que no los guardaron, se
 * resuelven al leer con lo que haya (un código si ya no existe).
 */
export function nombradorDe(catalogo: Catalogo): Nombrador {
  const productos = new Map(catalogo.productos.map((p) => [p.codigo, p]));
  const marcas = new Map(catalogo.marcas.map((m) => [m.slug, m.nombre]));
  const lotes = new Map(catalogo.lotes.map((l) => [l.slug, l]));
  const sets = new Map(catalogo.sets.map((s) => [s.slug, s]));

  return (productoId, ml) => {
    if (ml === 0) {
      const lote = lotes.get(productoId);
      if (lote) return { nombre: lote.nombre, detalle: `Lote · ${lote.piezas} piezas` };
      const set = sets.get(productoId);
      if (set) return { nombre: set.nombre, detalle: "Set de regalo" };
      return { nombre: productoId, detalle: "Paquete" };
    }
    const p = productos.get(productoId);
    if (!p) return { nombre: `Código ${productoId}`, detalle: `${ml} ml` };
    const marca = marcas.get(p.marca);
    const nombre =
      marca && !p.nombre.toLowerCase().startsWith(marca.toLowerCase())
        ? `${marca} ${p.nombre}`
        : p.nombre;
    // La presentación que de verdad se cobró: una que ya no existe cae en la
    // principal (`fuenteDeCatalogo`), y el detalle debe decir esa.
    const cobrada = p.presentaciones.some((v) => v.ml === ml)
      ? ml
      : (p.presentaciones.find((v) => v.ml === 100) ??
          [...p.presentaciones].sort((a, b) => b.ml - a.ml)[0])?.ml ?? ml;
    return { nombre, detalle: `${cobrada} ml` };
  };
}

/* ── Crear ────────────────────────────────────────────────────────────── */

/** El pedido nuevo, completo, listo para guardarse. */
export function armarPedidoNuevo(a: {
  folio: string;
  fecha: string;
  creadoEn: string;
  solicitud: SolicitudPedido;
  cotizacion: Cotizacion;
  nombrar: Nombrador;
  cliente: { sub: string; correo: string | null } | null;
  /** Quién lo registró: el cliente desde la tienda (por defecto) o alguien del equipo. */
  por?: string;
}): PedidoTienda {
  return {
    folio: a.folio,
    fecha: a.fecha,
    estatus: "Pendiente",
    solicitud: a.solicitud,
    cuenta: cuentaDe(a.cotizacion, a.nombrar),
    cliente: a.cliente,
    historial: [
      {
        estatus: "Pendiente",
        en: a.creadoEn,
        por: a.por ?? "cliente",
        ...(a.por ? { nota: "Pedido capturado desde el panel." } : {}),
      },
    ],
    guia: null,
    paqueteria: null,
    notaInterna: null,
    notaCliente: null,
    actualizadoEn: a.creadoEn,
  };
}

export function registradoDe(p: PedidoTienda): PedidoRegistrado {
  return {
    folio: p.folio,
    fecha: p.fecha,
    total: p.cuenta.total,
    comision: p.cuenta.comision,
    descuentoTransferencia: p.cuenta.descuentoTransferencia,
    metodo: p.cuenta.metodo ?? p.solicitud.metodo,
    urlPago: cobroDe(p)?.url ?? null,
  };
}

const centavos = (n: number) => Math.round(n * 100);

/**
 * El cobro que se le puede enseñar a quien va a pagar: solo si el pedido sigue
 * «Pendiente», se paga con Clip, el enlace no venció y **es por el total de
 * ahora**. Si el panel cambió los artículos, el enlace viejo deja de salir.
 */
export function cobroDe(p: PedidoTienda, ahora = new Date()): CobroPedido | null {
  const pago = p.pago;
  if (!pago?.url || estatusDe(p.estatus) !== "Pendiente") return null;
  if ((p.cuenta?.metodo ?? p.solicitud?.metodo) !== "clip") return null;
  if (centavos(pago.monto) !== centavos(p.cuenta?.total ?? -1)) return null;
  if (pago.expiraEn && new Date(pago.expiraEn).getTime() <= ahora.getTime()) return null;
  return { url: pago.url, monto: pago.monto, expiraEn: pago.expiraEn };
}

/* ── Leer ─────────────────────────────────────────────────────────────── */

const nulo = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** El historial guardado o, en filas de antes, el alta como único cambio. */
export function historialDe(p: PedidoTienda, creadoEn: string): CambioEstatus[] {
  const guardado = Array.isArray(p.historial)
    ? p.historial.filter((c) => c && esEstatusPedido(c.estatus) && typeof c.en === "string")
    : [];
  return guardado.length > 0 ? guardado : [{ estatus: "Pendiente", en: creadoEn, por: "cliente" }];
}

/**
 * El historial que ve el cliente: sin el nombre de quién del equipo lo movió
 * (puede ser un correo) y sin la nota, que es para el equipo. Lo que se le
 * quiere decir al cliente va en `notaCliente`.
 */
export function historialParaCliente(h: CambioEstatus[]): CambioEstatus[] {
  return h.map((c) => ({ estatus: c.estatus, en: c.en, por: c.por === "cliente" ? "cliente" : "tienda" }));
}

export function contactoDe(s: Partial<SolicitudPedido> | undefined): ContactoPedido {
  const c = (s?.contacto ?? {}) as Partial<ContactoPedido>;
  return {
    correo: c.correo ?? "",
    nombre: c.nombre ?? "",
    telefono: c.telefono ?? "",
    calle: c.calle ?? "",
    colonia: c.colonia ?? "",
    cp: c.cp ?? "",
    ciudad: c.ciudad ?? "",
    estado: c.estado ?? "",
    referencias: c.referencias ?? "",
  };
}

export function lineasDe(p: PedidoTienda, nombrar?: Nombrador): LineaPedido[] {
  return (p.cuenta?.lineas ?? []).map((l) => {
    const resuelto =
      l.nombre && l.detalle
        ? { nombre: l.nombre, detalle: l.detalle }
        : (nombrar?.(l.productoId, l.ml) ??
          { nombre: l.productoId, detalle: l.ml === 0 ? "Paquete" : `${l.ml} ml` });
    return {
      productoId: l.productoId,
      ml: l.ml,
      cantidad: l.cantidad,
      unitario: l.unitario,
      subtotal: l.subtotal,
      nombre: resuelto.nombre,
      detalle: resuelto.detalle,
    };
  });
}

export function cifrasDe(p: PedidoTienda): CifrasPedido {
  const c = p.cuenta ?? ({} as Partial<PedidoTienda["cuenta"]>);
  return {
    piezas: num(c.piezasTotales),
    subtotalMenudeo: num(c.subtotalMenudeo),
    subtotal: num(c.subtotal),
    ahorroVolumen: num(c.ahorroVolumen),
    descuento3x2: num(c.descuento3x2),
    descuentoCupon: num(c.descuentoCupon),
    descuentoTransferencia: num(c.descuentoTransferencia),
    costoEnvio: num(c.costoEnvio),
    envioGratis: c.envioGratis === true,
    comision: num(c.comision),
    total: num(c.total),
    escalon: typeof c.escalon === "string" ? c.escalon : "",
    cupon: nulo(c.cupon),
  };
}

function plazoDe(p: PedidoTienda): number | null {
  const plazo = p.solicitud?.plazo;
  return typeof plazo === "number" && plazo > 0 ? plazo : null;
}

/** Lo que ve el dueño del pedido. */
export function armarDetalle(fila: FilaPedido, nombrar?: Nombrador): PedidoDetalle {
  const completo = armarAdmin(fila, nombrar);
  const detalle: PedidoDetalle & Partial<Pick<PedidoAdmin, "cliente" | "notaInterna">> = {
    ...completo,
    historial: historialParaCliente(completo.historial),
  };
  // La nota interna y la cuenta con que se compró son del equipo.
  delete detalle.cliente;
  delete detalle.notaInterna;
  return detalle;
}

/** Lo que ve el panel: todo, con la nota interna y el historial firmado. */
export function armarAdmin(fila: FilaPedido, nombrar?: Nombrador): PedidoAdmin {
  const p = fila.pedido;
  const estatus = estatusDe(p.estatus);
  const guia = nulo(p.guia);
  const paqueteria = nulo(p.paqueteria);
  return {
    folio: p.folio,
    fecha: p.fecha,
    creadoEn: fila.creadoEn,
    actualizadoEn: p.actualizadoEn ?? fila.creadoEn,
    estatus,
    historial: historialDe(p, fila.creadoEn),
    guia,
    paqueteria,
    urlRastreo: urlRastreo(paqueteria, guia),
    notaCliente: nulo(p.notaCliente),
    metodo: p.cuenta?.metodo ?? p.solicitud?.metodo ?? null,
    plazo: plazoDe(p),
    envio: p.cuenta?.envio ?? p.solicitud?.envio ?? null,
    contacto: contactoDe(p.solicitud),
    lineas: lineasDe(p, nombrar),
    cifras: cifrasDe(p),
    cancelable: estatus === "Pendiente",
    heredado: false,
    cobro: cobroDe(p),
    cliente: { sub: p.cliente?.sub ?? null, correoCuenta: p.cliente?.correo ?? null },
    notaInterna: nulo(p.notaInterna),
  };
}

export function armarResumen(fila: FilaPedido): ResumenPedido {
  const p = fila.pedido;
  const contacto = contactoDe(p.solicitud);
  return {
    folio: p.folio,
    fecha: p.fecha,
    creadoEn: fila.creadoEn,
    estatus: estatusDe(p.estatus),
    total: num(p.cuenta?.total),
    piezas: num(p.cuenta?.piezasTotales),
    metodo: p.cuenta?.metodo ?? p.solicitud?.metodo ?? null,
    envio: p.cuenta?.envio ?? p.solicitud?.envio ?? null,
    escalon: nulo(p.cuenta?.escalon),
    nombre: contacto.nombre,
    telefono: contacto.telefono,
    correo: contacto.correo,
    ciudad: contacto.ciudad,
    estado: contacto.estado,
    guia: nulo(p.guia),
    paqueteria: nulo(p.paqueteria),
    conCuenta: Boolean(p.cliente?.sub),
    items: Array.isArray(p.solicitud?.items) ? p.solicitud.items : [],
  };
}

/**
 * Un folio heredado (847–1346) que solo existe como copia en «Mis pedidos».
 * Se enseña lo que hay y nada más: sin contacto ni forma de pago, que no se
 * guardaron.
 */
export function armarResumenCopia(fila: FilaCopia): ResumenPedido {
  const p = fila.pedido;
  return {
    folio: p.folio,
    fecha: p.fecha,
    creadoEn: fila.creadoEn ?? `${p.fecha}T12:00:00.000Z`,
    estatus: estatusDe(p.estatus),
    total: num(p.total),
    piezas: num(p.piezas),
    metodo: null,
    envio: null,
    escalon: null,
    nombre: "",
    telefono: "",
    correo: "",
    ciudad: "",
    estado: "",
    guia: nulo(p.guia),
    paqueteria: nulo(p.paqueteria),
    conCuenta: true,
    items: Array.isArray(p.items) ? p.items : [],
  };
}

export function armarDetalleCopia(fila: FilaCopia, nombrar?: Nombrador): PedidoDetalle {
  const r = armarResumenCopia(fila);
  const cifras: CifrasPedido = {
    piezas: r.piezas,
    subtotalMenudeo: 0,
    subtotal: 0,
    ahorroVolumen: 0,
    descuento3x2: 0,
    descuentoCupon: 0,
    descuentoTransferencia: 0,
    costoEnvio: 0,
    envioGratis: false,
    comision: 0,
    total: r.total,
    escalon: "",
    cupon: null,
  };
  return {
    folio: r.folio,
    fecha: r.fecha,
    creadoEn: r.creadoEn,
    actualizadoEn: r.creadoEn,
    estatus: r.estatus,
    historial: [{ estatus: r.estatus, en: r.creadoEn, por: "tienda" }],
    guia: r.guia,
    paqueteria: r.paqueteria,
    urlRastreo: urlRastreo(r.paqueteria, r.guia),
    notaCliente: null,
    metodo: null,
    plazo: null,
    envio: null,
    contacto: contactoDe(undefined),
    // Sin precio por línea: esa copia no lo guardó y no se inventa.
    lineas: r.items.map((i) => ({
      productoId: i.productoId,
      ml: i.ml,
      cantidad: i.cantidad,
      unitario: 0,
      subtotal: 0,
      ...(nombrar?.(i.productoId, i.ml) ?? { nombre: i.productoId, detalle: `${i.ml} ml` }),
    })),
    cifras,
    cancelable: false,
    heredado: true,
  };
}

/** Rastreo sin cuenta: sin dirección, sin teléfono, sin correo y con el primer nombre. */
export function armarPublico(fila: FilaPedido, nombrar?: Nombrador): PedidoPublico {
  const d = armarDetalle(fila, nombrar);
  return {
    folio: d.folio,
    fecha: d.fecha,
    estatus: d.estatus,
    historial: d.historial,
    guia: d.guia,
    paqueteria: d.paqueteria,
    urlRastreo: d.urlRastreo,
    notaCliente: d.notaCliente,
    metodo: d.metodo,
    plazo: d.plazo,
    envio: d.envio,
    lineas: d.lineas,
    cifras: d.cifras,
    nombre: d.contacto.nombre.trim().split(/\s+/)[0] ?? "",
    ciudad: d.contacto.ciudad,
    estado: d.contacto.estado,
    cobro: d.cobro ?? null,
  };
}

/* ── Saneado de lo que manda el panel ─────────────────────────────────── */

export const MAX_GUIA = 60;
export const MAX_NOTA = 1000;

/** Lo que de verdad cambia, ya validado. `undefined` = no se toca. */
export type CambioLimpio = {
  estatus?: CambioPedidoAdmin["estatus"];
  nota?: string;
  guia?: string | null;
  paqueteria?: string | null;
  notaInterna?: string | null;
  notaCliente?: string | null;
  contacto?: ContactoPedido;
  articulos?: ArticulosPedido;
  actualizadoEn: string | null;
};

type Saneado<T> = { ok: true; valor: T } | { ok: false; error: string };

/** Texto opcional: `null` o vacío borran; más largo que el tope es un error, no un recorte. */
function textoOpcional(
  v: unknown,
  tope: number,
  nombre: string,
): { ok: true; valor: string | null | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, valor: undefined };
  if (v === null) return { ok: true, valor: null };
  if (typeof v !== "string") return { ok: false, error: `${nombre} tiene que ser texto` };
  const limpio = v.trim();
  if (limpio.length > tope) {
    return { ok: false, error: `${nombre} no puede pasar de ${tope} caracteres` };
  }
  return { ok: true, valor: limpio === "" ? null : limpio };
}

/**
 * Sanea `PUT /admin/pedidos/{folio}`. **No recorta en silencio**: una guía de
 * 80 caracteres es un error de dedo y guardarla cortada mandaría al cliente a
 * rastrear otra. Se responde 422 con el motivo y el panel lo enseña.
 */
export function sanearCambioAdmin(cuerpo: unknown): Saneado<CambioLimpio> {
  if (typeof cuerpo !== "object" || cuerpo === null) {
    return { ok: false, error: "El cambio llegó vacío" };
  }
  const c = cuerpo as Record<string, unknown>;
  if (!("actualizadoEn" in c) || (c.actualizadoEn !== null && typeof c.actualizadoEn !== "string")) {
    return { ok: false, error: "Falta actualizadoEn: recarga el pedido y vuelve a intentarlo" };
  }
  const limpio: CambioLimpio = { actualizadoEn: c.actualizadoEn as string | null };

  if (c.estatus !== undefined) {
    if (!esEstatusPedido(c.estatus)) return { ok: false, error: `Estatus desconocido: ${String(c.estatus)}` };
    limpio.estatus = c.estatus;
  }

  const nota = textoOpcional(c.nota, MAX_NOTA, "La nota");
  if (!nota.ok) return nota;
  if (nota.valor) limpio.nota = nota.valor;

  const guia = textoOpcional(c.guia, MAX_GUIA, "La guía");
  if (!guia.ok) return guia;
  if (guia.valor !== undefined) limpio.guia = guia.valor;

  if (c.paqueteria !== undefined) {
    if (c.paqueteria === null || c.paqueteria === "") {
      limpio.paqueteria = null;
    } else {
      const p = typeof c.paqueteria === "string" ? paqueteriaDe(c.paqueteria) : null;
      if (!p) return { ok: false, error: `Paquetería desconocida: ${String(c.paqueteria)}` };
      limpio.paqueteria = p.id;
    }
  }

  for (const campo of ["notaInterna", "notaCliente"] as const) {
    const r = textoOpcional(c[campo], MAX_NOTA, campo === "notaInterna" ? "La nota interna" : "La nota para el cliente");
    if (!r.ok) return r;
    if (r.valor !== undefined) limpio[campo] = r.valor;
  }

  if (c.contacto !== undefined) {
    const contacto = sanearContactoAdmin(c.contacto);
    if (!contacto.ok) return contacto;
    limpio.contacto = contacto.valor;
  }

  if (c.articulos !== undefined) {
    const articulos = sanearArticulos(c.articulos);
    if (!articulos.ok) return articulos;
    limpio.articulos = articulos.valor;
  }
  return { ok: true, valor: limpio };
}

/** Topes de cada campo del contacto: los mismos que acepta la tienda al crear. */
const LARGOS_CONTACTO: Record<keyof ContactoPedido, number> = {
  correo: 160,
  nombre: 120,
  telefono: 40,
  calle: 200,
  colonia: 120,
  cp: 10,
  ciudad: 120,
  estado: 120,
  referencias: 300,
};

/**
 * El contacto que corrige el panel. Llega completo (el formulario manda todos
 * los campos). Igual que con la guía, un campo demasiado largo es un error y
 * no se recorta: guardarlo cortado mandaría el paquete a otra dirección.
 */
export function sanearContactoAdmin(v: unknown): Saneado<ContactoPedido> {
  if (typeof v !== "object" || v === null) return { ok: false, error: "El contacto llegó vacío" };
  const c = v as Record<string, unknown>;
  const salida = {} as ContactoPedido;
  for (const [campo, largo] of Object.entries(LARGOS_CONTACTO) as [keyof ContactoPedido, number][]) {
    const bruto = c[campo] ?? "";
    if (typeof bruto !== "string") return { ok: false, error: `«${campo}» tiene que ser texto` };
    const limpio = bruto.trim();
    if (limpio.length > largo) return { ok: false, error: `«${campo}» no puede pasar de ${largo} caracteres` };
    salida[campo] = limpio;
  }
  if (!salida.nombre) return { ok: false, error: "Falta el nombre del cliente" };
  if (soloDigitos(salida.telefono).length < 10) return { ok: false, error: "El teléfono necesita 10 dígitos" };
  if (salida.cp && !/^\d{5}$/.test(salida.cp)) return { ok: false, error: "El código postal son 5 dígitos" };
  return { ok: true, valor: salida };
}

/**
 * Artículos y condiciones de cobro que manda el panel. Reutiliza el saneado de
 * la tienda (`sanearSolicitud`) con un contacto de relleno, para que un pedido
 * editado acepte exactamente lo mismo que uno nuevo: ni más artículos, ni
 * cantidades más grandes, ni formas de pago que la tienda no ofrece.
 */
export function sanearArticulos(v: unknown): Saneado<ArticulosPedido> {
  if (typeof v !== "object" || v === null) return { ok: false, error: "Los artículos llegaron vacíos" };
  const a = v as Record<string, unknown>;
  const solicitud = sanearSolicitud({
    items: a.items,
    metodo: a.metodo,
    envio: a.envio,
    cupon: a.cupon,
    contacto: { nombre: "-", telefono: "-" },
  });
  if (!solicitud) return { ok: false, error: "El pedido necesita al menos un artículo y una forma de pago válida" };
  return {
    ok: true,
    valor: { items: solicitud.items, metodo: solicitud.metodo, envio: solicitud.envio, cupon: solicitud.cupon },
  };
}

/* ── Solicitudes ──────────────────────────────────────────────────────── */

const LARGOS: Record<Exclude<keyof SolicitudEntrada, "tipo">, number> = {
  nombre: 120,
  telefono: 40,
  correo: 160,
  ciudad: 120,
  negocio: 160,
  mensaje: 2000,
  volumen: 120,
  folio: 40,
  rfc: 13,
  razonSocial: 250,
  regimen: 120,
  cpFiscal: 5,
  usoCfdi: 80,
};

/** RFC de persona moral (12) o física (13). */
const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

/**
 * Sanea una solicitud de la tienda (distribuidor, contacto o factura).
 *
 * Es una ruta pública: se recorta todo a su largo máximo y se descartan los
 * campos que no son del contrato. Faltar nombre o teléfono es un 400 con un
 * mensaje que el formulario puede enseñar tal cual.
 */
export function sanearSolicitudEntrada(cuerpo: unknown): Saneado<SolicitudEntrada> {
  const s = (typeof cuerpo === "object" && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>;
  if (!(TIPOS_SOLICITUD as readonly unknown[]).includes(s.tipo)) {
    return { ok: false, error: "Tipo de solicitud desconocido" };
  }
  const tipo = s.tipo as TipoSolicitud;
  const salida: SolicitudEntrada = { tipo, nombre: "", telefono: "" };
  for (const [campo, largo] of Object.entries(LARGOS) as [keyof typeof LARGOS, number][]) {
    const v = typeof s[campo] === "string" ? (s[campo] as string).trim().slice(0, largo) : "";
    if (v !== "" || campo === "nombre" || campo === "telefono") salida[campo] = v;
  }
  if (!salida.nombre) return { ok: false, error: "Falta tu nombre" };
  if (soloDigitos(salida.telefono).length < 10) {
    return { ok: false, error: "Falta tu teléfono (10 dígitos)" };
  }
  if (tipo === "factura") {
    salida.rfc = salida.rfc?.toUpperCase();
    if (!salida.folio) return { ok: false, error: "Falta el folio del pedido a facturar" };
    if (!salida.rfc || !RFC.test(salida.rfc)) return { ok: false, error: "El RFC no tiene un formato válido" };
    if (!salida.razonSocial) return { ok: false, error: "Falta la razón social" };
    if (salida.cpFiscal && !/^\d{5}$/.test(salida.cpFiscal)) {
      return { ok: false, error: "El código postal fiscal son 5 dígitos" };
    }
  }
  return { ok: true, valor: salida };
}

export function sanearCambioSolicitud(
  cuerpo: unknown,
): Saneado<{ estado?: EstadoSolicitud; nota?: string | null; actualizadaEn: string }> {
  if (typeof cuerpo !== "object" || cuerpo === null) return { ok: false, error: "El cambio llegó vacío" };
  const c = cuerpo as Partial<Record<keyof CambioSolicitud, unknown>>;
  if (typeof c.actualizadaEn !== "string" || c.actualizadaEn === "") {
    return { ok: false, error: "Falta actualizadaEn: recarga la lista y vuelve a intentarlo" };
  }
  const salida: { estado?: EstadoSolicitud; nota?: string | null; actualizadaEn: string } = {
    actualizadaEn: c.actualizadaEn,
  };
  if (c.estado !== undefined) {
    if (!(ESTADOS_SOLICITUD as readonly unknown[]).includes(c.estado)) {
      return { ok: false, error: `Estado desconocido: ${String(c.estado)}` };
    }
    salida.estado = c.estado as EstadoSolicitud;
  }
  const nota = textoOpcional(c.nota, MAX_NOTA, "La nota");
  if (!nota.ok) return nota;
  if (nota.valor !== undefined) salida.nota = nota.valor;
  return { ok: true, valor: salida };
}
