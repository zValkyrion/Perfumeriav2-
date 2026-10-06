"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Boton, Insignia, Tarjeta } from "@/components/ui";
import { hayApi } from "@/lib/api";
import { useSesion } from "@/lib/sesion";
import { ErrorApi, type EstatusPedido } from "@/lib/tienda-admin";
import { ErrorGuardado } from "@/lib/catalogo-admin";
import { cn, enlaceWhatsappTexto, soloDigitos } from "@/lib/utils";

/**
 * Piezas comunes del panel de la tienda (pedidos, ventas, clientes y
 * solicitudes): la carga con su puerta, la cabecera, las cifras, las barras
 * por día y los formatos. Mismo lenguaje visual que el resto del panel
 * (`ui.tsx`, tokens de `globals.css`), columna de 672 px, pensado para el
 * teléfono del dueño.
 */

/* ── Carga ────────────────────────────────────────────────────────────────── */

export type PanelAdmin<T> = {
  sesion: ReturnType<typeof useSesion>;
  esAdmin: boolean;
  token: string | null;
  /** Lo último que se leyó. Se conserva mientras se recarga (no parpadea a vacío). */
  datos: T | null;
  setDatos: React.Dispatch<React.SetStateAction<T | null>>;
  /** Mensaje del último fallo, o `null`. Un fallo **nunca** es «no hay datos». */
  error: string | null;
  /** Código HTTP del último fallo (0 = sin red o sin respuesta), o `null`. */
  estadoError: number | null;
  /** Vuelve a pedir, sin tocar lo que ya se enseña. */
  recargar: () => void;
  /** `true` mientras hay una lectura en vuelo (la primera o una recarga). */
  cargando: boolean;
};

/**
 * Carga algo de `/admin/*` para una pantalla del panel.
 *
 * Patrón de `useCatalogoAdmin`: el efecto solo toca el estado después de un
 * `await`, recargar es mover `intento`, y `vivo` descarta respuestas de una
 * carga que ya no importa. `cargar` puede ser una función en línea: se guarda
 * la última en una referencia, y lo que vuelve a disparar la carga es `clave`
 * (p. ej. el rango de fechas) o `recargar()`.
 *
 * No carga nada sin sesión, sin permiso de admin o sin API: para eso está
 * `PuertaAdmin`.
 */
