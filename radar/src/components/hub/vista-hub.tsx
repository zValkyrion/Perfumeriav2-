"use client";

import Link from "next/link";
import {
  ChartColumn,
  ChevronRight,
  ClipboardList,
  Inbox,
  Package,
  RefreshCw,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
  Warehouse,
} from "lucide-react";
import { Boton, Tarjeta } from "@/components/ui";
import {
  BarrasDia,
  Cabecera,
  ErrorCarga,
  InsigniaEstatus,
  PuertaAdmin,
  pesosCentavos,
  usePanelAdmin,
} from "@/components/tienda/comun";
import { POR_ENVIAR, enlacePedido, fechaDia, hoyMexico } from "@/components/pedidos/comun";
import {
  ErrorApi,
  listarClientes,
  listarPedidosAdmin,
  listarSolicitudes,
  leerVentas,
  type ResumenPedido,
  type ResumenVentas,
} from "@/lib/tienda-admin";
import { ErrorGuardado } from "@/lib/catalogo-admin";
import { cn } from "@/lib/utils";

/**
 * Panel de la tienda: la puerta a todo lo de administración, con las cifras
 * del día a la vista para que el dueño sepa, sin entrar a nada, si hay algo
 * que cobrar, que mandar o que contestar.
 *
 * Cada cifra sale de su propia ruta y falla por separado: si Cognito no
 * responde, los clientes dicen «no se pudo leer» pero los pedidos y las
 * ventas siguen a la vista. Un fallo **nunca** se pinta como cero.
 */

type Parte<T> = { ok: true; valor: T } | { ok: false; error: string };

type DatosHub = {
  pedidos: Parte<{ pendientes: number; porCobrar: number; porEnviar: ResumenPedido[] }>;
  ventas: Parte<{ hoy: number; pedidosHoy: number; mes: ResumenVentas }>;
  clientes: Parte<{ total: number; conCuenta: number; aviso: string | null }>;
  solicitudes: Parte<{ nuevas: number; total: number }>;
};

const estadoDe = (e: unknown) => (e instanceof ErrorApi || e instanceof ErrorGuardado ? e.estado : 0);

function parte<T, R>(r: PromiseSettledResult<T>, armar: (v: T) => R): Parte<R> {
  return r.status === "fulfilled"
    ? { ok: true, valor: armar(r.value) }
    : { ok: false, error: r.reason instanceof Error ? r.reason.message : "No se pudo leer" };
}

async function cargarHub(token: string, hoy: string): Promise<DatosHub> {
  const resultados = await Promise.allSettled([
    listarPedidosAdmin(token),
    leerVentas(token, { desde: `${hoy.slice(0, 8)}01`, hasta: hoy }),
    listarClientes(token),
    listarSolicitudes(token),
  ] as const);
  const [pedidos, ventas, clientes, solicitudes] = resultados;

  // Sin permiso o sin sesión es de todo el panel, no de una tarjeta: se lanza
  // para que la puerta lo explique. Lo mismo si no se pudo leer nada.
  const fallos = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  const sinPermiso = fallos.find((r) => [401, 403].includes(estadoDe(r.reason)));
  if (sinPermiso) throw sinPermiso.reason;
  if (fallos.length === resultados.length) throw fallos[0]!.reason;

  return {
    pedidos: parte(pedidos, ({ pedidos: lista }) => ({
      pendientes: lista.filter((p) => p.estatus === "Pendiente").length,
      porCobrar: lista.filter((p) => p.estatus === "Pendiente").reduce((s, p) => s + p.total, 0),
      // Lo que lleva más tiempo esperando va primero.
      porEnviar: lista
        .filter((p) => POR_ENVIAR.includes(p.estatus))
        .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)),
    })),
    ventas: parte(ventas, (mes) => {
      const dia = mes.porDia.find((d) => d.fecha === hoy);
      return { hoy: dia?.ingresos ?? 0, pedidosHoy: dia?.vendidos ?? 0, mes };
    }),
    clientes: parte(clientes, ({ clientes: lista, aviso }) => ({
      total: lista.length,
      conCuenta: lista.filter((x) => x.sub).length,
      aviso,
    })),
    solicitudes: parte(solicitudes, ({ solicitudes: lista }) => ({
      nuevas: lista.filter((s) => s.estado === "nueva").length,
      total: lista.length,
    })),
  };
}

