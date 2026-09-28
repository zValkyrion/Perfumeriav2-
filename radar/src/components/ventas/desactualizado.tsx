"use client";

import { Mensaje } from "@/components/catalogo/comun";

/**
 * Una recarga que falló cuando ya había algo en pantalla: se sigue enseñando
 * la última lectura —no se borra lo que el dueño estaba mirando—, pero se dice
 * que no está al día y se ofrece «Reintentar» ahí mismo.
 */
export function Desactualizado({
  error,
  recargar,
  cargando = false,
}: {
  error: string;
  recargar: () => void;
  cargando?: boolean;
}) {
  const frase = /[.!?]$/.test(error.trim()) ? error.trim() : `${error.trim()}.`;
  return (
    <Mensaje tono="error">
      No se pudo actualizar: {frase} Se ve la última lectura.{" "}
      <button
        type="button"
        onClick={recargar}
        disabled={cargando}
        className="min-h-11 font-semibold text-info underline disabled:opacity-50"
      >
        {cargando ? "Reintentando…" : "Reintentar"}
      </button>
    </Mensaje>
  );
}
