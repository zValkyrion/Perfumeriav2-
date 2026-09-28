"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Mail, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { Boton, Insignia, Tarjeta } from "@/components/ui";
import { Aviso, Interruptor, Mensaje } from "@/components/catalogo/comun";
import {
  Cabecera,
  Dato,
  ErrorCarga,
  InsigniaEstatus,
  PuertaAdmin,
  fechaHora,
  pesosCentavos,
  usePanelAdmin,
  whatsappCliente,
} from "@/components/tienda/comun";
import {
  ErrorApi,
  cambiarGrupo,
  leerCliente,
  type ClienteAdmin,
  type Grupo,
  type ResumenPedido,
} from "@/lib/tienda-admin";
import { cn } from "@/lib/utils";
import { Desactualizado } from "@/components/ventas/desactualizado";
import {
  conCuenta,
  enlaceLlamar,
  enlacePedido,
  estadoCuentaLegible,
  fechaDia,
  nombreDe,
  subDeToken,
  telefonoLegible,
} from "./formato";

/**
 * Ficha de un cliente: sus datos, lo que ha comprado, sus pedidos y —si tiene
 * cuenta— sus permisos en el panel.
 *
 * Los permisos se cambian aquí pero **se hacen valer en la Lambda**: el token
 * de cada persona lleva los grupos con que entró, así que el cambio se nota
 * cuando vuelve a entrar (o cuando su sesión se renueva, a más tardar en una
 * hora). Nadie puede quitarse a sí mismo de `admins`: con un toque se quedaría
 * sin panel y sin forma de deshacerlo.
 */

const VOLVER = "/clientes/";

export function VistaCliente() {
  const params = useSearchParams();
  const clave = params.get("clave") ?? "";
  const c = usePanelAdmin(
    (t) => (clave ? leerCliente(t, clave) : Promise.reject(new ErrorApi("Falta la clave del cliente", 400))),
    clave,
  );

  const bloqueo = PuertaAdmin({ c, titulo: "La ficha del cliente", volver: VOLVER });
  if (bloqueo) return bloqueo;

  if (!clave) {
    return (
      <Aviso titulo="No sé qué cliente abrir" volver={VOLVER}>
        El enlace no dice de quién es la ficha. Vuelve a la lista de clientes y elígelo ahí.
      </Aviso>
    );
  }

  // Lo leído puede ser de otra ficha (se navegó a otra clave): solo vale si coincide.
  const d = c.datos && c.datos.cliente?.clave === clave ? c.datos : null;
  if (!d) {
    if (c.estadoError === 404) {
      return (
        <Aviso titulo="No encontramos a ese cliente" volver={VOLVER}>
          No hay una cuenta ni pedidos con esa clave. Puede que la cuenta se haya borrado; vuelve a la
          lista para ver la actual.
        </Aviso>
      );
    }
    return (
      <main className="p-4 pb-10">
        <Cabecera titulo="Cliente" volver={{ href: VOLVER, texto: "Clientes" }} />
        {c.error ? (
          <ErrorCarga mensaje={c.error} recargar={c.recargar} cargando={c.cargando} />
        ) : (
          <p className="text-[14px] text-fg-subtle">Abriendo la ficha…</p>
        )}
      </main>
    );
  }

  const cliente = d.cliente;
  const pedidos = [...d.pedidos].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));

  return (
    <main className="p-4 pb-10">
      <Cabecera
        titulo={nombreDe(cliente)}
        subtitulo={`${cliente.nivel || "Sin nivel"} · ${conCuenta(cliente) ? "con cuenta" : "compró sin cuenta"}`}
        volver={{ href: VOLVER, texto: "Clientes" }}
        acciones={
          <Boton
            variante="secundario"
            onClick={c.recargar}
            disabled={c.cargando}
            className="px-3"
            aria-label="Volver a leer la ficha"
          >
            <RefreshCw size={18} className={cn(c.cargando && "animate-spin")} />
          </Boton>
        }
      />

      {c.error && (
        <div className="mb-3">
          <Desactualizado error={c.error} recargar={c.recargar} cargando={c.cargando} />
        </div>
      )}

      <div className="grid gap-4">
        <Contacto cliente={cliente} />
        <Datos cliente={cliente} />
        <Metricas cliente={cliente} />
        <Pedidos pedidos={pedidos} />
        <Permisos
          cliente={cliente}
          token={c.token!}
          esYo={cliente.sub !== null && cliente.sub === subDeToken(c.token)}
          alCambiar={(grupos) =>
            c.setDatos((x) => (x && x.cliente.clave === cliente.clave ? { ...x, cliente: { ...x.cliente, grupos } } : x))
          }
        />
      </div>
    </main>
  );
}

/* ── Secciones ────────────────────────────────────────────────────────────── */

const claseEnlace =
  "lift inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 text-[15px] font-semibold text-fg";

