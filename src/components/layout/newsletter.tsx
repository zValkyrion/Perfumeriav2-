"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { pixel } from "@/lib/pixel";

/** El cupón de bienvenida que reparte el boletín (`CUPONES` en compartido/reglas.ts). */
const CUPON_BIENVENIDA = "REY10";

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
    /**
     * `Lead`: el correo entregado a cambio del cupón. Es el nombre estándar que
     * el administrador de anuncios sabe optimizar; con un evento personalizado
     * no se puede pujar por conversiones.
     *
     * Ojo con lo que este evento promete: hoy el formulario no tiene backend
     * —solo valida y confirma— así que el correo no se guarda en ningún sitio.
     * El evento mide la intención real de la persona, pero mientras no haya
     * dónde recogerlo, optimizar campañas hacia `Lead` compra correos que nadie
     * llega a usar.
     */
    pixel("Lead");
    // Antes: «tu cupón va en camino, revisa tu correo». No se manda ningún
    // correo, así que el cupón se da aquí mismo. Es `REY10`, el de la tienda;
    // `AURA10` era el de la plantilla (el servidor aún lo acepta por quien ya
    // lo tenía guardado, ver `compartido/reglas.ts`).
    toast.success(`¡Listo! Tu cupón es ${CUPON_BIENVENIDA}`, {
      description: "Escríbelo en el carrito para el 10% de bienvenida.",
    });
  }

  if (listo) {
    return (
      <div className="border-success/30 bg-success/10 flex items-center gap-2.5 rounded-md border px-3.5 py-3">
        <Check size={18} className="text-success shrink-0" aria-hidden />
        <p className="text-sm">
          Ya estás dentro. Usa{" "}
          <strong className="text-gold-light">{CUPON_BIENVENIDA}</strong> en el
          carrito para el 10% de bienvenida.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate>
      {/* Antes prometía «ofertas exclusivas y lanzamientos antes que nadie»,
          pero el correo no se guarda en ningún sitio: no hay envíos. */}
      {compacto ? (
        <p className="text-fg-muted mb-3 text-sm leading-relaxed">
          Escribe tu correo y te damos tu cupón al instante.{" "}
          <span className="text-gold-light">10% de bienvenida.</span>
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
