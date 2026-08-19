"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { TIPOS_FOTO } from "@/data/catalogo";
import { Tarjeta } from "@/components/ui";
import { borrarFoto, fotosDe, guardarFoto } from "@/lib/almacen";
import { comprimir, pesoLegible } from "@/lib/imagen";
import type { Foto, Proveedor, TipoFoto } from "@/lib/tipos";

export function PasoFotos({ proveedor }: { proveedor: Proveedor }) {
  const [fotos, setFotos] = useState<Foto[]>([]);

  useEffect(() => {
    fotosDe(proveedor.id).then(setFotos);
  }, [proveedor.id]);

  const agregar = async (tipo: TipoFoto, archivo: File) => {
    const blob = await comprimir(archivo);
    const foto: Foto = {
      id: crypto.randomUUID(),
      proveedorId: proveedor.id,
      tipo,
      blob,
      tomadaEn: new Date().toISOString(),
      lat: proveedor.lat,
      lng: proveedor.lng,
    };
    await guardarFoto(foto);
    setFotos((f) => [...f, foto]);
  };

  const quitar = async (id: string) => {
    await borrarFoto(id);
    setFotos((f) => f.filter((x) => x.id !== id));
  };

  const total = fotos.reduce((suma, f) => suma + f.blob.size, 0);

  return (
    <div className="grid gap-3">
      {TIPOS_FOTO.map((t) => (
        <Tarjeta key={t.valor} titulo={t.etiqueta} pista={t.pista}>
          <Galeria
            fotos={fotos.filter((f) => f.tipo === t.valor)}
            onAgregar={(archivo) => agregar(t.valor, archivo)}
            onQuitar={quitar}
          />
        </Tarjeta>
      ))}

      {fotos.length > 0 && (
        <p className="text-center text-[13px] text-fg-subtle">
          {fotos.length} foto{fotos.length === 1 ? "" : "s"} · {pesoLegible(total)}{" "}
          guardado en el teléfono
        </p>
      )}
    </div>
  );
}

function Galeria({
  fotos,
  onAgregar,
  onQuitar,
}: {
  fotos: Foto[];
  onAgregar: (archivo: File) => Promise<void>;
  onQuitar: (id: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      {fotos.map((f) => (
        <Miniatura key={f.id} foto={f} onQuitar={() => onQuitar(f.id)} />
      ))}

      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={ocupado}
        className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-border-strong text-fg-subtle disabled:opacity-50"
        aria-label="Tomar foto"
      >
        <Camera size={22} />
      </button>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        // `capture` abre la cámara directamente en el teléfono, sin pasar por el
        // selector de archivos. Un tap menos por foto, cinco fotos por local.
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const archivo = e.target.files?.[0];
          if (!archivo) return;
          setOcupado(true);
          try {
            await onAgregar(archivo);
          } finally {
            setOcupado(false);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}

function Miniatura({ foto, onQuitar }: { foto: Foto; onQuitar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(foto.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [foto.blob]);

  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-border-strong">
      {/* Blob local: `next/image` no aporta nada aquí y en export estático no
          optimiza de todos modos. */}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={onQuitar}
        aria-label="Quitar foto"
        className="absolute right-0.5 top-0.5 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white"
      >
        <X size={15} />
      </button>
    </div>
  );
}
