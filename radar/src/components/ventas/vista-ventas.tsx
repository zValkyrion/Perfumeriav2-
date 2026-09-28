"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, RefreshCw } from "lucide-react";
import { Boton, Campo, Tarjeta } from "@/components/ui";
import { Mensaje } from "@/components/catalogo/comun";
import {
  BarrasDia,
  Cabecera,
  Dato,
  ErrorCarga,
  InsigniaEstatus,
  PuertaAdmin,
  pesosCentavos,
  usePanelAdmin,
} from "@/components/tienda/comun";
import { enlaceCliente, telefonoLegible } from "@/components/clientes/formato";
import { leerVentas, type ResumenVentas } from "@/lib/tienda-admin";
import { cn } from "@/lib/utils";
import { descargarCsv, type Celda } from "./csv";
import { Desactualizado } from "./desactualizado";
import {
  MAX_DIAS,
  RANGOS,
  diaLegible,
  diasDelRango,
  esFecha,
  hoyMexico,
  rangoDe,
  rangoLegible,
  type IdRango,
} from "./fechas";

/**
 * Panel de ventas: cuánto se vendió en un rango, cuánto falta por cobrar, qué
 * se vende y a quién.
 *
 * Las cifras las calcula el servidor (`GET /admin/ventas`) con los totales que
 * se cobraron; aquí no se recalcula nada, solo se pinta y se exporta. «Vendido»
 * es Pagado, En preparación, En camino o Entregado: un pedido pendiente es
 * dinero por cobrar, no ingreso.
 */

/** El rango elegido, por pestaña del navegador: al volver de un cliente sigue ahí. */
const CLAVE_VISTA = "radar:ventas:rango";

type Vista = { id: IdRango; desde?: string; hasta?: string };

function vistaGuardada(): Vista {
  if (typeof window === "undefined") return { id: "30" };
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE_VISTA) ?? "{}") as Partial<Vista>;
    return RANGOS.some((r) => r.id === v.id) ? (v as Vista) : { id: "30" };
  } catch {
    return { id: "30" };
  }
}

/** Con más de tres meses, 90+ barras de un píxel no se leen: se juntan por semana. */
const DIAS_POR_SEMANA_DESDE = 92;

