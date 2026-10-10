import type { EstatusPedido, PedidoAdmin, ResumenPedido } from "@/lib/tienda-admin";
import type { IdEnvio, IdPago } from "../../../../compartido/reglas";
import { soloDigitos } from "@/lib/utils";

/**
 * Vocabulario y utilidades de las pantallas de pedidos (lista, detalle y hub).
 *
 * **Copias a propósito.** El panel importa de `compartido/` solo tipos: Next
 * compila con la raíz de Turbopack en `radar/` y el vocabulario lo valida el
 * servidor (un estatus o una paquetería que no conozca vuelve con 422). Cada
 * copia va atada al tipo del contrato con un `Record`, así que si
 * `compartido/pedido.ts` gana un estatus, `tsc` se queja aquí en vez de que la
 * lista lo esconda en silencio.
 */

/* ── Estatus ──────────────────────────────────────────────────────────────── */

const ORDEN_ESTATUS: Record<EstatusPedido, number> = {
  Pendiente: 0,
  Pagado: 1,
  "En preparación": 2,
  "En camino": 3,
  Entregado: 4,
  Cancelado: 5,
};

/** Los seis, en el orden en que avanza un pedido. */
export const ESTATUS: readonly EstatusPedido[] = (Object.keys(ORDEN_ESTATUS) as EstatusPedido[]).sort(
  (a, b) => ORDEN_ESTATUS[a] - ORDEN_ESTATUS[b],
);

/** Pagados y todavía sin salir: lo que el equipo tiene que surtir y mandar. */
export const POR_ENVIAR: readonly EstatusPedido[] = ["Pagado", "En preparación"];

export type Paso = { estatus: EstatusPedido; texto: string; peligro?: boolean };

/**
 * El siguiente paso lógico de cada estatus: lo que se toca el 95% de las
 * veces, a un botón. Lo demás (regresar un paso, cancelar algo ya pagado) va
 * por el selector de «Otro estatus», con confirmación.
 */
export const SIGUIENTES: Record<EstatusPedido, Paso[]> = {
  Pendiente: [
    { estatus: "Pagado", texto: "Confirmar pago" },
    { estatus: "Cancelado", texto: "Cancelar pedido", peligro: true },
  ],
  Pagado: [{ estatus: "En preparación", texto: "Empezar a surtir" }],
  "En preparación": [{ estatus: "En camino", texto: "Marcar enviado" }],
  "En camino": [{ estatus: "Entregado", texto: "Marcar entregado" }],
  Entregado: [],
  Cancelado: [],
};

/**
 * Pregunta antes de un cambio delicado: cancelar, o regresar el pedido a un
 * paso anterior (el cliente lo ve en su línea de tiempo). `null` si no hace
 * falta preguntar.
 */
export function confirmacionDe(actual: EstatusPedido, nuevo: EstatusPedido): string | null {
  if (nuevo === "Cancelado") {
    return "¿Cancelar este pedido? El cliente lo verá cancelado y ya no contará como venta.";
  }
  if (actual === "Cancelado") return `¿Reabrir el pedido como «${nuevo}»?`;
  if (ORDEN_ESTATUS[nuevo] < ORDEN_ESTATUS[actual]) {
    return `¿Regresar el pedido de «${actual}» a «${nuevo}»? El cliente verá el cambio en su seguimiento.`;
  }
  return null;
}

/**
 * Copias de `articulosEditables` y `contactoEditable` (`compartido/pedido.ts`):
 * solo deciden qué botones se enseñan. Si no coincidieran, el servidor
 * respondería 409 con el motivo, no guardaría de más.
 */
export const articulosEditables = (e: EstatusPedido) => e === "Pendiente";
export const contactoEditable = (e: EstatusPedido) => e !== "Entregado" && e !== "Cancelado";

/** Las etapas de la barra de progreso del detalle, en orden («Cancelado» no es etapa). */
export const ETAPAS: readonly EstatusPedido[] = ["Pendiente", "Pagado", "En preparación", "En camino", "Entregado"];

/* ── Etiquetas ────────────────────────────────────────────────────────────── */

export const ETIQUETA_METODO: Record<IdPago, string> = {
  clip: "Clip",
  transferencia: "Transferencia",
  contra: "Contra entrega",
};

export const ETIQUETA_ENVIO: Record<IdEnvio, string> = {
  estandar: "Estándar",
  express: "Express",
  "mismo-dia": "Mismo día",
};

