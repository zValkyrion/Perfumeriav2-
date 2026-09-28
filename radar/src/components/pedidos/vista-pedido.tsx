"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Printer,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { AreaTexto, Boton, Campo, Insignia, Selector, Tarjeta } from "@/components/ui";
import { Mensaje } from "@/components/catalogo/comun";
import {
  Cabecera,
  ErrorCarga,
  InsigniaEstatus,
  PuertaAdmin,
  fechaHora,
  pesosCentavos,
  usePanelAdmin,
  whatsappCliente,
} from "@/components/tienda/comun";
import { HojaSurtido } from "@/components/pedidos/hoja-surtido";
import {
  ESTATUS,
  PAQUETERIAS,
  SIGUIENTES,
  confirmacionDe,
  enlaceCliente,
  envioTexto,
  fechaDia,
  mensajeCliente,
  metodoTexto,
  nombrePaqueteria,
} from "@/components/pedidos/comun";
import {
  ErrorGuardado,
  cambiarPedidoAdmin,
  leerPedidoAdmin,
  type CambioPedidoAdmin,
  type EstatusPedido,
  type PedidoAdmin,
} from "@/lib/tienda-admin";
import { cn, soloDigitos } from "@/lib/utils";

/**
 * Un pedido completo y todo lo que el equipo hace con él: moverlo de estatus,
 * ponerle guía, escribirle al cliente, dejar notas e imprimir la hoja para
 * surtirlo.
 *
 * Las cifras son las que se cobraron (las congeló el servidor al crear el
 * pedido): aquí no se recalcula nada. Cada guardado va atado a
 * `actualizadoEn`; si otro administrador —o el cliente al cancelar— lo cambió
 * en medio, el servidor responde 409 y se ofrece «Recargar» **sin perder lo
 * tecleado**: solo lo que se tocó se queda en el borrador; lo demás se ve ya
 * con lo nuevo.
 */

const VOLVER = "/pedidos/";
const MAX_GUIA = 60;
const MAX_NOTA = 1000;

/** Lo que se editó y todavía no se guarda. `undefined` = no se tocó (se ve lo del servidor). */
type Borrador = {
  guia?: string;
  paqueteria?: string;
  notaCliente?: string;
  notaInterna?: string;
  /** Nota que va al historial con el siguiente cambio (o sola). */
  nota?: string;
};

type CampoEditable = "guia" | "paqueteria" | "notaCliente" | "notaInterna";
const CAMPOS: CampoEditable[] = ["guia", "paqueteria", "notaCliente", "notaInterna"];

const NOMBRE_CAMPO: Record<CampoEditable | "nota", string> = {
  guia: "guía",
  paqueteria: "paquetería",
  notaCliente: "mensaje al cliente",
  notaInterna: "nota interna",
  nota: "nota del historial",
};

export function VistaPedido() {
  const params = useSearchParams();
  const folio = (params.get("folio") ?? "").trim();
  const c = usePanelAdmin((token) => leerPedidoAdmin(token, folio), folio);

  const bloqueo = PuertaAdmin({ c, titulo: "El detalle del pedido", volver: VOLVER });
  if (bloqueo) return bloqueo;

  if (!folio) {
    return (
      <Aviso titulo="No sé qué pedido abrir">
        El enlace no trae el folio. Vuelve a la lista y elige el pedido.
      </Aviso>
    );
  }
  // `datos.folio !== folio`: se cambió el folio de la dirección y todavía está
  // a la vista el pedido anterior; no se enseña uno por otro.
  if (!c.datos || c.datos.folio !== folio) {
    if (c.estadoError === 404) {
      return (
        <Aviso titulo={`No existe el pedido ${folio}`}>
          Revisa el folio. Los pedidos de antes de la tienda nueva (sin registro en el servidor) no se pueden
          gestionar desde aquí.
        </Aviso>
      );
    }
    return (
      <main className="p-4">
        <Cabecera titulo={folio} volver={{ href: VOLVER, texto: "Pedidos" }} />
        {c.error ? (
          <ErrorCarga mensaje={c.error} recargar={c.recargar} cargando={c.cargando} />
        ) : (
          <p className="text-[14px] text-fg-subtle">Abriendo el pedido…</p>
        )}
      </main>
    );
  }

  return (
    <Detalle
      // Otro folio es otro borrador.
      key={c.datos.folio}
      pedido={c.datos}
      token={c.token!}
      evaluador={c.sesion.evaluador}
      error={c.error}
      cargando={c.cargando}
      recargar={c.recargar}
      alGuardar={(nuevo) => c.setDatos(nuevo)}
    />
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="p-4">
      <Cabecera titulo="Pedido" volver={{ href: VOLVER, texto: "Pedidos" }} />
      <Tarjeta>
        <p className="text-[15px] font-medium">{titulo}</p>
        <p className="mt-1 text-[14px] text-fg-muted">{children}</p>
      </Tarjeta>
    </main>
  );
}

