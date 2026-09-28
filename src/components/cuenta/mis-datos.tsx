"use client";

import { useState } from "react";
import { KeyRound, LogOut, Mail, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { borrarDatosRemotos, haySincronizacion } from "@/lib/cuenta-remota";
import type { Perfil, Sesion } from "@/lib/sesion";
import { cn } from "@/lib/utils";

/**
 * «Mis datos» con sesión real: todo lo de la cuenta se maneja desde aquí.
 *
 * Cada bloque guarda por su cuenta. Un formulario único con nombre, correo y
 * contraseña obligaba a reescribir la contraseña para cambiar el teléfono, y
 * un error en un campo bloqueaba los demás.
 */
export function MisDatosCuenta({
  sesion,
  perfil,
  piezas,
}: {
  sesion: Sesion;
  perfil: Perfil;
  /** Piezas de pedidos vendidos; `null` mientras no se sabe (sin red o cargando). */
  piezas: number | null;
}) {
  return (
    <div className="grid max-w-2xl gap-4">
      <DatosPersonales sesion={sesion} perfil={perfil} piezas={piezas} />
      <Correo sesion={sesion} perfil={perfil} />
      <Contrasena sesion={sesion} />
      <Sesiones sesion={sesion} />
      <Eliminar sesion={sesion} />
    </div>
  );
}

/* ── Piezas comunes ─────────────────────────────────────────────────────── */

function Bloque({
  titulo,
  icono: Icono,
  peligro,
  children,
}: {
  titulo: string;
  icono: typeof User;
  peligro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "bg-surface rounded-lg border p-4 lg:p-5",
        peligro ? "border-danger/30" : "border-border-soft",
      )}
    >
      <h2 className="mb-3 flex items-center gap-2 font-medium">
        <Icono
          size={17}
          className={peligro ? "text-danger" : "text-gold-light"}
          aria-hidden
        />
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campo({
  id,
  etiqueta,
  pista,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; etiqueta: string; pista?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {etiqueta}
      </Label>
      <Input id={id} className="h-11" {...props} />
      {pista && <p className="text-fg-subtle text-xs">{pista}</p>}
    </div>
  );
}

/** Error o confirmación de la última acción del bloque. */
function Estado({ estado }: { estado: { ok: boolean; texto: string } | null }) {
  if (!estado) return null;
  return (
    <p
      role={estado.ok ? "status" : "alert"}
      className={cn("text-sm", estado.ok ? "text-success" : "text-destructive")}
    >
      {estado.texto}
    </p>
  );
}

function useAccion() {
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const correr = async (
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    exito: string,
    alTerminar?: () => void,
  ) => {
    setEnviando(true);
    setEstado(null);
    const r = await fn();
    setEnviando(false);
    if (r.ok) {
      setEstado({ ok: true, texto: exito });
      alTerminar?.();
    } else setEstado({ ok: false, texto: r.error });
  };
  return { enviando, estado, setEstado, correr };
}

const PISTA_CONTRASENA = "Al menos 10 caracteres, con minúsculas y números.";

/* ── Bloques ────────────────────────────────────────────────────────────── */

function DatosPersonales({
  sesion,
  perfil,
  piezas,
}: {
  sesion: Sesion;
  perfil: Perfil;
  piezas: number | null;
}) {
  const [nombre, setNombre] = useState(perfil.nombre);
  const [telefono, setTelefono] = useState(perfil.telefono);
  const { enviando, estado, setEstado, correr } = useAccion();
  const sinCambios = nombre.trim() === perfil.nombre && telefono === perfil.telefono;

  return (
    <Bloque titulo="Datos personales" icono={User}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => sesion.actualizarPerfil({ nombre, telefono }), "Datos guardados.");
        }}
        className="grid gap-3"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            id="perfil-nombre"
            etiqueta="Nombre"
            autoComplete="name"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setEstado(null);
            }}
          />
          <Campo
            id="perfil-telefono"
            etiqueta="WhatsApp"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="477 123 4567"
            pista="10 dígitos. Para avisarte de tus pedidos."
            value={telefono}
            onChange={(e) => {
              setTelefono(e.target.value.replace(/\D/g, "").slice(0, 10));
              setEstado(null);
            }}
          />
        </div>
        {/* Sin la lista de pedidos no se sabe la cifra: se calla en vez de
            decir «0», que parecería que se le borraron las compras. */}
        {piezas !== null ? (
          <p className="text-fg-muted text-sm">
            Piezas compradas y pagadas: <strong className="text-fg">{piezas}</strong>
          </p>
        ) : null}
        <Estado estado={estado} />
        <div>
          <Button
            type="submit"
            variant="gold"
            size="touch"
            disabled={enviando || sinCambios || !nombre.trim()}
          >
            {enviando ? "Guardando…" : "Guardar datos"}
          </Button>
        </div>
      </form>
    </Bloque>
  );
}

