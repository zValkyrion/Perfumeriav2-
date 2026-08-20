"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,

  Download,
  LogOut,
  MapPin,
  Plus,
  Scale,
  Search,
  Store,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { BarraSync } from "@/components/barra-sync";
import { PortadaAcceso } from "@/components/portada-acceso";
import { Boton, Insignia, Tarjeta } from "@/components/ui";
import { espacio, listarProveedores } from "@/lib/almacen";
import {
  COLOR_SEMAFORO,
  ETIQUETA_SEMAFORO,
  analizar,
  completitud,
} from "@/lib/analisis";
import { useSesion } from "@/lib/sesion";
import type { Proveedor } from "@/lib/tipos";
import { cn, fechaCorta } from "@/lib/utils";

type Orden = "reciente" | "score";

export default function Pagina() {
  const sesion = useSesion();
  const router = useRouter();
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<Orden>("reciente");
  const [disco, setDisco] = useState<{ usadoMb: number; disponibleMb: number } | null>(
    null,
  );
  /** `null` = navegación normal. Un Set = modo comparar, con lo ya elegido. */
  const [seleccion, setSeleccion] = useState<Set<string> | null>(null);

  const activa = sesion.desbloqueado;

  useEffect(() => {
    if (!activa) return;
    listarProveedores().then(setProveedores);
    espacio().then(setDisco);
  }, [activa]);

  const visibles = useMemo(() => {
    if (!proveedores) return [];
    const q = busqueda.trim().toLowerCase();
    const filtrados = q
      ? proveedores.filter((p) =>
          [p.nombre, p.ciudad, p.telefono, p.direccion]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : proveedores;
    if (orden === "score") {
      return [...filtrados].sort(
        (a, b) => (analizar(b).score ?? -1) - (analizar(a).score ?? -1),
      );
    }
    return filtrados;
  }, [proveedores, busqueda, orden]);

  if (!sesion.listo) return null;
  if (!activa) return <PortadaAcceso sesion={sesion} />;

  const pendientes = proveedores?.filter((p) => p.estado !== "sincronizado").length ?? 0;
  const comparando = seleccion !== null;

  const alternarSeleccion = (id: string) => {
    setSeleccion((actual) => {
      if (actual === null) return actual;
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  return (
    <main className="p-4 pb-28">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <Logo />
            <span className="truncate text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
              {sesion.evaluador}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {comparando ? "Elige para comparar" : "Proveedores"}
          </h1>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* Vuelta a la tienda. Comparten dominio, así que es un enlace normal:
              se sale del panel sin cerrar sesión y se vuelve cuando haga falta. */}
          {!comparando && (
            <a href="/" aria-label="Ir a la tienda">
              <Boton variante="secundario" className="px-3">
                <Store size={18} />
              </Boton>
            </a>
          )}

          {comparando ? (
            <Boton
              variante="secundario"
              onClick={() => setSeleccion(null)}
              className="px-3"
              aria-label="Salir de comparar"
            >
              <X size={18} />
            </Boton>
          ) : (
            <>
              <ExportarCopia proveedores={proveedores ?? []} />
              <Boton
                variante="secundario"
                onClick={() => {
                  if (
                    confirm("¿Cerrar el acceso en este teléfono? Las fichas no se borran.")
                  )
                    sesion.salir();
                }}
                className="px-3"
                aria-label="Cerrar acceso"
              >
                <LogOut size={18} />
              </Boton>
            </>
          )}
        </div>
      </header>

      {!comparando && (
        <BarraSync
          sesion={sesion}
          pendientes={pendientes}
          alTerminar={() => listarProveedores().then(setProveedores)}
        />
      )}

      {proveedores && proveedores.length > 3 && (
        <div className="mb-3 grid gap-2">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, ciudad o teléfono"
              className="h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-10 pr-3 placeholder:text-fg-subtle"
            />
          </div>
          <div className="flex gap-2">
            {(["reciente", "score"] as Orden[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrden(o)}
                aria-pressed={orden === o}
                className={`min-h-11 flex-1 rounded-[var(--radius-md)] border text-[13px] font-medium ${
                  orden === o
                    ? "border-gold-deep bg-gold-gradient text-white"
                    : "border-border-strong bg-surface text-fg-muted"
                }`}
              >
                {o === "reciente" ? "Más recientes" : "Mejor puntaje"}
              </button>
            ))}
          </div>
        </div>
      )}

      {proveedores === null ? (
        <p className="text-[14px] text-fg-subtle">Cargando…</p>
      ) : visibles.length === 0 ? (
        <Vacio hayFiltro={busqueda.trim() !== ""} />
      ) : (
        <ul className="grid gap-2.5">
          {visibles.map((p) => (
            <li key={p.id}>
              <FilaProveedor
                proveedor={p}
                seleccionado={seleccion?.has(p.id) ?? false}
                modoSeleccion={comparando}
                onSeleccionar={() => alternarSeleccion(p.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {!comparando && disco && disco.disponibleMb < 150 && (
        <p className="mt-4 text-[13px] text-danger">
          Queda poco espacio en el teléfono ({disco.disponibleMb} MB). Conviene exportar
          una copia y liberar memoria.
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-2xl gap-2 border-t border-border-strong bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {comparando ? (
          <Boton
            onClick={() =>
              router.push(`/comparar/?ids=${[...(seleccion ?? [])].join(",")}`)
            }
            disabled={(seleccion?.size ?? 0) < 2}
            className="w-full"
          >
            <Scale size={18} />
            {(seleccion?.size ?? 0) < 2
              ? "Elige al menos 2"
              : `Comparar ${seleccion?.size} proveedores`}
          </Boton>
        ) : (
          <>
            <Link href="/captura/" className="flex-[2]">
              <Boton className="w-full">
                <Plus size={20} />
                Nuevo proveedor
              </Boton>
            </Link>
            {(proveedores?.length ?? 0) >= 2 && (
              <Boton
                variante="secundario"
                onClick={() => setSeleccion(new Set())}
                className="flex-1"
              >
                <Scale size={18} />
                Comparar
              </Boton>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function FilaProveedor({
  proveedor,
  seleccionado,
  modoSeleccion,
  onSeleccionar,
}: {
  proveedor: Proveedor;
  seleccionado: boolean;
  modoSeleccion: boolean;
  onSeleccionar: () => void;
}) {
  const { score, semaforo, cobertura } = analizar(proveedor);
  const avance = completitud(proveedor);
  // Un puntaje alto sostenido por dos respuestas engaña más que un puntaje bajo.
  // Cuando la información es poca, esa es la advertencia que hay que dar, no el
  // porcentaje de la ficha.
  const pocaInfo = score !== null && cobertura < 0.4;

  const cuerpo = (
    <>
      {modoSeleccion && (
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-md border",
            seleccionado
              ? "border-gold-deep bg-gold-gradient text-white"
              : "border-border-strong bg-surface",
          )}
        >
          {seleccionado && <Check size={16} />}
        </span>
      )}
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-bold tabular-nums text-white"
        style={{
          backgroundColor:
            semaforo === null ? "var(--color-fg-subtle)" : COLOR_SEMAFORO[semaforo],
        }}
        aria-label={
          score === null
            ? "Sin evaluar"
            : `Puntaje ${score} de 100, ${ETIQUETA_SEMAFORO[semaforo!]}`
        }
      >
        {score ?? "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {proveedor.nombre || "Sin nombre"}
        </span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-fg-subtle">
          {proveedor.lat !== null && <MapPin size={13} className="shrink-0" />}
          {proveedor.ciudad || proveedor.direccion || "Sin ubicación"}
          <span aria-hidden> · </span>
          {fechaCorta(proveedor.actualizadoEn)}
        </span>
      </span>
      {pocaInfo ? (
        <Insignia color="var(--color-warning)">
          {Math.round(cobertura * 100)}% info
        </Insignia>
      ) : (
        avance < 100 && <Insignia color="var(--color-warning)">{avance}%</Insignia>
      )}
    </>
  );

  const clases = cn(
    "flex w-full items-center gap-3 rounded-[var(--radius)] border bg-surface p-3 text-left",
    seleccionado ? "border-gold" : "border-border-soft",
  );

  if (modoSeleccion) {
    return (
      <button type="button" onClick={onSeleccionar} aria-pressed={seleccionado} className={clases}>
        {cuerpo}
      </button>
    );
  }

  return (
    <Link href={`/ficha/?id=${proveedor.id}`} className={clases}>
      {cuerpo}
    </Link>
  );
}

function Vacio({ hayFiltro }: { hayFiltro: boolean }) {
  if (hayFiltro) {
    return (
      <p className="py-8 text-center text-[14px] text-fg-subtle">Sin resultados.</p>
    );
  }
  return (
    <Tarjeta className="text-center">
      <p className="text-[15px] font-medium">Todavía no hay proveedores</p>
      <p className="mt-1 text-[14px] text-fg-muted">
        Toca <strong>Nuevo proveedor</strong> al entrar al local. Con el nombre, el
        teléfono y la ubicación ya tienes una ficha válida; lo demás se completa después.
      </p>
    </Tarjeta>
  );
}

/**
 * Copia de seguridad en JSON. Hasta que exista el backend, todo vive en un solo
 * teléfono: si se pierde o se rompe, se pierde la gira. Esto no sustituye a la
 * sincronización, es el seguro mientras llega.
 *
 * Las fotos NO van en la copia: son Blobs y no sobreviven a `JSON.stringify`.
 * Se quedan en el dispositivo hasta que la Fase 2 las suba a S3.
 */
function ExportarCopia({ proveedores }: { proveedores: Proveedor[] }) {
  const exportar = () => {
    const blob = new Blob([JSON.stringify(proveedores, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radar-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Boton
      variante="secundario"
      onClick={exportar}
      disabled={proveedores.length === 0}
      className="px-3"
      aria-label="Exportar copia de seguridad (sin fotos)"
      title="Exportar copia de seguridad — incluye los datos, no las fotos"
    >
      <Download size={18} />
    </Boton>
  );
}