export function VistaVentas() {
  const [inicial] = useState(vistaGuardada);
  const hoy = hoyMexico();
  const [idRango, setIdRango] = useState<IdRango>(inicial.id);
  // El rango personalizado que se está viendo, y lo que se teclea antes de «Ver».
  const [personal, setPersonal] = useState(() =>
    esFecha(inicial.desde) && esFecha(inicial.hasta) && inicial.desde <= inicial.hasta
      ? { desde: inicial.desde, hasta: inicial.hasta }
      : rangoDe("30", hoyMexico()),
  );
  const [borrador, setBorrador] = useState(personal);
  const [errorRango, setErrorRango] = useState<string | null>(null);

  const { desde, hasta } = idRango === "personalizado" ? personal : rangoDe(idRango, hoy);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_VISTA, JSON.stringify({ id: idRango, ...personal }));
    } catch {
      // Sin almacenamiento solo se pierde el recordatorio.
    }
  }, [idRango, personal]);

  const c = usePanelAdmin((t) => leerVentas(t, { desde, hasta }), `${desde}|${hasta}`);

  const bloqueo = PuertaAdmin({ c, titulo: "Ventas", volver: "/tienda/" });
  if (bloqueo) return bloqueo;

  const d = c.datos;
  // Mientras llega el rango nuevo se sigue viendo el anterior, atenuado y
  // rotulado con sus fechas: nunca se hacen pasar unas cifras por las de otro rango.
  const alDia = d !== null && d.desde === desde && d.hasta === hasta;

  const aplicarPersonal = () => {
    const { desde: a, hasta: b } = borrador;
    if (!esFecha(a) || !esFecha(b)) return setErrorRango("Elige las dos fechas.");
    if (a > b) return setErrorRango("La fecha de inicio va antes que la final.");
    if (diasDelRango(a, b) > MAX_DIAS) return setErrorRango(`El rango no puede pasar de ${MAX_DIAS} días.`);
    setErrorRango(null);
    setPersonal({ desde: a, hasta: b });
  };

  return (
    <main className="p-4 pb-10">
      <Cabecera
        titulo="Ventas"
        subtitulo={`${rangoLegible(desde, hasta, hoy)} · hora de México`}
        acciones={
          <>
            <Boton
              variante="secundario"
              onClick={c.recargar}
              disabled={c.cargando}
              className="px-3"
              aria-label="Volver a leer las ventas"
            >
              <RefreshCw size={18} className={cn(c.cargando && "animate-spin")} />
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => d && exportar(d)}
              disabled={!alDia}
              className="px-3"
              aria-label="Exportar a CSV"
              title="Exportar el resumen a CSV para Excel"
            >
              <Download size={18} />
            </Boton>
          </>
        }
      />

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Rango de fechas">
        {RANGOS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              setIdRango(r.id);
              setErrorRango(null);
              if (r.id === "personalizado") setBorrador(personal);
            }}
            aria-pressed={idRango === r.id}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-medium",
              idRango === r.id
                ? "border-gold-deep bg-gold-gradient text-white"
                : "border-border-strong bg-surface text-fg-muted",
            )}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>

      {idRango === "personalizado" && (
        <form
          className="mb-3 rounded-[var(--radius)] border border-border-soft bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            aplicarPersonal();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Campo
              etiqueta="Desde"
              type="date"
              value={borrador.desde}
              max={hoy}
              onChange={(e) => setBorrador((b) => ({ ...b, desde: e.target.value }))}
            />
            <Campo
              etiqueta="Hasta"
              type="date"
              value={borrador.hasta}
              max={hoy}
              onChange={(e) => setBorrador((b) => ({ ...b, hasta: e.target.value }))}
            />
          </div>
          {errorRango && <p className="mt-2 text-[13px] font-medium text-danger">{errorRango}</p>}
          <Boton type="submit" variante="secundario" className="mt-2 w-full">
            Ver este rango
          </Boton>
          <p className="mt-1 text-[12px] text-fg-subtle">Hasta {MAX_DIAS} días. Las fechas son de México.</p>
        </form>
      )}

      {c.error && !alDia && (
        <div className="mb-3">
          <ErrorCarga mensaje={c.error} recargar={c.recargar} cargando={c.cargando} />
        </div>
      )}
      {c.error && alDia && (
        <div className="mb-3">
          <Desactualizado error={c.error} recargar={c.recargar} cargando={c.cargando} />
        </div>
      )}

      {!d ? (
        !c.error && <p className="text-[14px] text-fg-subtle">Leyendo las ventas…</p>
      ) : c.error && !alDia ? null : (
        <div
          aria-busy={!alDia}
          className={cn("grid gap-4 transition-opacity", !alDia && "opacity-50")}
        >
          {!alDia && (
            <p role="status" className="text-[13px] font-medium text-fg-muted">
              Leyendo {rangoLegible(desde, hasta, hoy)}… Abajo, todavía las cifras {rangoLegible(d.desde, d.hasta, hoy)}.
            </p>
          )}
          {d.truncado && (
            <Mensaje tono="aviso">
              La tienda tiene más de 5,000 pedidos y el servidor leyó solo los más recientes: si el
              rango es antiguo, estas cifras pueden salir incompletas.
            </Mensaje>
          )}
          <Resumen d={d} />
          <Barras d={d} />
          <PorEstatus d={d} />
          <Desgloses d={d} />
          <TopProductos d={d} />
          <TopClientes d={d} />
          <Descuentos d={d} />
        </div>
      )}
    </main>
  );
}

/* ── Secciones ────────────────────────────────────────────────────────────── */

const entero = (n: number) => n.toLocaleString("es-MX");

