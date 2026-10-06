"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Crown,
  Download,
  Mail,
  RefreshCw,
  Search,
  ShoppingBag,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { Boton, Campo, Chips, Insignia, Tarjeta } from "@/components/ui";
import { Interruptor, Mensaje } from "@/components/catalogo/comun";
import { Cabecera, ErrorCarga, PuertaAdmin, fechaHora, usePanelAdmin } from "@/components/tienda/comun";
import { Desactualizado } from "@/components/ventas/desactualizado";
import { descargarCsv } from "@/components/ventas/csv";
import { hoyMexico } from "@/components/ventas/fechas";
import {
  coincide,
  enlaceCliente,
  estadoCuentaLegible,
  normalizar,
  subDeToken,
  telefonoLegible,
} from "@/components/clientes/formato";
import {
  cambiarAcceso,
  cambiarGrupo,
  invitarAlEquipo,
  leerEquipo,
  resolverSolicitudEquipo,
  type CuentaEquipo,
  type GrupoEquipo,
  type SolicitudEquipo,
} from "@/lib/tienda-admin";
import { cn } from "@/lib/utils";

/**
 * «Equipo y cuentas»: el tablero del superadmin.
 *
 * Aquí se ve el registro completo —cada cuenta de la tienda y cada persona del
 * equipo— y se decide quién entra: se aceptan o rechazan las solicitudes, se
 * invita por correo, se dan o quitan los grupos y se corta el acceso. La
 * Lambda (`/superadmin/*`) vuelve a comprobar cada cosa; esta pantalla solo
 * pinta lo que el servidor va a dejar hacer.
 *
 * Los cambios de grupo se notan cuando la persona vuelve a entrar: su sesión
 * lleva los grupos con que entró (a más tardar, una hora).
 */

type Pestana = "equipo" | "clientes" | "sin-acceso";

const ROLES: { grupo: GrupoEquipo; titulo: string; texto: string }[] = [
  {
    grupo: "proveedores",
    titulo: "Equipo de proveedores",
    texto: "Captura y consulta proveedores en el radar. No ve ventas ni clientes.",
  },
  {
    grupo: "admins",
    titulo: "Administrador",
    texto: "Ve pedidos, ventas y clientes, cambia estatus y edita el catálogo. No reparte permisos.",
  },
];

const tituloRol = (g: GrupoEquipo) => ROLES.find((r) => r.grupo === g)!.titulo;

const esDelEquipo = (c: CuentaEquipo) =>
  c.superadmin || c.grupos.includes("admins") || c.grupos.includes("proveedores");

const nombreCuenta = (c: Pick<CuentaEquipo, "nombre" | "correo">) => c.nombre.trim() || c.correo || "Sin nombre";

const PESTANAS: { valor: Pestana; etiqueta: string; cumple: (c: CuentaEquipo) => boolean }[] = [
  { valor: "equipo", etiqueta: "Equipo", cumple: (c) => c.habilitada && esDelEquipo(c) },
  { valor: "clientes", etiqueta: "Clientes", cumple: (c) => c.habilitada && !esDelEquipo(c) },
  { valor: "sin-acceso", etiqueta: "Sin acceso", cumple: (c) => !c.habilitada },
];

/** Primero el superadmin y los admins, luego por nombre. */
function ordenar(a: CuentaEquipo, b: CuentaEquipo): number {
  const peso = (c: CuentaEquipo) => (c.superadmin ? 0 : c.grupos.includes("admins") ? 1 : c.grupos.includes("proveedores") ? 2 : 3);
  return peso(a) - peso(b) || nombreCuenta(a).localeCompare(nombreCuenta(b), "es");
}