function Detalle({
  pedido: p,
  token,
  evaluador,
  error,
  cargando,
  recargar,
  alGuardar,
}: {
  pedido: PedidoAdmin;
  token: string;
  evaluador: string | null;
  error: string | null;
  cargando: boolean;
  recargar: () => void;
  alGuardar: (nuevo: PedidoAdmin) => void;
}) {
  const [borrador, setBorrador] = useState<Borrador>({});
  const [otroEstatus, setOtroEstatus] = useState<EstatusPedido | null>(null);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error" | "aviso"; texto: string } | null>(null);
  const [conflicto, setConflicto] = useState(false);
  const [esperandoRecarga, setEsperandoRecarga] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const cajaMensaje = useRef<HTMLDivElement>(null);

  // El aviso (guardado, 409, 422) va arriba y el botón que lo provocó puede
  // estar al fondo de la página: se trae a la vista para que no pase de largo.
  useEffect(() => {
    if (mensaje) cajaMensaje.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [mensaje]);

  // La raíz de la tienda para los mensajes (`/rastreo/`): el panel vive en el
  // mismo dominio. Este componente solo se pinta en el navegador (la puerta
  // no deja pasar al compilar, sin sesión), pero se cuida igual.
  const origen = typeof window === "undefined" ? "" : window.location.origin;

  /** Lo que se ve en un campo: lo tecleado o, si no se tocó, lo guardado. */
  const valor = (campo: CampoEditable) => borrador[campo] ?? p[campo] ?? "";
  const cambiado = (campo: CampoEditable) =>
    borrador[campo] !== undefined && borrador[campo]!.trim() !== (p[campo] ?? "");
  const pendientes = CAMPOS.filter(cambiado);
  const hayNota = Boolean(borrador.nota?.trim());
  const sucio = pendientes.length > 0 || hayNota;

  // Salir con cambios sin guardar pregunta primero: una guía tecleada a mano
  // en la bodega no se quiere volver a escribir.
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  // Terminó la recarga que se pidió tras un 409: el pedido ya es el actual y
  // el borrador sigue ahí. (Estado derivado al pintar, como en vista-editar.)
  if (esperandoRecarga && !cargando) {
    setEsperandoRecarga(false);
    setMensaje(
      error
        ? { tono: "error", texto: `No se pudo recargar: ${error}` }
        : {
            tono: "aviso",
            texto:
              `Ya está la versión actual (estatus «${p.estatus}»). ` +
              (sucio
                ? "Lo que tecleaste sigue en los campos: revísalo contra lo nuevo y vuelve a guardar."
                : "Revisa lo que cambió antes de seguir."),
          },
    );
  }

  const editar = (campo: keyof Borrador, v: string) => setBorrador((b) => ({ ...b, [campo]: v }));

  const guardar = async (estatus?: EstatusPedido) => {
    if (estatus) {
      const pregunta = confirmacionDe(p.estatus, estatus);
      if (pregunta && !confirm(pregunta)) return;
    }
    const cambio: CambioPedidoAdmin = { actualizadoEn: p.actualizadoEn };
    for (const campo of pendientes) {
      const texto = borrador[campo]!.trim();
      cambio[campo] = texto === "" ? null : texto;
    }
    if (hayNota) cambio.nota = borrador.nota!.trim();
    if (estatus) cambio.estatus = estatus;
    if (!estatus && !sucio) return;

    setGuardando(true);
    setMensaje(null);
    setConflicto(false);
    try {
      const nuevo = await cambiarPedidoAdmin(token, p.folio, cambio);
      alGuardar(nuevo);
      setBorrador({});
      setOtroEstatus(null);
      const partes = [
        ...(estatus ? [`estatus «${nuevo.estatus}»`] : []),
        ...pendientes.map((k) => NOMBRE_CAMPO[k]),
        ...(hayNota ? [NOMBRE_CAMPO.nota] : []),
      ];
      const sinGuia =
        estatus === "En camino" && !nuevo.guia && nuevo.paqueteria !== "propia"
          ? " Quedó en camino sin guía: agrégala cuando la tengas para que el cliente pueda rastrearlo."
          : "";
      setMensaje({ tono: sinGuia ? "aviso" : "ok", texto: `Guardado: ${partes.join(", ")}.${sinGuia}` });
    } catch (e) {
      if (e instanceof ErrorGuardado && e.estado === 409) {
        setConflicto(true);
        setMensaje({ tono: "error", texto: e.message });
      } else {
        setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo guardar" });
      }
    } finally {
      setGuardando(false);
    }
  };

  const pedirRecarga = () => {
    setMensaje(null);
    setConflicto(false);
    setOtroEstatus(null);
    setEsperandoRecarga(true);
    recargar();
  };

  const ocupado = guardando || esperandoRecarga;
  const whatsapp = whatsappCliente(p.contacto.telefono, mensajeCliente(p, origen));
  const diez = soloDigitos(p.contacto.telefono).slice(-10);
  const telefono = diez.length === 10 ? `tel:+52${diez}` : null;
  const ultimo = p.historial.at(-1);
  const pasos = SIGUIENTES[p.estatus];
  const guiaPendiente = !p.guia && !valor("guia").trim();

  return (
    <>
      <main className="p-4 pb-28 print:hidden">
        <Cabecera
          titulo={p.folio}
          volver={{ href: VOLVER, texto: "Pedidos" }}
          subtitulo={
            <>
              {fechaHora(p.creadoEn)} · {pesosCentavos(p.cifras.total)} · {p.cifras.piezas}{" "}
              {p.cifras.piezas === 1 ? "pieza" : "piezas"}
            </>
          }
          acciones={
            <>
              <Boton
                variante="secundario"
                onClick={recargar}
                disabled={cargando}
                className="px-3"
                aria-label="Volver a leer el pedido"
              >
                <RefreshCw size={18} className={cn(cargando && "animate-spin")} />
              </Boton>
              <Boton
                variante="secundario"
                onClick={() => window.print()}
                className="px-3"
                aria-label="Imprimir hoja de surtido"
                title="Imprimir hoja de surtido"
              >
                <Printer size={18} />
              </Boton>
            </>
          }
        />

        {error && !esperandoRecarga && (
          <div className="mb-3">
            <ErrorCarga mensaje={error} recargar={recargar} cargando={cargando} />
          </div>
        )}

        {mensaje && (
          <div ref={cajaMensaje} className="mb-3 scroll-mt-4">
            <Mensaje tono={mensaje.tono}>
              {mensaje.texto}
              {conflicto && (
                <button
                  type="button"
                  onClick={pedirRecarga}
                  className="ml-2 min-h-11 font-semibold text-info underline"
                >
                  Recargar
                </button>
              )}
            </Mensaje>
          </div>
        )}

        {p.heredado && (
          <div className="mb-3">
            <Mensaje tono="aviso">
              Pedido de la tienda anterior: no guardó dirección ni desglose, así que se ve solo lo que hay.
            </Mensaje>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {/* ── Estatus ── */}
          <Tarjeta titulo="Estatus">
            <div className="flex flex-wrap items-center gap-2">
              <InsigniaEstatus estatus={p.estatus} />
              {ultimo && (
                <span className="text-[13px] text-fg-subtle">
                  desde {fechaHora(ultimo.en)}
                  {ultimo.por && ` · ${porQuien(ultimo.por)}`}
                </span>
              )}
            </div>

            {pasos.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                {pasos.map((s) => (
                  <Boton
                    key={s.estatus}
                    variante={s.peligro ? "peligro" : "primario"}
                    onClick={() => guardar(s.estatus)}
                    disabled={ocupado}
                    className="w-full"
                  >
                    {!s.peligro && <Check size={18} />}
                    {s.texto}
                    <span className="text-[13px] font-medium opacity-80">→ {s.estatus}</span>
                  </Boton>
                ))}
                {pasos.some((s) => s.estatus === "En camino") && guiaPendiente && (
                  <p className="text-[13px] text-fg-subtle">
                    Aún no tiene guía. Escríbela en «Envío y rastreo» antes de marcarlo: se guarda junto.
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2">
              <AreaTexto
                etiqueta="Nota para el historial (opcional)"
                value={borrador.nota ?? ""}
                maxLength={MAX_NOTA}
                onChange={(e) => editar("nota", e.target.value)}
                placeholder="Ej.: pagó por transferencia a las 10:40"
              />
              <p className="-mt-1 text-[12px] text-fg-subtle">
                Va con el siguiente cambio de estatus (o sola, con «Guardar»). El cliente no la ve.
              </p>
              <div className="flex items-end gap-2">
                <Selector
                  etiqueta="Otro estatus"
                  className="min-w-0 flex-1"
                  valor={otroEstatus}
                  vacio="Elegir…"
                  opciones={ESTATUS.filter((e) => e !== p.estatus).map((e) => ({ valor: e, etiqueta: e }))}
                  onChange={(v) => setOtroEstatus((v as EstatusPedido | null) ?? null)}
                />
                <Boton
                  variante="secundario"
                  onClick={() => otroEstatus && guardar(otroEstatus)}
                  disabled={!otroEstatus || ocupado}
                  className="shrink-0"
                >
                  Cambiar
                </Boton>
              </div>
            </div>
          </Tarjeta>

          {/* ── Envío y rastreo ── */}
          <Tarjeta titulo="Envío y rastreo" pista={`Envío ${envioTexto(p.envio)}`}>
            <div className="grid grid-cols-1 gap-3">
              <Selector
                etiqueta="Paquetería"
                valor={valor("paqueteria") || null}
                vacio="Sin paquetería"
                opciones={opcionesPaqueteria(p.paqueteria)}
                onChange={(v) => editar("paqueteria", v ?? "")}
              />
              <Campo
                etiqueta="Número de guía"
                value={valor("guia")}
                maxLength={MAX_GUIA}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => editar("guia", e.target.value)}
                placeholder="Tal como viene en la etiqueta"
              />
              {p.urlRastreo && !cambiado("guia") && !cambiado("paqueteria") && (
                <a
                  href={p.urlRastreo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-info underline"
                >
                  <ExternalLink size={16} />
                  Rastrear en {nombrePaqueteria(p.paqueteria)}
                </a>
              )}
              {p.guia && !p.urlRastreo && !cambiado("guia") && p.paqueteria && (
                <p className="text-[13px] text-fg-subtle">
                  {nombrePaqueteria(p.paqueteria)} no tiene página pública de rastreo.
                </p>
              )}
            </div>
          </Tarjeta>

          {/* ── Cliente ── */}
          <TarjetaCliente pedido={p} whatsapp={whatsapp} telefono={telefono} />

          {/* ── Artículos y cuenta ── */}
          <TarjetaArticulos pedido={p} />

          {/* ── Notas ── */}
          <Tarjeta titulo="Notas">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <AreaTexto
                  etiqueta="Mensaje para el cliente"
                  value={valor("notaCliente")}
                  maxLength={MAX_NOTA}
                  onChange={(e) => editar("notaCliente", e.target.value)}
                  placeholder="Lo ve el cliente en su pedido (p. ej. «Sale mañana temprano»)"
                />
                <p className="mt-1 text-[12px] text-fg-subtle">Lo ve el cliente en «Mis pedidos» y en el rastreo.</p>
              </div>
              <div>
                <AreaTexto
                  etiqueta="Nota interna"
                  value={valor("notaInterna")}
                  maxLength={MAX_NOTA}
                  onChange={(e) => editar("notaInterna", e.target.value)}
                  placeholder="Solo la ve el equipo"
                />
                <p className="mt-1 text-[12px] text-fg-subtle">Solo la ve el equipo. Sale en la hoja de surtido.</p>
              </div>
            </div>
          </Tarjeta>

          {/* ── Historial ── */}
          <Tarjeta titulo="Historial" pista="Quién movió el pedido y cuándo">
            <ol className="grid grid-cols-1 gap-3">
              {[...p.historial].reverse().map((h, i) => (
                <li key={`${h.en}-${i}`} className="border-l-2 border-border-strong pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <InsigniaEstatus estatus={h.estatus} />
                    <span className="text-[13px] text-fg-subtle">{fechaHora(h.en)}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-fg-muted">{porQuien(h.por)}</p>
                  {h.nota && <p className="mt-0.5 whitespace-pre-line text-[14px]">{h.nota}</p>}
                </li>
              ))}
            </ol>
          </Tarjeta>
        </div>

        {/* ── Barra fija: guardar lo tecleado o escribirle al cliente ── */}
        <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-2xl gap-2 border-t border-border-strong bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {sucio ? (
            <>
              <Boton
                variante="secundario"
                onClick={() => {
                  setBorrador({});
                  setMensaje(null);
                }}
                disabled={ocupado}
                className="flex-1"
              >
                Descartar
              </Boton>
              <Boton onClick={() => guardar()} disabled={ocupado} className="flex-[2]">
                <Check size={18} />
                {guardando ? "Guardando…" : "Guardar"}
              </Boton>
            </>
          ) : (
            <>
              {telefono && (
                <a href={telefono} className="flex-1" aria-label={`Llamar a ${p.contacto.nombre || "el cliente"}`}>
                  <Boton variante="secundario" className="w-full" tabIndex={-1}>
                    <Phone size={18} />
                    Llamar
                  </Boton>
                </a>
              )}
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex-[2]">
                  <Boton className="w-full" tabIndex={-1}>
                    <MessageCircle size={18} />
                    WhatsApp · {p.estatus}
                  </Boton>
                </a>
              ) : (
                <Boton className="flex-[2]" disabled>
                  <MessageCircle size={18} />
                  Sin teléfono válido
                </Boton>
              )}
            </>
          )}
        </div>
      </main>

      <HojaSurtido pedido={p} evaluador={evaluador} />
    </>
  );
}

/** Quién hizo el cambio, en palabras: el servidor guarda «cliente», «tienda» o el nombre del admin. */
function porQuien(por: string): string {
  if (por === "cliente") return "Lo hizo el cliente";
  if (por === "tienda") return "La tienda";
  return `Por ${por}`;
}

/** La lista del selector; una paquetería vieja que no esté en ella se conserva para no borrarla sin querer. */
function opcionesPaqueteria(actual: string | null) {
  const opciones = PAQUETERIAS.map((q) => ({ valor: q.id, etiqueta: q.nombre }));
  if (actual && !opciones.some((o) => o.valor === actual)) {
    opciones.push({ valor: actual, etiqueta: `${actual} (anterior)` });
  }
  return opciones;
}

function TarjetaCliente({
  pedido: p,
  whatsapp,
  telefono,
}: {
  pedido: PedidoAdmin;
  whatsapp: string | null;
  telefono: string | null;
}) {
  const [copiado, setCopiado] = useState(false);
  const c = p.contacto;
  const lineas = [
    c.calle,
    c.colonia && `Col. ${c.colonia}`,
    [c.cp && `C.P. ${c.cp}`, c.ciudad, c.estado].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];
  const ficha = enlaceCliente(p);

  const copiar = async () => {
    const texto = [c.nombre, c.telefono, ...lineas, c.referencias && `Referencias: ${c.referencias}`]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles (http, navegador viejo): la dirección
      // sigue a la vista para copiarla a mano.
    }
  };

  return (
    <Tarjeta titulo="Cliente">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold">{c.nombre || "Sin nombre"}</p>
          <p className="text-[14px] tabular-nums text-fg-muted">{c.telefono || "Sin teléfono"}</p>
          {c.correo && <p className="truncate text-[14px] text-fg-muted">{c.correo}</p>}
        </div>
        {p.cliente.sub ? (
          <Insignia color="var(--color-success)">con cuenta</Insignia>
        ) : (
          <Insignia>sin cuenta</Insignia>
        )}
      </div>
      {p.cliente.correoCuenta && p.cliente.correoCuenta !== c.correo && (
        <p className="mt-1 text-[12px] text-fg-subtle">Cuenta: {p.cliente.correoCuenta}</p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <BotonEnlace href={telefono} icono={<Phone size={18} />} texto="Llamar" />
        <BotonEnlace href={whatsapp} icono={<MessageCircle size={18} />} texto="WhatsApp" externo />
        <BotonEnlace href={c.correo ? `mailto:${c.correo}` : null} icono={<Mail size={18} />} texto="Correo" />
      </div>

      <div className="mt-4">
        <p className="text-[13px] font-medium text-fg-muted">Dirección de entrega</p>
        {lineas.length > 0 ? (
          <address className="mt-1 text-[15px] not-italic leading-snug">
            {lineas.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
            {c.referencias && <span className="mt-1 block text-[14px] text-fg-muted">Referencias: {c.referencias}</span>}
          </address>
        ) : (
          <p className="mt-1 text-[14px] text-fg-subtle">Sin dirección registrada.</p>
        )}
        {lineas.length > 0 && (
          <Boton variante="secundario" onClick={copiar} className="mt-2 w-full">
            {copiado ? <Check size={18} /> : <Copy size={18} />}
            {copiado ? "Copiada" : "Copiar nombre y dirección"}
          </Boton>
        )}
      </div>

      {ficha && (
        <Link
          href={ficha}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-info underline"
        >
          <UserRound size={16} />
          Ver ficha e historial del cliente
        </Link>
      )}
    </Tarjeta>
  );
}

function BotonEnlace({
  href,
  icono,
  texto,
  externo = false,
}: {
  href: string | null;
  icono: React.ReactNode;
  texto: string;
  externo?: boolean;
}) {
  const clases =
    "inline-flex min-h-12 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-2 text-[14px] font-semibold";
  if (!href) {
    return (
      <span aria-disabled className={cn(clases, "border-border-soft bg-surface-2 text-fg-subtle")}>
        {icono}
        {texto}
      </span>
    );
  }
  return (
    <a
      href={href}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(clases, "lift border-border-strong bg-surface text-fg")}
    >
      {icono}
      {texto}
    </a>
  );
}

function TarjetaArticulos({ pedido: p }: { pedido: PedidoAdmin }) {
  const k = p.cifras;
  const filas: { etiqueta: string; valor: string; fuerte?: boolean }[] = [];
  const menos = (n: number) => `−${pesosCentavos(n)}`;
  if (k.subtotalMenudeo > 0 && k.subtotalMenudeo !== k.subtotal) {
    filas.push({ etiqueta: "Precio de lista", valor: pesosCentavos(k.subtotalMenudeo) });
  }
  if (k.ahorroVolumen > 0) {
    // En Menudeo no hay descuento por volumen: ese ahorro solo puede venir del
    // precio de un lote o un set frente a sus piezas a precio de lista.
    const etiqueta =
      k.escalon === "Menudeo"
        ? "Ahorro en paquetes"
        : `Descuento por volumen${k.escalon ? ` (${k.escalon})` : ""}`;
    filas.push({ etiqueta, valor: menos(k.ahorroVolumen) });
  }
  filas.push({ etiqueta: "Subtotal", valor: pesosCentavos(k.subtotal) });
  if (k.descuento3x2 > 0) filas.push({ etiqueta: "Promoción 3x2", valor: menos(k.descuento3x2) });
  if (k.descuentoCupon > 0) filas.push({ etiqueta: `Cupón${k.cupon ? ` ${k.cupon}` : ""}`, valor: menos(k.descuentoCupon) });
  if (k.descuentoTransferencia > 0) {
    filas.push({ etiqueta: "Descuento por transferencia", valor: menos(k.descuentoTransferencia) });
  }
  filas.push({ etiqueta: "Envío", valor: k.envioGratis ? "Gratis" : pesosCentavos(k.costoEnvio) });
  if (k.comision > 0) filas.push({ etiqueta: "Comisión de pago", valor: pesosCentavos(k.comision) });

  return (
    <Tarjeta titulo="Artículos" pista={`${p.lineas.length} ${p.lineas.length === 1 ? "línea" : "líneas"} · ${k.piezas} piezas`}>
      {p.lineas.length === 0 ? (
        <p className="text-[14px] text-fg-subtle">El pedido no trae artículos registrados.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {p.lineas.map((l, i) => (
            <li
              key={`${l.productoId}-${l.ml}-${i}`}
              className="flex items-start justify-between gap-3 border-b border-border-soft pb-2 last:border-b-0 last:pb-0"
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-snug">{l.nombre}</span>
                <span className="block text-[13px] text-fg-subtle">
                  {l.detalle} · {l.productoId}
                </span>
                <span className="block text-[13px] tabular-nums text-fg-muted">
                  {l.cantidad} × {pesosCentavos(l.unitario)}
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">{pesosCentavos(l.subtotal)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 grid gap-1 border-t border-border-strong pt-3 text-[14px]">
        {filas.map((f) => (
          <div key={f.etiqueta} className="flex justify-between gap-3">
            <dt className="text-fg-muted">{f.etiqueta}</dt>
            <dd className="tabular-nums">{f.valor}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 text-[17px] font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{pesosCentavos(k.total)}</dd>
        </div>
      </dl>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-[14px]">
        <div className="rounded-[var(--radius-md)] border border-border-soft p-2">
          <dt className="text-[12px] font-medium text-fg-subtle">Pago</dt>
          <dd className="font-semibold">{metodoTexto(p.metodo, p.plazo)}</dd>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border-soft p-2">
          <dt className="text-[12px] font-medium text-fg-subtle">Envío</dt>
          <dd className="font-semibold">{envioTexto(p.envio)}</dd>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border-soft p-2">
          <dt className="text-[12px] font-medium text-fg-subtle">Escalón</dt>
          <dd className="font-semibold">{k.escalon || "Sin dato"}</dd>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border-soft p-2">
          <dt className="text-[12px] font-medium text-fg-subtle">Fecha</dt>
          <dd className="font-semibold">{fechaDia(p.fecha)}</dd>
        </div>
      </dl>
    </Tarjeta>
  );
}
