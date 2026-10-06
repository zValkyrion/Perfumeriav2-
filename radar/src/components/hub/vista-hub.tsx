"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  ChevronRight,
  ClipboardList,
  Inbox,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { ErrorCarga, InsigniaEstatus, PuertaAdmin, pesosCentavos, usePanelAdmin } from "@/components/tienda/comun";
import { enlacePedido, fechaDia, hoyMexico, sumarDias } from "@/components/pedidos/comun";
import { BarraReparto, BarrasHorizontales, GraficaArea, Sparkline, Variacion, pesosRedondos } from "@/components/panel/graficas";
import { BotonIcono, EncabezadoPagina, Esqueleto, Indicador, Panel, Segmentado } from "@/components/panel/piezas";
import {
  leerEquipo,
  leerVentas,
  listarPedidosAdmin,
  listarSolicitudes,
  type EstatusPedido,
  type ResumenPedido,
  type ResumenVentas,
} from "@/lib/tienda-admin";
import { ErrorApi } from "@/lib/tienda-admin";
import { ErrorGuardado } from "@/lib/catalogo-admin";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utils";

/**
 * El tablero del panel de la tienda: lo primero que ve el dueño.
 *
 * Arriba, **lo que hay que hacer hoy** (cobrar, surtir, mandar, contestar);
 * debajo, **cómo va el negocio** en el periodo elegido contra el periodo
 * anterior del mismo largo, y al final los pedidos más recientes.
 *
 * Cada bloque sale de su propia lectura y falla por separado: si las ventas
 * no responden, las tareas siguen a la vista. Un fallo nunca se pinta como
 * cero.
 */

type Periodo = "7d" | "30d" | "mes" | "90d";

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: "7d", etiqueta: "7 días" },
  { valor: "30d", etiqueta: "30 días" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "90d", etiqueta: "90 días" },
];

type Rango = { desde: string; hasta: string };

