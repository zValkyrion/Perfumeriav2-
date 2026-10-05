"use client";

import { useEffect, useState } from "react";
import { Clock, UserPlus } from "lucide-react";
import { Logo } from "@/components/logo";
import { Boton, Campo, Tarjeta } from "@/components/ui";
import type { Sesion } from "@/lib/sesion";
import type { ResultadoAcceso } from "@/lib/cognito";
import { hayApi } from "@/lib/api";
import { leerMiSolicitud, pedirEntrarAlEquipo, type SolicitudEquipo } from "@/lib/tienda-admin";

/**
 * Puerta de entrada al panel: la cuenta propia, la misma de la tienda. El
 * código compartido del equipo se retiró el 2026-10-05.
 */
export function PortadaAcceso({ sesion }: { sesion: Sesion }) {
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

      <FormaCuenta sesion={sesion} />

      <p className="text-[13px] text-fg-subtle">
        Una vez abierta, funciona sin señal. Lo que captures se guarda en este
        teléfono hasta que lo subas.
      </p>
      <p className="text-[13px] text-fg-subtle">
        Es la misma cuenta de la tienda. ¿No tienes?{" "}
        <a href="/cuenta" className="font-medium text-info">
          Créala en la tienda
        </a>{" "}
        y vuelve aquí para pedir acceso al equipo. Para recuperar la contraseña,
        también desde la tienda.
      </p>
    </main>
  );
}

/**
 * Cuenta de cliente que llegó al panel.
 *
 * Todos inician sesión en el mismo sitio, así que un cliente puede terminar
 * aquí siguiendo un enlace — o porque es alguien nuevo del equipo que se creó
 * la cuenta en la tienda. Desde aquí pide entrar y el superadmin lo acepta en
 * «Equipo y cuentas». No se le cierra la sesión: su cuenta sigue sirviendo en
 * la tienda.
 */
