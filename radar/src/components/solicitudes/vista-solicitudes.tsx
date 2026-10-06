"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageCircle, Phone, RefreshCw, Search } from "lucide-react";
import type {
  EstadoSolicitud,
  TipoSolicitud,
} from "../../../../compartido/tienda-admin";
import { Boton, Insignia } from "@/components/ui";
import { Mensaje } from "@/components/catalogo/comun";
import {
  Cabecera,
  ErrorCarga,
  PuertaAdmin,
  fechaHora,
  usePanelAdmin,
  whatsappCliente,
} from "@/components/tienda/comun";
import {
  coincide,
  enlaceCliente,
  enlaceLlamar,
  enlacePedido,
  normalizar,
  telefonoLegible,
} from "@/components/clientes/formato";
import {
  ErrorGuardado,
  cambiarSolicitud,
  listarSolicitudes,
  type CambioSolicitud,
  type SolicitudAdmin,
} from "@/lib/tienda-admin";
import { cn } from "@/lib/utils";
import { Desactualizado } from "@/components/ventas/desactualizado";

/**
 * Solicitudes que llegan de la tienda: «Quiero ser distribuidor», contacto y
 * facturas (`GET /admin/solicitudes`).
 *
 * Cada una se abre en su lugar con todos sus datos —los fiscales incluidos—,
 * se le cambia el estado y se le deja una nota para el equipo. Dos admins
 * pueden tocar la misma a la vez: el servidor responde 409 si otro la cambió, y
 * lo tecleado **no se pierde** al recargar (es texto que alguien escribió).
 */

/* Los vocabularios son copia de `compartido/tienda-admin.ts`: el panel solo
   importa tipos de `compartido/` (su raíz de Turbopack es `radar/`). El
   `Record` obliga a que estén todos; uno de más lo rechaza el servidor (422). */
const ESTADOS: Record<EstadoSolicitud, { etiqueta: string; plural: string; color: string }> = {
  nueva: { etiqueta: "Nueva", plural: "Nuevas", color: "var(--color-warning)" },
  "en proceso": { etiqueta: "En proceso", plural: "En proceso", color: "var(--color-info)" },
  cerrada: { etiqueta: "Cerrada", plural: "Cerradas", color: "var(--color-success)" },
  descartada: { etiqueta: "Descartada", plural: "Descartadas", color: "var(--color-fg-subtle)" },
};
const LISTA_ESTADOS = Object.keys(ESTADOS) as EstadoSolicitud[];

const TIPOS: Record<TipoSolicitud, { etiqueta: string; color: string }> = {
  distribuidor: { etiqueta: "Distribuidor", color: "var(--color-gold-deep)" },
  contacto: { etiqueta: "Contacto", color: "var(--color-info)" },
  factura: { etiqueta: "Factura", color: "var(--color-success)" },
};
const LISTA_TIPOS = Object.keys(TIPOS) as TipoSolicitud[];

/** El tope del servidor para la nota (`MAX_NOTA`). */
const MAX_NOTA = 1000;

type FiltroEstado = EstadoSolicitud | "todas";
type FiltroTipo = TipoSolicitud | "todos";

const CLAVE_VISTA = "radar:solicitudes:vista";

function vistaGuardada(): { estado?: FiltroEstado; tipo?: FiltroTipo; busqueda?: string } {
  if (typeof window === "undefined") return {};
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE_VISTA) ?? "{}");
    return {
      estado: v.estado === "todas" || LISTA_ESTADOS.includes(v.estado) ? v.estado : undefined,
      tipo: v.tipo === "todos" || LISTA_TIPOS.includes(v.tipo) ? v.tipo : undefined,
      busqueda: typeof v.busqueda === "string" ? v.busqueda : undefined,
    };
  } catch {
    return {};
  }
}

type Borrador = { estado: EstadoSolicitud; nota: string };
type Aviso = {
  tono: "ok" | "error" | "aviso";
  texto: string;
  conflicto?: boolean;
  /** Se pidió lo último guardado tras un choque: el texto depende de si ya llegó. */
  recarga?: boolean;
};

const notaLimpia = (t: string) => t.trim() || null;

