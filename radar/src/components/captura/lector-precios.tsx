"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { PRESENTACIONES } from "@/data/catalogo";
import { Boton, Tarjeta } from "@/components/ui";
import { fotosDe, guardarFoto } from "@/lib/almacen";
import { leerPrecios, subirFoto, urlDeSubida, type FilaLeida } from "@/lib/api";
import type { Foto, Presentacion, Proveedor } from "@/lib/tipos";

/**
 * Lee la lista de precios desde la foto y deja asignar cada renglón.
 *
 * Es el mayor ahorro de tiempo de la app: fotografiar la hoja del mostrador en
 * lugar de teclear veinte renglones de pie en la calle.
 *
 * **La máquina propone y la persona asigna.** Una lista de mostrador tiene
 * tachones, columnas torcidas y abreviaturas que solo entiende quien las
 * escribió; rellenar los precios sin que nadie los mire metería datos falsos en
 * la comparación de proveedores, que es exactamente lo que esta herramienta
 * existe para evitar.
 */
export function LectorPrecios({
  proveedor,
  token,
  onPrecio,
}: {
  proveedor: Proveedor;
  token: string | null;
  onPrecio: (presentacion: Presentacion, precio: number) => void;
}) {
  const [foto, setFoto] = useState<Foto | null>(null);
  const [filas, setFilas] = useState<FilaLeida[] | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fotosDe(proveedor.id).then((todas) => {
      setFoto(todas.find((f) => f.tipo === "lista_precios") ?? null);
    });
  }, [proveedor.id]);

  // Sin foto de la lista no hay nada que leer, y sin token no hay a quién
  // preguntarle: en ambos casos la tarjeta sobra.
  if (!foto) return null;

  const leer = async () => {
    if (!token) {
      setError("Necesitas conexión e iniciar sesión para leer la lista.");
      return;
    }
    setLeyendo(true);
    setError(null);
    try {
      // Textract lee del bucket, no del teléfono: la foto tiene que estar
      // arriba antes. Si ya se subió en una sincronización previa, este paso se
      // salta solo.
      if (!foto.subida) {
        const { url } = await urlDeSubida(token, {
          proveedorId: proveedor.id,
          fotoId: foto.id,
          tipo: foto.tipo,
          contentType: foto.blob.type || "image/webp",
          tomadaEn: foto.tomadaEn,
          lat: foto.lat,
          lng: foto.lng,
        });
        await subirFoto(url, foto.blob);
        await guardarFoto({ ...foto, subida: true });
        setFoto({ ...foto, subida: true });
      }

      const r = await leerPrecios(token, proveedor.id, foto.id);
      setFilas(r.filas);
      if (r.filas.length === 0) {
        setError("No se distinguió ningún renglón. Prueba con más luz o más cerca.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la lista");
    } finally {
      setLeyendo(false);
    }
  };

  return (
    <Tarjeta
      titulo="Leer la lista de precios"
      pista="Saca lo que dice la foto para no teclearlo. Tú decides qué precio va en cada presentación."
    >
      <Boton variante="secundario" onClick={leer} disabled={leyendo} className="w-full">
        <ScanLine size={18} />
        {leyendo ? "Leyendo la foto…" : filas ? "Volver a leer" : "Leer la foto"}
      </Boton>

      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}

      {filas && filas.length > 0 && (
        <div className="mt-3 grid gap-2">
          <p className="text-[12px] text-fg-subtle">
            {filas.length} renglones. Toca la presentación a la que corresponde cada
            precio.
          </p>
          {filas.map((fila, i) => (
            <Renglon key={`${fila.texto}-${i}`} fila={fila} onPrecio={onPrecio} />
          ))}
        </div>
      )}
    </Tarjeta>
  );
}

function Renglon({
  fila,
  onPrecio,
}: {
  fila: FilaLeida;
  onPrecio: (presentacion: Presentacion, precio: number) => void;
}) {
  const [asignado, setAsignado] = useState<Presentacion | null>(null);

  // El volumen leído en el renglón adivina la presentación: "100 ml" es un
  // candidato mucho mejor que la primera de la lista.
  const sugerida = PRESENTACIONES.find((p) => p.ml === fila.ml)?.valor ?? null;

  return (
    <div className="rounded-[var(--radius-md)] border border-border-soft p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 flex-1 text-[13px] text-fg-muted">{fila.texto}</span>
        {fila.precio !== null && (
          <span className="shrink-0 text-[14px] font-semibold tabular-nums">
            {fila.precio}
          </span>
        )}
      </div>

      {fila.precio !== null && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {PRESENTACIONES.map((pres) => {
            const esSugerida = sugerida === pres.valor;
            const esAsignada = asignado === pres.valor;
            return (
              <button
                key={pres.valor}
                type="button"
                onClick={() => {
                  onPrecio(pres.valor, fila.precio!);
                  setAsignado(pres.valor);
                }}
                className={`min-h-9 rounded-full border px-2.5 text-[12px] font-medium ${
                  esAsignada
                    ? "border-success bg-success text-white"
                    : esSugerida
                      ? "border-gold text-gold"
                      : "border-border-strong text-fg-subtle"
                }`}
              >
                {esAsignada ? "✓ " : ""}
                {pres.etiqueta}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