export function SinPermiso({ sesion }: { sesion: Sesion }) {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-4 p-5">
      <Logo className="text-3xl" />
      <Tarjeta titulo="Tu cuenta todavía no abre el panel">
        <p className="text-[14px] text-fg-muted">
          Entraste como <strong>{sesion.evaluador}</strong>
          {sesion.correo && sesion.correo !== sesion.evaluador ? ` (${sesion.correo})` : ""}, que es
          una cuenta de cliente. El panel es solo para el equipo. Si trabajas con nosotros, pide
          acceso y el administrador te aceptará.
        </p>
        {sesion.token && hayApi() && <PedirAcceso token={sesion.token} />}
        <div className="mt-4 grid gap-2">
          {/* `<a>` a propósito: la tienda es otra app en la raíz del dominio, y
              `Link` la resolvería dentro de `/radar`. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">
            <Boton variante="secundario" className="w-full" tabIndex={-1}>
              Volver a la tienda
            </Boton>
          </a>
          <Boton variante="secundario" onClick={sesion.salir}>
            Entrar con otra cuenta
          </Boton>
        </div>
      </Tarjeta>
    </main>
  );
}

function PedirAcceso({ token }: { token: string }) {
  const [solicitud, setSolicitud] = useState<SolicitudEquipo | null | undefined>(undefined);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    leerMiSolicitud(token)
      .then((r) => vivo && setSolicitud(r.solicitud))
      // Sin red: se ofrece el formulario igual; al mandar dirá qué pasó.
      .catch(() => vivo && setSolicitud(null));
    return () => {
      vivo = false;
    };
  }, [token]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await pedirEntrarAlEquipo(token, mensaje.trim());
      setSolicitud(r.solicitud);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo mandar la solicitud");
    } finally {
      setEnviando(false);
    }
  };

  if (solicitud === undefined) {
    return <p className="mt-4 text-[13px] text-fg-subtle">Revisando si ya pediste acceso…</p>;
  }

  if (solicitud?.estado === "pendiente") {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface-2 px-3 py-2.5 text-[14px] text-fg-muted">
        <Clock size={16} className="mt-0.5 shrink-0 text-warning" />
        <span>
          Ya pediste acceso. En cuanto el administrador te acepte, <strong>sal y vuelve a entrar</strong>{" "}
          para que tu sesión traiga el permiso.
        </span>
      </p>
    );
  }

  if (solicitud?.estado === "aceptada") {
    return (
      <p className="mt-4 rounded-[var(--radius-md)] border border-success/40 bg-success/10 px-3 py-2.5 text-[14px] text-fg">
        Ya te aceptaron. Sal y vuelve a entrar para que tu sesión traiga el permiso.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-4 grid gap-3">
      {solicitud?.estado === "rechazada" && (
        <p className="text-[13px] text-fg-muted">
          Tu solicitud anterior no se aceptó. Si crees que es un error, puedes volver a pedirlo.
        </p>
      )}
      <Campo
        etiqueta="Mensaje para el administrador (opcional)"
        placeholder="Ej. Soy Laura, de compras en Guadalajara"
        maxLength={500}
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
      />
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <Boton type="submit" disabled={enviando}>
        <UserPlus size={18} />
        {enviando ? "Mandando…" : "Pedir acceso al equipo"}
      </Boton>
    </form>
  );
}

function FormaCuenta({ sesion }: { sesion: Sesion }) {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reto, setReto] = useState<ResultadoAcceso | null>(null);

  // Cuenta recién creada: Cognito exige cambiar la contraseña temporal antes de
  // entregar ninguna sesión.
  if (reto && reto.tipo === "nueva_contrasena") {
    return (
      <FormaNuevaContrasena
        sesion={sesion}
        reto={{ sesion: reto.sesion, correo: reto.correo }}
      />
    );
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const r = await sesion.entrarConCuenta(correo, contrasena);
    if ("nuevaContrasena" in r) setReto(r.nuevaContrasena);
    else if (!r.ok) {
      setError(r.error);
      setContrasena("");
    }
    setEnviando(false);
  };

  return (
    <Tarjeta>
      <form onSubmit={enviar} className="grid gap-3">
        <Campo
          etiqueta="Correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="tu@correo.com"
          value={correo}
          autoFocus
          onChange={(e) => setCorreo(e.target.value)}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => {
            setContrasena(e.target.value);
            setError(null);
          }}
        />
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <Boton
          type="submit"
          disabled={enviando || !correo.trim() || contrasena === ""}
        >
          {enviando ? "Entrando…" : "Entrar"}
        </Boton>
      </form>
    </Tarjeta>
  );
}

function FormaNuevaContrasena({
  sesion,
  reto,
}: {
  sesion: Sesion;
  reto: { sesion: string; correo: string };
}) {
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva !== repetida) {
      setError("Las dos contraseñas no coinciden");
      return;
    }
    setEnviando(true);
    setError(null);
    const r = await sesion.cambiarContrasena(reto, nueva);
    if (!r.ok) setError(r.error ?? "No se pudo guardar");
    setEnviando(false);
  };

  return (
    <Tarjeta titulo="Elige tu contraseña">
      <p className="mb-3 text-[14px] text-fg-muted">
        Es la primera vez que entras con <strong>{reto.correo}</strong>. La
        contraseña que te llegó por correo es temporal.
      </p>
      <form onSubmit={enviar} className="grid gap-3">
        <Campo
          etiqueta="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          pista="Al menos 10 caracteres, con minúsculas y números."
          value={nueva}
          autoFocus
          onChange={(e) => {
            setNueva(e.target.value);
            setError(null);
          }}
        />
        <Campo
          etiqueta="Repítela"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <Boton type="submit" disabled={enviando || nueva === "" || repetida === ""}>
          {enviando ? "Guardando…" : "Guardar y entrar"}
        </Boton>
      </form>
    </Tarjeta>
  );
}
