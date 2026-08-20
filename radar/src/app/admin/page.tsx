"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { MapaTodos } from "@/components/mapa-todos";
import { Boton, Insignia, Tarjeta } from "@/components/ui";
import { listarRemoto } from "@/lib/api";
import { listarProveedores } from "@/lib/almacen";
import {
  COLOR_SEMAFORO,
  ETIQUETA_SEMAFORO,
  analizar,
  mejorCostoPorMlConPromo,
} from "@/lib/analisis";
import { useSesion } from "@/lib/sesion";
import type { Proveedor } from "@/lib/tipos";
import { fechaCorta } from "@/lib/utils";

/**
 * Vista de conjunto para administración.
 *
 * La lista de la portada responde "¿qué capturé?"; esta responde "¿con quién nos
 * quedamos?": todo el equipo junto, ordenado por puntaje, sobre el mapa, y en un
 * CSV que se pueda llevar a una hoja de cálculo para negociar.
 *
 * **El grupo `admins` decide qué se pinta, no qué se puede leer.** Los datos
 * salen de `GET /proveedores`, que devuelve todo a cualquier token válido —"todos
 * ven lo de todos" es una decisión del módulo, no un descuido. Así que esta
 * puerta no guarda ningún secreto: evita que la vista de conjunto estorbe a quien
 * está capturando en la calle. El día que esta pantalla lea algo que un
 * `proveedores` no deba ver, el filtro va en `servidor/api.ts`; ponerlo aquí no
 * serviría de nada porque el navegador es de quien mira.
 */
