"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw, Search } from "lucide-react";
import { Boton } from "@/components/ui";
import { Mensaje } from "@/components/catalogo/comun";
import {
  Cabecera,
  ErrorCarga,
  InsigniaEstatus,
  PuertaAdmin,
  pesosCentavos,
  usePanelAdmin,
} from "@/components/tienda/comun";
import { listarPedidosAdmin, type EstatusPedido, type ResumenPedido } from "@/lib/tienda-admin";
import { cn } from "@/lib/utils";
import {
  ESTATUS,
  POR_ENVIAR,
  coincide,
  csvPedidos,
  descargar,
  enlacePedido,
  fechaDia,
  hoyMexico,
  sumarDias,
} from "@/components/pedidos/comun";

/**
 * La lista de pedidos de la tienda: lo primero que abre el dueño en la mañana
 * para ver qué hay que cobrar y qué hay que mandar.
 *
 * El rango se pide al servidor (el corte por día es de calendario de México y
 * lo hace la Lambda); el estatus y la búsqueda se filtran aquí, sobre lo que ya
 * llegó, para que cambiar de chip no espere a la red.
 */

type Rango = "7d" | "30d" | "mes" | "todo";

const RANGOS: { valor: Rango; etiqueta: string }[] = [
  { valor: "7d", etiqueta: "7 días" },
  { valor: "30d", etiqueta: "30 días" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "todo", etiqueta: "Todo" },
];

type FiltroEstatus = "todos" | EstatusPedido;

/** Dónde se quedó la lista, para volver del detalle al mismo sitio. */
const CLAVE_VISTA = "radar:pedidos:vista";

type Vista = { rango?: Rango; estatus?: FiltroEstatus; busqueda?: string };