export function usePanelAdmin<T>(
  cargar: (token: string) => Promise<T>,
  clave = "",
  /** `superadmin` para «Equipo y cuentas» (`/superadmin/*`). */
  nivel: "admin" | "superadmin" = "admin",
): PanelAdmin<T> {
  const sesion = useSesion();
  const esAdmin = nivel === "superadmin" ? sesion.esSuperadmin : sesion.esAdmin;
  const token = sesion.token;
  const [datos, setDatos] = useState<T | null>(null);
  const [fallo, setFallo] = useState<{ mensaje: string; estado: number } | null>(null);
  const [intento, setIntento] = useState(0);
  const [terminado, setTerminado] = useState<string | null>(null);
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  const puede = sesion.listo && esAdmin && Boolean(token) && hayApi();
  const pedido = `${token}|${clave}|${intento}`;

  useEffect(() => {
    if (!puede || !token) return;
    let vivo = true;
    (async () => {
      try {
        const d = await cargarRef.current(token);
        if (!vivo) return;
        setDatos(d);
        setFallo(null);
      } catch (e) {
        if (!vivo) return;
        setFallo({
          mensaje: e instanceof Error ? e.message : "No se pudo leer",
          estado: e instanceof ErrorApi || e instanceof ErrorGuardado ? e.estado : 0,
        });
      } finally {
        if (vivo) setTerminado(pedido);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [puede, token, pedido]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return {
    sesion,
    esAdmin,
    token,
    datos,
    setDatos,
    error: fallo?.mensaje ?? null,
    estadoError: fallo?.estado ?? null,
    recargar,
    cargando: puede && terminado !== pedido,
  };
}

/**
 * Lo que se enseña mientras la pantalla no puede trabajar: sin sesión, sin
 * permiso o sin API. `null` cuando sí puede.
 *
 * **La puerta de verdad está en la Lambda** (`/admin/*` exige el grupo
 * `admins`). Esto solo evita enseñar una pantalla que el servidor va a
 * rechazar. Un 403 del servidor (el grupo se quitó después de entrar) también
 * cae aquí.
 */
export function PuertaAdmin({
  c,
  titulo,
  volver = "/",
  nivel = "admin",
}: {
  c: Pick<PanelAdmin<unknown>, "sesion" | "esAdmin" | "token" | "estadoError">;
  /** Nombre de la sección, para los mensajes («Pedidos», «Ventas»…). */
  titulo: string;
  volver?: string;
  nivel?: "admin" | "superadmin";
}) {
  if (!c.sesion.listo) return <main className="p-4" />;
  if (nivel === "superadmin" && c.sesion.desbloqueado && c.token && (!c.esAdmin || c.estadoError === 403)) {
    return (
      <AvisoPuerta titulo="Esta sección es solo para el superadministrador" volver={volver}>
        {titulo} reparte los permisos de todo el sistema, así que solo la abre la cuenta del dueño.
      </AvisoPuerta>
    );
  }
  if (!c.sesion.desbloqueado || !c.token) {
    return (
      <AvisoPuerta titulo="Hay que iniciar sesión" volver={volver}>
        {titulo} se ve con una cuenta de administrador. Entra desde la portada del panel.
      </AvisoPuerta>
    );
  }
  if (!c.esAdmin || c.estadoError === 403) {
    return (
      <AvisoPuerta titulo="Esta sección es solo para administradores" volver={volver}>
        {titulo} tiene datos de clientes y de ventas, así que es del grupo <strong>admins</strong>. Si
        acaban de darte permiso, sal y vuelve a entrar para que tu sesión lo traiga.
      </AvisoPuerta>
    );
  }
  if (!hayApi()) {
    return (
      <AvisoPuerta titulo="Sin servidor" volver={volver}>
        Esta copia del panel no tiene API configurada, así que no puede leer la tienda.
      </AvisoPuerta>
    );
  }
  return null;
}

function AvisoPuerta({ titulo, children, volver }: { titulo: string; children: React.ReactNode; volver: string }) {
  return (
    <main className="p-4">
      <Link
        href={volver}
        className="inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-fg-subtle"
      >
        <ArrowLeft size={15} />
        Volver
      </Link>
      <Tarjeta className="mt-1">
        <p className="text-[15px] font-medium">{titulo}</p>
        <p className="mt-1 text-[14px] text-fg-muted">{children}</p>
      </Tarjeta>
    </main>
  );
}

/**
 * Un fallo de carga, con «Reintentar». Distinto del estado vacío a propósito:
 * decir «no hay pedidos» cuando lo que pasó es que no hubo red haría pensar
 * al dueño que no vendió.
 */
export function ErrorCarga({ mensaje, recargar, cargando = false }: { mensaje: string; recargar: () => void; cargando?: boolean }) {
  return (
    <div role="alert" className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/10 p-3">
      <p className="text-[14px] text-fg">No se pudo leer: {mensaje}</p>
      <Boton variante="secundario" className="mt-2" onClick={recargar} disabled={cargando}>
        <RefreshCw size={16} className={cn(cargando && "animate-spin")} />
        Reintentar
      </Boton>
    </div>
  );
}

/* ── Cabecera y cifras ────────────────────────────────────────────────────── */

export function Cabecera({
  titulo,
  subtitulo,
  volver = null,
  acciones,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  /**
   * Enlace de regreso, para los detalles (cliente → Clientes). Las secciones
   * no lo llevan: el menú del panel (`components/panel/marco.tsx`) ya está a
   * la vista en computadora y a un toque en el teléfono.
   */
  volver?: { href: string; texto: string } | null;
  /** Botones a la derecha (recargar, exportar…). */
  acciones?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {volver && (
          <Link
            href={volver.href}
            className="mb-1 inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-fg-subtle hover:text-fg"
          >
            <ArrowLeft size={15} />
            {volver.texto}
          </Link>
        )}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-[14px] text-fg-subtle">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap justify-end gap-2">{acciones}</div>}
    </header>
  );
}

/** Una cifra con su etiqueta: los KPI del hub y de ventas. */
export function Dato({
  etiqueta,
  valor,
  pista,
  className,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  pista?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[var(--radius)] border border-border-soft bg-surface p-3", className)}>
      <p className="text-[12px] font-medium text-fg-subtle">{etiqueta}</p>
      <p className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-tight text-fg">{valor}</p>
      {pista && <p className="mt-0.5 text-[12px] text-fg-muted">{pista}</p>}
    </div>
  );
}

/* ── Estatus ──────────────────────────────────────────────────────────────── */

export const COLOR_ESTATUS: Record<EstatusPedido, string> = {
  Pendiente: "var(--color-warning)",
  Pagado: "var(--color-info)",
  "En preparación": "var(--color-info)",
  "En camino": "var(--color-info)",
  Entregado: "var(--color-success)",
  Cancelado: "var(--color-danger)",
};

export function InsigniaEstatus({ estatus }: { estatus: EstatusPedido }) {
  return <Insignia color={COLOR_ESTATUS[estatus] ?? "var(--color-fg-muted)"}>{estatus}</Insignia>;
}

/* ── Formatos ─────────────────────────────────────────────────────────────── */

/** $1,234.50 — con centavos: es lo que se cobró, no una cifra redondeada. */
export function pesosCentavos(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** «27 sep 2026, 14:05» en la hora de México, sea cual sea la del teléfono. */
export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

/**
 * Enlace de WhatsApp al cliente con el mensaje ya escrito. Los pedidos traen
 * el teléfono como lo tecleó cada quien («+52 55…», «55-…»): se toman los
 * últimos 10 dígitos y se les pone la lada de México. `null` si no alcanza
 * para un número.
 */
export function whatsappCliente(telefono: string, texto: string): string | null {
  const diez = soloDigitos(telefono).slice(-10);
  if (diez.length < 10) return null;
  return enlaceWhatsappTexto("+52", diez, texto);
}