export default function Pagina() {
  const sesion = useSesion();
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [fuenteLocal, setFuenteLocal] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Se incrementa para pedir otra consulta. Ver el efecto de abajo. */
  const [intento, setIntento] = useState(0);

  const esAdmin = sesion.grupos.includes("admins");
  const token = sesion.token;

  // El botón de refrescar no llama a la consulta: mueve `intento` y este efecto
  // reacciona. Así el estado solo se toca después de un `await` —nunca de forma
  // síncrona dentro del efecto— y el montaje y el refresco recorren el mismo
  // camino en vez de dos.
  useEffect(() => {
    if (!sesion.listo || !esAdmin) return;
    let vivo = true;

    (async () => {
      try {
        if (!token) throw new Error("Sin sesión con el servidor");
        const { proveedores: remotos } = await listarRemoto(token);
        if (!vivo) return;
        setProveedores(remotos);
        setFuenteLocal(false);
        setError(null);
      } catch (e) {
        // Sin red esta pantalla no queda vacía: lo que hay en el teléfono es un
        // subconjunto honesto y se dice que lo es.
        const locales = await listarProveedores();
        if (!vivo) return;
        setProveedores(locales);
        setFuenteLocal(true);
        setError(e instanceof Error ? e.message : "No se pudo consultar el servidor");
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [sesion.listo, esAdmin, token, intento]);

  const cargar = useCallback(() => {
    setCargando(true);
    setIntento((n) => n + 1);
  }, []);

  const ranking = useMemo(() => {
    if (!proveedores) return [];
    return [...proveedores]
      .map((p) => ({ proveedor: p, analisis: analizar(p) }))
      .sort((a, b) => (b.analisis.score ?? -1) - (a.analisis.score ?? -1));
  }, [proveedores]);

  if (!sesion.listo) return null;

  if (!sesion.desbloqueado) {
    return (
      <Aviso titulo="Hay que iniciar sesión">
        Esta vista pide una cuenta del equipo. Entra desde la portada del panel.
      </Aviso>
    );
  }

  if (!esAdmin) {
    return (
      <Aviso titulo="Tu cuenta no abre esta vista">
        La vista de conjunto es del grupo <strong>admins</strong>. Tu sesión sirve
        para capturar y consultar fichas con normalidad; si necesitas el resumen
        global, pídele a un administrador que te cambie de grupo.
      </Aviso>
    );
  }

  const resumen = contar(ranking);

  return (
    <main className="p-4 pb-10">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-fg-subtle"
          >
            <ArrowLeft size={15} />
            Proveedores
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Vista de conjunto
          </h1>
          <p className="text-[13px] text-fg-subtle">
            {proveedores === null
              ? "Cargando…"
              : `${proveedores.length} fichas · ${fuenteLocal ? "solo este teléfono" : "todo el equipo"}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Boton
            variante="secundario"
            onClick={cargar}
            disabled={cargando}
            className="px-3"
            aria-label="Volver a consultar"
          >
            <RefreshCw size={18} className={cargando ? "animate-spin" : undefined} />
          </Boton>
          <ExportarCsv ranking={ranking} />
        </div>
      </header>

      {error && (
        <p className="mb-3 rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 p-3 text-[13px] text-fg-muted">
          {error}. Se muestra lo que hay guardado en este teléfono, que puede no
          ser todo lo que capturó el equipo.
        </p>
      )}

      {proveedores !== null && proveedores.length === 0 ? (
        <Tarjeta className="text-center">
          <p className="text-[15px] font-medium">Todavía no hay nada que resumir</p>
          <p className="mt-1 text-[14px] text-fg-muted">
            En cuanto el equipo suba fichas, aparecen aquí.
          </p>
        </Tarjeta>
      ) : (
        proveedores !== null && (
          <div className="grid gap-4">
            <Tarjeta titulo="Cómo va la gira" pista="Sobre las fichas ya evaluadas.">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Dato etiqueta="Buenos" valor={resumen.bueno} color="var(--color-success)" />
                <Dato etiqueta="Con reservas" valor={resumen.regular} color="var(--color-warning)" />
                <Dato etiqueta="Riesgosos" valor={resumen.malo} color="var(--color-danger)" />
                <Dato etiqueta="Sin evaluar" valor={resumen.sinEvaluar} color="var(--color-fg-subtle)" />
              </dl>
            </Tarjeta>

            <Tarjeta titulo="Dónde están" pista="El color es el del semáforo.">
              <MapaTodos proveedores={proveedores} />
            </Tarjeta>

            <Tarjeta
              titulo="Ranking global"
              pista="Ordenado por puntaje. La cobertura dice cuánta ficha lo sostiene."
            >
              <ol className="grid gap-2">
                {ranking.map(({ proveedor, analisis }, i) => (
                  <li key={proveedor.id}>
                    <Link
                      href={`/ficha/?id=${proveedor.id}`}
                      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border-soft bg-surface p-2.5"
                    >
                      <span className="w-5 shrink-0 text-right text-[13px] font-semibold tabular-nums text-fg-subtle">
                        {i + 1}
                      </span>
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-bold tabular-nums text-white"
                        style={{
                          backgroundColor:
                            analisis.semaforo === null
                              ? "var(--color-fg-subtle)"
                              : COLOR_SEMAFORO[analisis.semaforo],
                        }}
                        aria-label={
                          analisis.score === null
                            ? "Sin evaluar"
                            : `Puntaje ${analisis.score} de 100`
                        }
                      >
                        {analisis.score ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">
                          {proveedor.nombre || "Sin nombre"}
                        </span>
                        <span className="block truncate text-[13px] text-fg-subtle">
                          {proveedor.ciudad || proveedor.pais || "Sin ciudad"}
                          <span aria-hidden> · </span>
                          {proveedor.evaluador || "sin firma"}
                          <span aria-hidden> · </span>
                          {fechaCorta(proveedor.actualizadoEn)}
                        </span>
                      </span>
                      {analisis.topadoPorBandera ? (
                        <Insignia color="var(--color-danger)">bandera</Insignia>
                      ) : (
                        <Insignia>{Math.round(analisis.cobertura * 100)}%</Insignia>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
            </Tarjeta>
          </div>
        )
      )}
    </main>
  );
}

function Dato({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: number;
  color: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border-soft p-3">
      <dt className="text-[12px] font-medium text-fg-subtle">{etiqueta}</dt>
      <dd className="text-[22px] font-semibold tabular-nums" style={{ color }}>
        {valor}
      </dd>
    </div>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="p-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-fg-subtle"
      >
        <ArrowLeft size={15} />
        Proveedores
      </Link>
      <Tarjeta className="mt-3">
        <p className="text-[15px] font-medium">{titulo}</p>
        <p className="mt-1 text-[14px] text-fg-muted">{children}</p>
      </Tarjeta>
    </main>
  );
}

type Fila = { proveedor: Proveedor; analisis: ReturnType<typeof analizar> };

/**
 * Marca de orden de bytes al principio del CSV.
 *
 * Es lo que hace que Excel abra el archivo como UTF-8; sin ella, cada acento del
 * nombre de un proveedor sale roto. Va escapada y no como el carácter literal:
 * es invisible en el código, y cualquier editor o formateador se la llevaría por
 * delante sin que nadie note que el archivo dejó de abrirse bien.
 */
const BOM = "\uFEFF";

function contar(ranking: Fila[]) {
  const r = { bueno: 0, regular: 0, malo: 0, sinEvaluar: 0 };
  for (const { analisis } of ranking) {
    if (analisis.semaforo === null) r.sinEvaluar++;
    else r[analisis.semaforo]++;
  }
  return r;
}

/**
 * Exporta el ranking a CSV.
 *
 * Va a una hoja de cálculo, que es donde se arma la negociación: precios al
 * lado, columnas propias, filtros. El puntaje viaja **con su cobertura** por la
 * misma razón que en pantalla — un 80 con el 30% de la ficha respondida no es el
 * mismo 80 que uno con el 90%, y en una hoja sin ese dato al lado nadie lo
 * recuerda.
 */
function ExportarCsv({ ranking }: { ranking: Fila[] }) {
  const exportar = () => {
    const encabezados = [
      "posicion",
      "nombre",
      "razon_social",
      "tipo",
      "ciudad",
      "pais",
      "telefono",
      "whatsapp",
      "contacto",
      "score",
      "semaforo",
      "cobertura_pct",
      "bandera_critica",
      "banderas",
      "decision",
      "mejor_costo_por_ml",
      "moneda",
      "lat",
      "lng",
      "evaluador",
      "actualizado_en",
    ];

    const filas = ranking.map(({ proveedor: p, analisis: a }, i) => {
      const costo = mejorCostoPorMlConPromo(p);
      return [
        i + 1,
        p.nombre,
        p.razonSocial,
        p.tipo ?? "",
        p.ciudad,
        p.pais,
        p.telefono,
        p.whatsapp,
        p.contactoNombre,
        // Sin evaluar se queda vacío, no en cero: en la hoja, un cero se ordena
        // y se promedia como si fuera una observación.
        a.score ?? "",
        a.semaforo ? ETIQUETA_SEMAFORO[a.semaforo] : "",
        Math.round(a.cobertura * 100),
        a.topadoPorBandera ? "si" : "no",
        p.banderas.join(" "),
        p.decision ?? "",
        costo === null ? "" : costo.toFixed(4),
        p.moneda,
        p.lat ?? "",
        p.lng ?? "",
        p.evaluador,
        p.actualizadoEn,
      ];
    });

    const csv =
      BOM +
      [encabezados, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `radar-proveedores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Boton
      variante="secundario"
      onClick={exportar}
      disabled={ranking.length === 0}
      className="px-3"
      aria-label="Exportar CSV"
      title="Exportar el ranking a CSV"
    >
      <Download size={18} />
    </Boton>
  );
}

/**
 * Una celda de CSV.
 *
 * Siempre entre comillas: los nombres y direcciones llevan comas y saltos de
 * línea, y una sola coma sin escapar corre todas las columnas de esa fila.
 */
function celda(valor: string | number): string {
  return `"${String(valor).replace(/"/g, '""')}"`;
}
