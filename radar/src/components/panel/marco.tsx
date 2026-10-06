"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  ClipboardList,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  ShieldCheck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utils";

/**
 * El marco del panel de la tienda.
 *
 * - **Computadora (≥ 1024 px):** menú lateral fijo de 256 px con las
 *   secciones, el botón de «Nuevo pedido» y la cuenta abajo. El contenido usa
 *   el resto del ancho, hasta 1280 px.
 * - **Teléfono y tableta:** barra superior pegajosa con el logo y un botón de
 *   menú que abre el mismo menú como cajón. Nada de barra inferior: los
 *   detalles (pedido, catálogo) ya tienen su barra de acciones abajo y las dos
 *   se pisarían.
 *
 * Solo pinta el menú a quien es admin: a los demás les deja la pantalla tal
 * cual, que ya explica por qué no pueden entrar (`PuertaAdmin`). El permiso de
 * verdad lo comprueba la API en cada lectura; esto decide qué se pinta.
 */

type Enlace = {
  href: string;
  texto: string;
  icono: React.ReactNode;
  /** Rutas que también lo marcan como activo (los detalles). */
  prefijo: string;
  soloSuperadmin?: boolean;
};

const SECCIONES: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: "Operación",
    enlaces: [
      { href: "/tienda/", prefijo: "/tienda", texto: "Inicio", icono: <LayoutDashboard size={18} /> },
      { href: "/pedidos/", prefijo: "/pedidos", texto: "Pedidos", icono: <ClipboardList size={18} /> },
      { href: "/clientes/", prefijo: "/clientes", texto: "Clientes", icono: <Users size={18} /> },
      { href: "/solicitudes/", prefijo: "/solicitudes", texto: "Solicitudes", icono: <Inbox size={18} /> },
    ],
  },
  {
    titulo: "Negocio",
    enlaces: [
      { href: "/ventas/", prefijo: "/ventas", texto: "Ventas y reportes", icono: <ChartColumn size={18} /> },
      { href: "/catalogo/", prefijo: "/catalogo", texto: "Catálogo", icono: <Package size={18} /> },
    ],
  },
  {
    titulo: "Administración",
    enlaces: [
      {
        href: "/equipo/",
        prefijo: "/equipo",
        texto: "Equipo y cuentas",
        icono: <ShieldCheck size={18} />,
        soloSuperadmin: true,
      },
      { href: "/", prefijo: "/__proveedores", texto: "Radar de proveedores", icono: <Warehouse size={18} /> },
    ],
  },
];

export function MarcoPanel({ children }: { children: React.ReactNode }) {
  const sesion = useSesion();
  const ruta = usePathname() ?? "";
  const [abierto, setAbierto] = useState(false);

  // Al navegar, el cajón se cierra solo.
  const [rutaVista, setRutaVista] = useState(ruta);
  if (ruta !== rutaVista) {
    setRutaVista(ruta);
    setAbierto(false);
  }

  // Con el cajón abierto, Escape lo cierra y el fondo no se desplaza.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  if (!sesion.listo || !sesion.desbloqueado || !sesion.esAdmin) {
    // Sin menú: la pantalla dice por qué no se puede entrar.
    return <div className="mx-auto min-h-dvh max-w-2xl">{children}</div>;
  }

  const menu = (
    <Menu_
      ruta={ruta}
      esSuperadmin={sesion.esSuperadmin}
      nombre={sesion.evaluador ?? ""}
      correo={sesion.correo ?? ""}
      salir={() => {
        if (confirm("¿Cerrar la sesión en este dispositivo?")) sesion.salir();
      }}
    />
  );

  return (
    <div className="min-h-dvh">
      {/* Menú lateral, computadora */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border-soft bg-surface lg:flex lg:flex-col">
        {menu}
      </aside>

      {/* Barra superior, teléfono y tableta */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border-soft bg-surface/95 px-3 backdrop-blur lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir el menú"
          aria-expanded={abierto}
          className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-fg hover:bg-surface-2"
        >
          <Menu size={22} />
        </button>
        <Link href="/tienda/" className="flex items-baseline gap-2">
          <Logo className="text-lg" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">Panel</span>
        </Link>
        <Link
          href="/pedidos/nuevo/"
          aria-label="Nuevo pedido"
          className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] bg-gold-gradient text-white"
        >
          <Plus size={20} />
        </Link>
      </header>

      {/* Cajón, teléfono y tableta */}
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú del panel">
          <button
            type="button"
            aria-label="Cerrar el menú"
            className="absolute inset-0 bg-fg/40"
            onClick={() => setAbierto(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-surface shadow-xl">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar el menú"
              className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-fg-subtle hover:bg-surface-2"
            >
              <X size={20} />
            </button>
            {menu}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl lg:px-4 lg:py-3">{children}</div>
      </div>
    </div>
  );
}

function Menu_({
  ruta,
  esSuperadmin,
  nombre,
  correo,
  salir,
}: {
  ruta: string;
  esSuperadmin: boolean;
  nombre: string;
  correo: string;
  salir: () => void;
}) {
  const iniciales =
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?";

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2 px-5">
        <Link href="/tienda/" className="flex items-baseline gap-2">
          <Logo className="text-2xl" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">Panel</span>
        </Link>
      </div>

      <div className="px-3 pb-2">
        <Link
          href="/pedidos/nuevo/"
          className="lift flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-gold-deep bg-gold-gradient px-3 text-[14px] font-semibold text-white"
        >
          <Plus size={18} />
          Nuevo pedido
        </Link>
      </div>

      <nav aria-label="Secciones del panel" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {SECCIONES.map((s) => {
          const enlaces = s.enlaces.filter((e) => !e.soloSuperadmin || esSuperadmin);
          if (enlaces.length === 0) return null;
          return (
            <div key={s.titulo} className="mb-4">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
                {s.titulo}
              </p>
              <ul className="grid gap-0.5">
                {enlaces.map((e) => {
                  const activo = ruta === e.prefijo || ruta.startsWith(`${e.prefijo}/`);
                  return (
                    <li key={e.href}>
                      <Link
                        href={e.href}
                        aria-current={activo ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-[14px] font-semibold transition-colors",
                          activo
                            ? "bg-gold-muted text-gold-deep"
                            : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                        )}
                      >
                        <span className={cn(activo ? "text-gold" : "text-fg-subtle")}>{e.icono}</span>
                        {e.texto}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {/* `<a>` a propósito: la tienda es otra app en la raíz del dominio y
            `Link` la resolvería dentro de `/radar`. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-[14px] font-semibold text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <ExternalLink size={18} className="text-fg-subtle" />
          Ver la tienda
        </a>
      </nav>

      <div className="flex shrink-0 items-center gap-3 border-t border-border-soft p-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-bold text-fg-muted"
        >
          {iniciales}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{nombre || correo}</span>
          <span className="block truncate text-[12px] text-fg-subtle">
            {esSuperadmin ? "Superadministrador" : "Administrador"}
          </span>
        </span>
        <button
          type="button"
          onClick={salir}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-md)] text-fg-subtle hover:bg-surface-2 hover:text-fg"
        >
          <LogOut size={18} />
        </button>
      </div>
    </>
  );
}
