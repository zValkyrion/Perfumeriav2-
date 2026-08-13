"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * Captura de correo con el gancho del 10% (§1.2.2, punto 9). No hay backend:
 * valida el formato y confirma en el propio componente.
 */
export function Newsletter({ compacto = true }: { compacto?: boolean }) {
  const [correo, setCorreo] = useState("");
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const valido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
    if (!valido) {
      setError("Escribe un correo válido, por ejemplo nombre@correo.com");
      return;
    }
    setError(null);
    setListo(true);
    toast.success("¡Listo! Tu cupón AURA10 va en camino", {
      description: "Revisa tu correo para el 10% de tu primera compra.",
    });
  }

  if (listo) {
    return (
      <div className="border-success/30 bg-success/10 flex items-center gap-2.5 rounded-md border px-3.5 py-3">
        <Check size={18} className="text-success shrink-0" aria-hidden />
        <p className="text-sm">
          Ya estás dentro. Usa <strong className="text-gold-light">AURA10</strong>{" "}
          en tu primera compra.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate>
      {compacto ? (
        <p className="text-fg-muted mb-3 text-sm leading-relaxed">
          Recibe ofertas exclusivas y lanzamientos antes que nadie.{" "}
          <span className="text-gold-light">10% en tu primera compra.</span>
        </p>
      ) : null}

      <div className="border-border-strong focus-within:border-gold flex items-center gap-2 rounded-full border pr-1 pl-4 transition-colors">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="tu@correo.com"
          aria-label="Tu correo electrónico"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "error-newsletter" : undefined}
          className="placeholder:text-fg-subtle h-11 w-full min-w-0 bg-transparent text-sm outline-none"
        />
        <button
          type="submit"
          className="bg-gold-gradient text-bg grid size-9 shrink-0 place-items-center rounded-full transition-[filter] hover:brightness-110"
          aria-label="Suscribirme al boletín"
        >
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>

      {error ? (
        <p id="error-newsletter" role="alert" className="text-danger mt-2 text-xs">
          {error}
        </p>
      ) : null}
    </form>
  );
}