function Resumen({ d }: { d: ResumenVentas }) {
  return (
    <section aria-label="Cifras del rango" className="grid grid-cols-2 gap-2 [overflow-wrap:anywhere]">
      <Dato
        className="col-span-2"
        etiqueta="Ingresos"
        valor={pesosCentavos(d.ingresos)}
        pista={`${entero(d.vendidos)} ${d.vendidos === 1 ? "pedido vendido" : "pedidos vendidos"} · pagados, en preparación, en camino o entregados`}
      />
      <Dato
        etiqueta="Por cobrar"
        valor={pesosCentavos(d.porCobrar)}
        pista={`${entero(d.pendientes)} ${d.pendientes === 1 ? "pendiente" : "pendientes"}`}
      />
      <Dato
        etiqueta="Pedidos vendidos"
        valor={entero(d.vendidos)}
        pista={`de ${entero(d.pedidos)} · ${entero(d.cancelados)} ${d.cancelados === 1 ? "cancelado" : "cancelados"}`}
      />
      <Dato etiqueta="Ticket promedio" valor={pesosCentavos(d.ticketPromedio)} pista="por pedido vendido" />
      <Dato etiqueta="Piezas vendidas" valor={entero(d.piezas)} />
      <Dato etiqueta="Clientes nuevos" valor={entero(d.clientesNuevos)} pista="con una sola compra en total" />
      <Dato etiqueta="Clientes recurrentes" valor={entero(d.clientesRecurrentes)} pista="con 2 o más compras" />
    </section>
  );
}

