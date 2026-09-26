"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Reto, Sesion } from "@/lib/sesion";

/**
 * Entrada a la cuenta: iniciar sesión, crearla, confirmar el correo y
 * recuperar la contraseña.
 *
 * Es la misma puerta para clientes, equipo y admins. No hay selector de «entrar
 * como»: lo que decide qué ve cada quien es el grupo de su cuenta, que viene en
 * el token y comprueba la API. A quien tiene permiso le aparece el panel en su
 * cuenta y en la cabecera en cuanto entra.
 */

type Paso =
  | { tipo: "entrar" }
  | { tipo: "registro" }
  | { tipo: "confirmar"; correo: string; contrasena?: string; aviso?: string }
  | { tipo: "recuperar" }
  | { tipo: "restablecer"; correo: string }
  | { tipo: "nueva"; reto: Reto };

const PISTA_CONTRASENA = "Al menos 10 caracteres, con minúsculas y números.";

export function InicioSesion({ sesion }: { sesion: Sesion }) {
  const [paso, setPaso] = useState<Paso>({ tipo: "entrar" });
  // El correo pasa de un paso a otro para no tener que escribirlo dos veces.
  const [correo, setCorreo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const ir = (p: Paso, mensaje: string | null = null) => {
    setAviso(mensaje);
    setPaso(p);
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      {aviso && (
        <p className="border-gold/40 bg-gold-muted text-fg mb-5 rounded-md border px-3 py-2 text-sm">
          {aviso}
        </p>
      )}
      {paso.tipo === "entrar" && (
        <Entrar sesion={sesion} correo={correo} setCorreo={setCorreo} ir={ir} />
      )}
      {paso.tipo === "registro" && (
        <Registro sesion={sesion} correo={correo} setCorreo={setCorreo} ir={ir} />
      )}
      {paso.tipo === "confirmar" && <Confirmar sesion={sesion} paso={paso} ir={ir} />}
      {paso.tipo === "recuperar" && (
        <Recuperar sesion={sesion} correo={correo} setCorreo={setCorreo} ir={ir} />
      )}
      {paso.tipo === "restablecer" && (
        <Restablecer sesion={sesion} correo={paso.correo} ir={ir} />
      )}
      {paso.tipo === "nueva" && <NuevaContrasena sesion={sesion} reto={paso.reto} />}
    </div>
  );
}

type Ir = (p: Paso, aviso?: string | null) => void;
type ConCorreo = {
  sesion: Sesion;
  correo: string;
  setCorreo: (c: string) => void;
  ir: Ir;
};

/* ── Piezas comunes ─────────────────────────────────────────────────────── */

function Titulo({ titulo, texto }: { titulo: string; texto: React.ReactNode }) {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{titulo}</h1>
      <p className="text-fg-muted mt-1 text-sm">{texto}</p>
    </>
  );
}

function Campo({
  id,
  etiqueta,
  pista,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; etiqueta: string; pista?: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} {...props} />
      {pista && <p className="text-fg-subtle text-xs">{pista}</p>}
    </div>
  );
}

function MensajeError({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {texto}
    </p>
  );
}

function Enlace({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-gold-light hover:text-gold inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
    >
      {children}
    </button>
  );
}

function Volver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-fg-subtle hover:text-fg-muted mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm"
    >
      <ArrowLeft size={15} aria-hidden />
      Volver a iniciar sesión
    </button>
  );
}

/** Estado de un formulario: enviando y el error de la última vez. */
function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enviar = async (fn: () => Promise<void>) => {
    setEnviando(true);
    setError(null);
    try {
      await fn();
    } finally {
      setEnviando(false);
    }
  };
  return { enviando, error, setError, enviar };
}

/* ── Pasos ──────────────────────────────────────────────────────────────── */

function Entrar({ sesion, correo, setCorreo, ir }: ConCorreo) {
  const [contrasena, setContrasena] = useState("");
  const { enviando, error, setError, enviar } = useEnvio();

  const alEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    enviar(async () => {
      const r = await sesion.entrar(correo, contrasena);
      if ("nuevaContrasena" in r) return ir({ tipo: "nueva", reto: r.nuevaContrasena });
      if (r.ok) return;
      if (r.sinConfirmar) {
        // Se registró y no llegó a poner el código: se le manda uno nuevo y se
        // le lleva directo a escribirlo.
        await sesion.reenviar(correo);
        return ir(
          { tipo: "confirmar", correo: correo.trim(), contrasena },
          "Te falta confirmar tu correo. Te enviamos un código nuevo.",
        );
      }
      setError(r.error);
      setContrasena("");
    });
  };

  return (
    <>
      <Titulo
        titulo="Inicia sesión"
        texto="Para ver tus pedidos, tus direcciones y tu nivel de cliente."
      />
      <form onSubmit={alEnviar} className="mt-6 grid gap-4">
        <Campo
          id="correo"
          etiqueta="Correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="tu@correo.com"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <div className="grid gap-1">
          <Campo
            id="contrasena"
            etiqueta="Contraseña"
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value);
              setError(null);
            }}
          />
          <div className="flex justify-end">
            <Enlace onClick={() => ir({ tipo: "recuperar" })}>
              ¿Olvidaste tu contraseña?
            </Enlace>
          </div>
        </div>
        <MensajeError texto={error} />
        <Button
          type="submit"
          variant="gold"
          size="touch"
          disabled={enviando || !correo.trim() || contrasena === ""}
          className="w-full"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className="border-border-soft mt-6 border-t pt-5 text-center">
        <p className="text-fg-muted text-sm">¿Primera vez aquí?</p>
        <Button
          type="button"
          variant="outline"
          size="touch"
          className="mt-2 w-full"
          onClick={() => ir({ tipo: "registro" })}
        >
          Crear cuenta
        </Button>
      </div>
    </>
  );
}