export function VistaSolicitudes() {
  const c = usePanelAdmin(listarSolicitudes);
  const [inicial] = useState(vistaGuardada);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>(inicial.estado ?? "nueva");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>(inicial.tipo ?? "todos");
  const [busqueda, setBusqueda] = useState(inicial.busqueda ?? "");
  const [abiertas, setAbiertas] = useState<string[]>([]);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [avisos, setAvisos] = useState<Record<string, Aviso>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  // Las que se acaban de cambiar siguen a la vista aunque ya no pasen el filtro:
  // si desaparecieran al guardarlas, se iría con ellas el «Guardado».
  const [fijas, setFijas] = useState<string[]>([]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        CLAVE_VISTA,
        JSON.stringify({ estado: filtroEstado, tipo: filtroTipo, busqueda }),
      );
    } catch {
      // Sin almacenamiento solo se pierde el recordatorio.
    }
  }, [filtroEstado, filtroTipo, busqueda]);

  const bloqueo = PuertaAdmin({ c, titulo: "Solicitudes", volver: "/tienda/" });
  if (bloqueo) return bloqueo;

  const todas = c.datos?.solicitudes;
  const q = normalizar(busqueda.trim());
  const delTipo = (todas ?? []).filter(
    (s) =>
      (filtroTipo === "todos" || s.tipo === filtroTipo) &&
      coincide(q, s.nombre, s.telefono, s.correo, s.ciudad, s.negocio, s.folio, s.rfc, s.razonSocial),
  );
  const lista = delTipo.filter(
    (s) => filtroEstado === "todas" || s.estado === filtroEstado || fijas.includes(s.id),
  );
  const nuevas = (todas ?? []).filter((s) => s.estado === "nueva").length;

  const cambiarFiltro = (f: () => void) => {
    setFijas([]);
    f();
  };
  const ponerAviso = (id: string, aviso: Aviso | null) =>
    setAvisos((a) => {
      const copia = { ...a };
      if (aviso) copia[id] = aviso;
      else delete copia[id];
      return copia;
    });

  const guardar = async (s: SolicitudAdmin, b: Borrador) => {
    if (!c.token) return;
    const cambio: CambioSolicitud = { actualizadaEn: s.actualizadaEn };
    // Solo lo que cambió: lo que no se tocó no pisa lo que haya puesto otro.
    if (b.estado !== s.estado) cambio.estado = b.estado;
    if (notaLimpia(b.nota) !== (s.nota ?? null)) cambio.nota = notaLimpia(b.nota);
    setGuardando(s.id);
    ponerAviso(s.id, null);
    try {
      const nueva = await cambiarSolicitud(c.token, s.id, cambio);
      c.setDatos((d) =>
        d ? { ...d, solicitudes: d.solicitudes.map((x) => (x.id === nueva.id ? nueva : x)) } : d,
      );
      setBorradores((bs) => {
        const copia = { ...bs };
        delete copia[s.id];
        return copia;
      });
      setFijas((f) => (f.includes(s.id) ? f : [...f, s.id]));
      ponerAviso(s.id, { tono: "ok", texto: "Guardado." });
    } catch (e) {
      ponerAviso(s.id, {
        tono: "error",
        texto: e instanceof Error ? e.message : "No se pudo guardar",
        conflicto: e instanceof ErrorGuardado && e.estado === 409,
      });
    } finally {
      setGuardando(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl p-4 pb-12 sm:p-6">
      <Cabecera
        titulo="Solicitudes"
        subtitulo={
          todas
            ? `${todas.length} en total · ${nuevas} ${nuevas === 1 ? "nueva" : "nuevas"}`
            : c.error
              ? "No se pudo leer"
              : "Cargando…"
        }
        acciones={
          <Boton
            variante="secundario"
            onClick={c.recargar}
            disabled={c.cargando}
            className="px-3"
            aria-label="Volver a leer las solicitudes"
          >
            <RefreshCw size={18} className={cn(c.cargando && "animate-spin")} />
          </Boton>
        }
      />

      {c.error && (
        <div className="mb-3">
          {todas ? (
            <Desactualizado error={c.error} recargar={c.recargar} cargando={c.cargando} />
          ) : (
            <ErrorCarga mensaje={c.error} recargar={c.recargar} cargando={c.cargando} />
          )}
        </div>
      )}

      <div className="mb-3 grid grid-cols-4 gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1" role="group" aria-label="Tipo">
        {(["todos", ...LISTA_TIPOS] as FiltroTipo[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => cambiarFiltro(() => setFiltroTipo(t))}
            aria-pressed={filtroTipo === t}
            className={cn(
              "min-h-11 truncate rounded-[var(--radius-sm)] px-1 text-[13px] font-semibold",
              filtroTipo === t ? "bg-surface text-fg shadow-sm" : "text-fg-subtle",
            )}
          >
            {t === "todos" ? "Todas" : TIPOS[t].etiqueta}
          </button>
        ))}
      </div>

      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Estado">
        {([...LISTA_ESTADOS, "todas"] as FiltroEstado[]).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => cambiarFiltro(() => setFiltroEstado(e))}
            aria-pressed={filtroEstado === e}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-medium",
              filtroEstado === e
                ? "border-gold-deep bg-gold-gradient text-white"
                : "border-border-strong bg-surface text-fg-muted",
            )}
          >
            {e === "todas" ? "Todas" : ESTADOS[e].plural}
            {todas && (
              <span className="ml-1 tabular-nums opacity-80">
                {e === "todas" ? delTipo.length : delTipo.filter((s) => s.estado === e).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          aria-hidden
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, teléfono, negocio, folio o RFC"
          aria-label="Buscar solicitudes"
          className="h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-10 pr-3 placeholder:text-fg-subtle"
        />
      </div>

      {!todas ? (
        !c.error && <p className="text-[14px] text-fg-subtle">Leyendo las solicitudes…</p>
      ) : lista.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-fg-subtle">
          {todas.length === 0
            ? "Todavía no llega ninguna. Aquí aparecen las de «Quiero ser distribuidor», contacto y factura."
            : "Ninguna solicitud con ese filtro o búsqueda."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {lista.map((s) => {
            const borrador = borradores[s.id] ?? { estado: s.estado, nota: s.nota ?? "" };
            return (
              <FilaSolicitud
                key={s.id}
                s={s}
                abierta={abiertas.includes(s.id)}
                alternar={() =>
                  setAbiertas((a) => (a.includes(s.id) ? a.filter((x) => x !== s.id) : [...a, s.id]))
                }
                borrador={borrador}
                editado={s.id in borradores}
                cambiarBorrador={(b) => {
                  setBorradores((bs) => ({ ...bs, [s.id]: b }));
                  // Un «Guardado.» de antes ya no describe lo que se ve.
                  if (avisos[s.id]?.tono === "ok") ponerAviso(s.id, null);
                }}
                guardando={guardando === s.id}
                aviso={avisos[s.id] ?? null}
                guardar={() => guardar(s, borrador)}
                cargandoLista={c.cargando}
                recargar={() => {
                  ponerAviso(s.id, { tono: "aviso", texto: "", recarga: true });
                  // Si el otro admin le cambió el estado, al recargar ya no
                  // pasaría el filtro y se iría de la vista con lo tecleado.
                  setFijas((f) => (f.includes(s.id) ? f : [...f, s.id]));
                  c.recargar();
                }}
              />
            );
          })}
        </ul>
      )}
    </main>
  );
}

/* ── Una solicitud ────────────────────────────────────────────────────────── */

function textoWhatsapp(s: SolicitudAdmin): string {
  const primer = s.nombre.trim().split(/\s+/)[0] ?? "";
  const hola = `Hola${primer ? ` ${primer}` : ""}, te escribimos de El Rey de los Perfumes`;
  switch (s.tipo) {
    case "distribuidor":
      return `${hola} por tu solicitud para ser distribuidor.`;
    case "factura":
      return `${hola} por la factura${s.folio ? ` del pedido ${s.folio}` : ""}.`;
    default:
      return `${hola} por el mensaje que nos dejaste.`;
  }
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-soft py-2 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-fg-subtle">{etiqueta}</dt>
      <dd className="min-w-0 text-right text-[14px] [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const claseEnlace =
  "lift inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 text-[15px] font-semibold text-fg";

function FilaSolicitud({
  s,
  abierta,
  alternar,
  borrador,
  editado,
  cambiarBorrador,
  guardando,
  aviso,
  guardar,
  recargar,
  cargandoLista,
}: {
  s: SolicitudAdmin;
  abierta: boolean;
  alternar: () => void;
  borrador: Borrador;
  /** Hay algo tecleado que todavía no se guarda. */
  editado: boolean;
  cambiarBorrador: (b: Borrador) => void;
  guardando: boolean;
  aviso: Aviso | null;
  guardar: () => void;
  recargar: () => void;
  /** Hay una lectura de la lista en vuelo. */
  cargandoLista: boolean;
}) {
  const idPanel = `solicitud-${s.id}`;
  const estado = ESTADOS[s.estado] ?? ESTADOS.nueva;
  const tipo = TIPOS[s.tipo] ?? { etiqueta: s.tipo, color: "var(--color-fg-muted)" };
  const cambiado = borrador.estado !== s.estado || notaLimpia(borrador.nota) !== (s.nota ?? null);
  const llamar = enlaceLlamar(s.telefono);
  const whatsapp = whatsappCliente(s.telefono, textoWhatsapp(s));
  const resumen = [s.negocio, s.ciudad, s.tipo === "factura" && s.folio ? `folio ${s.folio}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="rounded-[var(--radius)] border border-border-soft bg-surface">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        aria-controls={idPanel}
        className="flex min-h-12 w-full items-center gap-3 p-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{s.nombre || "Sin nombre"}</span>
            {editado && cambiado && <Insignia color="var(--color-warning)">sin guardar</Insignia>}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <Insignia color={tipo.color}>{tipo.etiqueta}</Insignia>
            <span className="truncate text-[13px] text-fg-subtle">{resumen || telefonoLegible(s.telefono)}</span>
          </span>
          <span className="block truncate text-[12px] text-fg-subtle">{fechaHora(s.creadaEn)}</span>
        </span>
        <Insignia color={estado.color}>{estado.etiqueta}</Insignia>
        <ChevronDown
          size={18}
          aria-hidden
          className={cn("shrink-0 text-fg-subtle transition-transform", abierta && "rotate-180")}
        />
      </button>

      {abierta && (
        <div id={idPanel} className="border-t border-border-soft p-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={claseEnlace}>
                <MessageCircle size={18} />
                WhatsApp
              </a>
            ) : (
              <span role="link" aria-disabled="true" className={cn(claseEnlace, "opacity-40")}>
                <MessageCircle size={18} />
                WhatsApp
              </span>
            )}
            {llamar ? (
              <a href={llamar} className={claseEnlace}>
                <Phone size={18} />
                Llamar
              </a>
            ) : (
              <span role="link" aria-disabled="true" className={cn(claseEnlace, "opacity-40")}>
                <Phone size={18} />
                Llamar
              </span>
            )}
          </div>

          <dl>
            <Fila etiqueta="Tipo">{tipo.etiqueta}</Fila>
            <Fila etiqueta="Nombre">{s.nombre || "—"}</Fila>
            <Fila etiqueta="Teléfono">{telefonoLegible(s.telefono) || "—"}</Fila>
            <Fila etiqueta="Correo">
              {s.correo ? (
                <a href={`mailto:${s.correo}`} className="font-medium text-info underline">
                  {s.correo}
                </a>
              ) : (
                "—"
              )}
            </Fila>
            {(s.ciudad || s.tipo !== "factura") && <Fila etiqueta="Ciudad">{s.ciudad || "—"}</Fila>}
            {(s.negocio || s.tipo === "distribuidor") && <Fila etiqueta="Negocio">{s.negocio || "—"}</Fila>}
            {(s.volumen || s.tipo === "distribuidor") && (
              <Fila etiqueta="Volumen que maneja">{s.volumen || "—"}</Fila>
            )}
            {s.tipo === "factura" && (
              <>
                <Fila etiqueta="Pedido">
                  {s.folio ? (
                    <Link href={enlacePedido(s.folio)} className="font-medium text-info underline">
                      {s.folio}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Fila>
                <Fila etiqueta="RFC">{s.rfc || "—"}</Fila>
                <Fila etiqueta="Razón social">{s.razonSocial || "—"}</Fila>
                <Fila etiqueta="Régimen fiscal">{s.regimen || "—"}</Fila>
                <Fila etiqueta="C. P. fiscal">{s.cpFiscal || "—"}</Fila>
                <Fila etiqueta="Uso del CFDI">{s.usoCfdi || "—"}</Fila>
              </>
            )}
            <Fila etiqueta="Cuenta">
              {s.sub ? (
                <Link href={enlaceCliente(s.sub)} className="font-medium text-info underline">
                  Ver su ficha
                </Link>
              ) : (
                "La mandó sin iniciar sesión"
              )}
            </Fila>
            <Fila etiqueta="Llegó">{fechaHora(s.creadaEn)}</Fila>
            {s.actualizadaEn !== s.creadaEn && <Fila etiqueta="Último cambio">{fechaHora(s.actualizadaEn)}</Fila>}
          </dl>

          {s.mensaje && (
            <div className="mt-3">
              <p className="text-[13px] text-fg-subtle">Mensaje</p>
              <p className="mt-1 whitespace-pre-wrap rounded-[var(--radius-md)] bg-surface-2 p-3 text-[14px] [overflow-wrap:anywhere]">
                {s.mensaje}
              </p>
            </div>
          )}

          <form
            className="mt-4 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (cambiado && !guardando) guardar();
            }}
          >
            {/* Tras un choque con otro admin: lo guardado, para compararlo con lo tecleado. */}
            {editado && cambiado && (aviso?.conflicto || aviso?.tono === "aviso") && (
              <p className="rounded-[var(--radius-md)] bg-surface-2 p-3 text-[13px] text-fg-muted [overflow-wrap:anywhere]">
                Guardado ahora: <strong>{estado.etiqueta}</strong>
                {" · "}
                {s.nota ? <>nota «{s.nota}»</> : "sin nota"}
              </p>
            )}
            <fieldset>
              <legend className="mb-2 block text-[13px] font-medium text-fg-muted">Estado</legend>
              <div className="flex flex-wrap gap-2">
                {LISTA_ESTADOS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={borrador.estado === e}
                    onClick={() => cambiarBorrador({ ...borrador, estado: e })}
                    className={cn(
                      "min-h-11 rounded-full border px-4 text-[14px] font-medium",
                      borrador.estado === e
                        ? "border-gold-deep bg-gold-gradient text-white"
                        : "border-border-strong bg-surface text-fg-muted",
                    )}
                  >
                    {ESTADOS[e].etiqueta}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-1 flex justify-between text-[13px] font-medium text-fg-muted">
                <span>Nota del equipo</span>
                <span className="tabular-nums text-fg-subtle">
                  {borrador.nota.length}/{MAX_NOTA}
                </span>
              </span>
              <textarea
                value={borrador.nota}
                maxLength={MAX_NOTA}
                rows={3}
                onChange={(e) => cambiarBorrador({ ...borrador, nota: e.target.value })}
                placeholder="Qué se habló, qué falta, quién la lleva…"
                className="w-full rounded-[var(--radius-md)] border border-border-strong bg-surface p-3 text-fg placeholder:text-fg-subtle"
              />
              <span className="mt-1 block text-[12px] text-fg-subtle">Solo la ve el equipo, no quien la mandó.</span>
            </label>

            {aviso && (
              <Mensaje tono={aviso.tono}>
                {aviso.recarga
                  ? cargandoLista
                    ? "Leyendo lo último guardado… Lo que tecleaste se queda."
                    : editado && cambiado
                      ? "Arriba está lo último guardado. Lo que tecleaste se quedó: compáralo y vuelve a guardar."
                      : "Ya se ve lo último guardado."
                  : aviso.texto}
                {aviso.conflicto && (
                  <button
                    type="button"
                    onClick={recargar}
                    className="ml-2 min-h-11 font-semibold text-info underline"
                  >
                    Recargar
                  </button>
                )}
              </Mensaje>
            )}

            <Boton type="submit" disabled={!cambiado || guardando}>
              {guardando ? "Guardando…" : cambiado ? "Guardar" : "Sin cambios"}
            </Boton>
          </form>
        </div>
      )}
    </li>
  );
}
