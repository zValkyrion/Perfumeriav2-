"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Download, Plus, RefreshCw, Search, Truck, X } from "lucide-react";
import { Mensaje } from "@/components/catalogo/comun";
import { ErrorCarga, InsigniaEstatus, PuertaAdmin, pesosCentavos, usePanelAdmin } from "@/components/tienda/comun";
import { BotonIcono, EncabezadoPagina, Esqueleto, Segmentado } from "@/components/panel/piezas";
import { pesosRedondos } from "@/components/panel/graficas";
import { listarPedidosAdmin, type EstatusPedido, type ResumenPedido } from "@/lib/tienda-admin";
import { cn } from "@/lib/utils";
import {
  ESTATUS,
  ETIQUETA_METODO,
  POR_ENVIAR,
  coincide,
  csvPedidos,
  descargar,
  enlacePedido,
  fechaDia,
  hoyMexico,
  nombrePaqueteria,
  sumarDias,
} from "@/components/pedidos/comun";

/**
 * La lista de pedidos: lo que el dueño abre en la mañana para ver qué cobrar,
 * qué surtir y qué mandar.
 *
 * - **Computadora:** tabla completa (folio, cliente, destino, piezas, total,
 *   pago, estatus, guía) con la fila entera como enlace.
 * - **Teléfono:** tarjetas con lo esencial.
 *
 * El rango se pide al servidor (el corte por día es de calendario de México);
 * estatus, forma de pago, búsqueda y orden se aplican aquí, sobre lo que ya
 * llegó, para que cambiar un filtro no espere a la red. El tablero manda aquí
 * con `?estatus=`.
 */

type Rango = "7d" | "30d" | "mes" | "todo";
type FiltroEstatus = "todos" | EstatusPedido;
type FiltroPago = "todos" | "clip" | "transferencia" | "contra";
type Orden = "recientes" | "antiguos" | "total";

const RANGOS: { valor: Rango; etiqueta: string }[] = [
  { valor: "7d", etiqueta: "7 días" },
  { valor: "30d", etiqueta: "30 días" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "todo", etiqueta: "Todo" },
];

const ORDENES: { valor: Orden; etiqueta: string }[] = [
  { valor: "recientes", etiqueta: "Más recientes" },
  { valor: "antiguos", etiqueta: "Más antiguos" },
  { valor: "total", etiqueta: "Mayor total" },
];

const PAGOS: { valor: FiltroPago; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Toda forma de pago" },
  { valor: "transferencia", etiqueta: ETIQUETA_METODO.transferencia },
  { valor: "clip", etiqueta: ETIQUETA_METODO.clip },
  { valor: "contra", etiqueta: ETIQUETA_METODO.contra },
];

/** Cuántas filas se pintan de entrada: cientos de filas en un teléfono pesan. */
const PAGINA = 50;

/** Dónde se quedó la lista, para volver del detalle al mismo sitio. */
const CLAVE_VISTA = "radar:pedidos:vista";

type Vista = { rango?: Rango; estatus?: FiltroEstatus; busqueda?: string; pago?: FiltroPago; orden?: Orden };

function vistaGuardada(): Vista {
  if (typeof window === "undefined") return {};
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE_VISTA) ?? "{}") as Vista;
    return {
      rango: RANGOS.some((r) => r.valor === v.rango) ? v.rango : undefined,
      estatus: v.estatus === "todos" || ESTATUS.includes(v.estatus as EstatusPedido) ? v.estatus : undefined,
      busqueda: typeof v.busqueda === "string" ? v.busqueda : undefined,
      pago: PAGOS.some((p) => p.valor === v.pago) ? v.pago : undefined,
      orden: ORDENES.some((o) => o.valor === v.orden) ? v.orden : undefined,
    };
  } catch {
    return {};
  }
}

/** `desde` / `hasta` del rango, con el «hoy» de México. `todo` = sin límite. */
function fechasDe(rango: Rango, hoy: string): { desde: string | null; hasta: string | null } {
  switch (rango) {
    case "7d":
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case "30d":
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case "mes":
      return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
    case "todo":
      return { desde: null, hasta: null };
  }
}

const ORDENAR: Record<Orden, (a: ResumenPedido, b: ResumenPedido) => number> = {
  recientes: (a, b) => b.creadoEn.localeCompare(a.creadoEn),
  antiguos: (a, b) => a.creadoEn.localeCompare(b.creadoEn),
  total: (a, b) => b.total - a.total || b.creadoEn.localeCompare(a.creadoEn),
};

const horaMexico = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });

