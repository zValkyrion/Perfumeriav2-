"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Minus, PackageOpen, Plus, Search, Trash2 } from "lucide-react";
import { Campo } from "@/components/ui";
import { pesosCentavos } from "@/components/tienda/comun";
import { ETIQUETA_ENVIO, ETIQUETA_METODO, normalizar } from "@/components/pedidos/comun";
import {
  cotizarPedido,
  leerCatalogoPublico,
  type ArticulosPedido,
  type Catalogo,
  type ContactoPedido,
  type CotizacionAdmin,
  type IdEnvio,
  type IdPago,
} from "@/lib/tienda-admin";
import { cn } from "@/lib/utils";

/**
 * Armar o cambiar lo que lleva un pedido, para el panel.
 *
 * **El total nunca se calcula aquí.** Cada cambio pide `POST /admin/cotizar`
 * —la misma función con la que cobra el servidor— y lo que se enseña es esa
 * respuesta. Así lo que el dueño ve antes de guardar es exactamente lo que va
 * a quedar, con los precios, el escalón de volumen, el 3x2, el descuento por
 * transferencia y el envío de hoy.
 *
 * Los artículos se eligen del catálogo publicado (`GET /catalogo`): solo lo
 * visible, y lo agotado se enseña pero no se deja agregar (el servidor tampoco
 * lo cobraría).
 */

const MAX_CANTIDAD = 999;

/* ── El catálogo, como opciones ───────────────────────────────────────────── */

export type Opcion = {
  /** `${productoId}|${ml}` */
  clave: string;
  productoId: string;
  ml: number;
  nombre: string;
  detalle: string;
  precio: number;
  agotado: boolean;
  /** Texto normalizado para buscar. */
  busqueda: string;
};

function opcionesDe(c: Catalogo): Opcion[] {
  const marcas = new Map(c.marcas.map((m) => [m.slug, m.nombre]));
  const salida: Opcion[] = [];
  for (const p of c.productos) {
    const marca = marcas.get(p.marca) ?? "";
    const nombre = marca && !p.nombre.toLowerCase().startsWith(marca.toLowerCase()) ? `${marca} ${p.nombre}` : p.nombre;
    for (const v of [...p.presentaciones].sort((a, b) => b.ml - a.ml)) {
      salida.push({
        clave: `${p.codigo}|${v.ml}`,
        productoId: p.codigo,
        ml: v.ml,
        nombre,
        detalle: `${v.ml} ml · ${p.genero} · código ${p.codigo}`,
        precio: v.precio,
        agotado: p.agotado,
        busqueda: normalizar(`${nombre} ${p.codigo} ${p.codigosAlternos.join(" ")} ${p.familia} ${v.ml}ml`),
      });
    }
  }
  for (const s of c.sets) {
    salida.push({
      clave: `${s.slug}|0`,
      productoId: s.slug,
      ml: 0,
      nombre: s.nombre,
      detalle: "Set de regalo",
      precio: s.precio,
      agotado: s.agotado,
      busqueda: normalizar(`${s.nombre} set regalo ${s.codigo}`),
    });
  }
  for (const l of c.lotes) {
    salida.push({
      clave: `${l.slug}|0`,
      productoId: l.slug,
      ml: 0,
      nombre: l.nombre,
      detalle: `Lote · ${l.piezas} piezas`,
      precio: l.precio,
      agotado: false,
      busqueda: normalizar(`${l.nombre} lote paquete ${l.piezas} piezas`),
    });
  }
  return salida;
}

/** El catálogo como opciones, leído una vez por pestaña. */
export function useOpciones() {
  const [estado, setEstado] = useState<{ opciones: Opcion[] | null; error: string | null }>({ opciones: null, error: null });
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vivo = true;
    leerCatalogoPublico().then(
      (c) => vivo && setEstado({ opciones: opcionesDe(c), error: null }),
      (e) => vivo && setEstado({ opciones: null, error: e instanceof Error ? e.message : "No se pudo leer el catálogo" }),
    );
    return () => {
      vivo = false;
    };
  }, [intento]);
  return { ...estado, reintentar: () => setIntento((n) => n + 1) };
}

