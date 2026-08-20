"use client";

import { useState } from "react";
import { CloudOff, KeyRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { Boton, Campo, Tarjeta } from "@/components/ui";
import type { Sesion } from "@/lib/sesion";
import type { ResultadoAcceso } from "@/lib/cognito";

/**
 * Puerta de entrada al panel.
 *
 * Dos caminos mientras dura la transición: la cuenta propia (Cognito) y el
 * código de equipo de siempre. El código queda detrás de un enlace discreto
 * porque es lo que va a desaparecer — se quita este bloque y listo.
 */
export function PortadaAcceso({ sesion }: { sesion: Sesion }) {
  const [conCodigo, setConCodigo] = useState(false);

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

      {conCodigo ? (
        <FormaCodigo sesion={sesion} volver={() => setConCodigo(false)} />
      ) : (
        <FormaCuenta sesion={sesion} usarCodigo={() => setConCodigo(true)} />
      )}

      <p className="text-[13px] text-fg-subtle">
        Una vez abierta, funciona sin señal. Lo que captures se guarda en este
        teléfono hasta que lo subas.
      </p>
    </main>
  );
}

function FormaCuenta({
  sesion,
  usarCodigo,
}: {
  sesion: Sesion;
  usarCodigo: () => void;
}) {
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
    <>
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

      <button
        type="button"
        onClick={usarCodigo}
        className="inline-flex min-h-11 items-center gap-2 self-start text-[13px] font-medium text-info"
      >
        <KeyRound size={15} />
        Entrar con el código del equipo
      </button>
    </>
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
        contraseña que te dieron es temporal.
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

/**
 * El código compartido. Se retira cuando todo el equipo tenga cuenta: se borra
 * este componente y el enlace que lleva hasta él.
 */
function FormaCodigo({ sesion, volver }: { sesion: Sesion; volver: () => void }) {
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

    const r = await sesion.entrarConCodigo(pin, nombre);
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
    <>
      <Tarjeta titulo="Código del equipo">
        <form onSubmit={enviar} className="grid gap-3">
          <Campo
            etiqueta="Tu nombre"
            placeholder="Ej. Carlos A."
            value={nombre}
            autoFocus
            onChange={(e) => setNombre(e.target.value)}
          />
          <Campo
            etiqueta="Código"
            type="password"
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
          <Boton type="submit" disabled={enviando || !nombre.trim() || pin === ""}>
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

      <button
        type="button"
        onClick={volver}
        className="inline-flex min-h-11 items-center self-start text-[13px] font-medium text-info"
      >
        Entrar con mi cuenta
      </button>
    </>
  );
}