function Registro({ sesion, correo, setCorreo, ir }: ConCorreo) {
  const [nombre, setNombre] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [repetida, setRepetida] = useState("");
  const { enviando, error, setError, enviar } = useEnvio();

  const alEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (contrasena !== repetida) return setError("Las dos contraseñas no coinciden");
    enviar(async () => {
      const r = await sesion.crearCuenta(nombre, correo, contrasena);
      if (!r.ok) return setError(r.error);
      ir(
        { tipo: "confirmar", correo: correo.trim(), contrasena },
        `Te enviamos un código a ${correo.trim()}. Puede tardar un minuto; revisa también el correo no deseado.`,
      );
    });
  };

  return (
    <>
      <Volver onClick={() => ir({ tipo: "entrar" })} />
      <Titulo
        titulo="Crea tu cuenta"
        texto="Guarda tu carrito y tus direcciones, y sigue tus pedidos desde cualquier dispositivo."
      />
      <form onSubmit={alEnviar} className="mt-6 grid gap-4">
        <Campo
          id="nombre"
          etiqueta="Nombre"
          autoComplete="name"
          placeholder="Cómo te llamas"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Campo
          id="correo-registro"
          etiqueta="Correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <Campo
          id="contrasena-registro"
          etiqueta="Contraseña"
          type="password"
          autoComplete="new-password"
          pista={PISTA_CONTRASENA}
          value={contrasena}
          onChange={(e) => {
            setContrasena(e.target.value);
            setError(null);
          }}
        />
        <Campo
          id="repetida-registro"
          etiqueta="Repítela"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => {
            setRepetida(e.target.value);
            setError(null);
          }}
        />
        <MensajeError texto={error} />
        <Button
          type="submit"
          variant="gold"
          size="touch"
          disabled={
            enviando || !nombre.trim() || !correo.trim() || !contrasena || !repetida
          }
          className="w-full"
        >
          {enviando ? "Creando…" : "Crear cuenta"}
        </Button>
        <p className="text-fg-subtle text-xs">
          Al crearla aceptas los{" "}
          <a href="/terminos" className="underline underline-offset-2">
            términos
          </a>{" "}
          y el{" "}
          <a href="/privacidad" className="underline underline-offset-2">
            aviso de privacidad
          </a>
          .
        </p>
      </form>
    </>
  );
}

function Confirmar({
  sesion,
  paso,
  ir,
}: {
  sesion: Sesion;
  paso: Extract<Paso, { tipo: "confirmar" }>;
  ir: Ir;
}) {
  const [codigo, setCodigo] = useState("");
  const [reenviado, setReenviado] = useState(false);
  const { enviando, error, setError, enviar } = useEnvio();

  const alEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    enviar(async () => {
      const r = await sesion.confirmar(paso.correo, codigo, paso.contrasena);
      if (!r.ok) return setError(r.error);
      // Con perfil, la pantalla de cuenta ya se pinta sola. Sin él —se recargó
      // la página en medio y no hay contraseña a mano— toca entrar.
      if (!r.perfil) ir({ tipo: "entrar" }, "Correo confirmado. Ya puedes iniciar sesión.");
    });
  };

  const pedirOtro = () =>
    enviar(async () => {
      const r = await sesion.reenviar(paso.correo);
      if (!r.ok) return setError(r.error);
      setReenviado(true);
    });

  return (
    <>
      <Volver onClick={() => ir({ tipo: "entrar" })} />
      <Titulo
        titulo="Confirma tu correo"
        texto={
          <>
            Escribe el código que enviamos a <strong>{paso.correo}</strong>.
          </>
        }
      />
      <form onSubmit={alEnviar} className="mt-6 grid gap-4">
        <Campo
          id="codigo"
          etiqueta="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value.replace(/\D/g, ""));
            setError(null);
          }}
        />
        <MensajeError texto={error} />
        <Button
          type="submit"
          variant="gold"
          size="touch"
          disabled={enviando || codigo.length < 6}
          className="w-full"
        >
          {enviando ? "Confirmando…" : "Confirmar y entrar"}
        </Button>
      </form>
      <div className="mt-3">
        {reenviado ? (
          <p className="text-fg-muted text-sm">Listo, te mandamos otro código.</p>
        ) : (
          <Enlace onClick={pedirOtro}>¿No te llegó? Enviar otro código</Enlace>
        )}
      </div>
    </>
  );
}

