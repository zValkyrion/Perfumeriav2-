"use client";

import { useState } from "react";
import { CloudOff } from "lucide-react";
import { Logo } from "@/components/logo";
import { Boton, Campo, Tarjeta } from "@/components/ui";
import type { Sesion } from "@/lib/sesion";

/**
 * Puerta de entrada: nombre y código del equipo, en una sola pantalla.
 *
 * Van juntos porque el servidor los valida juntos: el nombre viaja dentro del
 * token, y así cada ficha que suba este teléfono queda firmada por quien la
 * levantó sin pedir nada más nunca.
 */
export function PortadaAcceso({ sesion }: { sesion: Sesion }) {
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setAviso(null);

    const r = await sesion.entrar(pin, nombre);

    if (!r.ok) {
      setError(r.error ?? "No se pudo entrar");
      setPin("");
    } else if (r.sinRed) {
      setAviso(
        "Sin conexión: puedes capturar igual. Se pedirá el código otra vez para subir las fichas.",
      );
    }
    setEnviando(false);
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-5">
      <div>
        <Logo className="text-3xl" />
        <p className="eyebrow mt-3">El Rey de los Perfumes</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Radar de Proveedores
        </h1>
        <span aria-hidden className="rule-gold mt-3 block h-px w-24" />
      </div>

      <Tarjeta>
        <form onSubmit={enviar} className="grid gap-3">
          <Campo
            etiqueta="Tu nombre"
            placeholder="Ej. Carlos A."
            value={nombre}
            autoFocus
            onChange={(e) => setNombre(e.target.value)}
          />
          <Campo
            etiqueta="Código del equipo"
            type="password"
            // `numeric` levanta el teclado de números: ocho dígitos con el
            // teclado de texto son ocho oportunidades de equivocarse.
            inputMode="numeric"
            autoComplete="off"
            placeholder="••••••••"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(null);
            }}
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Boton
            type="submit"
            disabled={enviando || !nombre.trim() || pin.trim() === ""}
          >
            {enviando ? "Entrando…" : "Entrar"}
          </Boton>
        </form>
      </Tarjeta>

      {aviso && (
        <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 py-2.5 text-[13px] text-fg-muted">
          <CloudOff size={16} className="mt-0.5 shrink-0 text-warning" />
          {aviso}
        </p>
      )}

      <p className="text-[13px] text-fg-subtle">
        Una vez abierta, funciona sin señal. Lo que captures se guarda en este
        teléfono hasta que lo subas.
      </p>
    </main>
  );
}