export function VistaEquipo() {
  const c = usePanelAdmin(leerEquipo, "", "superadmin");
  const [pestana, setPestana] = useState<Pestana>("equipo");
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);

  const cuentas = c.datos?.cuentas;
  const q = normalizar(busqueda.trim());
  const lista = useMemo(() => {
    if (!cuentas) return [];
    const cumple = PESTANAS.find((p) => p.valor === pestana)!.cumple;
    // La fila abierta se queda aunque el cambio la saque de la pestaña (darle
    // un grupo a un cliente, cortar el acceso): si desapareciera al instante,
    // se perdería el «Listo» y parecería que no pasó nada.
    return cuentas
      .filter((x) => (cumple(x) || x.sub === abierta) && coincide(q, x.nombre, x.correo, x.telefono))
      .sort(ordenar);
  }, [cuentas, pestana, q, abierta]);

  const bloqueo = PuertaAdmin({ c, titulo: "Equipo y cuentas", volver: "/tienda/", nivel: "superadmin" });
  if (bloqueo) return bloqueo;

  const yo = subDeToken(c.token);
  const pendientes = (c.datos?.solicitudes ?? []).filter((s) => s.estado === "pendiente");

  /** Reemplaza una cuenta en lo leído, sin volver a bajar la lista. */
  const actualizarCuenta = (sub: string, cambio: Partial<CuentaEquipo>) =>
    c.setDatos((d) => d && { ...d, cuentas: d.cuentas.map((x) => (x.sub === sub ? { ...x, ...cambio } : x)) });

  const actualizarSolicitud = (s: SolicitudEquipo) =>
    c.setDatos((d) => d && { ...d, solicitudes: d.solicitudes.map((x) => (x.sub === s.sub ? s : x)) });

  const conteo = (p: (typeof PESTANAS)[number]) => cuentas?.filter(p.cumple).length ?? 0;

  return (
    <main className="p-4 pb-12 sm:p-6">
      <Cabecera
        titulo="Equipo y cuentas"
        subtitulo={
          cuentas
            ? `${cuentas.length} cuentas · ${cuentas.filter(esDelEquipo).length} del equipo` +
              (pendientes.length ? ` · ${pendientes.length} por aceptar` : "")
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
              aria-label="Volver a leer las cuentas"
            >
              <RefreshCw size={18} className={cn(c.cargando && "animate-spin")} />
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => cuentas && exportar(cuentas)}
              disabled={!cuentas || cuentas.length === 0}
              className="px-3"
              aria-label="Exportar todas las cuentas a CSV"
              title="Exportar todas las cuentas a CSV para Excel"
            >
              <Download size={18} />
            </Boton>
          </>
        }
      />

      {c.error && (
        <div className="mb-3">
          {c.datos ? (
            <Desactualizado error={c.error} recargar={c.recargar} cargando={c.cargando} />
          ) : (
            <ErrorCarga mensaje={c.error} recargar={c.recargar} cargando={c.cargando} />
          )}
        </div>
      )}

      {c.datos && (
        <div className="grid gap-4">
          <Solicitudes
            pendientes={pendientes}
            resueltas={c.datos.solicitudes.filter((s) => s.estado !== "pendiente")}
            token={c.token!}
            alResolver={(s, grupos) => {
              if (s) actualizarSolicitud(s);
              if (s && grupos) actualizarCuenta(s.sub, { grupos });
            }}
          />

          <Invitar
            token={c.token!}
            alInvitar={(cuenta) => {
              c.setDatos((d) => d && { ...d, cuentas: [...d.cuentas, cuenta] });
              setPestana("equipo");
            }}
          />

          <section aria-label="Cuentas">
            <div className="mb-2 grid grid-cols-3 gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1" role="tablist">
              {PESTANAS.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p.valor}
                  onClick={() => {
                    setPestana(p.valor);
                    setAbierta(null);
                  }}
                  className={cn(
                    "min-h-11 rounded-[var(--radius-sm)] text-[14px] font-semibold",
                    pestana === p.valor ? "bg-surface text-fg shadow-sm" : "text-fg-subtle",
                  )}
                >
                  {p.etiqueta} <span className="tabular-nums opacity-70">{conteo(p)}</span>
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
                placeholder="Buscar por nombre, correo o teléfono"
                aria-label="Buscar cuentas"
                className="h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-10 pr-3 placeholder:text-fg-subtle"
              />
            </div>

            {lista.length === 0 ? (
              <p className="py-8 text-center text-[14px] text-fg-subtle">
                {q
                  ? "Nadie coincide con la búsqueda."
                  : pestana === "equipo"
                    ? "Todavía no hay nadie más en el equipo. Acepta una solicitud o invita por correo."
                    : pestana === "clientes"
                      ? "Todavía no hay clientes registrados."
                      : "No hay cuentas con el acceso cortado."}
              </p>
            ) : (
              <ul className="grid items-start gap-2 xl:grid-cols-2">
                {lista.map((x) => (
                  <FilaCuenta
                    key={x.sub}
                    cuenta={x}
                    esYo={x.sub === yo}
                    abierta={abierta === x.sub}
                    alAbrir={() => setAbierta((a) => (a === x.sub ? null : x.sub))}
                    token={c.token!}
                    alCambiar={(cambio) => actualizarCuenta(x.sub, cambio)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {!c.datos && !c.error && <p className="text-[14px] text-fg-subtle">Leyendo las cuentas…</p>}
    </main>
  );
}

/* ── Solicitudes ──────────────────────────────────────────────────────────── */

function Solicitudes({
  pendientes,
  resueltas,
  token,
  alResolver,
}: {
  pendientes: SolicitudEquipo[];
  resueltas: SolicitudEquipo[];
  token: string;
  alResolver: (s: SolicitudEquipo | null, grupos?: string[]) => void;
}) {
  const [verResueltas, setVerResueltas] = useState(false);
  return (
    <Tarjeta
      titulo={pendientes.length ? `Por aceptar (${pendientes.length})` : "Solicitudes para entrar"}
      pista="Quien se registra en la tienda y abre el panel puede pedir entrar al equipo. Aquí decides."
    >
      {pendientes.length === 0 ? (
        <p className="text-[14px] text-fg-subtle">No hay nadie esperando.</p>
      ) : (
        <ul className="grid gap-3">
          {pendientes.map((s) => (
            <SolicitudPendiente key={s.sub} solicitud={s} token={token} alResolver={alResolver} />
          ))}
        </ul>
      )}

      {resueltas.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setVerResueltas((v) => !v)}
            aria-expanded={verResueltas}
            className="inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-info"
          >
            <ChevronDown size={15} className={cn("transition-transform", verResueltas && "rotate-180")} />
            {verResueltas ? "Ocultar" : "Ver"}{" "}
            {resueltas.length === 1 ? "la ya resuelta" : `las ${resueltas.length} ya resueltas`}
          </button>
          {verResueltas && (
            <ul className="mt-1 grid gap-1.5">
              {resueltas.map((s) => (
                <li key={s.sub} className="flex items-baseline justify-between gap-2 border-b border-border-soft py-1.5 text-[13px] last:border-b-0">
                  <span className="min-w-0 truncate">
                    <strong className="font-semibold">{nombreCuenta(s)}</strong>{" "}
                    <span className="text-fg-subtle">{s.correo}</span>
                  </span>
                  <span className="shrink-0 text-fg-subtle">
                    {s.estado === "aceptada" ? `aceptada${s.grupo ? ` · ${tituloRol(s.grupo).toLowerCase()}` : ""}` : "rechazada"}
                    {s.resueltaPor && ` por ${s.resueltaPor}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

function SolicitudPendiente({
  solicitud: s,
  token,
  alResolver,
}: {
  solicitud: SolicitudEquipo;
  token: string;
  alResolver: (s: SolicitudEquipo | null, grupos?: string[]) => void;
}) {
  const [pregunta, setPregunta] = useState<"admins" | "rechazar" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolver = async (decision: { decision: "aceptar"; grupo: GrupoEquipo } | { decision: "rechazar" }) => {
    setGuardando(true);
    setError(null);
    try {
      const r = await resolverSolicitudEquipo(token, s.sub, decision);
      alResolver(r.solicitud ?? { ...s, estado: decision.decision === "aceptar" ? "aceptada" : "rechazada" }, r.grupos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setGuardando(false);
    }
  };

  return (
    <li className="rounded-[var(--radius-md)] border border-gold/40 bg-surface p-3">
      <p className="text-[15px] font-semibold">{nombreCuenta(s)}</p>
      <p className="text-[13px] text-fg-subtle [overflow-wrap:anywhere]">
        {s.correo} · pidió el {fechaHora(s.creadaEn)}
      </p>
      {s.mensaje && <p className="mt-2 rounded-[var(--radius-sm)] bg-surface-2 px-2.5 py-2 text-[14px] text-fg">“{s.mensaje}”</p>}

      {pregunta ? (
        <div role="alertdialog" aria-label="Confirmar" className="mt-3 rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 p-3">
          <p className="text-[14px]">
            {pregunta === "admins"
              ? `¿Aceptar a ${nombreCuenta(s)} como administrador? Verá todos los pedidos, clientes y ventas y podrá cambiar el catálogo.`
              : `¿Rechazar a ${nombreCuenta(s)}? Seguirá siendo cliente de la tienda y podrá volver a pedirlo.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setPregunta(null)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton
              variante={pregunta === "rechazar" ? "peligro" : "primario"}
              disabled={guardando}
              onClick={() => resolver(pregunta === "admins" ? { decision: "aceptar", grupo: "admins" } : { decision: "rechazar" })}
            >
              {guardando ? "Guardando…" : pregunta === "rechazar" ? "Sí, rechazar" : "Sí, aceptar"}
            </Boton>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          <Boton onClick={() => resolver({ decision: "aceptar", grupo: "proveedores" })} disabled={guardando}>
            <UserCheck size={18} />
            {guardando ? "Guardando…" : "Aceptar en el equipo"}
          </Boton>
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setPregunta("admins")} disabled={guardando}>
              Como admin
            </Boton>
            <Boton variante="peligro" onClick={() => setPregunta("rechazar")} disabled={guardando}>
              Rechazar
            </Boton>
          </div>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <Mensaje tono="error">{error}</Mensaje>
        </div>
      )}
    </li>
  );
}

/* ── Invitar ──────────────────────────────────────────────────────────────── */

function Invitar({ token, alInvitar }: { token: string; alInvitar: (c: CuentaEquipo) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [grupo, setGrupo] = useState<GrupoEquipo>("proveedores");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setMensaje(null);
    try {
      const { cuenta } = await invitarAlEquipo(token, { correo: correo.trim(), nombre: nombre.trim(), grupo });
      alInvitar(cuenta);
      setMensaje({
        tono: "ok",
        texto: `Listo: a ${cuenta.correo} le llegará un correo con su contraseña temporal (vale 14 días). Al entrar a /radar le pedirá elegir la suya.`,
      });
      setCorreo("");
      setNombre("");
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo invitar" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Tarjeta>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="flex min-h-11 w-full items-center gap-2 text-left text-[15px] font-semibold"
      >
        <UserPlus size={18} className="text-gold" />
        <span className="flex-1">Invitar por correo</span>
        <ChevronDown size={18} className={cn("text-fg-subtle transition-transform", abierto && "rotate-180")} />
      </button>
      {!abierto && (
        <p className="text-[13px] text-fg-subtle">
          Para quien todavía no tiene cuenta: se la creas y le llega la contraseña por correo.
        </p>
      )}
      {abierto && (
        <form onSubmit={enviar} className="mt-3 grid gap-3">
          <Campo
            etiqueta="Correo"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="persona@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
          <Campo
            etiqueta="Nombre completo"
            pista="Es lo que firma cada ficha que capture."
            autoComplete="off"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Chips
            etiqueta="Entra como"
            opciones={ROLES.map((r) => ({ valor: r.grupo, etiqueta: r.titulo }))}
            valor={grupo}
            onChange={setGrupo}
          />
          <p className="text-[12px] text-fg-subtle">{ROLES.find((r) => r.grupo === grupo)!.texto}</p>
          <Boton type="submit" disabled={enviando || !correo.trim() || nombre.trim().length < 2}>
            <Mail size={18} />
            {enviando ? "Invitando…" : "Mandar invitación"}
          </Boton>
          <p className="text-[12px] text-fg-subtle">
            Los correos salen de Cognito, con un tope de unos 50 al día entre invitaciones y registros.
          </p>
        </form>
      )}
      {mensaje && (
        <div className="mt-3">
          <Mensaje tono={mensaje.tono}>{mensaje.texto}</Mensaje>
        </div>
      )}
    </Tarjeta>
  );
}

/* ── Cuentas ──────────────────────────────────────────────────────────────── */

function FilaCuenta({
  cuenta: x,
  esYo,
  abierta,
  alAbrir,
  token,
  alCambiar,
}: {
  cuenta: CuentaEquipo;
  esYo: boolean;
  abierta: boolean;
  alAbrir: () => void;
  token: string;
  alCambiar: (cambio: Partial<CuentaEquipo>) => void;
}) {
  const estado = estadoCuentaLegible(x.estado);
  return (
    <li className={cn("rounded-[var(--radius)] border bg-surface", abierta ? "border-gold/50" : "border-border-soft")}>
      <button
        type="button"
        onClick={alAbrir}
        aria-expanded={abierta}
        className="flex min-h-16 w-full items-center gap-3 p-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{nombreCuenta(x)}</span>
            {x.superadmin && (
              <Insignia color="var(--color-gold)">
                <Crown size={12} /> superadmin
              </Insignia>
            )}
            {x.grupos.includes("admins") && <Insignia color="var(--color-info)">admin</Insignia>}
            {x.grupos.includes("proveedores") && <Insignia color="var(--color-success)">equipo</Insignia>}
            {!x.habilitada && <Insignia color="var(--color-danger)">sin acceso</Insignia>}
            {esYo && <Insignia>tú</Insignia>}
          </span>
          <span className="block truncate text-[13px] text-fg-subtle">
            {[x.correo, telefonoLegible(x.telefono)].filter(Boolean).join(" · ") || "Sin contacto"}
          </span>
          <span className="block truncate text-[12px] text-fg-subtle">
            {x.registradoEn ? `Desde ${fechaHora(x.registradoEn)}` : "Sin fecha de alta"}
            {estado && x.estado !== "CONFIRMED" && ` · ${estado}`}
          </span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-fg-subtle transition-transform", abierta && "rotate-180")} aria-hidden />
      </button>
      {abierta && <Gestion cuenta={x} esYo={esYo} token={token} alCambiar={alCambiar} />}
    </li>
  );
}

type Pendiente =
  | { tipo: "grupo"; grupo: GrupoEquipo; accion: "agregar" | "quitar" }
  | { tipo: "acceso"; habilitada: boolean };

function preguntaDe(nombre: string, p: Pendiente): string {
  if (p.tipo === "acceso") {
    return p.habilitada
      ? `¿Devolverle el acceso a ${nombre}? Podrá volver a entrar con su contraseña de siempre.`
      : `¿Cortarle el acceso a ${nombre}? No podrá entrar ni al panel ni a su cuenta de la tienda, y se cierran sus sesiones abiertas. Lo que ya tenga en la mano vale hasta una hora más. Sus fichas y pedidos no se borran.`;
  }
  const rol = tituloRol(p.grupo).toLowerCase();
  return p.accion === "agregar"
    ? `¿Hacer a ${nombre} ${p.grupo === "admins" ? "administrador" : `parte del ${rol}`}? ${ROLES.find((r) => r.grupo === p.grupo)!.texto}`
    : `¿Quitarle a ${nombre} el permiso de ${rol}?`;
}

function Gestion({
  cuenta: x,
  esYo,
  token,
  alCambiar,
}: {
  cuenta: CuentaEquipo;
  esYo: boolean;
  token: string;
  alCambiar: (cambio: Partial<CuentaEquipo>) => void;
}) {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const nombre = nombreCuenta(x);

  const confirmar = async () => {
    if (!pendiente) return;
    setGuardando(true);
    setMensaje(null);
    try {
      if (pendiente.tipo === "grupo") {
        const { grupos } = await cambiarGrupo(token, x.sub, pendiente.grupo, pendiente.accion);
        alCambiar({ grupos });
        setMensaje({
          tono: "ok",
          texto: `Listo. ${nombre} lo notará cuando vuelva a entrar; si tiene la sesión abierta, puede tardar hasta una hora.`,
        });
      } else {
        const { habilitada } = await cambiarAcceso(token, x.sub, pendiente.habilitada);
        alCambiar({ habilitada });
        setMensaje({ tono: "ok", texto: habilitada ? `${nombre} ya puede volver a entrar.` : `Listo: ${nombre} ya no puede entrar.` });
      }
      setPendiente(null);
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      setGuardando(false);
    }
  };

  const verCompras = (
    <Link
      href={enlaceCliente(x.sub)}
      className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-info underline"
    >
      <ShoppingBag size={16} />
      Ver sus compras y datos
    </Link>
  );

  if (x.superadmin || esYo) {
    return (
      <div className="border-t border-border-soft p-3">
        <p className="text-[13px] text-fg-muted">
          {x.superadmin
            ? "Es el superadministrador: su permiso vive en el código (compartido/equipo.ts) y no se cambia desde el panel."
            : "Es tu propia cuenta: no se cambia desde aquí."}
        </p>
        {verCompras}
      </div>
    );
  }

  return (
    <div className="border-t border-border-soft p-3">
      <div className={cn("grid gap-4", guardando && "pointer-events-none opacity-60")} aria-busy={guardando}>
        {ROLES.map((r) => {
          const tiene = x.grupos.includes(r.grupo);
          const propuesto = pendiente?.tipo === "grupo" && pendiente.grupo === r.grupo ? pendiente.accion === "agregar" : tiene;
          return (
            <Interruptor
              key={r.grupo}
              etiqueta={r.titulo}
              pista={r.texto}
              valor={propuesto}
              onChange={(v) => {
                setMensaje(null);
                setPendiente(v === tiene ? null : { tipo: "grupo", grupo: r.grupo, accion: v ? "agregar" : "quitar" });
              }}
            />
          );
        })}
        <Interruptor
          etiqueta="Puede entrar"
          pista="Apagarlo es la baja: no borra la cuenta ni lo que capturó, y se puede deshacer."
          textos={["Sí", "No"]}
          valor={pendiente?.tipo === "acceso" ? pendiente.habilitada : x.habilitada}
          onChange={(v) => {
            setMensaje(null);
            setPendiente(v === x.habilitada ? null : { tipo: "acceso", habilitada: v });
          }}
        />
      </div>

      {pendiente && (
        <div role="alertdialog" aria-label="Confirmar el cambio" className="mt-4 rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 p-3">
          <p className="text-[14px]">{preguntaDe(nombre, pendiente)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setPendiente(null)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton
              variante={(pendiente.tipo === "grupo" && pendiente.accion === "quitar") || (pendiente.tipo === "acceso" && !pendiente.habilitada) ? "peligro" : "primario"}
              onClick={confirmar}
              disabled={guardando}
            >
              {guardando ? (
                "Guardando…"
              ) : pendiente.tipo === "acceso" && !pendiente.habilitada ? (
                <>
                  <UserX size={18} /> Sí, cortar
                </>
              ) : (
                "Sí, confirmar"
              )}
            </Boton>
          </div>
        </div>
      )}

      {mensaje && (
        <div className="mt-3">
          <Mensaje tono={mensaje.tono}>{mensaje.texto}</Mensaje>
        </div>
      )}
      <div className="mt-2">{verCompras}</div>
    </div>
  );
}

/* ── Exportar ─────────────────────────────────────────────────────────────── */

function exportar(cuentas: CuentaEquipo[]) {
  descargarCsv(`cuentas-${hoyMexico()}.csv`, [
    ["Nombre", "Correo", "Teléfono", "Rol", "Grupos", "Puede entrar", "Estado de la cuenta", "Registrado en"],
    ...[...cuentas].sort(ordenar).map((x) => [
      x.nombre,
      x.correo,
      x.telefono,
      x.superadmin ? "superadmin" : x.grupos.includes("admins") ? "administrador" : x.grupos.includes("proveedores") ? "equipo" : "cliente",
      x.grupos.join(" "),
      x.habilitada ? "sí" : "no",
      estadoCuentaLegible(x.estado),
      x.registradoEn,
    ]),
  ]);
}