export const metodoTexto = (m: IdPago | null, plazo?: number | null) =>
  m === null
    ? "Sin dato"
    : ETIQUETA_METODO[m] + (m === "clip" && plazo ? ` · ${plazo} meses sin intereses` : "");

export const envioTexto = (e: IdEnvio | null) => (e === null ? "Sin dato" : ETIQUETA_ENVIO[e]);

/**
 * Las paqueterías de `compartido/pedido.ts` (se guarda el `id`). El servidor
 * responde 422 a una que no esté en su lista, así que un desfase se nota al
 * guardar, no queda guardado mal.
 */
export const PAQUETERIAS: readonly { id: string; nombre: string }[] = [
  { id: "estafeta", nombre: "Estafeta" },
  { id: "dhl", nombre: "DHL" },
  { id: "fedex", nombre: "FedEx" },
  { id: "paquetexpress", nombre: "Paquetexpress" },
  { id: "99minutos", nombre: "99 Minutos" },
  { id: "redpack", nombre: "Redpack" },
  { id: "propia", nombre: "Entrega propia" },
  { id: "otra", nombre: "Otra" },
];

/** El nombre para pintar; si no es de la lista (pedidos viejos), lo que venga escrito. */
export function nombrePaqueteria(v: string | null | undefined): string | null {
  if (!v) return null;
  const limpio = v.trim().toLowerCase();
  return PAQUETERIAS.find((p) => p.id === limpio || p.nombre.toLowerCase() === limpio)?.nombre ?? v;
}

/* ── Fechas (calendario de México) ────────────────────────────────────────── */

