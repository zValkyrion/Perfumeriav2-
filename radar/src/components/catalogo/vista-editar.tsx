"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { RegistroGuardado } from "../../../../compartido/catalogo-admin";
import type { RegistroCatalogo } from "../../../../compartido/catalogo-tabla";
import { Boton, Tarjeta } from "@/components/ui";
import {
  Aviso,
  Mensaje,
  PuertaCatalogo,
  conGuardado,
  sinRegistro,
  useCatalogoAdmin,
} from "@/components/catalogo/comun";
import { FormLote, FormMarca, FormProducto, FormSet } from "@/components/catalogo/formularios";
import { enlaceEditar } from "@/components/catalogo/vista-catalogo";
import {
  ErrorGuardado,
  borrarRegistro,
  guardarRegistro,
  type CatalogoAdmin,
  type DatosDe,
  type ErrorCampo,
  type TipoRegistro,
} from "@/lib/catalogo-admin";
import { fechaCorta } from "@/lib/utils";

const TIPOS: Record<TipoRegistro, { uno: string; nuevo: string }> = {
  producto: { uno: "perfume", nuevo: "Nuevo perfume" },
  marca: { uno: "marca", nuevo: "Nueva marca" },
  set: { uno: "set", nuevo: "Nuevo set" },
  lote: { uno: "lote", nuevo: "Nuevo lote" },
};

const esTipo = (x: string | null): x is TipoRegistro => x !== null && x in TIPOS;

function buscar(d: CatalogoAdmin, tipo: TipoRegistro, id: string): RegistroCatalogo | undefined {
  const c = d.catalogo;
  switch (tipo) {
    case "producto":
      return c.productos.find((p) => p.codigo === id);
    case "marca":
      return c.marcas.find((m) => m.slug === id);
    case "set":
      return c.sets.find((s) => s.codigo === id);
    case "lote":
      return c.lotes.find((l) => l.slug === id);
  }
}

const VOLVER = "/catalogo/";

export function VistaEditar() {
  const params = useSearchParams();
  const c = useCatalogoAdmin();
  const tipo = params.get("tipo");
  const id = params.get("id") ?? "";
  const nuevo = params.get("nuevo") === "1";

  const bloqueo = PuertaCatalogo({ c, volver: VOLVER });
  if (bloqueo) return bloqueo;
  if (!esTipo(tipo) || (!nuevo && !id)) {
    return (
      <Aviso titulo="No sé qué abrir" volver={VOLVER}>
        El enlace no dice qué registro editar. Vuelve al catálogo y elígelo de la lista.
      </Aviso>
    );
  }
  if (!c.datos) {
    return c.error ? (
      <Aviso titulo="No se pudo leer el catálogo" volver={VOLVER}>
        {c.error}
      </Aviso>
    ) : (
      <main className="p-4 text-[14px] text-fg-subtle">Abriendo…</main>
    );
  }

  const registro = nuevo ? null : buscar(c.datos, tipo, id);
  if (!nuevo && !registro) {
    return (
      <Aviso titulo="Ese registro no existe" volver={VOLVER}>
        Puede que alguien lo haya borrado. Vuelve al catálogo para ver la lista actual.
      </Aviso>
    );
  }

  return (
    <Editor
      // Otro registro es otro formulario: sin la llave, React reusaría el
      // borrador del anterior al pasar de un alta a su edición.
      key={`${tipo}:${nuevo ? "nuevo" : id}`}
      tipo={tipo}
      id={nuevo ? null : id}
      registro={registro ?? null}
      datos={c.datos}
      token={c.token!}
      alGuardar={(t, i, guardado) => c.setDatos((d) => (d ? conGuardado(d, t, i, guardado) : d))}
      alBorrar={(t, i) => c.setDatos((d) => (d ? sinRegistro(d, t, i) : d))}
      recargar={c.recargar}
    />
  );
}