/* ── La cotización en vivo ────────────────────────────────────────────────── */

export type EstadoCotizacion = { cotizacion: CotizacionAdmin | null; cargando: boolean; error: string | null };

/**
 * Pide la cotización al servidor cada vez que cambian los artículos, con una
 * pausa de 350 ms para no mandar una petición por cada toque del «+». Una
 * respuesta vieja que llegue tarde se descarta.
 */
export function useCotizacion(token: string | null, articulos: ArticulosPedido): EstadoCotizacion {
  // La última respuesta, marcada con lo que se cotizó. «Calculando» no es un
  // estado aparte: es que lo pedido ahora no coincide con lo respondido.
  const [respuesta, setRespuesta] = useState<{ clave: string; cotizacion: CotizacionAdmin | null; error: string | null } | null>(null);
  const turno = useRef(0);
  const clave = JSON.stringify(articulos);
  const vacio = articulos.items.length === 0;

  useEffect(() => {
    const yo = ++turno.current;
    if (!token || vacio) return;
    const a = JSON.parse(clave) as ArticulosPedido;
    const espera = setTimeout(() => {
      cotizarPedido(token, a).then(
        (c) => yo === turno.current && setRespuesta({ clave, cotizacion: c, error: null }),
        (e) =>
          yo === turno.current &&
          setRespuesta((r) => ({
            clave,
            cotizacion: r?.cotizacion ?? null,
            error: e instanceof Error ? e.message : "No se pudo cotizar",
          })),
      );
    }, 350);
    return () => clearTimeout(espera);
  }, [token, clave, vacio]);

  if (vacio) return { cotizacion: null, cargando: false, error: null };
  return {
    // Mientras llega la nueva se enseña la anterior (atenuada), no un hueco.
    cotizacion: respuesta?.cotizacion ?? null,
    cargando: Boolean(token) && respuesta?.clave !== clave,
    error: respuesta?.clave === clave ? respuesta.error : null,
  };
}

/* ── Editor ───────────────────────────────────────────────────────────────── */

const METODOS: IdPago[] = ["transferencia", "clip", "contra"];
const ENVIOS: IdEnvio[] = ["estandar", "express", "mismo-dia"];

