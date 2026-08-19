"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Crown, Trophy } from "lucide-react";
import { Boton, Insignia, Tarjeta } from "@/components/ui";
import { leerProveedor } from "@/lib/almacen";
import {
  COLOR_SEMAFORO,
  CRITERIOS,
  type Criterio,
  analizar,
  huecosDeFicha,
  mejorCostoPorMl,
  mejorCostoPorMlConPromo,
} from "@/lib/analisis";
import type { Proveedor } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/**
 * Comparación lado a lado.
 *
 * Se lee en columnas porque así es como se decide: la pregunta no es "¿qué tal
 * es este proveedor?" sino "¿cuál de estos tres me conviene?". Cada fila marca
 * al que gana ese criterio, y abajo se cuenta cuántas filas ganó cada uno — un
 * proveedor puede tener el puntaje global más alto y aun así perder en las tres
 * cosas que a ti te importan.
 */
export function VistaComparar() {
  const ids = (useSearchParams().get("ids") ?? "").split(",").filter(Boolean);
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);

  useEffect(() => {
    Promise.all(ids.map(leerProveedor)).then((lista) =>
      setProveedores(lista.filter((p): p is Proveedor => p !== undefined)),
    );
    // Los ids vienen de la URL y no cambian mientras la vista está abierta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  if (proveedores === null) {
    return <p className="p-5 text-[14px] text-fg-subtle">Abriendo…</p>;
  }

  if (proveedores.length < 2) {
    return (
      <main className="p-4">
        <Tarjeta className="text-center">
          <p className="text-[15px] font-medium">Hacen falta al menos dos fichas</p>
          <Link href="/" className="mt-3 inline-block">
            <Boton variante="secundario">Volver a la lista</Boton>
          </Link>
        </Tarjeta>
      </main>
    );
  }

  const analisis = proveedores.map((p) => ({ proveedor: p, ...analizar(p) }));

  // Victorias por criterio. Un empate no da punto a nadie: si dos proveedores
  // salen igual en precio, ese criterio no decide nada entre ellos.
  const victorias = new Map<string, number>();
  const ganadorDe: Partial<Record<Criterio, string | null>> = {};

  for (const clave of Object.keys(CRITERIOS) as Criterio[]) {
    let mejor: { id: string; valor: number } | null = null;
    let empate = false;
    for (const a of analisis) {
      const v = a.criterios[clave].valor;
      if (v === null) continue;
      if (mejor === null || v > mejor.valor) {
        mejor = { id: a.proveedor.id, valor: v };
        empate = false;
      } else if (v === mejor.valor) {
        empate = true;
      }
    }
    if (mejor && !empate) {
      ganadorDe[clave] = mejor.id;
      victorias.set(mejor.id, (victorias.get(mejor.id) ?? 0) + 1);
    } else {
      ganadorDe[clave] = null;
    }
  }

  const masVictorias = Math.max(0, ...victorias.values());
  const lider =
    masVictorias > 0
      ? analisis.find((a) => victorias.get(a.proveedor.id) === masVictorias)
      : undefined;

  const costos = analisis.map((a) => mejorCostoPorMl(a.proveedor.precios));
  const ordenados = costos.filter((c): c is number => c !== null).sort((a, b) => a - b);
  // Si dos empatan en el más barato, el precio no decide entre ellos y no se
  // resalta a nadie: marcar a los dos sugeriría una ventaja que no existe.
  const mejorCosto =
    ordenados.length > 0 && ordenados[0] !== ordenados[1] ? ordenados[0] : null;

  return (
    <main className="p-4 pb-8">
      <header className="mb-3 flex items-center gap-2">
        <Link href="/">
          <Boton variante="secundario" className="px-3" aria-label="Volver">
            <ArrowLeft size={20} />
          </Boton>
        </Link>
        <h1 className="text-[17px] font-semibold">
          Comparando {proveedores.length} proveedores
        </h1>
      </header>

      {lider && (
        <Tarjeta className="mb-3">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Trophy size={18} className="shrink-0 text-gold" />
            {lider.proveedor.nombre || "Sin nombre"} gana en {masVictorias} de{" "}
            {Object.keys(CRITERIOS).length} criterios
          </p>
          <p className="mt-1 text-[14px] text-fg-muted">{lider.veredicto}</p>
        </Tarjeta>
      )}

      {/* Una sola tabla con desplazamiento horizontal: en móvil, tres columnas
          apretadas se leen peor que dos y un gesto. */}
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border-soft bg-surface">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface p-3 text-left font-medium text-fg-subtle">
                Criterio
              </th>
              {analisis.map((a) => (
                <th key={a.proveedor.id} className="min-w-32 p-3 text-left align-top">
                  <Link
                    href={`/ficha/?id=${a.proveedor.id}`}
                    className="block truncate font-semibold"
                  >
                    {a.proveedor.nombre || "Sin nombre"}
                  </Link>
                  <span className="mt-1 flex items-center gap-1.5">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold tabular-nums text-white"
                      style={{
                        backgroundColor:
                          a.semaforo === null
                            ? "var(--color-fg-subtle)"
                            : COLOR_SEMAFORO[a.semaforo],
                      }}
                    >
                      {a.score ?? "—"}
                    </span>
                    <span className="text-[11px] font-normal text-fg-subtle">
                      {Math.round(a.cobertura * 100)}% info
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(CRITERIOS) as Criterio[]).map((clave) => (
              <tr key={clave} className="border-t border-border-soft">
                <th className="sticky left-0 z-10 bg-surface p-3 text-left font-medium text-fg-muted">
                  {CRITERIOS[clave].nombre}
                  <span className="ml-1 text-[11px] text-fg-subtle">
                    {CRITERIOS[clave].peso}%
                  </span>
                </th>
                {analisis.map((a) => {
                  const c = a.criterios[clave];
                  const gana = ganadorDe[clave] === a.proveedor.id;
                  return (
                    <td
                      key={a.proveedor.id}
                      className={cn("p-3 tabular-nums", gana && "bg-gold-muted font-semibold")}
                    >
                      {c.valor ?? <span className="text-fg-subtle">sin dato</span>}
                      {gana && <Crown size={13} className="ml-1 inline text-gold" />}
                    </td>
                  );
                })}
              </tr>
            ))}

            <Fila titulo="Costo por ml">
              {analisis.map((a, i) => (
                <td
                  key={a.proveedor.id}
                  className={cn(
                    "p-3 tabular-nums",
                    costos[i] !== null && costos[i] === mejorCosto && "bg-gold-muted font-semibold",
                  )}
                >
                  {costos[i] === null ? (
                    <span className="text-fg-subtle">sin dato</span>
                  ) : (
                    `${costos[i]!.toFixed(3)} ${a.proveedor.moneda}`
                  )}
                </td>
              ))}
            </Fila>

            <Fila titulo="Con promoción">
              {analisis.map((a) => {
                const conPromo = mejorCostoPorMlConPromo(a.proveedor);
                const lista = mejorCostoPorMl(a.proveedor.precios);
                const mejora = conPromo !== null && lista !== null && conPromo < lista;
                return (
                  <td key={a.proveedor.id} className="p-3 tabular-nums">
                    {conPromo === null ? (
                      <span className="text-fg-subtle">sin dato</span>
                    ) : (
                      <>
                        {conPromo.toFixed(3)}
                        {mejora && (
                          <span className="ml-1 text-[11px] text-success">
                            −{Math.round((1 - conPromo / lista!) * 100)}%
                          </span>
                        )}
                      </>
                    )}
                  </td>
                );
              })}
            </Fila>

            <Fila titulo="Entrega">
              {analisis.map((a) => (
                <td key={a.proveedor.id} className="p-3 tabular-nums">
                  {a.proveedor.ejes.dias_entrega === null ? (
                    <span className="text-fg-subtle">sin dato</span>
                  ) : (
                    `${a.proveedor.ejes.dias_entrega} días`
                  )}
                </td>
              ))}
            </Fila>

            <Fila titulo="Banderas rojas">
              {analisis.map((a) => (
                <td key={a.proveedor.id} className="p-3">
                  {a.proveedor.banderas.length === 0 ? (
                    <span className="text-fg-subtle">ninguna</span>
                  ) : (
                    <span className="font-semibold text-danger">
                      {a.proveedor.banderas.length}
                    </span>
                  )}
                </td>
              ))}
            </Fila>

            <Fila titulo="Preguntas sin hacer">
              {analisis.map((a) => {
                const faltan = a.pendientes.length + huecosDeFicha(a.proveedor).length;
                return (
                  <td key={a.proveedor.id} className="p-3 tabular-nums">
                    {faltan === 0 ? <span className="text-success">ninguna</span> : faltan}
                  </td>
                );
              })}
            </Fila>
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2.5">
        {analisis.map((a) => (
          <Tarjeta key={a.proveedor.id} titulo={a.proveedor.nombre || "Sin nombre"}>
            <p className="text-[14px] text-fg-muted">{a.veredicto}</p>
            {a.fortalezas.length > 0 && (
              <p className="mt-2 text-[13px]">
                <Insignia color="var(--color-success)">Fuerte en</Insignia>{" "}
                {a.fortalezas.join(", ")}
              </p>
            )}
            {a.debilidades.length > 0 && (
              <p className="mt-1.5 text-[13px]">
                <Insignia color="var(--color-danger)">Flojo en</Insignia>{" "}
                {a.debilidades.join(", ")}
              </p>
            )}
          </Tarjeta>
        ))}
      </div>

      <p className="mt-3 text-[12px] text-fg-subtle">
        El porcentaje de información importa tanto como el puntaje: comparar un
        proveedor con el 90% de la ficha contra otro con el 20% dice más de lo que se
        preguntó que de los proveedores.
      </p>
    </main>
  );
}

function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-border-soft">
      <th className="sticky left-0 z-10 bg-surface p-3 text-left font-medium text-fg-muted">
        {titulo}
      </th>
      {children}
    </tr>
  );
}
