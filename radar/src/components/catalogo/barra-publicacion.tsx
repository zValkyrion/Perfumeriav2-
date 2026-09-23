"use client";

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Rocket } from "lucide-react";
import { Boton } from "@/components/ui";
import {
  estadoPublicacion,
  publicar,
  type EstadoPublicacion,
} from "@/lib/catalogo-admin";
import { fechaCorta } from "@/lib/utils";

/**
 * ¿La tienda ya enseña lo que se guardó?
 *
 * Lo que se vende y a cuánto llega a la tienda en un minuto sin publicar nada:
 * un agotado ya no se puede comprar, un precio ya se cobra. Ocultar, un
 * perfume nuevo, un texto o una foto necesitan que la tienda se vuelva a
 * compilar: eso es «publicar», y tarda unos minutos.
 * Con el token de GitHub configurado se hace solo diez minutos después del
 * último cambio, o al momento con el botón.
 */
export function BarraPublicacion({
  token,
  inicial,
}: {
  token: string;
  inicial: EstadoPublicacion;
}) {
  const [estado, setEstado] = useState(inicial);
  // Un guardado en la lista cambia `inicial` (queda algo pendiente): se
  // adopta en el mismo render, sin esperar a un efecto.
  const [recibido, setRecibido] = useState(inicial);
  if (inicial !== recibido) {
    setRecibido(inicial);
    setEstado(inicial);
  }
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enMarcha = estado.corrida !== null && estado.corrida.estado !== "terminada";

  // Mientras hay un despliegue en marcha se vuelve a mirar cada 20 s: así el
  // «publicando» se convierte en «al día» sin que nadie recargue.
  useEffect(() => {
    if (!enMarcha) return;
    const t = setInterval(async () => {
      try {
        setEstado(await estadoPublicacion(token));
      } catch {
        // Sin red se deja lo último que se supo.
      }
    }, 20_000);
    return () => clearInterval(t);
  }, [enMarcha, token]);

  const pedir = async () => {
    setPidiendo(true);
    setError(null);
    try {
      setEstado(await publicar(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo pedir la publicación");
    } finally {
      setPidiendo(false);
    }
  };

  // Solo importa si dejó cambios sin publicar: un despliegue que falló en las
  // pruebas de después ya había dejado la tienda al día.
  const fallo = estado.corrida?.resultado === "fallo" && estado.pendiente;

  let icono = <CircleCheck size={20} className="text-success" />;
  let titulo = "La tienda está al día";
  let detalle = estado.publicadoEn
    ? `Publicada el ${fechaCorta(estado.publicadoEn)}.`
    : "Todo lo guardado ya se ve en la tienda.";

  if (enMarcha) {
    icono = <LoaderCircle size={20} className="animate-spin text-info" />;
    titulo = "Publicando…";
    detalle = "La tienda se está compilando con los cambios. Tarda unos minutos.";
  } else if (fallo) {
    icono = <CircleAlert size={20} className="text-danger" />;
    titulo = "La última publicación falló";
    detalle = "Los cambios siguen guardados. Revisa el despliegue o vuelve a intentarlo.";
  } else if (estado.pendiente) {
    icono = <CircleAlert size={20} className="text-warning" />;
    titulo = "Hay cambios sin publicar";
    detalle = estado.automatica
      ? "Agotados y precios ya cuentan en la tienda. Lo demás se publica solo 10 minutos después del último cambio, o ahora con el botón."
      : "Agotados y precios ya cuentan en la tienda. Lo demás (ocultar, fotos, textos, perfumes nuevos) sale con el siguiente despliegue.";
  }

  return (
    <div className="rounded-[var(--radius)] border border-border-soft bg-surface p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icono}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{titulo}</p>
          <p className="text-[13px] text-fg-muted">{detalle}</p>
          {estado.corrida && (enMarcha || fallo) && (
            <a
              href={estado.corrida.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[13px] font-medium text-info underline"
            >
              Ver el despliegue en GitHub
            </a>
          )}
          {error && <p className="mt-1 text-[13px] font-medium text-danger">{error}</p>}
        </div>
        {estado.automatica && (estado.pendiente || fallo) && !enMarcha && (
          <Boton onClick={pedir} disabled={pidiendo} className="shrink-0 px-3 text-[14px]">
            <Rocket size={17} />
            {pidiendo ? "Pidiendo…" : "Publicar"}
          </Boton>
        )}
      </div>
    </div>
  );
}