export function VistaHub() {
  const hoy = hoyMexico();
  // `hoy` en la clave: si el panel se queda abierto de un día para otro, al
  // recargar las cifras de «hoy» y «este mes» son las del día nuevo.
  const c = usePanelAdmin((token) => cargarHub(token, hoy), hoy);

  const bloqueo = PuertaAdmin({ c, titulo: "El panel de la tienda" });
  if (bloqueo) return bloqueo;

  const d = c.datos;
  // Sin nada leído y con error, cada tarjeta dice «no se pudo leer»: dejarla
  // en «…» haría pensar que sigue cargando.
  const de = <K extends keyof DatosHub>(k: K): DatosHub[K] | undefined =>
    d ? d[k] : c.error && !c.cargando ? { ok: false, error: c.error } : undefined;
  const fallidas = d
    ? (Object.values(d) as Parte<unknown>[]).filter((x): x is { ok: false; error: string } => !x.ok)
    : [];

  return (
    <main className="p-4 pb-10">
      <Cabecera
        titulo="Panel de la tienda"
        subtitulo={c.sesion.evaluador ? `Hola, ${c.sesion.evaluador}` : "Pedidos, ventas y clientes"}
        volver={{ href: "/", texto: "Proveedores" }}
        acciones={
          <>
            {/* `<a>` a propósito: la tienda es otra app en la raíz del dominio,
                y `Link` la resolvería dentro de `/radar`. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" aria-label="Ir a la tienda">
              <Boton variante="secundario" className="px-3" tabIndex={-1}>
                <Store size={18} />
              </Boton>
            </a>
            <Boton
              variante="secundario"
              onClick={c.recargar}
              disabled={c.cargando}
              className="px-3"
              aria-label="Volver a leer las cifras"
            >
              <RefreshCw size={18} className={cn(c.cargando && "animate-spin")} />
            </Boton>
          </>
        }
      />

      {c.error && (
        <div className="mb-3">
          <ErrorCarga mensaje={c.error} recargar={c.recargar} cargando={c.cargando} />
        </div>
      )}
      {!c.error && fallidas.length > 0 && (
        <div className="mb-3">
          <ErrorCarga
            mensaje={`${fallidas.length === 1 ? "una cifra" : `${fallidas.length} cifras`} (${fallidas[0]!.error})`}
            recargar={c.recargar}
            cargando={c.cargando}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Seccion
          href="/pedidos/"
          icono={<ClipboardList size={18} />}
          titulo="Pedidos"
          parte={de("pedidos")}
          cifra={(v) => `${v.pendientes} por cobrar`}
          pista={(v) =>
            `${v.porEnviar.length} por enviar` + (v.porCobrar > 0 ? ` · ${pesosCentavos(v.porCobrar)} pendientes` : "")
          }
          destacar={(v) => v.porEnviar.length > 0 || v.pendientes > 0}
        />
        <Seccion
          href="/ventas/"
          icono={<TrendingUp size={18} />}
          titulo="Ventas"
          parte={de("ventas")}
          cifra={(v) => pesosCentavos(v.hoy)}
          pista={(v) => `hoy (${v.pedidosHoy} ${v.pedidosHoy === 1 ? "pedido" : "pedidos"}) · mes ${pesosCentavos(v.mes.ingresos)}`}
        />
        <Seccion
          href="/clientes/"
          icono={<Users size={18} />}
          titulo="Clientes"
          parte={de("clientes")}
          cifra={(v) => String(v.total)}
          pista={(v) => (v.aviso ? "Solo compradores: las cuentas no respondieron" : `${v.conCuenta} con cuenta`)}
        />
        <Seccion
          href="/solicitudes/"
          icono={<Inbox size={18} />}
          titulo="Solicitudes"
          parte={de("solicitudes")}
          cifra={(v) => `${v.nuevas} ${v.nuevas === 1 ? "nueva" : "nuevas"}`}
          pista={(v) => `${v.total} en total · distribuidores, contacto y facturas`}
          destacar={(v) => v.nuevas > 0}
        />
      </div>

      {d?.pedidos.ok && (
        <Tarjeta titulo="Por enviar" pista="Pagados que todavía no salen, del más antiguo al más nuevo" className="mt-3">
          {d.pedidos.valor.porEnviar.length === 0 ? (
            <p className="text-[14px] text-fg-subtle">Nada pendiente de mandar.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {d.pedidos.valor.porEnviar.slice(0, 5).map((p) => (
                <li key={p.folio}>
                  <Link
                    href={enlacePedido(p.folio)}
                    className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border border-border-soft px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{p.nombre || "Sin nombre"}</span>
                      <span className="block truncate text-[13px] text-fg-subtle">
                        {p.folio} · {fechaDia(p.fecha)}
                        {p.ciudad && ` · ${p.ciudad}`}
                      </span>
                    </span>
                    <InsigniaEstatus estatus={p.estatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {d.pedidos.valor.porEnviar.length > 5 && (
            <Link
              href="/pedidos/"
              className="mt-2 inline-flex min-h-11 items-center text-[14px] font-semibold text-info underline"
            >
              Ver los {d.pedidos.valor.porEnviar.length} en Pedidos
            </Link>
          )}
        </Tarjeta>
      )}

      {d?.ventas.ok && (
        <Tarjeta
          titulo="Ingresos del mes"
          pista={`${pesosCentavos(d.ventas.valor.mes.ingresos)} en ${d.ventas.valor.mes.vendidos} ${
            d.ventas.valor.mes.vendidos === 1 ? "pedido vendido" : "pedidos vendidos"
          } · pagados, en preparación, en camino y entregados`}
          className="mt-3"
        >
          <BarrasDia datos={d.ventas.valor.mes.porDia} alto={150} />
        </Tarjeta>
      )}

      <h2 className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
        Más del panel
      </h2>
      <ul className="grid grid-cols-1 gap-2">
        {c.sesion.esSuperadmin && (
          <Acceso
            href="/equipo/"
            icono={<ShieldCheck size={18} />}
            titulo="Equipo y cuentas"
            texto="Aceptar al equipo, invitar, permisos y todas las cuentas"
          />
        )}
        <Acceso href="/catalogo/" icono={<Package size={18} />} titulo="Catálogo" texto="Perfumes, sets, lotes, precios y agotados" />
        <Acceso href="/" icono={<Warehouse size={18} />} titulo="Proveedores" texto="Captura y evaluación en campo" />
        <Acceso href="/admin/" icono={<ChartColumn size={18} />} titulo="Vista de conjunto" texto="Ranking y mapa de proveedores" />
      </ul>
    </main>
  );
}

function Seccion<T>({
  href,
  icono,
  titulo,
  parte,
  cifra,
  pista,
  destacar,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  /** `undefined` mientras carga la primera vez. */
  parte: Parte<T> | undefined;
  cifra: (v: T) => string;
  pista: (v: T) => string;
  destacar?: (v: T) => boolean;
}) {
  const resaltada = parte?.ok && destacar ? destacar(parte.valor) : false;
  return (
    <Link
      href={href}
      className={cn(
        "lift flex min-h-28 flex-col rounded-[var(--radius)] border bg-surface p-3",
        resaltada ? "border-gold/50" : "border-border-soft",
      )}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted">
        <span className={cn(resaltada ? "text-gold" : "text-fg-subtle")}>{icono}</span>
        {titulo}
      </span>
      {parte === undefined ? (
        <span className="mt-1 text-[20px] font-semibold text-fg-subtle">…</span>
      ) : parte.ok ? (
        <>
          <span className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight">{cifra(parte.valor)}</span>
          <span className="mt-0.5 text-[12px] leading-snug text-fg-muted">{pista(parte.valor)}</span>
        </>
      ) : (
        <>
          <span className="mt-1 text-[15px] font-semibold text-danger">No se pudo leer</span>
          <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-fg-muted">{parte.error}</span>
        </>
      )}
    </Link>
  );
}

function Acceso({
  href,
  icono,
  titulo,
  texto,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="lift flex min-h-14 items-center gap-3 rounded-[var(--radius)] border border-border-soft bg-surface p-3"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-muted">{icono}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{titulo}</span>
          <span className="block truncate text-[13px] text-fg-subtle">{texto}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-fg-subtle" />
      </Link>
    </li>
  );
}
