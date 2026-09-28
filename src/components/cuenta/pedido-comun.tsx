"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, MessageCircle, Package, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Imagen } from "@/components/comunes/imagen";
import { Precio } from "@/components/comunes/precio";
import { MARCA, OPCIONES_ENVIO } from "@/data/contenido";
import { getLote } from "@/data/lotes";
import {
  CLIP_LINK,
  DATOS_BANCARIOS,
  HAY_DATOS_BANCARIOS,
  METODOS,
  type IdPago,
} from "@/data/pagos";
import { getProductoPorId } from "@/data/productos";
import { getSet } from "@/data/sets";
import { ML_PAQUETE } from "@/lib/carrito";
import { precio as fmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ETAPAS_SEGUIMIENTO,
  nombrePaqueteria,
  paqueteriaDe,
  type CambioEstatus,
  type CifrasPedido,
  type EstatusPedido,
  type LineaPedido,
} from "../../../compartido/pedido";
import type { IdEnvio } from "../../../compartido/reglas";

/**
 * Piezas del pedido que comparten el detalle de «Mi cuenta» y el rastreo sin
 * cuenta (`/rastreo`). Las dos pantallas enseñan el mismo pedido —una con la
 * dirección completa, la otra sin ella—, y con dos copias de la línea de tiempo
 * o del desglose tarde o temprano dirían cosas distintas.
 */

/* ── Estatus ──────────────────────────────────────────────────────────── */

export const COLOR_ESTATUS: Record<EstatusPedido, string> = {
  Pendiente: "bg-warning/15 text-warning",
  Pagado: "bg-gold-muted text-gold-light",
  "En preparación": "bg-gold-muted text-gold-light",
  "En camino": "bg-gold-muted text-gold-light",
  Entregado: "bg-success/15 text-success",
  Cancelado: "bg-danger/15 text-danger",
};

export function InsigniaEstatus({
  estatus,
  className,
}: {
  estatus: EstatusPedido;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
        COLOR_ESTATUS[estatus],
        className,
      )}
    >
      {estatus}
    </span>
  );
}

/* ── Formatos ─────────────────────────────────────────────────────────── */

// Las fechas del historial vienen en UTC. Se enseñan en hora del centro de
// México, que es donde está la tienda y casi todos sus clientes: con la zona
// del navegador, un pedido de las 20:00 salía «mañana» para quien viaja.
const fechaHoraMx = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : fechaHoraMx.format(d);
}

/** «Clip · tarjeta o efectivo · 6 meses sin intereses», o `null` si no se guardó. */
export function etiquetaPago(metodo: IdPago | null, plazo: number | null): string | null {
  if (!metodo) return null;
  const base = METODOS.find((m) => m.id === metodo)?.etiqueta ?? metodo;
  return metodo === "clip" && plazo ? `${base} · ${plazo} meses sin intereses` : base;
}

/** «Estándar · 3 a 5 días hábiles», o `null` si no se guardó. */
export function etiquetaEnvio(envio: IdEnvio | null): string | null {
  if (!envio) return null;
  const o = OPCIONES_ENVIO.find((x) => x.id === envio);
  return o ? `${o.nombre} · ${o.tiempo}` : envio;
}

/**
 * Un folio que puso este navegador porque el servidor no contestó
 * (`REY-2026-L…` o, de antes, `AUR-2026-L…`). No existe en el servidor, así
 * que no se puede rastrear ni aparece en «Mis pedidos»: solo viaja por WhatsApp.
 */
export function esFolioLocal(folio: string): boolean {
  return /-L[0-9A-Z]+$/.test(folio);
}

/** Enlace a WhatsApp de la tienda con un texto ya escrito. */
export function enlaceWhatsApp(texto: string): string {
  return `https://wa.me/${MARCA.whatsappNumero}?text=${encodeURIComponent(texto)}`;
}

/* ── Línea de tiempo ──────────────────────────────────────────────────── */