function Contacto({ cliente }: { cliente: ClienteAdmin }) {
  const primerNombre = cliente.nombre.trim().split(/\s+/)[0] ?? "";
  const llamar = enlaceLlamar(cliente.telefono);
  const whatsapp = whatsappCliente(
    cliente.telefono,
    `Hola${primerNombre ? ` ${primerNombre}` : ""}, te escribimos de El Rey de los Perfumes.`,
  );
  const correo = cliente.correo.trim() ? `mailto:${cliente.correo.trim()}` : null;
  const botones = [
    { href: llamar, texto: "Llamar", icono: <Phone size={18} />, externo: false },
    { href: whatsapp, texto: "WhatsApp", icono: <MessageCircle size={18} />, externo: true },
    { href: correo, texto: "Correo", icono: <Mail size={18} />, externo: false },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {botones.map((b) =>
        b.href ? (
          <a
            key={b.texto}
            href={b.href}
            className={claseEnlace}
            {...(b.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {b.icono}
            <span className="truncate">{b.texto}</span>
          </a>
        ) : (
          <span
            key={b.texto}
            role="link"
            aria-disabled="true"
            className={cn(claseEnlace, "opacity-40")}
            title="Sin ese dato"
          >
            {b.icono}
            <span className="truncate">{b.texto}</span>
          </span>
        ),
      )}
    </div>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-soft py-2 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-fg-subtle">{etiqueta}</dt>
      <dd className="min-w-0 text-right text-[14px] [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Datos({ cliente }: { cliente: ClienteAdmin }) {
  const sinCuenta = cliente.clave.startsWith("tel:")
    ? "Sin cuenta: se le reconoce por su teléfono"
    : cliente.clave.startsWith("folio:")
      ? "Sin cuenta ni teléfono: solo su pedido"
      : "Compró con una cuenta que ya no está registrada";
  return (
    <Tarjeta titulo="Datos">
      <dl>
        <Fila etiqueta="Correo">{cliente.correo || "—"}</Fila>
        <Fila etiqueta="Teléfono">{telefonoLegible(cliente.telefono) || "—"}</Fila>
        <Fila etiqueta="Ciudad">{cliente.ciudad || "—"}</Fila>
        <Fila etiqueta="Cuenta">{estadoCuentaLegible(cliente.estadoCuenta) ?? sinCuenta}</Fila>
        {cliente.registradoEn && <Fila etiqueta="Se registró">{fechaHora(cliente.registradoEn)}</Fila>}
        {cliente.grupos.length > 0 && (
          <Fila etiqueta="Grupos">
            <span className="inline-flex flex-wrap justify-end gap-1">
              {cliente.grupos.map((g) => (
                <Insignia key={g}>{g}</Insignia>
              ))}
            </span>
          </Fila>
        )}
      </dl>
    </Tarjeta>
  );
}

function Metricas({ cliente }: { cliente: ClienteAdmin }) {
  const ticket = cliente.pedidosVendidos > 0 ? cliente.ingresos / cliente.pedidosVendidos : 0;
  return (
    <section aria-label="Lo que ha comprado" className="grid grid-cols-2 gap-2 [overflow-wrap:anywhere]">
      <Dato
        className="col-span-2"
        etiqueta="Ha comprado"
        valor={pesosCentavos(cliente.ingresos)}
        pista="Solo pedidos pagados, en preparación, en camino o entregados."
      />
      <Dato
        etiqueta="Pedidos vendidos"
        valor={cliente.pedidosVendidos}
        pista={`de ${cliente.pedidos} ${cliente.pedidos === 1 ? "pedido" : "pedidos"}`}
      />
      <Dato etiqueta="Piezas vendidas" valor={cliente.piezas.toLocaleString("es-MX")} />
      <Dato etiqueta="Ticket promedio" valor={cliente.pedidosVendidos > 0 ? pesosCentavos(ticket) : "—"} />
      <Dato etiqueta="Nivel" valor={cliente.nivel || "—"} pista="por piezas vendidas" />
      <Dato className="col-span-2" etiqueta="Último pedido" valor={fechaDia(cliente.ultimoPedido)} />
    </section>
  );
}

function Pedidos({ pedidos }: { pedidos: ResumenPedido[] }) {
  return (
    <Tarjeta titulo="Pedidos" pista={pedidos.length ? "Toca uno para verlo completo." : undefined}>
      {pedidos.length === 0 ? (
        <p className="py-2 text-[14px] text-fg-subtle">Todavía no ha hecho pedidos.</p>
      ) : (
        <ul className="grid gap-2">
          {pedidos.map((p) => (
            <li key={p.folio}>
              <Link
                href={enlacePedido(p.folio)}
                className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border border-border-soft bg-surface p-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{p.folio}</span>
                  <span className="block truncate text-[12px] text-fg-subtle">
                    {fechaDia(p.fecha)} · {p.piezas} {p.piezas === 1 ? "pieza" : "piezas"}
                    {p.ciudad && ` · ${p.ciudad}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[14px] font-semibold tabular-nums">{pesosCentavos(p.total)}</span>
                  <InsigniaEstatus estatus={p.estatus} />
                </span>
                <ChevronRight size={16} className="shrink-0 text-fg-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/* ── Permisos ─────────────────────────────────────────────────────────────── */

const GRUPOS_EDITABLES: { grupo: Grupo; titulo: string; texto: string }[] = [
  {
    grupo: "admins",
    titulo: "Administrador",
    texto: "Ve pedidos, ventas y clientes, cambia estatus, edita el catálogo y da permisos.",
  },
  {
    grupo: "proveedores",
    titulo: "Equipo de proveedores",
    texto: "Captura y consulta proveedores en el radar. No ve ventas ni clientes.",
  },
];

function pregunta(nombre: string, grupo: Grupo, accion: "agregar" | "quitar"): string {
  if (grupo === "admins") {
    return accion === "agregar"
      ? `¿Hacer administrador a ${nombre}? Podrá ver todos los pedidos, clientes y ventas, cambiar el catálogo y dar o quitar permisos.`
      : `¿Quitarle a ${nombre} el acceso de administrador? Dejará de ver pedidos, ventas y clientes.`;
  }
  return accion === "agregar"
    ? `¿Agregar a ${nombre} al equipo de proveedores? Podrá capturar y ver proveedores en el radar.`
    : `¿Quitar a ${nombre} del equipo de proveedores? Dejará de ver el radar de proveedores.`;
}

function Permisos({
  cliente,
  token,
  esYo,
  alCambiar,
}: {
  cliente: ClienteAdmin;
  token: string;
  esYo: boolean;
  alCambiar: (grupos: string[]) => void;
}) {
  const [pendiente, setPendiente] = useState<{ grupo: Grupo; accion: "agregar" | "quitar" } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  // Sin cuenta en Cognito no hay a quién darle permisos.
  if (!cliente.sub || cliente.estadoCuenta === null) {
    return (
      <Tarjeta titulo="Permisos">
        <p className="text-[14px] text-fg-muted">
          {cliente.sub
            ? "No encontramos su cuenta registrada (se borró o no se pudo leer), así que no hay permisos que cambiar."
            : "Compró sin cuenta, así que no tiene permisos que cambiar. Si crea una cuenta en la tienda, aparecerá aquí con ella."}
        </p>
      </Tarjeta>
    );
  }
  const sub = cliente.sub;
  const nombre = nombreDe(cliente);

  const confirmar = async () => {
    if (!pendiente) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { grupos } = await cambiarGrupo(token, sub, pendiente.grupo, pendiente.accion);
      const titulo = GRUPOS_EDITABLES.find((g) => g.grupo === pendiente.grupo)?.titulo ?? pendiente.grupo;
      setPendiente(null);
      setMensaje({
        tono: "ok",
        texto:
          `Listo: ${nombre} ${pendiente.accion === "agregar" ? "ya es" : "ya no es"} ${titulo.toLowerCase()}. ` +
          "Lo notará cuando vuelva a entrar; si tiene la sesión abierta, puede tardar hasta una hora.",
      });
      alCambiar(grupos);
    } catch (e) {
      setMensaje({
        tono: "error",
        // 400 si el servidor no deja (p. ej. quitarse a uno mismo), 404 si la
        // cuenta ya no existe: su mensaje ya lo dice en palabras del dueño.
        texto: e instanceof Error ? e.message : "No se pudo cambiar el permiso",
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta
      titulo="Permisos"
      pista="El cambio se nota cuando la persona vuelve a entrar: su sesión guarda los permisos con que entró."
    >
      <div className={cn("grid gap-4", guardando && "pointer-events-none opacity-60")} aria-busy={guardando}>
        {GRUPOS_EDITABLES.map((g) => {
          const tiene = cliente.grupos.includes(g.grupo);
          if (esYo && g.grupo === "admins" && tiene) {
            return (
              <div key={g.grupo} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{g.titulo}</span>
                  <span className="block text-[12px] text-fg-subtle">
                    Eres tú: no puedes quitarte. Si hace falta, pídeselo a otro administrador.
                  </span>
                </span>
                <Insignia color="var(--color-success)">Sí</Insignia>
              </div>
            );
          }
          return (
            <Interruptor
              key={g.grupo}
              etiqueta={g.titulo}
              pista={g.texto}
              valor={pendiente?.grupo === g.grupo ? pendiente.accion === "agregar" : tiene}
              onChange={(v) => {
                setMensaje(null);
                // Volver a su estado actual cancela la pregunta.
                setPendiente(v === tiene ? null : { grupo: g.grupo, accion: v ? "agregar" : "quitar" });
              }}
            />
          );
        })}
      </div>

      {pendiente && (
        <div
          role="alertdialog"
          aria-label="Confirmar el cambio de permisos"
          className="mt-4 rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 p-3"
        >
          <p className="text-[14px] text-fg">{pregunta(nombre, pendiente.grupo, pendiente.accion)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setPendiente(null)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton
              variante={pendiente.accion === "quitar" ? "peligro" : "primario"}
              onClick={confirmar}
              disabled={guardando}
            >
              {guardando ? "Guardando…" : pendiente.accion === "quitar" ? "Sí, quitar" : "Sí, agregar"}
            </Boton>
          </div>
        </div>
      )}

      {mensaje && (
        <div className="mt-4">
          <Mensaje tono={mensaje.tono}>{mensaje.texto}</Mensaje>
        </div>
      )}
    </Tarjeta>
  );
}