export function EditorArticulos({
  valor,
  onChange,
  opciones,
  errorCatalogo,
  reintentarCatalogo,
}: {
  valor: ArticulosPedido;
  onChange: (v: ArticulosPedido) => void;
  opciones: Opcion[] | null;
  errorCatalogo: string | null;
  reintentarCatalogo: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const porClave = useMemo(() => new Map((opciones ?? []).map((o) => [o.clave, o])), [opciones]);

  const q = normalizar(busqueda.trim());
  const resultados = useMemo(() => {
    if (!opciones || q.length < 2) return [];
    const palabras = q.split(/\s+/);
    return opciones.filter((o) => palabras.every((p) => o.busqueda.includes(p))).slice(0, 12);
  }, [opciones, q]);

  const poner = (items: ArticulosPedido["items"]) => onChange({ ...valor, items });

  const agregar = (o: Opcion) => {
    const i = valor.items.findIndex((x) => x.productoId === o.productoId && x.ml === o.ml);
    if (i >= 0) {
      poner(valor.items.map((x, j) => (j === i ? { ...x, cantidad: Math.min(MAX_CANTIDAD, x.cantidad + 1) } : x)));
    } else {
      poner([...valor.items, { productoId: o.productoId, ml: o.ml, cantidad: 1 }]);
    }
    setBusqueda("");
  };

  const cantidad = (i: number, n: number) => {
    if (n <= 0) poner(valor.items.filter((_, j) => j !== i));
    else poner(valor.items.map((x, j) => (j === i ? { ...x, cantidad: Math.min(MAX_CANTIDAD, n) } : x)));
  };

  return (
    <div className="grid gap-5">
      {/* Buscar y agregar */}
      <div>
        <label className="relative block">
          <span className="mb-1 block text-[13px] font-semibold text-fg-muted">Agregar artículo</span>
          <Search size={18} className="pointer-events-none absolute bottom-3.5 left-3 text-fg-subtle" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={opciones ? "Nombre, marca, código o «lote»" : "Cargando el catálogo…"}
            disabled={!opciones}
            className="h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-10 pr-3 placeholder:text-fg-subtle disabled:bg-surface-2"
          />
        </label>
        {errorCatalogo && (
          <p className="mt-2 text-[13px] text-danger">
            {errorCatalogo}{" "}
            <button type="button" onClick={reintentarCatalogo} className="font-semibold underline">
              Reintentar
            </button>
          </p>
        )}
        {q.length >= 2 && opciones && (
          <ul className="mt-2 max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-border-soft bg-surface shadow-sm">
            {resultados.length === 0 ? (
              <li className="px-3 py-4 text-center text-[14px] text-fg-subtle">Nada coincide con «{busqueda.trim()}».</li>
            ) : (
              resultados.map((o) => (
                <li key={o.clave} className="border-b border-border-soft last:border-b-0">
                  <button
                    type="button"
                    disabled={o.agotado}
                    onClick={() => agregar(o)}
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{o.nombre}</span>
                      <span className="block truncate text-[12px] text-fg-subtle">
                        {o.detalle}
                        {o.agotado && " · agotado"}
                      </span>
                    </span>
                    <span className="cifra shrink-0 text-[14px] font-semibold">{pesosCentavos(o.precio)}</span>
                    {!o.agotado && (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-muted text-gold">
                        <Plus size={16} />
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Lo que lleva */}
      <div>
        <p className="mb-2 text-[13px] font-semibold text-fg-muted">
          Artículos ({valor.items.reduce((s, i) => s + i.cantidad, 0)} piezas)
        </p>
        {valor.items.length === 0 ? (
          <div className="grid place-items-center gap-1 rounded-[var(--radius-md)] border border-dashed border-border-strong px-4 py-8 text-center">
            <PackageOpen size={26} className="text-fg-subtle" />
            <p className="text-[14px] font-semibold">Todavía no lleva nada</p>
            <p className="text-[13px] text-fg-subtle">Búscalo arriba por nombre, marca o código.</p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {valor.items.map((it, i) => {
              const o = porClave.get(`${it.productoId}|${it.ml}`);
              return (
                <li
                  key={`${it.productoId}-${it.ml}`}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border-soft p-3"
                >
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block truncate text-[14px] font-semibold">{o?.nombre ?? `Código ${it.productoId}`}</span>
                    <span className="block truncate text-[12px] text-fg-subtle">
                      {o ? `${o.detalle.split(" · ")[0]} · ${pesosCentavos(o.precio)} c/u de lista` : it.ml ? `${it.ml} ml` : "Paquete"}
                      {o?.agotado && " · agotado: no se cobra"}
                      {!o && opciones && " · ya no está en el catálogo: no se cobra"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cantidad(i, it.cantidad - 1)}
                      aria-label={it.cantidad === 1 ? "Quitar" : "Una menos"}
                      className="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] border border-border-strong bg-surface hover:bg-surface-2"
                    >
                      {it.cantidad === 1 ? <Trash2 size={16} className="text-danger" /> : <Minus size={16} />}
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_CANTIDAD}
                      value={it.cantidad}
                      aria-label="Cantidad"
                      onChange={(e) => {
                        const n = Math.round(Number(e.target.value));
                        if (Number.isFinite(n) && n >= 1) cantidad(i, n);
                      }}
                      className="cifra h-10 w-16 rounded-[var(--radius-md)] border border-border-strong bg-surface text-center"
                    />
                    <button
                      type="button"
                      onClick={() => cantidad(i, it.cantidad + 1)}
                      aria-label="Una más"
                      className="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] border border-border-strong bg-surface hover:bg-surface-2"
                    >
                      <Plus size={16} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Condiciones */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Elegir
          etiqueta="Forma de pago"
          opciones={METODOS.map((m) => ({ valor: m, etiqueta: ETIQUETA_METODO[m] }))}
          valor={valor.metodo}
          onChange={(metodo) => onChange({ ...valor, metodo })}
        />
        <Elegir
          etiqueta="Envío"
          opciones={ENVIOS.map((e) => ({ valor: e, etiqueta: ETIQUETA_ENVIO[e] }))}
          valor={valor.envio}
          onChange={(envio) => onChange({ ...valor, envio })}
        />
        <Campo
          etiqueta="Cupón (opcional)"
          value={valor.cupon ?? ""}
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={30}
          onChange={(e) => onChange({ ...valor, cupon: e.target.value.toUpperCase() || null })}
          placeholder="Ej. REY10"
          className="sm:col-span-2"
        />
      </div>
    </div>
  );
}

function Elegir<T extends string>({
  etiqueta,
  opciones,
  valor,
  onChange,
}: {
  etiqueta: string;
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-[13px] font-semibold text-fg-muted">{etiqueta}</span>
      <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            onClick={() => onChange(o.valor)}
            className={cn(
              "min-h-10 rounded-full border px-4 text-[14px] font-semibold transition-colors",
              valor === o.valor
                ? "border-gold-deep bg-gold-gradient text-white"
                : "border-border-strong bg-surface text-fg-muted hover:text-fg",
            )}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Resumen de la cotización ─────────────────────────────────────────────── */

/** El desglose que devolvió el servidor: lo que se va a cobrar. */
export function ResumenCotizacion({
  estado,
  metodoPedido,
  totalAnterior,
}: {
  estado: EstadoCotizacion;
  metodoPedido: IdPago;
  /** Al editar: el total que tenía, para enseñar la diferencia. */
  totalAnterior?: number;
}) {
  const { cotizacion: c, cargando, error } = estado;
  if (!c) {
    return (
      <p className="text-[14px] text-fg-subtle">
        {error ? <span className="text-danger">{error}</span> : cargando ? "Calculando…" : "Agrega artículos para ver el total."}
      </p>
    );
  }
  const k = c.cifras;
  const menos = (n: number) => `−${pesosCentavos(n)}`;
  const filas: [string, string][] = [];
  if (k.subtotalMenudeo > 0 && k.subtotalMenudeo !== k.subtotal) filas.push(["Precio de lista", pesosCentavos(k.subtotalMenudeo)]);
  if (k.ahorroVolumen > 0) {
    // En Menudeo no hay escalera de volumen: ese ahorro es el de un lote o un
    // set frente a sus piezas sueltas (igual que en la tarjeta del pedido).
    filas.push([
      k.escalon === "Menudeo" ? "Ahorro en paquetes" : `Descuento por volumen${k.escalon ? ` (${k.escalon})` : ""}`,
      menos(k.ahorroVolumen),
    ]);
  }
  filas.push(["Subtotal", pesosCentavos(k.subtotal)]);
  if (k.descuento3x2 > 0) filas.push(["Promoción 3x2", menos(k.descuento3x2)]);
  if (k.descuentoCupon > 0) filas.push([`Cupón ${k.cupon ?? ""}`.trim(), menos(k.descuentoCupon)]);
  if (k.descuentoTransferencia > 0) filas.push(["Descuento por transferencia", menos(k.descuentoTransferencia)]);
  filas.push(["Envío", k.envioGratis ? "Gratis" : pesosCentavos(k.costoEnvio)]);
  if (k.comision > 0) filas.push(["Comisión de pago", pesosCentavos(k.comision)]);
  const diferencia = totalAnterior !== undefined ? k.total - totalAnterior : 0;

  return (
    <div className={cn("transition-opacity", cargando && "opacity-60")} aria-busy={cargando}>
      {c.lineas.length > 0 && (
        <ul className="mb-3 grid gap-1.5 text-[13px]">
          {c.lineas.map((l, i) => (
            <li key={`${l.productoId}-${l.ml}-${i}`} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-fg-muted">
                {l.cantidad} × {l.nombre} <span className="text-fg-subtle">({l.detalle})</span>
              </span>
              <span className="cifra shrink-0">{pesosCentavos(l.subtotal)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="grid gap-1 border-t border-border-soft pt-3 text-[14px]">
        {filas.map(([e, v]) => (
          <div key={e} className="flex justify-between gap-3">
            <dt className="text-fg-muted">{e}</dt>
            <dd className="cifra">{v}</dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border-soft pt-2">
          <dt className="text-[16px] font-semibold">Total</dt>
          <dd className="cifra text-[22px] font-bold">{pesosCentavos(k.total)}</dd>
        </div>
      </dl>
      {totalAnterior !== undefined && Math.abs(diferencia) >= 0.01 && (
        <p className="text-right text-[13px] text-fg-subtle">
          Antes {pesosCentavos(totalAnterior)} ({diferencia > 0 ? "+" : "−"}
          {pesosCentavos(Math.abs(diferencia))})
        </p>
      )}
      {c.descartados > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-[13px] text-warning">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {c.descartados === 1 ? "Un artículo no existe" : `${c.descartados} artículos no existen`} o está agotado: no se cobra.
        </p>
      )}
      {c.metodo && c.metodo !== metodoPedido && (
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-warning">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          El contra entrega no aplica a este monto: se cobra con {ETIQUETA_METODO[c.metodo]}.
        </p>
      )}
      {k.piezas > 0 && <p className="mt-2 text-[12px] text-fg-subtle">{k.piezas} piezas · escalón {k.escalon || "—"}</p>}
    </div>
  );
}

/* ── Contacto ─────────────────────────────────────────────────────────────── */

export const CONTACTO_VACIO: ContactoPedido = {
  nombre: "",
  telefono: "",
  correo: "",
  calle: "",
  colonia: "",
  cp: "",
  ciudad: "",
  estado: "",
  referencias: "",
};

/** Lo mínimo para guardar: nombre y 10 dígitos de teléfono (lo mismo que exige el servidor). */
export function errorContacto(c: ContactoPedido): string | null {
  if (!c.nombre.trim()) return "Falta el nombre del cliente";
  if (c.telefono.replace(/\D/g, "").length < 10) return "El teléfono necesita 10 dígitos";
  if (c.cp.trim() && !/^\d{5}$/.test(c.cp.trim())) return "El código postal son 5 dígitos";
  return null;
}

/** Nombre, teléfono, correo y dirección de entrega. */
export function FormContacto({ valor, onChange }: { valor: ContactoPedido; onChange: (c: ContactoPedido) => void }) {
  const campo = (k: keyof ContactoPedido) => ({
    value: valor[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...valor, [k]: e.target.value }),
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo etiqueta="Nombre completo" autoComplete="off" maxLength={120} {...campo("nombre")} className="sm:col-span-2" />
      <Campo etiqueta="Teléfono (WhatsApp)" type="tel" inputMode="tel" autoComplete="off" maxLength={40} {...campo("telefono")} />
      <Campo etiqueta="Correo (opcional)" type="email" inputMode="email" autoComplete="off" maxLength={160} {...campo("correo")} />
      <Campo etiqueta="Calle y número" autoComplete="off" maxLength={200} {...campo("calle")} className="sm:col-span-2" />
      <Campo etiqueta="Colonia" autoComplete="off" maxLength={120} {...campo("colonia")} />
      <Campo etiqueta="Código postal" inputMode="numeric" autoComplete="off" maxLength={5} {...campo("cp")} />
      <Campo etiqueta="Ciudad" autoComplete="off" maxLength={120} {...campo("ciudad")} />
      <Campo etiqueta="Estado" autoComplete="off" maxLength={120} {...campo("estado")} />
      <Campo etiqueta="Referencias (opcional)" autoComplete="off" maxLength={300} {...campo("referencias")} className="sm:col-span-2" />
    </div>
  );
}
