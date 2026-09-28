"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, RefreshCw, Search } from "lucide-react";
import { Boton, Insignia } from "@/components/ui";
import { Mensaje } from "@/components/catalogo/comun";
import { Cabecera, ErrorCarga, PuertaAdmin, pesosCentavos, usePanelAdmin } from "@/components/tienda/comun";
import { descargarCsv } from "@/components/ventas/csv";
import { Desactualizado } from "@/components/ventas/desactualizado";
import { hoyMexico } from "@/components/ventas/fechas";
import { listarClientes, type ClienteAdmin } from "@/lib/tienda-admin";
import { cn } from "@/lib/utils";
import {
  coincide,
  conCuenta,
  enlaceCliente,
  esEquipo,
  estadoCuentaLegible,
  fechaDia,
  nombreDe,
  normalizar,
  telefonoLegible,
} from "./formato";

/**
 * Clientes de la tienda: las cuentas registradas y quien compró sin cuenta,
 * juntos en una lista (`GET /admin/clientes`).
 *
 * Quien compró sin cuenta se agrupa por teléfono: es lo único obligatorio del
 * pedido y es por donde se cierra la venta. Las cifras cuentan solo pedidos
 * vendidos (pagados en adelante), igual que el nivel.
 */

type Orden = "ingresos" | "reciente" | "nombre";
type Filtro = "todos" | "cuenta" | "compras" | "equipo";

const ORDENES: { valor: Orden; etiqueta: string }[] = [
  { valor: "ingresos", etiqueta: "Más compra" },
  { valor: "reciente", etiqueta: "Reciente" },
  { valor: "nombre", etiqueta: "Nombre" },
];

const FILTROS: { valor: Filtro; etiqueta: string; cumple: (c: ClienteAdmin) => boolean }[] = [
  { valor: "todos", etiqueta: "Todos", cumple: () => true },
  { valor: "cuenta", etiqueta: "Con cuenta", cumple: conCuenta },
  { valor: "compras", etiqueta: "Solo compras", cumple: (c) => !conCuenta(c) },
  { valor: "equipo", etiqueta: "Admins y equipo", cumple: esEquipo },
];

/** Cuántas filas se pintan de entrada: cientos de filas en un teléfono pesan. */
const PAGINA = 100;

const CLAVE_VISTA = "radar:clientes:vista";

function vistaGuardada(): { orden?: Orden; filtro?: Filtro; busqueda?: string } {
  if (typeof window === "undefined") return {};
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE_VISTA) ?? "{}");
    return {
      orden: ORDENES.some((o) => o.valor === v.orden) ? v.orden : undefined,
      filtro: FILTROS.some((f) => f.valor === v.filtro) ? v.filtro : undefined,
      busqueda: typeof v.busqueda === "string" ? v.busqueda : undefined,
    };
  } catch {
    return {};
  }
}

const porNombre = (a: ClienteAdmin, b: ClienteAdmin) => nombreDe(a).localeCompare(nombreDe(b), "es");

const ORDENAR: Record<Orden, (a: ClienteAdmin, b: ClienteAdmin) => number> = {
  ingresos: (a, b) => b.ingresos - a.ingresos || b.pedidos - a.pedidos || porNombre(a, b),
  // Sin pedidos, al final; entre ellos, la cuenta más nueva primero.
  reciente: (a, b) =>
    (b.ultimoPedido ?? "").localeCompare(a.ultimoPedido ?? "") ||
    (b.registradoEn ?? "").localeCompare(a.registradoEn ?? "") ||
    porNombre(a, b),
  nombre: porNombre,
};