function Correo({ sesion, perfil }: { sesion: Sesion; perfil: Perfil }) {
  // `null`: mostrando el correo. `""`/texto: escribiendo el nuevo. Con
  // `pendiente`, ya se pidió y falta el código.
  const [nuevo, setNuevo] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const { enviando, estado, setEstado, correr } = useAccion();

  if (pendiente) {
    return (
      <Bloque titulo="Correo" icono={Mail}>
        <p className="text-fg-muted mb-3 text-sm">
          Escribe el código que enviamos a <strong className="text-fg">{pendiente}</strong>.
          Hasta confirmarlo, sigues entrando con {perfil.correo}.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            correr(
              () => sesion.confirmarCorreo(codigo),
              "Correo cambiado. Desde ahora entras con el nuevo.",
              () => {
                setPendiente(null);
                setNuevo(null);
                setCodigo("");
              },
            );
          }}
          className="grid gap-3"
        >
          <Campo
            id="correo-codigo"
            etiqueta="Código"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value.replace(/\D/g, ""));
              setEstado(null);
            }}
          />
          <Estado estado={estado} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="gold"
              size="touch"
              disabled={enviando || codigo.length < 6}
            >
              {enviando ? "Confirmando…" : "Confirmar correo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              disabled={enviando}
              onClick={() =>
                correr(() => sesion.reenviarCodigoDeCorreo(), "Te mandamos otro código.")
              }
            >
              Enviar otro código
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="touch"
              onClick={() => {
                setPendiente(null);
                setNuevo(null);
                setEstado(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Bloque>
    );
  }

  return (
    <Bloque titulo="Correo" icono={Mail}>
      {nuevo === null ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{perfil.correo}</p>
            <Button
              variant="outline"
              size="touch"
              onClick={() => {
                setNuevo("");
                setEstado(null);
              }}
            >
              Cambiar correo
            </Button>
          </div>
          <Estado estado={estado} />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const destino = nuevo.trim();
            if (destino.toLowerCase() === perfil.correo.toLowerCase()) {
              return setEstado({ ok: false, texto: "Ese ya es tu correo" });
            }
            correr(
              () => sesion.cambiarCorreo(destino),
              "",
              () => {
                setEstado(null);
                setPendiente(destino);
              },
            );
          }}
          className="grid gap-3"
        >
          <Campo
            id="correo-nuevo"
            etiqueta="Correo nuevo"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@correo.com"
            value={nuevo}
            onChange={(e) => {
              setNuevo(e.target.value);
              setEstado(null);
            }}
          />
          <Estado estado={estado} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="gold"
              size="touch"
              disabled={enviando || !nuevo.trim()}
            >
              {enviando ? "Enviando…" : "Enviar código"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="touch"
              onClick={() => {
                setNuevo(null);
                setEstado(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Bloque>
  );
}

function Contrasena({ sesion }: { sesion: Sesion }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const { enviando, estado, setEstado, correr } = useAccion();

  return (
    <Bloque titulo="Contraseña" icono={KeyRound}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (nueva !== repetida) {
            return setEstado({ ok: false, texto: "Las dos contraseñas nuevas no coinciden" });
          }
          correr(
            () => sesion.cambiarMiContrasena(actual, nueva),
            "Contraseña cambiada.",
            () => {
              setActual("");
              setNueva("");
              setRepetida("");
            },
          );
        }}
        className="grid gap-3"
      >
        {/* Para que el gestor de contraseñas sepa de qué cuenta es. */}
        <input type="text" autoComplete="username" hidden readOnly />
        <Campo
          id="contrasena-actual"
          etiqueta="Contraseña actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => {
            setActual(e.target.value);
            setEstado(null);
          }}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            id="contrasena-nueva"
            etiqueta="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            pista={PISTA_CONTRASENA}
            value={nueva}
            onChange={(e) => {
              setNueva(e.target.value);
              setEstado(null);
            }}
          />
          <Campo
            id="contrasena-repetida"
            etiqueta="Repítela"
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => {
              setRepetida(e.target.value);
              setEstado(null);
            }}
          />
        </div>
        <Estado estado={estado} />
        <div>
          <Button
            type="submit"
            variant="gold"
            size="touch"
            disabled={enviando || !actual || !nueva || !repetida}
          >
            {enviando ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </div>
      </form>
    </Bloque>
  );
}