function vistaGuardada(): Vista {
  if (typeof window === "undefined") return {};
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE_VISTA) ?? "{}") as Vista;
    return {
      rango: RANGOS.some((r) => r.valor === v.rango) ? v.rango : undefined,
      estatus: v.estatus === "todos" || ESTATUS.includes(v.estatus as EstatusPedido) ? v.estatus : undefined,
      busqueda: typeof v.busqueda === "string" ? v.busqueda : undefined,
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

export function VistaPedidos() {
  const [inicial] = useState(vistaGuardada);
  // «Todo» por defecto: un pedido pagado hace 35 días y sin mandar es
  // justamente el que no se puede quedar fuera de la vista.
  const [rango, setRango] = useState<Rango>(inicial.rango ?? "todo");
  const [estatus, setEstatus] = useState<FiltroEstatus>(inicial.estatus ?? "todos");
  const [busqueda, setBusqueda] = useState(inicial.busqueda ?? "");

  const hoy = hoyMexico();
  const { desde, hasta } = fechasDe(rango, hoy);
  const claveRango = `${desde ?? ""}|${hasta ?? ""}`;
  // Cada respuesta se marca con el rango que se pidió: `usePanelAdmin`
  // conserva lo último leído mientras recarga, y sin la marca, al cambiar de
  // «Todo» a «7 días» (o si esa lectura falla) se verían los pedidos del rango
  // anterior con los conteos y el título del nuevo.
  const c = usePanelAdmin(
    async (token) => ({ ...(await listarPedidosAdmin(token, { desde, hasta })), rango: claveRango }),
    claveRango,
  );
  const datos = c.datos?.rango === claveRango ? c.datos : null;

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_VISTA, JSON.stringify({ rango, estatus, busqueda }));
    } catch {
      // No pasa nada: solo se pierde el recordatorio.
    }
  }, [rango, estatus, busqueda]);

  const pedidos = datos?.pedidos;
  // Los conteos de los chips salen de lo buscado, antes del filtro de estatus:
  // así cada chip dice cuántos hay de verdad si se toca.
  const buscados = useMemo(
    () => (pedidos ?? []).filter((p) => coincide(p, busqueda)),
    [pedidos, busqueda],
  );
  const conteo = useMemo(() => {
    const n = new Map<EstatusPedido, number>();
    for (const p of buscados) n.set(p.estatus, (n.get(p.estatus) ?? 0) + 1);
    return n;
  }, [buscados]);
  const visibles = estatus === "todos" ? buscados : buscados.filter((p) => p.estatus === estatus);

  const bloqueo = PuertaAdmin({ c, titulo: "La lista de pedidos", volver: "/tienda/" });
  if (bloqueo) return bloqueo;

  const pendientes = (pedidos ?? []).filter((p) => p.estatus === "Pendiente").length;
  const porEnviar = (pedidos ?? []).filter((p) => POR_ENVIAR.includes(p.estatus)).length;

  const exportar = () => {
    const sufijo = desde && hasta ? `${desde}_a_${hasta}` : `todo_${hoy}`;
    descargar(csvPedidos(visibles), `pedidos-${sufijo}.csv`);
  };

  return (
    <main className="p-4 pb-10">
      <Cabecera
        titulo="Pedidos"
        subtitulo={
          pedidos
            ? `${pedidos.length} en el rango · ${pendientes} por cobrar · ${porEnviar} por enviar`
            : c.error && !c.cargando
              ? "No se pudo leer"
              : "Cargando…"
        }
        acciones={
          <>
            <Boton
              variante="secundario"
              onClick={c.recargar}
              disabled={c.cargando}
              className="px-3"
              aria-label="Volver a leer los pedidos"
            >
              <RefreshCw size={18} className={cn(c.cargando && "animate-spin")} />
            </Boton>
            <Boton
              variante="secundario"
              onClick={exportar}
              disabled={visibles.length === 0}
              className="px-3"
              aria-label="Exportar a CSV lo que se ve"
              title="Exportar a CSV (Excel) lo que se ve"
            >
              <Download size={18} />
            </Boton>
          </>
        }
      />

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

      <div
        role="group"
        aria-label="Rango de fechas"
        className="mb-3 grid grid-cols-4 gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1"
      >
        {RANGOS.map((r) => (
          <button
            key={r.valor}
            type="button"
            onClick={() => setRango(r.valor)}
            aria-pressed={rango === r.valor}
            className={cn(
              "min-h-11 rounded-[var(--radius-sm)] text-[14px] font-semibold",
              rango === r.valor ? "bg-surface text-fg shadow-sm" : "text-fg-subtle",
            )}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>

      <div className="relative mb-2">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Folio, nombre, teléfono o ciudad"
          aria-label="Buscar pedidos"
          className="h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-10 pr-3 placeholder:text-fg-subtle"
        />
      </div>

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar por estatus">
        {/* Sin datos (cargando o sin red) los chips van sin número: un cero
            ahí diría «no hay» cuando lo que pasa es que no se sabe. */}
        <Chip activo={estatus === "todos"} onClick={() => setEstatus("todos")}>
          Todos {pedidos && <Conteo n={buscados.length} activo={estatus === "todos"} />}
        </Chip>
        {ESTATUS.map((e) => (
          <Chip key={e} activo={estatus === e} onClick={() => setEstatus(e)}>
            {e} {pedidos && <Conteo n={conteo.get(e) ?? 0} activo={estatus === e} />}
          </Chip>
        ))}
      </div>

      {!pedidos ? (
        (c.cargando || !c.error) && <p className="text-[14px] text-fg-subtle">Cargando los pedidos…</p>
      ) : visibles.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-fg-subtle">
          {pedidos.length === 0
            ? rango === "todo"
              ? "Todavía no hay pedidos."
              : "No hay pedidos en este rango."
            : "Ningún pedido coincide con el filtro."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {visibles.map((p) => (
            <li key={p.folio}>
              <FilaPedido pedido={p} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium",
        activo ? "border-gold-deep bg-gold-gradient text-white" : "border-border-strong bg-surface text-fg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Conteo({ n, activo }: { n: number; activo: boolean }) {
  return (
    <span
      className={cn(
        "min-w-5 rounded-full px-1.5 text-center text-[12px] font-semibold tabular-nums",
        activo ? "bg-white/25 text-white" : "bg-surface-2 text-fg-muted",
      )}
    >
      {n}
    </span>
  );
}

function FilaPedido({ pedido: p }: { pedido: ResumenPedido }) {
  const lugar = [p.ciudad, p.estado].filter(Boolean).join(", ");
  return (
    <Link
      href={enlacePedido(p.folio)}
      className="lift block rounded-[var(--radius)] border border-border-soft bg-surface p-3"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-semibold">{p.nombre || "Sin nombre"}</span>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums">{pesosCentavos(p.total)}</span>
      </span>
      <span className="mt-0.5 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-fg-subtle">
          <span className="font-semibold text-fg-muted">{p.folio}</span>
          {" · "}
          {fechaDia(p.fecha)}
          {lugar && ` · ${lugar}`}
        </span>
        <span className="shrink-0">
          <InsigniaEstatus estatus={p.estatus} />
        </span>
      </span>
      <span className="mt-0.5 block truncate text-[12px] text-fg-subtle">
        {p.piezas} {p.piezas === 1 ? "pieza" : "piezas"}
        {p.escalon && ` · ${p.escalon}`}
        {p.conCuenta ? " · con cuenta" : ""}
        {p.guia ? ` · guía ${p.guia}` : ""}
      </span>
    </Link>
  );
}