export function VistaClientes() {
  const c = usePanelAdmin(listarClientes);
  const [inicial] = useState(vistaGuardada);
  const [orden, setOrden] = useState<Orden>(inicial.orden ?? "ingresos");
  const [filtro, setFiltro] = useState<Filtro>(inicial.filtro ?? "todos");
  const [busqueda, setBusqueda] = useState(inicial.busqueda ?? "");
  const [limite, setLimite] = useState(PAGINA);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_VISTA, JSON.stringify({ orden, filtro, busqueda }));
    } catch {
      // Sin almacenamiento solo se pierde el recordatorio.
    }
  }, [orden, filtro, busqueda]);

  const todos = c.datos?.clientes;
  const q = normalizar(busqueda.trim());
  const lista = useMemo(() => {
    if (!todos) return [];
    const cumple = FILTROS.find((f) => f.valor === filtro)!.cumple;
    return todos
      .filter((x) => cumple(x) && coincide(q, x.nombre, x.correo, x.telefono, x.ciudad, x.clave))
      .sort(ORDENAR[orden]);
  }, [todos, filtro, q, orden]);

  const bloqueo = PuertaAdmin({ c, titulo: "Clientes", volver: "/tienda/" });
  if (bloqueo) return bloqueo;

  const conteo = (f: (typeof FILTROS)[number]) => todos?.filter(f.cumple).length ?? 0;

  return (
    <main className="p-4 pb-10">
      <Cabecera
        titulo="Clientes"
        subtitulo={
          todos
            ? `${todos.length} en total · ${todos.filter(conCuenta).length} con cuenta · ` +
              `${todos.filter((x) => x.pedidosVendidos > 0).length} ya compraron`
            : c.error
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
              aria-label="Volver a leer los clientes"
            >
              <RefreshCw size={18} className={cn(c.cargando && "animate-spin")} />
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => exportar(lista)}
              disabled={!todos || lista.length === 0}
              className="px-3"
              aria-label="Exportar la lista a CSV"
              title="Exportar la lista (con su filtro) a CSV para Excel"
            >
              <Download size={18} />
            </Boton>
          </>
        }
      />

      {c.error && (
        <div className="mb-3">
          {todos ? (
            <Desactualizado error={c.error} recargar={c.recargar} cargando={c.cargando} />
          ) : (
            <ErrorCarga mensaje={c.error} recargar={c.recargar} cargando={c.cargando} />
          )}
        </div>
      )}
      {c.datos?.aviso && (
        <div className="mb-3">
          <Mensaje tono="aviso">
            {c.datos.aviso} Las cuentas que nunca han comprado no aparecen hasta que se puedan leer;
            vuelve a intentarlo en un momento.
          </Mensaje>
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1" role="group" aria-label="Ordenar">
        {ORDENES.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => setOrden(o.valor)}
            aria-pressed={orden === o.valor}
            className={cn(
              "min-h-11 rounded-[var(--radius-sm)] text-[14px] font-semibold",
              orden === o.valor ? "bg-surface text-fg shadow-sm" : "text-fg-subtle",
            )}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>

      <div className="relative mb-2">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          aria-hidden
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setLimite(PAGINA);
          }}
          placeholder="Buscar por nombre, teléfono, correo o ciudad"
          aria-label="Buscar clientes"
          className="h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-10 pr-3 placeholder:text-fg-subtle"
        />
      </div>

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrar">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => {
              setFiltro(f.valor);
              setLimite(PAGINA);
            }}
            aria-pressed={filtro === f.valor}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-medium",
              filtro === f.valor
                ? "border-gold-deep bg-gold-gradient text-white"
                : "border-border-strong bg-surface text-fg-muted",
            )}
          >
            {f.etiqueta}
            {todos && <span className="ml-1 tabular-nums opacity-80">{conteo(f)}</span>}
          </button>
        ))}
      </div>

      {!todos ? (
        !c.error && <p className="text-[14px] text-fg-subtle">Leyendo los clientes…</p>
      ) : lista.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-fg-subtle">
          {todos.length === 0
            ? "Todavía no hay clientes: aparecen con la primera cuenta o el primer pedido."
            : "Nadie coincide con la búsqueda o el filtro."}
        </p>
      ) : (
        <>
          <ul className="grid gap-2">
            {lista.slice(0, limite).map((x) => (
              <FilaCliente key={x.clave} cliente={x} />
            ))}
          </ul>
          {lista.length > limite && (
            <Boton variante="secundario" className="mt-3 w-full" onClick={() => setLimite((n) => n + PAGINA)}>
              Ver {Math.min(PAGINA, lista.length - limite)} más (quedan {lista.length - limite})
            </Boton>
          )}
        </>
      )}
    </main>
  );
}

function FilaCliente({ cliente: x }: { cliente: ClienteAdmin }) {
  const contacto = [telefonoLegible(x.telefono), x.ciudad].filter(Boolean).join(" · ");
  return (
    <li>
      <Link
        href={enlaceCliente(x.clave)}
        className="flex items-center gap-3 rounded-[var(--radius)] border border-border-soft bg-surface p-3"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{nombreDe(x)}</span>
            {x.grupos.includes("admins") && <Insignia color="var(--color-info)">admin</Insignia>}
            {x.grupos.includes("proveedores") && <Insignia color="var(--color-success)">equipo</Insignia>}
          </span>
          <span className="block truncate text-[13px] text-fg-subtle">
            {contacto || x.correo || "Sin contacto"}
          </span>
          <span className="block truncate text-[12px] text-fg-subtle">
            {x.nivel} · {x.pedidos} {x.pedidos === 1 ? "pedido" : "pedidos"}
            {x.ultimoPedido && ` · último ${fechaDia(x.ultimoPedido)}`}
            {!conCuenta(x) && " · sin cuenta"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[14px] font-semibold tabular-nums">{pesosCentavos(x.ingresos)}</span>
          <span className="block text-[12px] text-fg-subtle">
            {x.pedidosVendidos} {x.pedidosVendidos === 1 ? "vendido" : "vendidos"}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-fg-subtle" aria-hidden />
      </Link>
    </li>
  );
}

/** La lista tal como se ve (filtro, búsqueda y orden), para Excel. */
function exportar(lista: ClienteAdmin[]) {
  // La fecha del nombre, de México: en UTC, después de las 18:00 saldría la de mañana.
  descargarCsv(`clientes-${hoyMexico()}.csv`, [
    [
      "Clave",
      "Nombre",
      "Correo",
      "Teléfono",
      "Ciudad",
      "Con cuenta",
      "Estado de la cuenta",
      "Grupos",
      "Registrado en",
      "Pedidos",
      "Pedidos vendidos",
      "Piezas vendidas",
      "Ingresos",
      "Último pedido",
      "Nivel",
    ],
    ...lista.map((x) => [
      x.clave,
      x.nombre,
      x.correo,
      x.telefono,
      x.ciudad,
      conCuenta(x) ? "sí" : "no",
      estadoCuentaLegible(x.estadoCuenta),
      x.grupos.join(" "),
      x.registradoEn,
      x.pedidos,
      x.pedidosVendidos,
      x.piezas,
      x.ingresos,
      x.ultimoPedido,
      x.nivel,
    ]),
  ]);
}
