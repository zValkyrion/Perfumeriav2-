"use client";

import { useState } from "react";
import { LayoutDashboard, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { puedeVerPanel, type Perfil, type Sesion } from "@/lib/sesion";
import { cn } from "@/lib/utils";

type Destino = "tienda" | "panel";

/** Marca de un intento de entrar al panel sin permiso. La lee la cuenta. */
export const AVISO_SIN_PANEL = "elrey:sin_panel";

/**
 * Inicio de sesión de la tienda.
 *
 * El selector de arriba **no es un permiso**: solo dice a dónde ir después de
 * entrar. Quien elige «Equipo» y no tiene el grupo no consigue nada más que un
 * aviso — el permiso vive en el token que firma Cognito y lo comprueba la API,
 * no en un botón del navegador.
 *
 * Está en «Cliente» por defecto y en tamaño pequeño porque la inmensa mayoría de
 * quien entra aquí viene a comprar; el acceso del equipo es la excepción y no
 * tiene por qué ocupar la mitad de la pantalla.
 */
export function InicioSesion({ sesion }: { sesion: Sesion }) {
  const [destino, setDestino] = useState<Destino>("tienda");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reto, setReto] = useState<{ sesion: string; correo: string } | null>(null);

  /** Tras entrar: al panel si lo pidió y su cuenta lo permite. */
  const seguir = (perfil: Perfil) => {
    if (destino !== "panel") return;
    if (puedeVerPanel(perfil)) {
      window.location.href = "/radar/";
      return;
    }
    // Iniciar sesión funciona igual: lo que no hay es permiso para el panel.
    // El aviso viaja en `sessionStorage` porque esta pantalla desaparece en
    // cuanto hay sesión, y con ella se iría el mensaje: el usuario pidió el
    // panel, acabó en la tienda y nadie le dijo por qué.
    sessionStorage.setItem(AVISO_SIN_PANEL, "si");
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const r = await sesion.entrar(correo, contrasena);
    if ("nuevaContrasena" in r) setReto(r.nuevaContrasena);
    else if (!r.ok) {
      setError(r.error);
      setContrasena("");
    } else seguir(r.perfil);

    setEnviando(false);
  };

  if (reto) {
    return <NuevaContrasena sesion={sesion} reto={reto} alEntrar={seguir} />;
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Inicia sesión
      </h1>
      <p className="text-fg-muted mt-1 text-sm">
        Para ver tus pedidos, tus direcciones y tu nivel de cliente.
      </p>

      <form onSubmit={enviar} className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="correo">Correo</Label>
          <Input
            id="correo"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="tu@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contrasena">Contraseña</Label>
          <Input
            id="contrasena"
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value);
              setError(null);
            }}
          />
        </div>

        <SelectorDestino valor={destino} onChange={setDestino} />

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button
          type="submit"
          disabled={enviando || !correo.trim() || contrasena === ""}
          className="w-full"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="text-fg-subtle mt-4 text-xs">
        ¿Aún no tienes cuenta? Escríbenos por WhatsApp y te damos de alta.
      </p>
    </div>
  );
}

/**
 * El selector, deliberadamente pequeño.
 *
 * Dos pastillas de 11px bajo los campos: quien viene a comprar ni lo mira, y
 * quien es del equipo lo encuentra sin que nadie se lo explique.
 */
function SelectorDestino({
  valor,
  onChange,
}: {
  valor: Destino;
  onChange: (d: Destino) => void;
}) {
  const opciones: { valor: Destino; texto: string; icono: typeof ShoppingBag }[] = [
    { valor: "tienda", texto: "Cliente", icono: ShoppingBag },
    { valor: "panel", texto: "Equipo", icono: LayoutDashboard },
  ];

  return (
    <div role="radiogroup" aria-label="Después de entrar, ir a">
      <span className="text-fg-subtle text-[11px]">Entrar como</span>
      <div className="mt-1 flex gap-1">
        {opciones.map((o) => {
          const activo = valor === o.valor;
          const Icono = o.icono;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange(o.valor)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                activo
                  ? "border-gold text-gold bg-gold-muted"
                  : "border-border text-fg-subtle hover:text-fg-muted",
              )}
            >
              <Icono size={12} aria-hidden />
              {o.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Cuenta recién creada por un administrador: la temporal solo vale una vez. */
function NuevaContrasena({
  sesion,
  reto,
  alEntrar,
}: {
  sesion: Sesion;
  reto: { sesion: string; correo: string };
  alEntrar: (p: Perfil) => void;
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
    else if (r.perfil) alEntrar(r.perfil);
    setEnviando(false);
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Elige tu contraseña
      </h1>
      <p className="text-fg-muted mt-1 text-sm">
        Es la primera vez que entras con <strong>{reto.correo}</strong>. La que te
        dieron era temporal.
      </p>

      <form onSubmit={enviar} className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="nueva">Nueva contraseña</Label>
          <Input
            id="nueva"
            type="password"
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => {
              setNueva(e.target.value);
              setError(null);
            }}
          />
          <p className="text-fg-subtle text-xs">
            Al menos 10 caracteres, con minúsculas y números.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="repetida">Repítela</Label>
          <Input
            id="repetida"
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button
          type="submit"
          disabled={enviando || nueva === "" || repetida === ""}
          className="w-full"
        >
          {enviando ? "Guardando…" : "Guardar y entrar"}
        </Button>
      </form>
    </div>
  );
}
