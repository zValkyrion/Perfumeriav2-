"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Imagen } from "@/components/comunes/imagen";
import { Precio } from "@/components/comunes/precio";
import { normalizar, puntuar } from "@/lib/coincidencia";
import type { EntradaIndice } from "@/data/productos";
import { MARCAS } from "@/data/marcas";

const NOMBRE_MARCA = new Map(MARCAS.map((m) => [m.slug, m.nombre]));

const POPULARES = [
  "Oud",
  "Vainilla",
  "Azahar",
  "Vetiver",
  "Árabes",
  "Para regalo",
];

/**
 * Buscador del header (§7.2). Trabaja sobre un índice compacto que le pasa el
 * servidor, así que no arrastra el catálogo completo al bundle del cliente.
 */
export function Buscador({ indice }: { indice: EntradaIndice[] }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

  const resultados = useMemo(() => {
    const consulta = normalizar(q);
    if (consulta.length < 2) return [];
    return indice
      .map((e) => ({
        e,
        puntos: puntuar(normalizar(e.nombre), e.texto, consulta),
      }))
      .filter((r) => r.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, 6)
      .map((r) => r.e);
  }, [q, indice]);

  function enviar(consulta: string) {
    const limpio = consulta.trim();
    if (!limpio) return;
    setAbierto(false);
    router.push(`/buscar?q=${encodeURIComponent(limpio)}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Buscar perfumes"
        className="text-fg-muted hover:text-fg grid size-11 place-items-center rounded-full transition-colors"
      >
        <Search size={20} aria-hidden />
      </button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent
          side="top"
          className="bg-bg/95 border-border-soft h-auto max-h-[85dvh] overflow-y-auto backdrop-blur-xl"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Buscar en AURA</SheetTitle>
          </SheetHeader>

          <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-6 lg:px-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviar(q);
              }}
              role="search"
              className="border-border-strong focus-within:border-gold flex items-center gap-3 border-b py-3 transition-colors"
            >
              <Search size={20} aria-hidden className="text-gold shrink-0" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Busca por nombre, nota o marca…"
                aria-label="Buscar perfumes"
                className="placeholder:text-fg-subtle h-9 w-full bg-transparent text-base outline-none"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Limpiar búsqueda"
                  className="text-fg-subtle hover:text-fg grid size-8 place-items-center rounded-full"
                >
                  <X size={16} aria-hidden />
                </button>
              ) : null}
            </form>

            {q.trim().length < 2 ? (
              <div className="pt-6">
                <p className="eyebrow mb-3">Búsquedas populares</p>
                <div className="flex flex-wrap gap-2">
                  {POPULARES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => enviar(t)}
                      className="border-border-strong hover:border-gold hover:text-gold-light rounded-full border px-3.5 py-2 text-sm transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : resultados.length === 0 ? (
              // Vacío con alternativas, nunca un callejón sin salida (§9).
              <div className="pt-8 pb-2 text-center">
                <p className="text-fg mb-1 text-[15px]">
                  No encontramos “{q.trim()}”.
                </p>
                <p className="text-fg-muted mb-5 text-sm">
                  Revisa la ortografía o explora estas categorías.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {POPULARES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => enviar(t)}
                      className="border-border-strong hover:border-gold hover:text-gold-light rounded-full border px-3.5 py-2 text-sm transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="pt-4">
                {resultados.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/producto/${r.slug}`}
                      onClick={() => setAbierto(false)}
                      className="hover:bg-surface flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
                    >
                      <span className="bg-surface relative size-14 shrink-0 overflow-hidden rounded">
                        <Imagen
                          src={r.imagen}
                          alt=""
                          sizes="56px"
                          quality={45}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-fg-subtle block text-[10px] tracking-[0.14em] uppercase">
                          {NOMBRE_MARCA.get(r.marca) ?? r.marca}
                        </span>
                        <span className="font-display block truncate text-[17px]">
                          {r.nombre}
                        </span>
                      </span>
                      <Precio
                        valor={r.precio}
                        className="text-fg-muted shrink-0 text-sm"
                      />
                    </Link>
                  </li>
                ))}
                <li className="pt-3">
                  <button
                    type="button"
                    onClick={() => enviar(q)}
                    className="text-gold-light hover:text-gold w-full px-2 text-left text-sm font-medium"
                  >
                    Ver todos los resultados de “{q.trim()}” →
                  </button>
                </li>
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
