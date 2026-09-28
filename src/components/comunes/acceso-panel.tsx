"use client";

import {
  ChartColumn,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  Package,
  Store,
  Users,
} from "lucide-react";
import { esAdmin, puedeVerPanel, useSesion, type Perfil } from "@/lib/sesion";
import { cn } from "@/lib/utils";

/**
 * La puerta al panel para quien tiene permiso.
 *
 * Todos entran igual, como clientes, y el panel aparece solo si el token trae
 * `admins` o `proveedores`. Sale en cuanto se inicia sesión, sin recargar: el
 * perfil llega por `useSesion`, que avisa a todas las pantallas a la vez.
 *
 * **Esto no es un control de acceso.** Aquí solo se decide si pintar un enlace.
 * Lo que protege los datos es la API, que comprueba el grupo en un token
 * firmado por Cognito; alterar el navegador no abre nada.
 */

type Seccion = { href: string; titulo: string; texto: string; icono: typeof Package };

/** El panel de la tienda (hub con pedidos, ventas, clientes y solicitudes). */
const PANEL_TIENDA = "/radar/tienda/";

function seccionesDe(perfil: Perfil): Seccion[] {
  const proveedores: Seccion = {
    href: "/radar/",
    titulo: "Proveedores",
    texto: "Fichas, capturas y comparación",
    icono: Store,
  };
  if (!esAdmin(perfil)) return [proveedores];
  return [
    {
      href: "/radar/pedidos/",
      titulo: "Pedidos",
      texto: "Estatus, guías y cobro",
      icono: ClipboardList,
    },
    {
      href: "/radar/ventas/",
      titulo: "Ventas",
      texto: "Ingresos, productos y clientes top",
      icono: ChartColumn,
    },
    {
      href: "/radar/clientes/",
      titulo: "Clientes",
      texto: "Cuentas, compras y permisos",
      icono: Users,
    },
    {
      href: "/radar/solicitudes/",
      titulo: "Solicitudes",
      texto: "Distribuidores, contacto y facturas",
      icono: Inbox,
    },
    {
      href: "/radar/catalogo/",
      titulo: "Catálogo",
      texto: "Productos, precios, fotos y publicación",
      icono: Package,
    },
    proveedores,
  ];
}

/** Botón de la cabecera. */
export function AccesoPanel({ className }: { className?: string }) {
  const { perfil } = useSesion();
  if (!puedeVerPanel(perfil)) return null;

  const admin = esAdmin(perfil);
  return (
    <a
      href={admin ? PANEL_TIENDA : "/radar/"}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/40 px-3 text-[13px] font-semibold text-gold-light transition-colors hover:bg-gold-muted",
        className,
      )}
      title={`Abrir el panel como ${perfil!.nombre}`}
    >
      <LayoutDashboard size={16} aria-hidden />
      <span className="hidden sm:inline">{admin ? "Panel admin" : "Panel"}</span>
      <span className="sr-only">, como {perfil!.nombre}</span>
    </a>
  );
}

/** Tarjeta en «Mi cuenta» con cada sección del panel que su cuenta abre. */
export function AccesoPanelCuenta({
  perfil,
  className,
}: {
  perfil: Perfil | null;
  className?: string;
}) {
  if (!perfil || !puedeVerPanel(perfil)) return null;
  const admin = esAdmin(perfil);

  return (
    <section
      aria-labelledby="titulo-panel"
      className={cn("border-gold/40 bg-surface rounded-lg border p-4 lg:p-5", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={18} className="text-gold-light" aria-hidden />
          <h2 id="titulo-panel" className="font-medium">
            {admin ? "Panel de administración" : "Panel del equipo"}
          </h2>
        </div>
        {admin ? (
          <a
            href={PANEL_TIENDA}
            className="text-gold-light inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Abrir el panel de la tienda
          </a>
        ) : null}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {seccionesDe(perfil).map((s) => {
          const Icono = s.icono;
          return (
            <li key={s.href}>
              <a
                href={s.href}
                className="border-border-soft hover:border-gold/50 hover:bg-gold-muted flex min-h-11 items-start gap-3 rounded-md border p-3 transition-colors"
              >
                <Icono size={18} className="text-gold-light mt-0.5 shrink-0" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{s.titulo}</span>
                  <span className="text-fg-subtle block text-xs">{s.texto}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