function Editor({
  tipo,
  id,
  registro,
  datos,
  token,
  alGuardar,
  alBorrar,
  recargar,
}: {
  tipo: TipoRegistro;
  id: string | null;
  registro: RegistroCatalogo | null;
  datos: CatalogoAdmin;
  token: string;
  alGuardar: (tipo: TipoRegistro, id: string, guardado: RegistroGuardado) => void;
  alBorrar: (tipo: TipoRegistro, id: string) => void;
  recargar: () => void;
}) {
  const router = useRouter();
  const estado = id ? datos.registros[`${tipo}:${id}`] : undefined;
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error" | "aviso"; texto: string } | null>(
    null,
  );
  const [conflicto, setConflicto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (nuevoId: string, valor: RegistroCatalogo) => {
    setGuardando(true);
    setErrores([]);
    setMensaje(null);
    setConflicto(false);
    try {
      const r = await guardarRegistro(
        token,
        tipo,
        nuevoId,
        valor as DatosDe<typeof tipo>,
        estado?.huella ?? null,
      );
      alGuardar(tipo, nuevoId, r);
      if (!id) {
        // El alta pasa a ser una edición normal, con su propia dirección.
        router.replace(enlaceEditar(tipo, nuevoId));
        return;
      }
      setMensaje({
        tono: "ok",
        texto: r.sinCambios
          ? "No había nada que guardar."
          : "Guardado. Agotado y precios cuentan en la tienda en un minuto; lo demás, al publicar.",
      });
    } catch (e) {
      if (e instanceof ErrorGuardado) {
        setErrores(e.errores);
        setConflicto(e.estado === 409);
        setMensaje({ tono: "error", texto: e.message });
      } else {
        setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo guardar" });
      }
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!id || !estado) return;
    const aviso =
      tipo === "producto" || tipo === "set"
        ? "¿Borrarlo del catálogo? Si solo quieres que no se vea, mejor márcalo como oculto: se conserva y se puede volver a publicar."
        : `¿Borrar ${TIPOS[tipo].uno === "marca" ? "esta marca" : "este lote"}?`;
    if (!confirm(aviso)) return;
    setGuardando(true);
    setMensaje(null);
    try {
      await borrarRegistro(token, tipo, id, estado.huella);
      alBorrar(tipo, id);
      router.push(VOLVER);
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo borrar" });
      setGuardando(false);
    }
  };

  const titulo = registro
    ? "nombre" in registro
      ? registro.nombre
      : id
    : TIPOS[tipo].nuevo;

  const props = { datos, token, errores, guardando };

  return (
    <main className="p-4 pb-28">
      <header className="mb-4">
        <Link
          href={VOLVER}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-fg-subtle"
        >
          <ArrowLeft size={15} />
          Catálogo
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{titulo}</h1>
        {estado && (
          <p className="text-[13px] text-fg-subtle">
            {estado.editadoEn
              ? `Editado el ${fechaCorta(estado.editadoEn)}${estado.editadoPor ? ` por ${estado.editadoPor}` : ""}`
              : "Tal como vino del CSV"}
          </p>
        )}
      </header>

      {mensaje && (
        <div className="mb-4">
          <Mensaje tono={mensaje.tono}>
            {mensaje.texto}
            {errores.length > 0 && " Están marcados abajo."}
            {conflicto && (
              <button
                type="button"
                onClick={recargar}
                className="ml-2 font-semibold text-info underline"
              >
                Recargar
              </button>
            )}
          </Mensaje>
        </div>
      )}

      {tipo === "producto" && (
        <FormProducto {...props} inicial={registro as DatosDe<"producto"> | null} onGuardar={guardar} />
      )}
      {tipo === "marca" && (
        <FormMarca {...props} inicial={registro as DatosDe<"marca"> | null} onGuardar={guardar} />
      )}
      {tipo === "set" && (
        <FormSet {...props} inicial={registro as DatosDe<"set"> | null} onGuardar={guardar} />
      )}
      {tipo === "lote" && (
        <FormLote {...props} inicial={registro as DatosDe<"lote"> | null} onGuardar={guardar} />
      )}

      {id && estado && (
        <Tarjeta titulo="Borrar" className="mt-4">
          <p className="mb-3 text-[14px] text-fg-muted">
            {tipo === "marca"
              ? "Solo se puede borrar una marca que ya no tenga perfumes ni sets."
              : tipo === "producto"
                ? "Un perfume que está en un lote no se puede borrar hasta sacarlo del lote."
                : "Se quita de la tienda en la siguiente publicación."}
          </p>
          <Boton variante="peligro" onClick={borrar} disabled={guardando} className="w-full">
            <Trash2 size={18} />
            Borrar {TIPOS[tipo].uno}
          </Boton>
        </Tarjeta>
      )}
    </main>
  );
}