/** YYYY-MM-DD de hoy en México, sea cual sea la zona del teléfono. */
export function hoyMexico(ahora = new Date()): string {
  // en-CA escribe las fechas como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** «27 sep 2026» de un YYYY-MM-DD, sin que la zona del teléfono lo corra un día. */
export function fechaDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/* ── Enlaces ──────────────────────────────────────────────────────────────── */

/** Sin `/radar`: Next pone el basePath. */
export const enlacePedido = (folio: string) => `/pedidos/detalle/?folio=${encodeURIComponent(folio)}`;

/**
 * La ficha del cliente en `/clientes/`. La clave es la misma que arma el
 * servidor (`claveCliente`): el `sub` si compró con cuenta; si no, los
 * últimos 10 dígitos del teléfono.
 */
export function enlaceCliente(p: Pick<PedidoAdmin, "cliente" | "contacto">): string | null {
  const tel = soloDigitos(p.contacto.telefono).slice(-10);
  const clave = p.cliente.sub ?? (tel ? `tel:${tel}` : null);
  return clave ? `/clientes/detalle/?clave=${encodeURIComponent(clave)}` : null;
}

/* ── Mensajes al cliente ──────────────────────────────────────────────────── */

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? "";

const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * El mensaje de WhatsApp según el estatus del pedido, para no escribirlo a
 * mano cada vez. Solo dice lo que el pedido sabe: nada de datos bancarios ni
 * fechas de entrega que nadie prometió. `origen` es la raíz de la tienda (el
 * panel vive en el mismo dominio) para mandar al cliente a `/rastreo`.
 */
export function mensajeCliente(
  p: Pick<PedidoAdmin, "folio" | "estatus" | "guia" | "paqueteria" | "urlRastreo" | "metodo" | "cifras" | "contacto" | "cobro">,
  origen: string,
): string {
  const nombre = primerNombre(p.contacto.nombre);
  const saludo = `Hola${nombre ? ` ${nombre}` : ""}, te escribimos de El Rey de los Perfumes`;
  const folio = p.folio;
  // El enlace ya lleva el folio (`/rastreo/?folio=`): al cliente solo le
  // falta escribir su teléfono, que es la llave para ver el pedido sin cuenta.
  const rastreo = origen
    ? ` Puedes seguirlo en ${origen}/rastreo/?folio=${encodeURIComponent(folio)} con tu teléfono.`
    : "";
  switch (p.estatus) {
    case "Pendiente": {
      const como =
        p.metodo === "transferencia"
          ? " Para confirmarlo solo falta tu transferencia; aquí te compartimos los datos."
          : p.metodo === "clip"
            ? p.cobro
              ? ` Para confirmarlo solo falta el pago con tarjeta. Paga aquí, en la pantalla segura de Clip: ${p.cobro.url}`
              : " Para confirmarlo solo falta el pago con tarjeta; aquí te mandamos el enlace de Clip."
            : p.metodo === "contra"
              ? " Lo pagas al recibirlo. ¿Nos confirmas que la dirección está bien?"
              : " Para confirmarlo solo falta el pago.";
      return `${saludo} por tu pedido ${folio} de ${pesos(p.cifras.total)}.${como}`;
    }
    case "Pagado":
      return `${saludo}. Confirmamos el pago de tu pedido ${folio}, ¡gracias! En cuanto salga te mandamos la guía.${rastreo}`;
    case "En preparación":
      return `${saludo}. Tu pedido ${folio} ya se está surtiendo y empacando. Te avisamos en cuanto salga.${rastreo}`;
    case "En camino": {
      const paq = nombrePaqueteria(p.paqueteria);
      if (p.paqueteria === "propia") {
        return `${saludo}. Tu pedido ${folio} ya va en camino con nuestro repartidor.${rastreo}`;
      }
      const con = paq ? ` con ${paq}` : "";
      const guia = p.guia ? ` Tu guía es ${p.guia}.` : "";
      const url = p.urlRastreo ? ` Rastréala aquí: ${p.urlRastreo}` : "";
      return `${saludo}. Tu pedido ${folio} ya va en camino${con}.${guia}${url}${url ? "" : rastreo}`;
    }
    case "Entregado":
      return `${saludo}. Tu pedido ${folio} aparece como entregado. ¡Gracias por tu compra! Si algo no llegó bien, respóndenos por aquí.`;
    case "Cancelado":
      return `${saludo}. Tu pedido ${folio} quedó cancelado. Si fue un error o quieres volver a pedir, respóndenos por aquí.`;
  }
}

/* ── Búsqueda y CSV ───────────────────────────────────────────────────────── */

/**
 * Los acentos sueltos que deja `normalize("NFD")` (U+0300 a U+036F). Se arma
 * con `fromCharCode` por la misma razón que el BOM: escritos tal cual son
 * caracteres invisibles.
 */
const ACENTOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

export const normalizar = (t: string) => t.normalize("NFD").replace(ACENTOS, "").toLowerCase();

/**
 * ¿La fila coincide con lo buscado? Folio, nombre, ciudad y estado por texto;
 * el teléfono por dígitos, porque cada quien lo escribe distinto («55 1234…»,
 * «+52 (55)…»).
 */
export function coincide(p: ResumenPedido, busqueda: string): boolean {
  const q = normalizar(busqueda.trim());
  if (q === "") return true;
  const texto = normalizar([p.folio, p.nombre, p.ciudad, p.estado, p.correo].join(" "));
  if (texto.includes(q)) return true;
  const digitos = soloDigitos(q);
  return digitos.length >= 3 && soloDigitos(p.telefono).includes(digitos);
}

/**
 * Marca de orden de bytes: sin ella Excel abre el CSV como Latin-1 y cada
 * acento sale roto. Se arma con `fromCharCode` para que no quede un carácter
 * invisible en el código que un editor se lleve sin avisar.
 */
const BOM = String.fromCharCode(0xfeff);

/** Siempre entre comillas: nombres y direcciones traen comas. */
const celda = (v: string | number | boolean | null | undefined) =>
  `"${String(v ?? "").replace(/"/g, '""')}"`;

export function csvPedidos(pedidos: readonly ResumenPedido[]): string {
  const encabezados = [
    "folio",
    "fecha",
    "creado_en",
    "estatus",
    "cliente",
    "telefono",
    "correo",
    "ciudad",
    "estado",
    "piezas",
    "total",
    "metodo",
    "envio",
    "escalon",
    "paqueteria",
    "guia",
    "con_cuenta",
  ];
  const filas = pedidos.map((p) => [
    p.folio,
    p.fecha,
    p.creadoEn,
    p.estatus,
    p.nombre,
    p.telefono,
    p.correo,
    p.ciudad,
    p.estado,
    p.piezas,
    // Punto decimal y sin separador de miles: así lo suma cualquier hoja.
    p.total.toFixed(2),
    p.metodo ? ETIQUETA_METODO[p.metodo] : "",
    p.envio ? ETIQUETA_ENVIO[p.envio] : "",
    p.escalon ?? "",
    nombrePaqueteria(p.paqueteria) ?? "",
    p.guia ?? "",
    p.conCuenta ? "si" : "no",
  ]);
  return BOM + [encabezados, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");
}

export function descargar(contenido: string, nombre: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