function Barras({ d }: { d: ResumenVentas }) {
  const porSemana = d.porDia.length > DIAS_POR_SEMANA_DESDE;
  const serie = porSemana ? juntarPorSemana(d.porDia) : d.porDia;
  const conMovimiento = d.porDia.filter((x) => x.pedidos > 0).reverse();
  return (
    <Tarjeta
      titulo={porSemana ? "Ingresos por semana" : "Ingresos por día"}
      pista={
        porSemana
          ? "Solo pedidos vendidos. Cada barra suma 7 días y lleva la fecha del primero."
          : "Solo pedidos vendidos. Las cifras exactas, abajo en «Ver día por día»."
      }
    >
      <BarrasDia datos={serie} />
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-[14px] font-semibold text-info">
          Ver día por día ({conMovimiento.length} {conMovimiento.length === 1 ? "día" : "días"} con pedidos)
        </summary>
        {conMovimiento.length === 0 ? (
          <p className="py-3 text-[14px] text-fg-subtle">Ningún pedido en el rango.</p>
        ) : (
          <table className="mt-1 w-full text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-[12px] text-fg-subtle">
                <th className="py-1 font-medium">Día</th>
                <th className="py-1 text-right font-medium">Pedidos</th>
                <th className="py-1 text-right font-medium">Vendidos</th>
                <th className="py-1 text-right font-medium">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {conMovimiento.map((x) => (
                <tr key={x.fecha} className="border-t border-border-soft">
                  <td className="py-2">{diaLegible(x.fecha)}</td>
                  <td className="py-2 text-right">{x.pedidos}</td>
                  <td className="py-2 text-right">{x.vendidos}</td>
                  <td className="py-2 text-right font-semibold">{pesosCentavos(x.ingresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </Tarjeta>
  );
}

function juntarPorSemana(dias: ResumenVentas["porDia"]): { fecha: string; ingresos: number }[] {
  const semanas: { fecha: string; ingresos: number }[] = [];
  for (let i = 0; i < dias.length; i += 7) {
    const tramo = dias.slice(i, i + 7);
    const suma = tramo.reduce((s, x) => s + x.ingresos, 0);
    semanas.push({ fecha: tramo[0]!.fecha, ingresos: Math.round(suma * 100) / 100 });
  }
  return semanas;
}

function PorEstatus({ d }: { d: ResumenVentas }) {
  return (
    <Tarjeta titulo="Pedidos por estatus" pista="Todos los pedidos del rango, con lo que suman.">
      <ul className="grid gap-1">
        {d.porEstatus.map((e) => (
          <li
            key={e.estatus}
            className="flex min-h-11 items-center justify-between gap-2 border-b border-border-soft py-1 last:border-b-0"
          >
            <InsigniaEstatus estatus={e.estatus} />
            <span className="text-right text-[14px] tabular-nums">
              <span className="font-semibold">{entero(e.pedidos)}</span>
              <span className="text-fg-subtle"> · {pesosCentavos(e.total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

type Eje = "porMetodo" | "porEnvio" | "porEscalon";
const EJES: { id: Eje; etiqueta: string }[] = [
  { id: "porMetodo", etiqueta: "Pago" },
  { id: "porEnvio", etiqueta: "Envío" },
  { id: "porEscalon", etiqueta: "Escalón" },
];

function Desgloses({ d }: { d: ResumenVentas }) {
  const [eje, setEje] = useState<Eje>("porMetodo");
  const filas = d[eje];
  return (
    <Tarjeta titulo="De dónde viene el ingreso" pista="Solo pedidos vendidos. La barra es su parte del ingreso.">
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1">
        {EJES.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEje(e.id)}
            aria-pressed={eje === e.id}
            className={cn(
              "min-h-11 rounded-[var(--radius-sm)] text-[14px] font-semibold",
              eje === e.id ? "bg-surface text-fg shadow-sm" : "text-fg-subtle",
            )}
          >
            {e.etiqueta}
          </button>
        ))}
      </div>
      {filas.length === 0 ? (
        <p className="py-3 text-[14px] text-fg-subtle">Sin ventas en el rango.</p>
      ) : (
        <ul className="grid gap-3">
          {filas.map((f) => {
            const parte = d.ingresos > 0 ? f.ingresos / d.ingresos : 0;
            return (
              <li key={f.clave || "sin-dato"}>
                <div className="flex items-baseline justify-between gap-2 text-[14px]">
                  <span className="min-w-0 truncate font-medium">{f.etiqueta}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold">{pesosCentavos(f.ingresos)}</span>
                    <span className="text-fg-subtle">
                      {" "}
                      · {entero(f.pedidos)} · {Math.round(parte * 100)}%
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, parte * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

function TopProductos({ d }: { d: ResumenVentas }) {
  return (
    <Tarjeta
      titulo="Lo que más se vende"
      pista="Por ingreso de la línea, antes de los descuentos del pedido. Solo pedidos vendidos."
    >
      {d.topProductos.length === 0 ? (
        <p className="py-3 text-[14px] text-fg-subtle">Sin ventas en el rango.</p>
      ) : (
        <ol className="grid gap-1">
          {d.topProductos.map((p, i) => (
            <li
              key={`${p.productoId}|${p.ml}`}
              className="flex items-center gap-3 border-b border-border-soft py-2 last:border-b-0"
            >
              <span className="w-5 shrink-0 text-right text-[13px] font-semibold tabular-nums text-fg-subtle">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{p.nombre || p.productoId}</span>
                <span className="block truncate text-[12px] text-fg-subtle">
                  {p.ml > 0 ? `${p.ml} ml` : "Lote o set"} · {entero(p.piezas)}{" "}
                  {p.piezas === 1 ? "pieza" : "piezas"}
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums">{pesosCentavos(p.ingresos)}</span>
            </li>
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}

function TopClientes({ d }: { d: ResumenVentas }) {
  return (
    <Tarjeta titulo="Mejores clientes" pista="Por lo que compraron en el rango. Toca uno para ver su ficha.">
      {d.topClientes.length === 0 ? (
        <p className="py-3 text-[14px] text-fg-subtle">Sin ventas en el rango.</p>
      ) : (
        <ol className="grid gap-2">
          {d.topClientes.map((cl, i) => (
            <li key={cl.clave}>
              <Link
                href={enlaceCliente(cl.clave)}
                className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border border-border-soft bg-surface p-2.5"
              >
                <span className="w-5 shrink-0 text-right text-[13px] font-semibold tabular-nums text-fg-subtle">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">
                    {cl.nombre || telefonoLegible(cl.telefono) || cl.correo || "Sin nombre"}
                  </span>
                  <span className="block truncate text-[12px] text-fg-subtle">
                    {entero(cl.pedidos)} {cl.pedidos === 1 ? "pedido" : "pedidos"}
                    {cl.telefono && ` · ${telefonoLegible(cl.telefono)}`}
                  </span>
                </span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums">{pesosCentavos(cl.ingresos)}</span>
                <ChevronRight size={16} className="shrink-0 text-fg-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}

function Descuentos({ d }: { d: ResumenVentas }) {
  const x = d.descuentos;
  const total = x.volumen + x.transferencia + x.cupon + x.tresPorDos;
  return (
    <Tarjeta
      titulo="Descuentos concedidos"
      pista={`${pesosCentavos(total)} en pedidos vendidos del rango.`}
    >
      <div className="grid grid-cols-2 gap-2 [overflow-wrap:anywhere]">
        <Dato etiqueta="Por volumen" valor={pesosCentavos(x.volumen)} pista="escalones de mayoreo" />
        <Dato etiqueta="Por transferencia" valor={pesosCentavos(x.transferencia)} />
        <Dato etiqueta="Cupones" valor={pesosCentavos(x.cupon)} />
        <Dato etiqueta="3x2" valor={pesosCentavos(x.tresPorDos)} />
      </div>
    </Tarjeta>
  );
}

/* ── Exportar ─────────────────────────────────────────────────────────────── */

/**
 * Todo el resumen en un CSV por secciones, para la hoja de cálculo del
 * contador. Los montos van como número con punto decimal (sin «$» ni comas de
 * miles) para que Excel los sume.
 */
function exportar(d: ResumenVentas) {
  const vacia: Celda[] = [];
  const filas: Celda[][] = [
    ["Resumen de ventas", `${d.desde} a ${d.hasta}`, "Calendario de México"],
    ["Concepto", "Valor"],
    ["Pedidos (todos los estatus)", d.pedidos],
    ["Pedidos vendidos", d.vendidos],
    ["Pedidos pendientes", d.pendientes],
    ["Pedidos cancelados", d.cancelados],
    ["Ingresos (vendidos)", d.ingresos],
    ["Por cobrar (pendientes)", d.porCobrar],
    ["Ticket promedio", d.ticketPromedio],
    ["Piezas vendidas", d.piezas],
    ["Clientes nuevos", d.clientesNuevos],
    ["Clientes recurrentes", d.clientesRecurrentes],
    ...(d.truncado ? [["Aviso", "Más de 5000 pedidos: las cifras pueden estar incompletas"] as Celda[]] : []),
    vacia,
    ["Por día"],
    ["Fecha", "Pedidos", "Vendidos", "Ingresos", "Piezas"],
    ...d.porDia.map((x) => [x.fecha, x.pedidos, x.vendidos, x.ingresos, x.piezas]),
    vacia,
    ["Por estatus"],
    ["Estatus", "Pedidos", "Total"],
    ...d.porEstatus.map((x) => [x.estatus, x.pedidos, x.total]),
    vacia,
    ["Por forma de pago (vendidos)"],
    ["Clave", "Forma de pago", "Pedidos", "Ingresos"],
    ...d.porMetodo.map((x) => [x.clave, x.etiqueta, x.pedidos, x.ingresos]),
    vacia,
    ["Por envío (vendidos)"],
    ["Clave", "Envío", "Pedidos", "Ingresos"],
    ...d.porEnvio.map((x) => [x.clave, x.etiqueta, x.pedidos, x.ingresos]),
    vacia,
    ["Por escalón (vendidos)"],
    ["Clave", "Escalón", "Pedidos", "Ingresos"],
    ...d.porEscalon.map((x) => [x.clave, x.etiqueta, x.pedidos, x.ingresos]),
    vacia,
    ["Productos más vendidos"],
    ["Producto", "ml (0 = lote o set)", "Nombre", "Piezas", "Ingresos"],
    ...d.topProductos.map((x) => [x.productoId, x.ml, x.nombre, x.piezas, x.ingresos]),
    vacia,
    ["Mejores clientes"],
    ["Clave", "Nombre", "Teléfono", "Correo", "Pedidos", "Ingresos"],
    ...d.topClientes.map((x) => [x.clave, x.nombre, x.telefono, x.correo, x.pedidos, x.ingresos]),
    vacia,
    ["Descuentos concedidos (vendidos)"],
    ["Concepto", "Monto"],
    ["Por volumen", d.descuentos.volumen],
    ["Por transferencia", d.descuentos.transferencia],
    ["Cupones", d.descuentos.cupon],
    ["3x2", d.descuentos.tresPorDos],
  ];
  descargarCsv(`ventas-${d.desde}-a-${d.hasta}.csv`, filas);
}