function Recuperar({ sesion, correo, setCorreo, ir }: ConCorreo) {
  const { enviando, error, setError, enviar } = useEnvio();

  const alEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    enviar(async () => {
      const r = await sesion.recuperar(correo);
      if (!r.ok) return setError(r.error);
      // El mensaje no dice si la cuenta existe: se responde igual en ambos
      // casos para no confirmarle a nadie qué correos están registrados.
      ir(
        { tipo: "restablecer", correo: correo.trim() },
        `Si hay una cuenta con ${correo.trim()}, te llegará un código en un minuto.`,
      );
    });
  };

  return (
    <>
      <Volver onClick={() => ir({ tipo: "entrar" })} />
      <Titulo
        titulo="Recupera tu contraseña"
        texto="Te enviamos un código a tu correo para que elijas una nueva."
      />
      <form onSubmit={alEnviar} className="mt-6 grid gap-4">
        <Campo
          id="correo-recuperar"
          etiqueta="Correo"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="tu@correo.com"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <MensajeError texto={error} />
        <Button
          type="submit"
          variant="gold"
          size="touch"
          disabled={enviando || !correo.trim()}
          className="w-full"
        >
          {enviando ? "Enviando…" : "Enviar código"}
        </Button>
      </form>
    </>
  );
}

function Restablecer({ sesion, correo, ir }: { sesion: Sesion; correo: string; ir: Ir }) {
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const { enviando, error, setError, enviar } = useEnvio();

  const alEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva !== repetida) return setError("Las dos contraseñas no coinciden");
    enviar(async () => {
      const r = await sesion.restablecer(correo, codigo, nueva);
      if (!r.ok) return setError(r.error);
      if (!r.perfil) ir({ tipo: "entrar" }, "Contraseña cambiada. Ya puedes iniciar sesión.");
    });
  };

  return (
    <>
      <Volver onClick={() => ir({ tipo: "entrar" })} />
      <Titulo
        titulo="Elige una contraseña nueva"
        texto={
          <>
            Escribe el código que enviamos a <strong>{correo}</strong>.
          </>
        }
      />
      <form onSubmit={alEnviar} className="mt-6 grid gap-4">
        <Campo
          id="codigo-restablecer"
          etiqueta="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value.replace(/\D/g, ""));
            setError(null);
          }}
        />
        <Campo
          id="nueva-restablecer"
          etiqueta="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          pista={PISTA_CONTRASENA}
          value={nueva}
          onChange={(e) => {
            setNueva(e.target.value);
            setError(null);
          }}
        />
        <Campo
          id="repetida-restablecer"
          etiqueta="Repítela"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />
        <MensajeError texto={error} />
        <Button
          type="submit"
          variant="gold"
          size="touch"
          disabled={enviando || codigo.length < 6 || !nueva || !repetida}
          className="w-full"
        >
          {enviando ? "Guardando…" : "Guardar y entrar"}
        </Button>
      </form>
    </>
  );
}

/** Cuenta creada por un administrador: la contraseña temporal solo vale una vez. */
function NuevaContrasena({ sesion, reto }: { sesion: Sesion; reto: Reto }) {
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const { enviando, error, setError, enviar } = useEnvio();

  const alEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva !== repetida) return setError("Las dos contraseñas no coinciden");
    enviar(async () => {
      const r = await sesion.cambiarContrasena(reto, nueva);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <>
      <Titulo
        titulo="Elige tu contraseña"
        texto={
          <>
            Es la primera vez que entras con <strong>{reto.correo}</strong>. La que te
            dieron era temporal.
          </>
        }
      />
      <form onSubmit={alEnviar} className="mt-6 grid gap-4">
        <Campo
          id="nueva"
          etiqueta="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          pista={PISTA_CONTRASENA}
          value={nueva}
          onChange={(e) => {
            setNueva(e.target.value);
            setError(null);
          }}
        />
        <Campo
          id="repetida"
          etiqueta="Repítela"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />
        <MensajeError texto={error} />
        <Button
          type="submit"
          variant="gold"
          size="touch"
          disabled={enviando || nueva === "" || repetida === ""}
          className="w-full"
        >
          {enviando ? "Guardando…" : "Guardar y entrar"}
        </Button>
      </form>
    </>
  );
}
