"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gráficas del panel de la tienda, en SVG a mano (sin librerías: es una
 * exportación estática que se abre con datos móviles).
 *
 * Reglas que siguen todas (las de la guía de visualización):
 * - Color por el **trabajo** del dato: una serie = `--color-serie-1`; el
 *   periodo anterior, gris punteado; categorías en orden fijo
 *   (`--color-serie-1..3`), nunca por ranking.
 * - Marcas delgadas: línea de 2 px, barras con punta redondeada de 4 px
 *   ancladas a la base, 2 px de aire entre segmentos.
 * - Los textos van en tinta de texto, nunca en el color de la serie.
 * - Toda gráfica tiene su lectura en texto (`aria-label`) y un tooltip al
 *   pasar el mouse o tocar.
 */

/* ── Medir el contenedor ──────────────────────────────────────────────────── */

/** Ancho real del contenedor: el texto de los ejes se queda legible en cualquier pantalla. */
function useAncho<T extends HTMLElement>(inicial = 320) {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      if (e) setAncho(Math.max(160, Math.round(e.contentRect.width)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** Un tope «redondo» para el eje: 1, 2, 2.5 o 5 por una potencia de 10. */
export function topeRedondo(max: number): number {
  if (max <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * base >= max) return m * base;
  return 10 * base;
}

export const pesosCompactos = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} M`
    : n >= 1000
      ? `$${(n / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} k`
      : `$${Math.round(n)}`;

/** $51,233 — sin centavos, para cifras de tablero donde el centavo solo estorba. */
export const pesosRedondos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0, minimumFractionDigits: 0 });

export const diaCorto = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });

/* ── Área en el tiempo ────────────────────────────────────────────────────── */

export type PuntoSerie = { fecha: string; valor: number };

/**
 * Una medida a lo largo de los días, con el periodo anterior (si lo hay)
 * como línea gris punteada debajo, alineado por posición (día 1 con día 1).
 * Crosshair y tooltip con las dos cifras.
 */
export function GraficaArea({
  datos,
  anterior,
  formato,
  alto = 220,
  etiquetaSerie = "Este periodo",
  etiquetaAnterior = "Periodo anterior",
}: {
  datos: PuntoSerie[];
  anterior?: PuntoSerie[] | null;
  formato: (n: number) => string;
  alto?: number;
  etiquetaSerie?: string;
  etiquetaAnterior?: string;
}) {
  const [caja, ancho] = useAncho<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);

  const izq = 52;
  const der = 12;
  const arriba = 12;
  const abajo = 26;
  const util = Math.max(1, ancho - izq - der);
  const altoUtil = alto - arriba - abajo;
  const n = datos.length;
  const max = topeRedondo(Math.max(0, ...datos.map((d) => d.valor), ...(anterior ?? []).map((d) => d.valor)));
  const x = (i: number) => izq + (n <= 1 ? util / 2 : (i / (n - 1)) * util);
  const y = (v: number) => arriba + altoUtil - (v / max) * altoUtil;

  const linea = (serie: PuntoSerie[]) => serie.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.valor).toFixed(1)}`).join(" ");
  const area =
    n > 0 ? `${linea(datos)} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";

  // Etiquetas del eje x sin encimarse: como mucho una cada ~64 px.
  const cada = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(util / 64))));

  const total = datos.reduce((s, d) => s + d.valor, 0);
  const mejor = datos.reduce<PuntoSerie | null>((m, d) => (!m || d.valor > m.valor ? d : m), null);
  const resumen =
    n === 0
      ? "Sin días en el rango."
      : `${etiquetaSerie}: ${formato(total)} del ${diaCorto(datos[0]!.fecha)} al ${diaCorto(datos[n - 1]!.fecha)}` +
        (mejor && mejor.valor > 0 ? `; el mejor día fue el ${diaCorto(mejor.fecha)} con ${formato(mejor.valor)}.` : ".");

  const alMover = (e: React.PointerEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = n <= 1 ? 0 : Math.round(((px - izq) / util) * (n - 1));
    setFoco(Math.min(n - 1, Math.max(0, i)));
  };

  const f = foco !== null ? datos[foco] : null;
  const fAnt = foco !== null && anterior ? anterior[foco] : null;
  const xFoco = foco !== null ? x(foco) : 0;
  const tooltipIzq = Math.min(Math.max(xFoco - 80, 0), Math.max(0, ancho - 168));

  return (
    <div ref={caja} className="relative w-full select-none">
      {anterior && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-muted" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-[var(--color-serie-1)]" />
            {etiquetaSerie}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-fg-subtle" />
            {etiquetaAnterior}
          </span>
        </div>
      )}
      <svg
        width={ancho}
        height={alto}
        role="img"
        aria-label={resumen}
        className="block touch-none"
        onPointerMove={alMover}
        onPointerDown={alMover}
        onPointerLeave={() => setFoco(null)}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={izq} x2={ancho - der} y1={y(max * t)} y2={y(max * t)} stroke="var(--color-border-soft)" />
            <text x={izq - 8} y={y(max * t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-fg-subtle)">
              {pesosCompactosSi(formato, max * t)}
            </text>
          </g>
        ))}
        {anterior && anterior.length > 0 && (
          <path d={linea(anterior.slice(0, n))} fill="none" stroke="var(--color-fg-subtle)" strokeWidth={1.5} strokeDasharray="4 4" />
        )}
        {n > 0 && <path d={area} fill="var(--color-serie-1-suave)" />}
        {n > 0 && <path d={linea(datos)} fill="none" stroke="var(--color-serie-1)" strokeWidth={2} strokeLinejoin="round" />}
        {datos.map((d, i) => {
          // La última siempre; las de en medio, una cada tantas y sin pegarse
          // a la última. Las de las orillas se anclan hacia dentro.
          const ultima = i === n - 1;
          const toca = ultima || (i % cada === 0 && n - 1 - i >= cada * 0.6);
          if (!toca) return null;
          const ancla = n > 1 && i === 0 ? "start" : ultima && n > 1 ? "end" : "middle";
          return (
            <text key={d.fecha} x={x(i)} y={alto - 8} textAnchor={ancla} fontSize={11} fill="var(--color-fg-subtle)">
              {diaCorto(d.fecha)}
            </text>
          );
        })}
        {f && (
          <g pointerEvents="none">
            <line x1={xFoco} x2={xFoco} y1={arriba} y2={y(0)} stroke="var(--color-border-strong)" />
            {fAnt && <circle cx={xFoco} cy={y(fAnt.valor)} r={4} fill="var(--color-surface)" stroke="var(--color-fg-subtle)" strokeWidth={2} />}
            <circle cx={xFoco} cy={y(f.valor)} r={5} fill="var(--color-serie-1)" stroke="var(--color-surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {f && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-[168px] rounded-[var(--radius-md)] border border-border-soft bg-surface px-3 py-2 text-[12px] shadow-lg"
          style={{ left: tooltipIzq, transform: `translateY(${anterior ? 24 : 0}px)` }}
        >
          <p className="font-semibold text-fg">{diaCorto(f.fecha)}</p>
          <p className="mt-0.5 flex items-center justify-between gap-2 text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-serie-1)]" />
              {anterior ? "Este" : "Valor"}
            </span>
            <span className="cifra font-semibold text-fg">{formato(f.valor)}</span>
          </p>
          {fAnt && (
            <p className="flex items-center justify-between gap-2 text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0 w-2 border-t-2 border-dashed border-fg-subtle" />
                Antes ({diaCorto(fAnt.fecha)})
              </span>
              <span className="cifra">{formato(fAnt.valor)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** En el eje, los pesos van compactos ($12 k); si la serie no es de pesos, su propio formato. */
function pesosCompactosSi(formato: (n: number) => string, v: number) {
  return formato(1).startsWith("$") ? pesosCompactos(v) : formato(Math.round(v));
}

/* ── Sparkline ────────────────────────────────────────────────────────────── */

/** Tendencia mínima para un KPI: sin ejes, solo la forma. Decorativa (el número va al lado). */
export function Sparkline({ valores, className }: { valores: number[]; className?: string }) {
  const w = 96;
  const h = 28;
  if (valores.length < 2) return <svg width={w} height={h} className={className} aria-hidden />;
  const max = Math.max(...valores, 1);
  const x = (i: number) => (i / (valores.length - 1)) * (w - 2) + 1;
  const y = (v: number) => h - 2 - (v / max) * (h - 4);
  const d = valores.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className={className} aria-hidden>
      <path d={`${d} L${x(valores.length - 1)},${h} L${x(0)},${h} Z`} fill="var(--color-serie-1-suave)" />
      <path d={d} fill="none" stroke="var(--color-serie-1)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/* ── Variación contra el periodo anterior ─────────────────────────────────── */

/**
 * «▲ 12 %» contra el periodo anterior. Con icono y texto, nunca solo color.
 * `inverso`: cuando bajar es bueno (p. ej. lo que falta por cobrar).
 */
export function Variacion({
  actual,
  anterior,
  inverso = false,
}: {
  actual: number;
  anterior: number | null | undefined;
  inverso?: boolean;
}) {
  if (anterior === null || anterior === undefined) return null;
  if (anterior === 0) {
    if (actual === 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-fg-subtle">
          <Minus size={13} /> igual
        </span>
      );
    }
    return <span className="text-[12px] font-semibold text-fg-subtle">nuevo</span>;
  }
  const cambio = (actual - anterior) / anterior;
  const sube = cambio > 0.005;
  const baja = cambio < -0.005;
  const bueno = inverso ? baja : sube;
  const malo = inverso ? sube : baja;
  const texto = `${Math.abs(cambio * 100).toLocaleString("es-MX", { maximumFractionDigits: Math.abs(cambio) < 0.1 ? 1 : 0 })} %`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] font-semibold",
        bueno && "bg-success/10 text-success",
        malo && "bg-danger/10 text-danger",
        !bueno && !malo && "bg-surface-2 text-fg-subtle",
      )}
      title={`Antes: ${anterior.toLocaleString("es-MX")}`}
    >
      {sube ? <ArrowUpRight size={13} /> : baja ? <ArrowDownRight size={13} /> : <Minus size={13} />}
      {sube || baja ? texto : "igual"}
      <span className="sr-only">{sube ? " más" : baja ? " menos" : ""} que el periodo anterior</span>
    </span>
  );
}

/* ── Barras horizontales ──────────────────────────────────────────────────── */

export type FilaBarra = {
  clave: string;
  etiqueta: React.ReactNode;
  /** Texto bajo la etiqueta (p. ej. «12 piezas»). */
  detalle?: React.ReactNode;
  valor: number;
  /** Lo que se escribe a la derecha. */
  texto: string;
  /** Color de la barra; por defecto, la serie 1. */
  color?: string;
  href?: string;
};

/**
 * Ranking o reparto en barras horizontales: la etiqueta arriba, el valor a la
 * derecha y la barra debajo. Se lee igual en un teléfono que en una pantalla
 * ancha, y el texto siempre está a la vista (no depende del color).
 */
export function BarrasHorizontales({ filas, max }: { filas: FilaBarra[]; max?: number }) {
  const tope = max ?? Math.max(0, ...filas.map((f) => f.valor));
  return (
    <ul className="grid gap-3">
      {filas.map((f) => {
        const pct = tope > 0 ? Math.max(f.valor > 0 ? 2 : 0, (f.valor / tope) * 100) : 0;
        const cuerpo = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-fg">{f.etiqueta}</span>
                {f.detalle && <span className="block truncate text-[12px] text-fg-subtle">{f.detalle}</span>}
              </span>
              <span className="cifra shrink-0 text-[14px] font-semibold text-fg">{f.texto}</span>
            </span>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, backgroundColor: f.color ?? "var(--color-serie-1)" }}
              />
            </span>
          </>
        );
        return (
          <li key={f.clave}>
            {f.href ? (
              <Link href={f.href} className="block rounded-[var(--radius-sm)] hover:bg-surface-2/60">
                {cuerpo}
              </Link>
            ) : (
              cuerpo
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ── Reparto en una barra ─────────────────────────────────────────────────── */

export type Parte = {
  clave: string;
  etiqueta: string;
  /** Texto chico bajo la etiqueta (p. ej. «8 pedidos»). */
  detalle?: string;
  valor: number;
  texto: string;
  color: string;
};

/**
 * Cómo se reparte un total (formas de pago, envíos): una barra al 100 % con 2
 * px de aire entre segmentos y la leyenda con la cifra de cada parte debajo.
 */
export function BarraReparto({ partes, total }: { partes: Parte[]; total: number }) {
  const con = partes.filter((p) => p.valor > 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img"
        aria-label={partes.map((p) => `${p.etiqueta}: ${p.texto}`).join("; ")}>
        {total > 0 &&
          con.map((p) => (
            <span
              key={p.clave}
              title={`${p.etiqueta}: ${p.texto}`}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(p.valor / total) * 100}%`, backgroundColor: p.color }}
            />
          ))}
      </div>
      <ul className="mt-3 grid gap-2">
        {partes.map((p) => (
          <li key={p.clave} className="flex items-center justify-between gap-3 text-[14px]">
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-fg">{p.etiqueta}</span>
                {p.detalle && <span className="block truncate text-[12px] text-fg-subtle">{p.detalle}</span>}
              </span>
            </span>
            <span className="cifra shrink-0 font-semibold text-fg">
              {p.texto}
              <span className="ml-1.5 text-[12px] font-medium text-fg-subtle">
                {total > 0 ? `${Math.round((p.valor / total) * 100)} %` : "—"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
