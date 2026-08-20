"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { leerPerfil, puedeVerPanel } from "@/lib/sesion";
import { cn } from "@/lib/utils";

/**
 * Puerta al panel de proveedores para quien ya trabaja en él.
 *
 * La tienda y el panel comparten origen desde que ambos se sirven de la misma
 * distribución (`/` y `/radar`), y por eso comparten `localStorage`. Basta con
 * mirar si este dispositivo tiene una sesión del panel: si la tiene, es de
 * alguien del equipo y se le ofrece el atajo; si no, el visitante ve una tienda
 * normal y no se entera de que el panel existe.
 *
 * **Esto no es un control de acceso.** Cualquiera puede escribir `localStorage`
 * en su navegador y hacer aparecer el botón — y no ganaría nada, porque el panel
 * pide el código del equipo y la API rechaza todo lo que no traiga un token
 * firmado. Aquí solo se decide si mostrar un enlace, y ese es el único poder que
 * tiene.
 *
 * En GitHub Pages nunca aparece: es otro origen, así que allí no existe esa
 * sesión aunque la persona la tenga en el sitio de AWS.
 */
export function AccesoPanel({ className }: { className?: string }) {
  const [quien, setQuien] = useState<string | null>(null);

  useEffect(() => {
    try {
      // El token es la señal de que la sesión es real; el nombre es solo para
      // saludar. Sin token no se muestra nada, aunque quede el nombre de antes.
      const token = localStorage.getItem("radar:token");
      if (!token) return;
      // El grupo del token decide, no el simple hecho de tener sesión: un cliente
      // de la tienda inicia sesión igual y no tiene nada que hacer en el panel.
      const perfil = leerPerfil(token);
      if (!puedeVerPanel(perfil)) return;
      setQuien(perfil?.nombre ?? null);
    } catch {
      // Navegador con almacenamiento bloqueado: se comporta como un visitante.
    }
  }, []);

  if (quien === null) return null;

  return (
    <a
      href="/radar/"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/40 px-3 text-[13px] font-semibold text-gold-light transition-colors hover:bg-gold-muted",
        className,
      )}
      title={`Entrar al panel de proveedores como ${quien}`}
    >
      <LayoutDashboard size={16} aria-hidden />
      <span className="hidden sm:inline">Panel</span>
      <span className="sr-only">de proveedores, como {quien}</span>
    </a>
  );
}
