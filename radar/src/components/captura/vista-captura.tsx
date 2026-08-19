"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { PasoEvaluacion } from "@/components/captura/paso-evaluacion";
import { PasoFotos } from "@/components/captura/paso-fotos";
import { PasoIdentidad } from "@/components/captura/paso-identidad";
import { Boton } from "@/components/ui";
import { guardarProveedor, leerProveedor } from "@/lib/almacen";
import { analizar, completitud } from "@/lib/analisis";
import { useSesion } from "@/lib/sesion";
import { sincronizarDeFondo } from "@/lib/sync";
import { proveedorNuevo, type Proveedor } from "@/lib/tipos";

const PASOS = ["Quién y dónde", "Fotos", "Evaluación"];

export function VistaCaptura() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { evaluador, token, listo: sesionLista } = useSesion();

  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga (o crea) la ficha. Un id inexistente — enlace viejo, ficha borrada —
  // no puede dejar la pantalla en blanco: se abre una nueva.
  useEffect(() => {
    if (!sesionLista) return;
    let cancelado = false;
    const cargar = async () => {
      if (id) {
        const guardado = await leerProveedor(id);
        if (!cancelado && guardado) {
          setProveedor(guardado);
          return;
        }
      }
      if (!cancelado) setProveedor(proveedorNuevo(evaluador ?? "sin identificar"));
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [id, evaluador, sesionLista]);

  /**
   * Autoguardado con 500 ms de espera. No hay botón de "guardar" en ningún paso:
   * en la calle la ficha se pierde por una llamada entrante o por batería, no
   * por olvidar tocar un botón.
   */
  const actualizar = useCallback((cambios: Partial<Proveedor>) => {
    setProveedor((actual) => {
      if (!actual) return actual;
      const siguiente = { ...actual, ...cambios };
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        setGuardando(true);
        guardarProveedor(siguiente).finally(() => setGuardando(false));
      }, 500);
      return siguiente;
    });
  }, []);

  // Un cambio pendiente en el temporizador se perdería al salir de la pantalla.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  const salir = async () => {
    if (!proveedor) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    await guardarProveedor({
      ...proveedor,
      estado: proveedor.estado === "sincronizado" ? "sincronizado" : "pendiente",
    });
    // Al dar Listo, la ficha se va al servidor sin que nadie tenga que acordarse
    // de pulsar Sincronizar. Arranca aquí y sigue en segundo plano: esperar a que
    // terminen de subir las fotos dejaría al capturista mirando una pantalla
    // congelada en plena calle.
    sincronizarDeFondo(token);

    // A la ficha, no a la lista: al cerrar el formulario lo natural es querer ver
    // cómo quedó lo que acabas de capturar.
    router.push(`/ficha/?id=${proveedor.id}`);
  };

  if (!proveedor) return <p className="p-5 text-[14px] text-fg-subtle">Abriendo…</p>;

  const avance = completitud(proveedor);

  return (
    <main className="p-4 pb-28">
      <header className="mb-3 flex items-center gap-2">
        <Boton variante="secundario" onClick={salir} className="px-3" aria-label="Volver">
          <ArrowLeft size={20} />
        </Boton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">
            {proveedor.nombre || "Proveedor sin nombre"}
          </p>
          <p className="text-[12px] text-fg-subtle">
            {guardando ? "Guardando…" : `Guardado · ${avance}% completo`}
          </p>
        </div>
        <span className="text-[13px] font-bold tabular-nums text-gold">
          {analizar(proveedor).score ?? "—"}
        </span>
      </header>

      <nav className="mb-4 flex gap-1.5" aria-label="Pasos">
        {PASOS.map((nombre, i) => (
          <button
            key={nombre}
            type="button"
            onClick={() => setPaso(i)}
            aria-current={paso === i}
            className={`h-11 flex-1 rounded-lg border text-[13px] font-medium ${
              paso === i
                ? "border-gold-deep bg-gold-gradient text-white"
                : "border-border-strong bg-surface text-fg-muted"
            }`}
          >
            {nombre}
          </button>
        ))}
      </nav>

      {paso === 0 && <PasoIdentidad proveedor={proveedor} actualizar={actualizar} />}
      {paso === 1 && <PasoFotos proveedor={proveedor} />}
      {paso === 2 && <PasoEvaluacion proveedor={proveedor} actualizar={actualizar} />}

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-2xl gap-2 border-t border-border-strong bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {paso > 0 && (
          <Boton variante="secundario" onClick={() => setPaso(paso - 1)} className="flex-1">
            Atrás
          </Boton>
        )}
        {paso < PASOS.length - 1 ? (
          <Boton onClick={() => setPaso(paso + 1)} className="flex-[2]">
            Siguiente
          </Boton>
        ) : (
          <Boton onClick={salir} className="flex-[2]">
            <Check size={20} />
            Listo
          </Boton>
        )}
      </div>
    </main>
  );
}