/** El rango del periodo y el anterior del mismo largo (para comparar). */
function rangos(periodo: Periodo, hoy: string): { actual: Rango; anterior: Rango } {
  if (periodo === "mes") {
    const desde = `${hoy.slice(0, 8)}01`;
    const dia = Number(hoy.slice(8, 10));
    const finMesPasado = sumarDias(desde, -1);
    const inicioMesPasado = `${finMesPasado.slice(0, 8)}01`;
    const ultimo = Number(finMesPasado.slice(8, 10));
    const hastaPasado = `${finMesPasado.slice(0, 8)}${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
    return { actual: { desde, hasta: hoy }, anterior: { desde: inicioMesPasado, hasta: hastaPasado } };
  }
  const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
  return {
    actual: { desde: sumarDias(hoy, -(dias - 1)), hasta: hoy },
    anterior: { desde: sumarDias(hoy, -(2 * dias - 1)), hasta: sumarDias(hoy, -dias) },
  };
}

type Parte<T> = { ok: true; valor: T } | { ok: false; error: string };

type Datos = {
  periodo: Periodo;
  ventas: Parte<ResumenVentas>;
  anterior: Parte<ResumenVentas>;
  pedidos: Parte<ResumenPedido[]>;
  solicitudes: Parte<{ nuevas: number }>;
  equipo: Parte<{ porAceptar: number }> | null;
};

const estadoDe = (e: unknown) => (e instanceof ErrorApi || e instanceof ErrorGuardado ? e.estado : 0);

function parte<T, R>(r: PromiseSettledResult<T>, armar: (v: T) => R): Parte<R> {
  return r.status === "fulfilled"
    ? { ok: true, valor: armar(r.value) }
    : { ok: false, error: r.reason instanceof Error ? r.reason.message : "No se pudo leer" };
}

async function cargar(token: string, periodo: Periodo, hoy: string, esSuperadmin: boolean): Promise<Datos> {
  const { actual, anterior } = rangos(periodo, hoy);
  const resultados = await Promise.allSettled([
    leerVentas(token, actual),
    leerVentas(token, anterior),
    listarPedidosAdmin(token),
    listarSolicitudes(token),
    esSuperadmin ? leerEquipo(token) : Promise.resolve(null),
  ] as const);
  const [ventas, ant, pedidos, solicitudes, equipo] = resultados;

  // Sin permiso o sin sesión es de todo el panel: que la puerta lo explique.
  const fallos = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  const sinPermiso = fallos.find((r) => [401, 403].includes(estadoDe(r.reason)) && r !== equipo);
  if (sinPermiso) throw sinPermiso.reason;
  if (fallos.length >= 4) throw fallos[0]!.reason;

  return {
    periodo,
    ventas: parte(ventas, (v) => v),
    anterior: parte(ant, (v) => v),
    pedidos: parte(pedidos, (v) => v.pedidos),
    solicitudes: parte(solicitudes, (v) => ({ nuevas: v.solicitudes.filter((s) => s.estado === "nueva").length })),
    equipo: esSuperadmin
      ? parte(equipo, (v) => ({ porAceptar: v ? v.solicitudes.filter((s) => s.estado === "pendiente").length : 0 }))
      : null,
  };
}

const CLAVE_PERIODO = "radar:tablero:periodo";

function periodoGuardado(): Periodo {
  try {
    const v = localStorage.getItem(CLAVE_PERIODO);
    return PERIODOS.some((p) => p.valor === v) ? (v as Periodo) : "30d";
  } catch {
    return "30d";
  }
}

const COLOR_METODO: Record<string, string> = {
  transferencia: "var(--color-serie-1)",
  clip: "var(--color-serie-2)",
  contra: "var(--color-serie-3)",
};

export function VistaHub() {
  const hoy = hoyMexico();
  const [periodo, setPeriodo] = useState<Periodo>(periodoGuardado);
  // `periodo` y `hoy` en la clave: cambiar de periodo, o dejar el panel
  // abierto de un día para otro, vuelve a leer.
  const esSuper = useSesion().esSuperadmin;
  const c = usePanelAdmin<Datos>((token) => cargar(token, periodo, hoy, esSuper), `${periodo}|${hoy}|${esSuper}`);

  const bloqueo = PuertaAdmin({ c, titulo: "El panel de la tienda" });
  if (bloqueo) return bloqueo;

  const cambiarPeriodo = (p: Periodo) => {
    setPeriodo(p);
    try {
      localStorage.setItem(CLAVE_PERIODO, p);
    } catch {
      /* solo se pierde el recordatorio */
    }
  };

  // Lo leído puede ser de otro periodo mientras recarga: se enseña igual
  // (atenuado) en vez de parpadear a vacío.
  const d = c.datos;
  const desfasado = d !== null && d.periodo !== periodo;
  const pedidos = d?.pedidos.ok ? d.pedidos.valor : null;
  const v = d?.ventas.ok ? d.ventas.valor : null;
  const ant = d?.anterior.ok ? d.anterior.valor : null;

  const contar = (e: EstatusPedido) => pedidos?.filter((p) => p.estatus === e).length ?? 0;
  const porCobrar = pedidos?.filter((p) => p.estatus === "Pendiente") ?? [];
  const deHoy = pedidos?.filter((p) => p.fecha === hoy) ?? [];
  const vendidoHoy = deHoy.filter((p) => !["Pendiente", "Cancelado"].includes(p.estatus));

  const nombre = c.sesion.evaluador?.split(/\s+/)[0] ?? "";
  const saludo = saludoDe(new Date());

  return (
    <main className="p-4 pb-12 sm:p-6">
      <EncabezadoPagina
        titulo={`${saludo}${nombre ? `, ${nombre}` : ""}`}
        subtitulo={fechaLarga(hoy)}
        acciones={
          <>
            <Segmentado etiqueta="Periodo" opciones={PERIODOS} valor={periodo} onChange={cambiarPeriodo} className="flex-1 sm:flex-none" />
            <BotonIcono etiqueta="Volver a leer las cifras" onClick={c.recargar} disabled={c.cargando}>
              <RefreshCw size={18} className={cn(c.cargando && "animate-spin")} />
            </BotonIcono>
          </>
        }
      />

      {c.error && (
        <div className="mb-4">
          <ErrorCarga mensaje={c.error} recargar={c.recargar} cargando={c.cargando} />
        </div>
      )}

      {/* ── Lo que hay que hacer ── */}
      <section aria-label="Pendientes" className="mb-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tarea
            href="/pedidos/?estatus=Pendiente"
            icono={<Wallet size={18} />}
            titulo="Por cobrar"
            cifra={pedidos ? contar("Pendiente") : null}
            detalle={pedidos ? pesosCentavos(porCobrar.reduce((s, p) => s + p.total, 0)) : undefined}
            urgente={contar("Pendiente") > 0}
          />
          <Tarea
            href="/pedidos/?estatus=Pagado"
            icono={<PackageCheck size={18} />}
            titulo="Por surtir"
            cifra={pedidos ? contar("Pagado") : null}
            detalle="pagados sin empezar"
            urgente={contar("Pagado") > 0}
          />
          <Tarea
            href="/pedidos/?estatus=En%20preparaci%C3%B3n"
            icono={<ClipboardList size={18} />}
            titulo="Por enviar"
            cifra={pedidos ? contar("En preparación") : null}
            detalle="en preparación"
            urgente={contar("En preparación") > 0}
          />
          <Tarea
            href="/pedidos/?estatus=En%20camino"
            icono={<Truck size={18} />}
            titulo="En camino"
            cifra={pedidos ? contar("En camino") : null}
            detalle="por confirmar entrega"
          />
          <Tarea
            href="/solicitudes/"
            icono={<Inbox size={18} />}
            titulo="Solicitudes"
            cifra={d?.solicitudes.ok ? d.solicitudes.valor.nuevas : null}
            detalle="nuevas sin atender"
            urgente={(d?.solicitudes.ok ? d.solicitudes.valor.nuevas : 0) > 0}
            error={d && !d.solicitudes.ok ? d.solicitudes.error : undefined}
          />
          {esSuper ? (
            <Tarea
              href="/equipo/"
              icono={<ShieldCheck size={18} />}
              titulo="Equipo"
              cifra={d?.equipo?.ok ? d.equipo.valor.porAceptar : null}
              detalle="por aceptar"
              urgente={(d?.equipo?.ok ? d.equipo.valor.porAceptar : 0) > 0}
              error={d?.equipo && !d.equipo.ok ? d.equipo.error : undefined}
            />
          ) : (
            <Tarea
              href="/pedidos/nuevo/"
              icono={<Plus size={18} />}
              titulo="Nuevo pedido"
              cifra={null}
              detalle="capturar uno de WhatsApp"
            />
          )}
        </div>
        {d && !d.pedidos.ok && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-danger">
            <AlertCircle size={15} /> No se pudieron leer los pedidos: {d.pedidos.error}
          </p>
        )}
      </section>

      {/* ── Cómo va el negocio ── */}
      <section aria-label="Indicadores del periodo" className={cn("transition-opacity", desfasado && "opacity-60")}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[17px] font-semibold tracking-tight">Cómo va el negocio</h2>
          {v && (
            <p className="text-[13px] text-fg-subtle">
              {fechaDia(v.desde)} – {fechaDia(v.hasta)} · contra {ant ? `${fechaDia(ant.desde)} – ${fechaDia(ant.hasta)}` : "el periodo anterior"}
            </p>
          )}
        </div>

        {d && !d.ventas.ok ? (
          <ErrorCarga mensaje={`las ventas (${d.ventas.error})`} recargar={c.recargar} cargando={c.cargando} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador
              etiqueta="Ingresos"
              icono={<Banknote size={16} />}
              destacado
              valor={v ? pesosRedondos(v.ingresos) : <Esqueleto className="h-7 w-28" />}
              extra={v && <Sparkline valores={v.porDia.map((x) => x.ingresos)} className="hidden sm:block" />}
              variacion={v && <Variacion actual={v.ingresos} anterior={ant?.ingresos} />}
              detalle={v && `${v.vendidos} ${v.vendidos === 1 ? "pedido vendido" : "pedidos vendidos"}`}
              href="/ventas/"
            />
            <Indicador
              etiqueta="Pedidos"
              icono={<ShoppingBag size={16} />}
              valor={v ? v.pedidos.toLocaleString("es-MX") : <Esqueleto className="h-7 w-16" />}
              variacion={v && <Variacion actual={v.pedidos} anterior={ant?.pedidos} />}
              detalle={v && `${v.cancelados} cancelados`}
              href="/pedidos/"
            />
            <Indicador
              etiqueta="Ticket promedio"
              icono={<ReceiptText size={16} />}
              valor={v ? pesosRedondos(v.ticketPromedio) : <Esqueleto className="h-7 w-24" />}
              variacion={v && <Variacion actual={v.ticketPromedio} anterior={ant?.ticketPromedio} />}
              detalle={v && `${v.piezas.toLocaleString("es-MX")} piezas vendidas`}
            />
            <Indicador
              etiqueta="Clientes que compraron"
              icono={<Users size={16} />}
              valor={v ? (v.clientesNuevos + v.clientesRecurrentes).toLocaleString("es-MX") : <Esqueleto className="h-7 w-12" />}
              variacion={
                v && (
                  <Variacion
                    actual={v.clientesNuevos + v.clientesRecurrentes}
                    anterior={ant ? ant.clientesNuevos + ant.clientesRecurrentes : null}
                  />
                )
              }
              detalle={v && `${v.clientesNuevos} nuevos · ${v.clientesRecurrentes} recurrentes`}
              href="/clientes/"
            />
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            titulo="Ingresos por día"
            subtitulo="Pedidos pagados, en preparación, en camino y entregados"
            accion={{ href: "/ventas/", texto: "Reporte completo" }}
          >
            {v ? (
              <GraficaArea
                datos={v.porDia.map((x) => ({ fecha: x.fecha, valor: x.ingresos }))}
                anterior={ant?.porDia.map((x) => ({ fecha: x.fecha, valor: x.ingresos })) ?? null}
                formato={pesosCentavos}
                alto={240}
              />
            ) : (
              <Esqueleto className="h-[240px] w-full" />
            )}
          </Panel>

          <Panel titulo="Hoy" subtitulo={fechaDia(hoy)}>
            {pedidos ? (
              <dl className="grid grid-cols-2 gap-3">
                <MiniCifra etiqueta="Pedidos nuevos" valor={deHoy.length.toLocaleString("es-MX")} />
                <MiniCifra
                  etiqueta="Vendido"
                  valor={pesosCentavos(vendidoHoy.reduce((s, p) => s + p.total, 0))}
                />
                <MiniCifra
                  etiqueta="Piezas"
                  valor={deHoy.reduce((s, p) => s + p.piezas, 0).toLocaleString("es-MX")}
                />
                <MiniCifra
                  etiqueta="Por cobrar hoy"
                  valor={deHoy.filter((p) => p.estatus === "Pendiente").length.toLocaleString("es-MX")}
                />
              </dl>
            ) : (
              <Esqueleto className="h-24 w-full" />
            )}
            {v && (
              <div className="mt-4 border-t border-border-soft pt-4">
                <p className="mb-2 text-[13px] font-semibold text-fg-muted">Pedidos del periodo por estatus</p>
                <ul className="grid gap-1.5">
                  {v.porEstatus.map((e) => (
                    <li key={e.estatus}>
                      <Link
                        href={`/pedidos/?estatus=${encodeURIComponent(e.estatus)}`}
                        className="flex min-h-9 items-center justify-between gap-2 rounded-[var(--radius-sm)] px-1 hover:bg-surface-2"
                      >
                        <InsigniaEstatus estatus={e.estatus} />
                        <span className="cifra text-[14px] font-semibold">
                          {e.pedidos}
                          <span className="ml-2 text-[12px] font-medium text-fg-subtle">{pesosCentavos(e.total)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <Panel titulo="Lo más vendido" subtitulo="Por ingresos del periodo">
            {v ? (
              v.topProductos.length === 0 ? (
                <Vacio>Todavía no hay ventas en este periodo.</Vacio>
              ) : (
                <BarrasHorizontales
                  filas={v.topProductos.slice(0, 6).map((p) => ({
                    clave: `${p.productoId}-${p.ml}`,
                    etiqueta: p.nombre,
                    detalle: `${p.piezas} ${p.piezas === 1 ? "pieza" : "piezas"}${p.ml ? ` · ${p.ml} ml` : ""}`,
                    valor: p.ingresos,
                    texto: pesosCentavos(p.ingresos),
                  }))}
                />
              )
            ) : (
              <Esqueleto className="h-48 w-full" />
            )}
          </Panel>

          <Panel titulo="Mejores clientes" subtitulo="Por lo que compraron en el periodo" accion={{ href: "/clientes/", texto: "Clientes" }}>
            {v ? (
              v.topClientes.length === 0 ? (
                <Vacio>Sin compras en este periodo.</Vacio>
              ) : (
                <BarrasHorizontales
                  filas={v.topClientes.slice(0, 6).map((x) => ({
                    clave: x.clave,
                    etiqueta: x.nombre || x.telefono || "Sin nombre",
                    detalle: `${x.pedidos} ${x.pedidos === 1 ? "pedido" : "pedidos"}`,
                    valor: x.ingresos,
                    texto: pesosCentavos(x.ingresos),
                    href: `/clientes/detalle/?clave=${encodeURIComponent(x.clave)}`,
                  }))}
                />
              )
            ) : (
              <Esqueleto className="h-48 w-full" />
            )}
          </Panel>

          <Panel titulo="Cómo pagan" subtitulo="Ingresos por forma de pago" className="lg:col-span-2 xl:col-span-1">
            {v ? (
              <>
                <BarraReparto
                  total={v.porMetodo.reduce((s, m) => s + m.ingresos, 0)}
                  partes={v.porMetodo.map((m) => ({
                    clave: m.clave,
                    etiqueta: m.etiqueta,
                    detalle: `${m.pedidos} ${m.pedidos === 1 ? "pedido" : "pedidos"}`,
                    valor: m.ingresos,
                    texto: pesosCentavos(m.ingresos),
                    color: COLOR_METODO[m.clave] ?? "var(--color-fg-subtle)",
                  }))}
                />
                {(v.descuentos.volumen + v.descuentos.transferencia + v.descuentos.cupon + v.descuentos.tresPorDos) > 0 && (
                  <div className="mt-4 border-t border-border-soft pt-3">
                    <p className="text-[13px] font-semibold text-fg-muted">Descuentos concedidos</p>
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                      <Descuento etiqueta="Volumen" valor={v.descuentos.volumen} />
                      <Descuento etiqueta="Transferencia" valor={v.descuentos.transferencia} />
                      <Descuento etiqueta="Cupones" valor={v.descuentos.cupon} />
                      <Descuento etiqueta="3x2" valor={v.descuentos.tresPorDos} />
                    </dl>
                  </div>
                )}
              </>
            ) : (
              <Esqueleto className="h-40 w-full" />
            )}
          </Panel>
        </div>
      </section>

      {/* ── Pedidos recientes ── */}
      <Panel
        className="mt-6"
        titulo="Pedidos recientes"
        accion={{ href: "/pedidos/", texto: "Todos los pedidos" }}
        sinRelleno
      >
        {pedidos ? (
          pedidos.length === 0 ? (
            <div className="px-5 pb-5">
              <Vacio>
                Todavía no hay pedidos.{" "}
                <Link href="/pedidos/nuevo/" className="font-semibold text-info underline">
                  Captura el primero
                </Link>
                .
              </Vacio>
            </div>
          ) : (
            <TablaRecientes pedidos={[...pedidos].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)).slice(0, 8)} />
          )
        ) : (
          <div className="px-5 pb-5">
            <Esqueleto className="h-40 w-full" />
          </div>
        )}
      </Panel>
    </main>
  );
}

/* ── Piezas del tablero ───────────────────────────────────────────────────── */

function Tarea({
  href,
  icono,
  titulo,
  cifra,
  detalle,
  urgente = false,
  error,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  /** `null` mientras carga (o si es un acceso sin cifra). */
  cifra: number | null;
  detalle?: string;
  urgente?: boolean;
  error?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "tarjeta-panel lift group flex min-h-[104px] flex-col justify-between p-4",
        urgente && "border-gold/45 bg-gradient-to-br from-gold-muted to-transparent",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-fg-muted">{titulo}</span>
        <span className={cn("grid h-8 w-8 place-items-center rounded-full", urgente ? "bg-gold text-white" : "bg-surface-2 text-fg-subtle")}>
          {icono}
        </span>
      </span>
      {error ? (
        <span className="text-[13px] font-semibold text-danger">No se pudo leer</span>
      ) : (
        <span>
          {cifra !== null ? (
            <span className="cifra block text-[28px] font-bold leading-none">{cifra}</span>
          ) : titulo === "Nuevo pedido" ? (
            <span className="flex items-center gap-1 text-[15px] font-semibold text-info">
              Capturar <ChevronRight size={16} />
            </span>
          ) : (
            <Esqueleto className="h-7 w-10" />
          )}
          {detalle && <span className="mt-1 block truncate text-[12px] text-fg-subtle">{detalle}</span>}
        </span>
      )}
    </Link>
  );
}

function MiniCifra({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-2/60 p-3">
      <dt className="text-[12px] font-medium text-fg-subtle">{etiqueta}</dt>
      <dd className="cifra mt-0.5 truncate text-[18px] font-bold">{valor}</dd>
    </div>
  );
}

function Descuento({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-fg-subtle">{etiqueta}</dt>
      <dd className="cifra font-semibold">{pesosCentavos(valor)}</dd>
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-[14px] text-fg-subtle">{children}</p>;
}

function TablaRecientes({ pedidos }: { pedidos: ResumenPedido[] }) {
  return (
    <>
      {/* Teléfono: tarjetas */}
      <ul className="grid gap-2 px-4 pb-4 md:hidden">
        {pedidos.map((p) => (
          <li key={p.folio}>
            <Link href={enlacePedido(p.folio)} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border-soft p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{p.nombre || "Sin nombre"}</span>
                <span className="block truncate text-[12px] text-fg-subtle">
                  {p.folio} · {fechaDia(p.fecha)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="cifra text-[14px] font-semibold">{pesosCentavos(p.total)}</span>
                <InsigniaEstatus estatus={p.estatus} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* Computadora: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr className="border-y border-border-soft bg-surface-2/50 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">
              <th className="px-5 py-2.5">Folio</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Fecha</th>
              <th className="px-3 py-2.5 text-right">Piezas</th>
              <th className="px-3 py-2.5 text-right">Total</th>
              <th className="px-5 py-2.5">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.folio} className="border-b border-border-soft last:border-b-0 hover:bg-surface-2/40">
                <td className="px-5 py-3 font-semibold">
                  <Link href={enlacePedido(p.folio)} className="text-info hover:underline">
                    {p.folio}
                  </Link>
                </td>
                <td className="max-w-[16rem] truncate px-3 py-3">
                  {p.nombre || "Sin nombre"}
                  {p.ciudad && <span className="text-fg-subtle"> · {p.ciudad}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-fg-muted">{fechaDia(p.fecha)}</td>
                <td className="cifra px-3 py-3 text-right">{p.piezas}</td>
                <td className="cifra px-3 py-3 text-right font-semibold">{pesosCentavos(p.total)}</td>
                <td className="px-5 py-3">
                  <InsigniaEstatus estatus={p.estatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Textos ───────────────────────────────────────────────────────────────── */

function saludoDe(ahora: Date): string {
  const hora = Number(
    new Intl.DateTimeFormat("es-MX", { hour: "numeric", hour12: false, timeZone: "America/Mexico_City" }).format(ahora),
  );
  return hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
}

function fechaLarga(fecha: string): string {
  const t = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
