"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Transición entre páginas.
 *
 * Al cambiar la `key` el contenido se remonta y vuelve a disparar la animación
 * CSS, así que la navegación se funde en vez de saltar en seco. Se resuelve con
 * una clase, no con Framer Motion: son 0 KB de JavaScript extra en cada ruta y
 * `prefers-reduced-motion` ya la anula desde globals.css.
 */
export function TransicionRuta({ children }: { children: ReactNode }) {
  const ruta = usePathname();

  return (
    <div key={ruta} className="entrada-ruta">
      {children}
    </div>
  );
}