export function VistaPedidos() {
  const params = useSearchParams();
  const router = useRouter();
  const [inicial] = useState(() => {
    const v = vistaGuardada();
    // Lo que manda el tablero (`?estatus=`) gana sobre lo recordado.
    const delEnlace = params.get("estatus");
    if (delEnlace && ESTATUS.includes(delEnlace as EstatusPedido)) {
      return { ...v, estatus: delEnlace as EstatusPedido, busqueda: "", rango: "todo" as Rango, pago: "todos" as FiltroPago };
    }
    return v;
  });
  // «Todo» por defecto: un pedido pagado hace 35 días y sin mandar es
  // justamente el que no se puede quedar fuera de la vista.
  const [rango, setRango] = useState<Rango>(inicial.rango ?? "todo");
  const [estatus, setEstatus] = useState<FiltroEstatus>(inicial.estatus ?? "todos");
  const [busqueda, setBusqueda] = useState(inicial.busqueda ?? "");
  const [pago, setPago] = useState<FiltroPago>(inicial.pago ?? "todos");
  const [orden, setOrden] = useState<Orden>(inicial.orden ?? "recientes");
  const [limite, setLimite] = useState(PAGINA);

  const hoy = hoyMexico();
  const { desde, hasta } = fechasDe(rango, hoy);
  const claveRango = `${desde ?? ""}|${hasta ?? ""}`;
  // Cada respuesta se marca con el rango que se pidió: sin la marca, al
  // cambiar de «Todo» a «7 días» se verían un momento los pedidos del rango
  // anterior con los conteos del nuevo.
  const c = usePanelAdmin(
    async (token) => ({ ...(await listarPedidosAdmin(token, { desde, hasta })), rango: claveRango }),
    claveRango,
  );
  const datos = c.datos?.rango === claveRango ? c.datos : null;

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_VISTA, JSON.stringify({ rango, estatus, busqueda, pago, orden }));
    } catch {
      // No pasa nada: solo se pierde el recordatorio.
    }
  }, [rango, estatus, busqueda, pago, orden]);

  const pedidos = datos?.pedidos;
  // Los conteos de las pestañas salen de lo buscado y del pago, antes del
  // filtro de estatus: así cada pestaña dice cuántos hay de verdad si se toca.
  const buscados = useMemo(
    () => (pedidos ?? []).filter((p) => coincide(p, busqueda) && (pago === "todos" || p.metodo === pago)),
    [pedidos, busqueda, pago],
  );
  const conteo = useMemo(() => {
    const n = new Map<EstatusPedido, number>();
    for (const p of buscados) n.set(p.estatus, (n.get(p.estatus) ?? 0) + 1);
    return n;
  }, [buscados]);
  const visibles = useMemo(
    () => (estatus === "todos" ? buscados : buscados.filter((p) => p.estatus === estatus)).slice().sort(ORDENAR[orden]),
    [buscados, estatus, orden],
  );

  const bloqueo = PuertaAdmin({ c, titulo: "La lista de pedidos", volver: "/tienda/" });
  if (bloqueo) return bloqueo;

  const todos = pedidos ?? [];
  const pendientes = todos.filter((p) => p.estatus === "Pendiente");
  const porEnviar = todos.filter((p) => POR_ENVIAR.includes(p.estatus));
  const vendidos = todos.filter((p) => !["Pendiente", "Cancelado"].includes(p.estatus));
  const hayFiltros = busqueda.trim() !== "" || pago !== "todos" || estatus !== "todos";

  const exportar = () => {
    const sufijo = desde && hasta ? `${desde}_a_${hasta}` : `todo_${hoy}`;
    descargar(csvPedidos(visibles), `pedidos-${sufijo}.csv`);
  };

  const limpiar = () => {
    setBusqueda("");
    setPago("todos");
    setEstatus("todos");
    setLimite(PAGINA);
  };

  return (
    <main className="p-4 pb-12 sm:p-6">
      <EncabezadoPagina
        titulo="Pedidos"
        subtitulo="Cobra, surte, envía y da seguimiento a cada pedido."
        acciones={
          <>
            <BotonIcono etiqueta="Volver a leer los pedidos" onClick={c.recargar} disabled={c.cargando}>
              <RefreshCw size={18} className={cn(c.cargando && "animate-spin")} />
            </BotonIcono>
            <BotonIcono etiqueta="Exportar a Excel (CSV) lo que se ve" onClick={exportar} disabled={visibles.length === 0}>
              <Download size={18} />
            </BotonIcono>
            <Link
              href="/pedidos/nuevo/"
              className="lift inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-gold-deep bg-gold-gradient px-4 text-[14px] font-semibold text-white sm:flex-none"
            >
              <Plus size={18} />
              Nuevo pedido
            </Link>
          </>
        }
      />

      {/* Resumen del rango */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumen etiqueta="Pedidos en el rango" valor={pedidos ? todos.length.toLocaleString("es-MX") : null} />
        <Resumen
          etiqueta="Por cobrar"
          valor={pedidos ? pesosRedondos(pendientes.reduce((s, p) => s + p.total, 0)) : null}
          detalle={pedidos ? `${pendientes.length} pendientes` : undefined}
          onClick={() => setEstatus("Pendiente")}
        />
        <Resumen
          etiqueta="Vendido"
          valor={pedidos ? pesosRedondos(vendidos.reduce((s, p) => s + p.total, 0)) : null}
          detalle={pedidos ? `${vendidos.length} pedidos` : undefined}
        />
        <Resumen
          etiqueta="Por enviar"
          valor={pedidos ? porEnviar.length.toLocaleString("es-MX") : null}
          detalle="pagados y en preparación"
          onClick={() => setEstatus("Pagado")}
        />
      </div>

      {c.error && (
        <div className="mb-3">
          <ErrorCarga mensaje={c.error} recargar={c.recargar} cargando={c.cargando} />
        </div>
      )}
      {datos?.truncado && (
        <div className="mb-3">
          <Mensaje tono="aviso">
            Son demasiados pedidos para leerlos de una vez: se ven los 5000 más recientes. Elige un rango más corto.
          </Mensaje>
        </div>
      )}

      <section className="tarjeta-panel">
        {/* Barra de filtros */}
        <div className="grid gap-3 border-b border-border-soft p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
          <label className="relative block">
            <span className="sr-only">Buscar pedidos</span>
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setLimite(PAGINA);
              }}
              placeholder="Folio, nombre, teléfono, correo o ciudad"
              className="h-11 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-10 pr-3 placeholder:text-fg-subtle"
            />
          </label>
          <Segmentado etiqueta="Rango de fechas" opciones={RANGOS} valor={rango} onChange={(r) => { setRango(r); setLimite(PAGINA); }} />
          <div className="grid grid-cols-2 gap-2 lg:contents">
            <select
              aria-label="Forma de pago"
              value={pago}
              onChange={(e) => setPago(e.target.value as FiltroPago)}
              className="h-11 rounded-[var(--radius-md)] border border-border-strong bg-surface px-2 text-[14px]"
            >
              {PAGOS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
            <label className="relative">
              <span className="sr-only">Ordenar</span>
              <ArrowDownUp size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                className="h-11 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-8 pr-2 text-[14px]"
              >
                {ORDENES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Pestañas de estatus */}
        <div className="flex gap-1 overflow-x-auto border-b border-border-soft px-2 sm:px-3" role="tablist" aria-label="Estatus">
          <Pestana activa={estatus === "todos"} onClick={() => setEstatus("todos")} texto="Todos" n={pedidos ? buscados.length : null} />
          {ESTATUS.map((e) => (
            <Pestana key={e} activa={estatus === e} onClick={() => setEstatus(e)} texto={e} n={pedidos ? (conteo.get(e) ?? 0) : null} />
          ))}
        </div>

        {/* Lista */}
        {!pedidos ? (
          c.cargando || !c.error ? (
            <div className="grid gap-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Esqueleto key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : null
        ) : visibles.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[15px] font-semibold">
              {pedidos.length === 0 ? (rango === "todo" ? "Todavía no hay pedidos" : "No hay pedidos en este rango") : "Ningún pedido coincide"}
            </p>
            <p className="mt-1 text-[14px] text-fg-subtle">
              {pedidos.length === 0 ? "Cuando entre uno —o lo captures— aparece aquí." : "Prueba con otro filtro o búscalo de otra forma."}
            </p>
            {hayFiltros && pedidos.length > 0 && (
              <button type="button" onClick={limpiar} className="mt-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-semibold text-info">
                <X size={16} /> Quitar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Teléfono */}
            <ul className="grid gap-2 p-3 md:hidden">
              {visibles.slice(0, limite).map((p) => (
                <li key={p.folio}>
                  <TarjetaPedido pedido={p} />
                </li>
              ))}
            </ul>
            {/* Computadora */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="border-b border-border-soft bg-surface-2/50 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                    <th className="px-4 py-2.5">Folio</th>
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="hidden px-3 py-2.5 lg:table-cell">Destino</th>
                    <th className="px-3 py-2.5 text-right">Piezas</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="hidden px-3 py-2.5 xl:table-cell">Pago</th>
                    <th className="px-3 py-2.5">Estatus</th>
                    <th className="hidden px-4 py-2.5 xl:table-cell">Envío</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.slice(0, limite).map((p) => (
                    <tr
                      key={p.folio}
                      onClick={(e) => {
                        // Toda la fila abre el pedido; el folio sigue siendo un enlace de verdad
                        // (teclado, abrir en otra pestaña).
                        if ((e.target as HTMLElement).closest("a")) return;
                        router.push(enlacePedido(p.folio));
                      }}
                      className="cursor-pointer border-b border-border-soft last:border-b-0 hover:bg-surface-2/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link href={enlacePedido(p.folio)} className="font-semibold text-info hover:underline">
                          {p.folio}
                        </Link>
                        <span className="block text-[12px] text-fg-subtle">
                          {fechaDia(p.fecha)} · {horaMexico(p.creadoEn)}
                        </span>
                      </td>
                      <td className="max-w-[15rem] px-3 py-3">
                        <span className="block truncate font-semibold">{p.nombre || "Sin nombre"}</span>
                        <span className="block truncate text-[12px] text-fg-subtle">
                          {p.telefono || p.correo || "Sin contacto"}
                          {p.conCuenta && " · con cuenta"}
                        </span>
                      </td>
                      <td className="hidden max-w-[12rem] truncate px-3 py-3 text-fg-muted lg:table-cell">
                        {[p.ciudad, p.estado].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="cifra px-3 py-3 text-right">{p.piezas}</td>
                      <td className="cifra whitespace-nowrap px-3 py-3 text-right font-semibold">{pesosCentavos(p.total)}</td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-fg-muted xl:table-cell">
                        {p.metodo ? ETIQUETA_METODO[p.metodo] : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <InsigniaEstatus estatus={p.estatus} />
                      </td>
                      <td className="hidden max-w-[11rem] truncate px-4 py-3 text-[13px] text-fg-muted xl:table-cell">
                        {p.guia ? (
                          <span className="inline-flex items-center gap-1">
                            <Truck size={14} className="shrink-0 text-fg-subtle" />
                            {nombrePaqueteria(p.paqueteria) ?? ""} {p.guia}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft px-4 py-3 text-[13px] text-fg-subtle">
              <span>
                {Math.min(limite, visibles.length)} de {visibles.length} {visibles.length === 1 ? "pedido" : "pedidos"}
              </span>
              {visibles.length > limite && (
                <button
                  type="button"
                  onClick={() => setLimite((n) => n + PAGINA)}
                  className="min-h-10 rounded-[var(--radius-md)] border border-border-strong bg-surface px-4 font-semibold text-fg hover:bg-surface-2"
                >
                  Ver {Math.min(PAGINA, visibles.length - limite)} más
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Resumen({
  etiqueta,
  valor,
  detalle,
  onClick,
}: {
  etiqueta: string;
  valor: string | null;
  detalle?: string;
  onClick?: () => void;
}) {
  const cuerpo = (
    <>
      <span className="block text-[12px] font-semibold text-fg-subtle">{etiqueta}</span>
      {valor === null ? (
        <Esqueleto className="mt-1.5 h-6 w-20" />
      ) : (
        <span className="cifra mt-1 block truncate text-[20px] font-bold leading-tight">{valor}</span>
      )}
      {detalle && <span className="mt-0.5 block truncate text-[12px] text-fg-subtle">{detalle}</span>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="tarjeta-panel lift p-3 text-left sm:p-4">
      {cuerpo}
    </button>
  ) : (
    <div className="tarjeta-panel p-3 sm:p-4">{cuerpo}</div>
  );
}

function Pestana({ activa, onClick, texto, n }: { activa: boolean; onClick: () => void; texto: string; n: number | null }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[14px] font-semibold transition-colors",
        activa ? "border-gold text-fg" : "border-transparent text-fg-subtle hover:text-fg",
      )}
    >
      {texto}
      {/* Sin datos (cargando o sin red) va sin número: un cero diría «no hay». */}
      {n !== null && (
        <span
          className={cn(
            "cifra min-w-6 rounded-full px-1.5 text-center text-[12px]",
            activa ? "bg-gold text-white" : "bg-surface-2 text-fg-muted",
          )}
        >
          {n}
        </span>
      )}
    </button>
  );
}

function TarjetaPedido({ pedido: p }: { pedido: ResumenPedido }) {
  const lugar = [p.ciudad, p.estado].filter(Boolean).join(", ");
  return (
    <Link href={enlacePedido(p.folio)} className="lift block rounded-[var(--radius-md)] border border-border-soft bg-surface p-3">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-semibold">{p.nombre || "Sin nombre"}</span>
        <span className="cifra shrink-0 text-[15px] font-semibold">{pesosCentavos(p.total)}</span>
      </span>
      <span className="mt-1 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-fg-subtle">
          <span className="font-semibold text-fg-muted">{p.folio}</span> · {fechaDia(p.fecha)}
          {lugar && ` · ${lugar}`}
        </span>
        <span className="shrink-0">
          <InsigniaEstatus estatus={p.estatus} />
        </span>
      </span>
      <span className="mt-1 block truncate text-[12px] text-fg-subtle">
        {p.piezas} {p.piezas === 1 ? "pieza" : "piezas"}
        {p.metodo && ` · ${ETIQUETA_METODO[p.metodo]}`}
        {p.guia ? ` · guía ${p.guia}` : ""}
      </span>
    </Link>
  );
}