function Sesiones({ sesion }: { sesion: Sesion }) {
  const { enviando, estado, correr } = useAccion();
  return (
    <Bloque titulo="Sesiones" icono={LogOut}>
      <p className="text-fg-muted mb-3 text-sm">
        ¿Entraste desde un equipo que no es tuyo o perdiste el teléfono? Esto cierra
        tu sesión en todos lados, incluido aquí.
      </p>
      <Estado estado={estado} />
      <Button
        variant="outline"
        size="touch"
        disabled={enviando}
        onClick={() => {
          if (confirm("¿Cerrar tu sesión en todos los dispositivos?")) {
            correr(() => sesion.salirDeTodos(), "Sesiones cerradas.");
          }
        }}
      >
        {enviando ? "Cerrando…" : "Cerrar sesión en todos los dispositivos"}
      </Button>
    </Bloque>
  );
}

function Eliminar({ sesion }: { sesion: Sesion }) {
  const [abierto, setAbierto] = useState(false);
  const [contrasena, setContrasena] = useState("");
  const { enviando, estado, setEstado, correr } = useAccion();

  return (
    <Bloque titulo="Eliminar cuenta" icono={Trash2} peligro>
      <p className="text-fg-muted mb-3 text-sm">
        Se borran tu cuenta, tu carrito guardado, tus direcciones y tu historial de
        pedidos. Los pedidos que ya hiciste siguen en camino. No se puede deshacer.
      </p>
      {!abierto ? (
        <Button variant="outline" size="touch" onClick={() => setAbierto(true)}>
          Quiero eliminar mi cuenta
        </Button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            correr(
              () =>
                sesion.eliminarMiCuenta(
                  contrasena,
                  haySincronizacion() ? borrarDatosRemotos : undefined,
                ),
              "Tu cuenta fue eliminada.",
            );
          }}
          className="grid gap-3"
        >
          <input type="text" autoComplete="username" hidden readOnly />
          <Campo
            id="eliminar-contrasena"
            etiqueta="Escribe tu contraseña para confirmar"
            type="password"
            autoComplete="current-password"
            value={contrasena}
            onChange={(e) => {
              setContrasena(e.target.value);
              setEstado(null);
            }}
          />
          <Estado estado={estado} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="destructive"
              size="touch"
              disabled={enviando || !contrasena}
            >
              {enviando ? "Eliminando…" : "Eliminar mi cuenta para siempre"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="touch"
              onClick={() => {
                setAbierto(false);
                setContrasena("");
                setEstado(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Bloque>
  );
}