/**
 * Las etapas del pedido con la fecha en que se cumplió cada una.
 *
 * La fecha sale del historial (el último cambio a ese estatus, por si el
 * negocio lo movió dos veces). Si el negocio se saltó una etapa —de «Pagado» a
 * «En camino», por ejemplo— la etapa se marca hecha sin fecha: inventarle una
 * sería peor que dejarla en blanco.
 */
export function LineaTiempo({
  estatus,
  historial,
}: {
  estatus: EstatusPedido;
  historial: CambioEstatus[];
}) {
  const ultimo = (e: EstatusPedido) =>
    [...historial].reverse().find((c) => c.estatus === e) ?? null;

  if (estatus === "Cancelado") {
    const cancelado = ultimo("Cancelado");
    return (
      <div className="border-danger/30 bg-danger/10 rounded-md border px-4 py-3 text-sm">
        <p className="text-danger flex items-center gap-2 font-medium">
          <X size={15} aria-hidden />
          Pedido cancelado
          {cancelado ? (
            <span className="text-fg-muted font-normal">· {fechaHora(cancelado.en)}</span>
          ) : null}
        </p>
        <p className="text-fg-muted mt-1 leading-relaxed">
          {cancelado?.por === "cliente"
            ? "Lo cancelaste tú desde tu cuenta."
            : "Lo canceló la tienda."}{" "}
          Si hiciste algún pago, escríbenos con tu folio y lo revisamos el mismo día.
        </p>
      </div>
    );
  }

  const actual = ETAPAS_SEGUIMIENTO.findIndex((e) => e.estatus === estatus);

  return (
    <ol className="relative">
      {ETAPAS_SEGUIMIENTO.map((etapa, i) => {
        const hecho = i <= actual;
        const esActual = i === actual;
        const cambio = hecho ? ultimo(etapa.estatus) : null;
        return (
          <li key={etapa.estatus} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
                  hecho ? "bg-gold-gradient border-transparent" : "border-border-strong",
                )}
              >
                {hecho ? (
                  <Check size={14} className="text-bg" aria-hidden />
                ) : (
                  <span className="bg-border-strong size-1.5 rounded-full" />
                )}
              </span>
              {i < ETAPAS_SEGUIMIENTO.length - 1 ? (
                <span
                  aria-hidden
                  className={cn("mt-1 w-px flex-1", i < actual ? "bg-gold/50" : "bg-border-soft")}
                />
              ) : null}
            </div>

            <div className="-mt-0.5 min-w-0 pb-1">
              <p
                className={cn(
                  "text-sm",
                  esActual ? "text-gold-light font-medium" : hecho ? "" : "text-fg-subtle",
                )}
              >
                {etapa.titulo}
                {esActual ? <span className="sr-only"> (estado actual)</span> : null}
              </p>
              {cambio ? (
                <p className="text-fg-subtle mt-0.5 text-xs">{fechaHora(cambio.en)}</p>
              ) : null}
              {esActual ? (
                <p className="text-fg-muted mt-0.5 text-xs">{etapa.texto}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Guía y nota del negocio ──────────────────────────────────────────── */

/**
 * La guía con su botón de rastreo y el de copiar.
 *
 * Copiar importa aunque haya enlace: la página de algunas paqueterías no lee
 * la guía de la URL y hay que pegarla a mano. La entrega propia no tiene guía
 * que rastrear, pero sí conviene decir quién lleva el paquete.
 */
export function BloqueGuia({
  guia,
  paqueteria,
  urlRastreo,
}: {
  guia: string | null;
  paqueteria: string | null;
  urlRastreo: string | null;
}) {
  const [copiada, setCopiada] = useState(false);
  const nombre = nombrePaqueteria(paqueteria);
  if (!guia && !nombre) return null;

  if (!guia) {
    return (
      <div className="border-border-soft mt-5 border-t pt-4 text-sm">
        <p className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">Envío</p>
        <p className="mt-1 flex items-center gap-2">
          <Truck size={15} className="text-gold shrink-0" aria-hidden />
          {paqueteriaDe(paqueteria)?.id === "propia"
            ? "Lo entregamos nosotros. Te avisamos por WhatsApp antes de llegar."
            : `Va con ${nombre}. En cuanto tengamos la guía aparecerá aquí.`}
        </p>
      </div>
    );
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(guia!);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2500);
    } catch {
      // Sin permiso de portapapeles la guía sigue a la vista para copiarla a mano.
    }
  }

  return (
    <div className="border-border-soft mt-5 border-t pt-4">
      <p className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">Guía de rastreo</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span data-precio className="font-medium break-all">
          {guia}
        </span>
        {nombre ? <span className="text-fg-muted text-sm">· {nombre}</span> : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 print:hidden">
        {urlRastreo ? (
          <Button asChild variant="gold" size="touch">
            <a href={urlRastreo} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} aria-hidden />
              Rastrear en {nombre ?? "la paquetería"}
            </a>
          </Button>
        ) : null}
        <Button variant="outline" size="touch" onClick={copiar} aria-live="polite">
          {copiada ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          {copiada ? "Guía copiada" : "Copiar guía"}
        </Button>
      </div>
      {!urlRastreo && nombre ? (
        <p className="text-fg-subtle mt-2 text-xs">
          Pégala en el sitio de {nombre} para ver dónde va.
        </p>
      ) : null}
    </div>
  );
}

/** El mensaje que el negocio dejó para el cliente en el panel. */
export function NotaTienda({ nota }: { nota: string | null }) {
  if (!nota) return null;
  return (
    <section className="border-gold/35 bg-gold-muted rounded-lg border p-4 lg:p-5">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium">
        <MessageCircle size={15} className="text-gold" aria-hidden />
        Mensaje de la tienda
      </p>
      <p className="text-fg-muted text-sm leading-relaxed whitespace-pre-line">{nota}</p>
    </section>
  );
}

/* ── Artículos y cifras ───────────────────────────────────────────────── */

/**
 * Foto y enlace de una línea, si el catálogo de esta tienda la conoce. El
 * nombre y el precio **no** salen de aquí: son los congelados del pedido, lo
 * que se cobró ese día aunque el catálogo haya cambiado después.
 */
function fichaDe(l: { productoId: string; ml: number }): {
  imagen: string | null;
  enlace: string | null;
} {
  if (l.ml === ML_PAQUETE) {
    const lote = getLote(l.productoId);
    if (lote) return { imagen: lote.imagen, enlace: `/lotes/${lote.slug}` };
    const set = getSet(l.productoId);
    if (set) return { imagen: set.imagen, enlace: "/catalogo/sets" };
    return { imagen: null, enlace: null };
  }
  const p = getProductoPorId(l.productoId);
  return p ? { imagen: p.imagenes[0] ?? null, enlace: `/producto/${p.slug}` } : { imagen: null, enlace: null };
}

/**
 * Las líneas tal como se cobraron, lotes y sets incluidos. En pedidos
 * heredados no hay precio por línea (esa copia no lo guardó) y se dice en vez
 * de enseñar $0.
 */
export function ListaLineas({
  lineas,
  heredado = false,
}: {
  lineas: LineaPedido[];
  heredado?: boolean;
}) {
  if (lineas.length === 0) {
    return <p className="text-fg-muted text-sm">Este pedido no guardó sus artículos.</p>;
  }
  return (
    <ul className="divide-border-soft border-border-soft divide-y border-y">
      {lineas.map((l) => {
        const { imagen, enlace } = fichaDe(l);
        const foto = (
          <span className="bg-surface relative grid size-16 shrink-0 place-items-center overflow-hidden rounded">
            {imagen ? (
              <Imagen src={imagen} alt="" sizes="64px" />
            ) : (
              <Package size={20} className="text-fg-subtle" aria-hidden />
            )}
          </span>
        );
        return (
          <li key={`${l.productoId}-${l.ml}`} className="flex items-center gap-4 py-4">
            {enlace ? (
              <Link href={enlace} tabIndex={-1} aria-hidden className="print:hidden">
                {foto}
              </Link>
            ) : (
              <span className="print:hidden">{foto}</span>
            )}
            <div className="min-w-0 flex-1">
              {enlace ? (
                <Link href={enlace} className="font-display hover:text-gold-light block">
                  {l.nombre}
                </Link>
              ) : (
                <p className="font-display">{l.nombre}</p>
              )}
              <p className="text-fg-subtle text-xs">
                {l.detalle} · {l.cantidad} {l.cantidad === 1 ? "unidad" : "unidades"}
                {!heredado && l.cantidad > 1 ? ` · ${fmt(l.unitario)} c/u` : ""}
              </p>
            </div>
            {heredado ? null : <Precio valor={l.subtotal} className="shrink-0 text-sm" />}
          </li>
        );
      })}
    </ul>
  );
}

/** El desglose completo: de dónde sale el total que se cobró. */
export function DesgloseCifras({
  cifras,
  heredado = false,
}: {
  cifras: CifrasPedido;
  heredado?: boolean;
}) {
  const filas: { etiqueta: string; valor: number; resta?: boolean; nota?: string }[] = heredado
    ? []
    : [
        { etiqueta: "Subtotal a precio de menudeo", valor: cifras.subtotalMenudeo },
        ...(cifras.ahorroVolumen > 0
          ? [
              {
                // En Menudeo no hay descuento por volumen: el ahorro viene
                // del precio de un lote o un set.
                etiqueta:
                  cifras.escalon === "Menudeo"
                    ? "Ahorro en paquetes"
                    : cifras.escalon
                      ? `Precio por volumen (${cifras.escalon})`
                      : "Precio por volumen",
                valor: cifras.ahorroVolumen,
                resta: true,
              },
            ]
          : []),
        ...(cifras.descuento3x2 > 0
          ? [{ etiqueta: "Promoción 3x2", valor: cifras.descuento3x2, resta: true }]
          : []),
        ...(cifras.descuentoCupon > 0
          ? [
              {
                etiqueta: cifras.cupon ? `Cupón ${cifras.cupon}` : "Cupón",
                valor: cifras.descuentoCupon,
                resta: true,
              },
            ]
          : []),
        ...(cifras.descuentoTransferencia > 0
          ? [
              {
                etiqueta: "Descuento por transferencia",
                valor: cifras.descuentoTransferencia,
                resta: true,
              },
            ]
          : []),
        // `envioGratis` dice que el pedido alcanzó las piezas, no que el envío
        // saliera gratis: el express se cobra igual.
        {
          etiqueta: "Envío",
          valor: cifras.costoEnvio,
          nota: cifras.envioGratis && cifras.costoEnvio === 0 ? "Gratis" : undefined,
        },
        ...(cifras.comision > 0
          ? [{ etiqueta: "Servicio de cobro en destino", valor: cifras.comision }]
          : []),
      ];

  return (
    <dl className="text-sm">
      {filas.map((f) => (
        <div key={f.etiqueta} className="flex justify-between gap-4 py-1.5">
          <dt className="text-fg-muted">{f.etiqueta}</dt>
          <dd data-precio className={f.resta ? "text-success" : undefined}>
            {f.nota ?? `${f.resta ? "−" : ""}${fmt(f.valor)}`}
          </dd>
        </div>
      ))}
      <div className="border-border-soft mt-2 flex items-baseline justify-between gap-4 border-t pt-3">
        <dt className="font-medium">Total</dt>
        <dd>
          <Precio valor={cifras.total} moneda className="text-gold-light font-medium" />
        </dd>
      </div>
      <p className="text-fg-subtle mt-1 text-xs">
        {cifras.piezas} {cifras.piezas === 1 ? "pieza" : "piezas"}
        {heredado ? " · Este pedido es anterior al desglose por concepto." : ""}
      </p>
    </dl>
  );
}

/* ── Cómo pagar ───────────────────────────────────────────────────────── */

/**
 * Qué hacer para pagar un pedido «Pendiente», según su forma de pago.
 *
 * Existe porque la pantalla de gracias no es para siempre: quien la cerró sin
 * mandar el WhatsApp se quedaba con un pedido apartado y sin saber cómo
 * pagarlo. El WhatsApp lleva el folio y el total ya escritos, que es con lo que
 * la tienda encuentra el pedido en el panel.
 */
export function ComoPagar({
  folio,
  metodo,
  plazo,
  total,
}: {
  folio: string;
  metodo: IdPago | null;
  plazo: number | null;
  total: number;
}) {
  const forma = etiquetaPago(metodo, plazo);
  const texto = [
    `Hola, quiero pagar mi pedido ${folio} por ${fmt(total)} MXN.`,
    forma ? `Forma de pago: ${forma}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const instrucciones =
    metodo === "clip"
      ? CLIP_LINK
        ? "Paga con tarjeta o en efectivo en la pantalla segura de Clip y mándanos el comprobante por WhatsApp con tu folio."
        : "Escríbenos por WhatsApp con tu folio y te mandamos el enlace de cobro de Clip para pagar con tarjeta o en efectivo."
      : metodo === "transferencia"
        ? HAY_DATOS_BANCARIOS
          ? "Transfiere el total exacto por SPEI o deposita en ventanilla, y mándanos el comprobante por WhatsApp con tu folio."
          : "Escríbenos por WhatsApp con tu folio y te pasamos la CLABE y el monto exacto. Enviamos en cuanto entra el pago."
        : metodo === "contra"
          ? "Pagas en efectivo al repartidor cuando recibas el paquete. Escríbenos por WhatsApp con tu folio para acordar el día de entrega."
          : "Escríbenos por WhatsApp con tu folio y te decimos cómo pagarlo.";

  return (
    <section className="border-gold/35 bg-gold-muted rounded-lg border p-5 print:hidden">
      <h2 className="font-display mb-1.5 text-lg">Cómo pagar</h2>
      <p className="text-fg-muted mb-4 text-sm leading-relaxed">{instrucciones}</p>
      {metodo === "clip" && plazo ? (
        <p className="text-fg-muted mb-4 text-sm">
          Elegiste {plazo} meses sin intereses con tarjetas participantes.
        </p>
      ) : null}

      {metodo === "transferencia" && HAY_DATOS_BANCARIOS ? (
        <dl className="border-border-soft bg-surface mb-4 grid gap-2 rounded-md border px-4 py-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Banco</dt>
            <dd>{DATOS_BANCARIOS.banco}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Titular</dt>
            <dd className="text-right">{DATOS_BANCARIOS.titular}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">CLABE</dt>
            <dd data-precio className="text-gold-light break-all">
              {DATOS_BANCARIOS.clabe}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-fg-muted">Monto</dt>
            <dd data-precio>{fmt(total)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="grid gap-2">
        {metodo === "clip" && CLIP_LINK ? (
          <Button asChild variant="gold" size="touch-lg" className="w-full">
            <a href={CLIP_LINK} target="_blank" rel="noopener noreferrer">
              Pagar {fmt(total)} con Clip
            </a>
          </Button>
        ) : null}
        <Button
          asChild
          variant={metodo === "clip" && CLIP_LINK ? "outline" : "gold"}
          size="touch-lg"
          className="w-full"
        >
          <a href={enlaceWhatsApp(texto)} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} aria-hidden />
            Escribir por WhatsApp con mi folio
          </a>
        </Button>
      </div>
    </section>
  );
}

/* ── Impresión ────────────────────────────────────────────────────────── */

/**
 * Hoja de impresión del comprobante.
 *
 * Imprime solo lo que va dentro de `[data-comprobante]`: la cabecera, el pie y
 * los botones flotantes de la tienda viven en el layout y no hay forma de
 * marcarlos desde aquí, así que se ocultan con `visibility` en vez de tocar el
 * layout. Fondo blanco y texto negro: el tema oscuro en papel gasta un cartucho
 * y se lee peor.
 */
export function EstiloImpresion() {
  return (
    <style>{`
@media print {
  @page { margin: 12mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  [data-comprobante], [data-comprobante] * { visibility: visible !important; }
  [data-comprobante] { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0 !important; }
  [data-comprobante] * {
    color: #000 !important; background: transparent !important;
    box-shadow: none !important; border-color: #bbb !important;
  }
}
`}</style>
  );
}
