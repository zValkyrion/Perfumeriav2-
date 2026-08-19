"use client";

import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { Boton, Campo, Tarjeta } from "@/components/ui";
import { descargar, sincronizar } from "@/lib/sync";
import type { Sesion } from "@/lib/sesion";

/** Texto único para las dos rutas: la automática y el botón. */
function resumen(
  fichas: number,
  fotos: number,
  bajadas: number,
  borradas: number,
): string {
  const partes = [
    fichas > 0 ? `${fichas} ficha${fichas === 1 ? "" : "s"} subida${fichas === 1 ? "" : "s"}` : null,
    fotos > 0 ? `${fotos} foto${fotos === 1 ? "" : "s"}` : null,
    bajadas > 0 ? `${bajadas} traída${bajadas === 1 ? "" : "s"} del servidor` : null,
    borradas > 0
      ? `${borradas} borrada${borradas === 1 ? "" : "s"} por otro equipo`
      : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Todo estaba al día";
}

/**
 * El estado de la sincronización, en una sola franja.
 *
 * Muestra lo que falta por subir y lo sube. Si el teléfono entró sin señal y no
 * tiene token, pide el código aquí mismo en vez de mandar a nadie a cerrar
 * sesión: lo capturado no se toca y se sube en cuanto valida.
 */
export function BarraSync({
  sesion,
  pendientes,
  alTerminar,
}: {
  sesion: Sesion;
  pendientes: number;
  alTerminar: () => void;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [fallos, setFallos] = useState<string[]>([]);
  const [pin, setPin] = useState("");
  const [errorPin, setErrorPin] = useState<string | null>(null);
  const yaCorrio = useRef(false);
  /**
   * `alTerminar` llega como función nueva en cada render del padre. Si el efecto
   * de abajo dependiera de ella, se limpiaría a media sincronización y tiraría el
   * resultado ya descargado: las fichas llegaban al teléfono pero la lista seguía
   * mostrándose vacía. Guardada en una ref, el efecto depende solo del token.
   */
  const avisar = useRef(alTerminar);
  avisar.current = alTerminar;

  /**
   * Al abrir la app se sincroniza sola.
   *
   * Sin esto, cada teléfono solo veía lo suyo: las fichas de los compañeros
   * estaban en el servidor, pero no bajaban hasta que alguien se acordaba de
   * pulsar el botón. Mientras no haya roles, todos ven lo de todos — y eso tiene
   * que pasar solo, no por disciplina de nadie.
   *
   * Corre una vez por montaje; si no hay red, falla en silencio y la barra sigue
   * mostrando lo que queda pendiente.
   */
  useEffect(() => {
    if (!sesion.token || yaCorrio.current) return;
    yaCorrio.current = true;

    (async () => {
      try {
        const r = await sincronizar(sesion.token!);
        const d = await descargar(sesion.token!);
        // La lista se refresca siempre, pase lo que pase. Condicionarlo a que
        // "algo haya cambiado" ya falló dos veces: la primera con las descargas y
        // la segunda con los borrados, que no entraban en la cuenta. Releer de
        // IndexedDB es barato; enumerar todos los casos posibles, no.
        avisar.current();
        if (r.fichas > 0 || r.fotos > 0 || d.traidos > 0 || d.borrados > 0) {
          setMensaje(resumen(r.fichas, r.fotos, d.traidos, d.borrados));
        }
      } catch {
        // Sin red al abrir es lo normal en la calle: no es un error que reportar.
      }
    })();
  }, [sesion.token]);

  const subir = async () => {
    if (!sesion.token) return;
    setTrabajando(true);
    setMensaje(null);
    setFallos([]);
    try {
      const r = await sincronizar(sesion.token);
      const d = await descargar(sesion.token);
      setMensaje(resumen(r.fichas, r.fotos, d.traidos, d.borrados));
      setFallos(r.fallos);
      alTerminar();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Falló la sincronización");
    } finally {
      setTrabajando(false);
    }
  };

  const conectar = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrabajando(true);
    setErrorPin(null);
    const r = await sesion.conectar(pin);
    if (!r.ok) setErrorPin(r.error ?? "No se pudo conectar");
    else setPin("");
    setTrabajando(false);
  };

  // Entró sin red: hay que validar el código antes de poder subir nada.
  if (sesion.soloLocal) {
    return (
      <Tarjeta className="mb-3">
        <p className="flex items-start gap-2 text-[13px] text-fg-muted">
          <CloudOff size={16} className="mt-0.5 shrink-0 text-warning" />
          Estás trabajando sin conexión al servidor. Escribe el código del equipo para
          poder subir {pendientes > 0 ? `las ${pendientes} fichas pendientes` : "lo que captures"}.
        </p>
        <form onSubmit={conectar} className="mt-2 flex items-end gap-2">
          <Campo
            etiqueta="Código"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="••••••••"
            className="flex-1"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          <Boton type="submit" disabled={trabajando || pin.trim() === ""}>
            Conectar
          </Boton>
        </form>
        {errorPin && <p className="mt-1 text-[13px] text-danger">{errorPin}</p>}
      </Tarjeta>
    );
  }

  // La barra se queda visible aunque no haya nada pendiente: sincronizar también
  // sirve para *traer* fichas, y un teléfono recién estrenado —o el de alguien
  // que perdió el suyo— empieza justamente con cero pendientes. Ocultarla ahí
  // dejaba la recuperación sin ninguna puerta de entrada.

  return (
    <div className="mb-3 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] text-fg-muted">
          {pendientes > 0 ? (
            <>
              <strong className="text-fg">{pendientes}</strong>{" "}
              {pendientes === 1 ? "ficha sin subir" : "fichas sin subir"}
            </>
          ) : (
            (mensaje ?? "Todo al día")
          )}
        </span>
        <Boton
          variante="secundario"
          onClick={subir}
          disabled={trabajando}
          className="px-3 py-0"
        >
          <RefreshCw size={16} className={trabajando ? "animate-spin" : undefined} />
          {trabajando ? "Subiendo…" : "Sincronizar"}
        </Boton>
      </div>

      {pendientes > 0 && mensaje && (
        <p className="mt-1 text-[13px] text-fg-subtle">{mensaje}</p>
      )}

      {fallos.length > 0 && (
        <ul className="mt-1 grid gap-0.5 text-[13px] text-danger">
          {fallos.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
