"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Contenedor } from "@/components/comunes/layout";
import { GridProductos, GridSkeleton } from "@/components/producto/grid-productos";
import { PRODUCTOS } from "@/data/productos";
import { useTienda } from "@/store/tienda";

export function VistaFavoritos() {
  const hidratado = useTienda((s) => s.hidratado);
  const favoritos = useTienda((s) => s.favoritos);
  const productos = PRODUCTOS.filter((p) => favoritos.includes(p.id));

  return (
    <Contenedor className="py-6 lg:py-10">
      <header className="mb-7">
        <p className="eyebrow mb-2">Tu lista</p>
        <h1 className="font-display text-[32px] leading-tight tracking-tight lg:text-[42px]">
          Favoritos
        </h1>
        {hidratado && productos.length > 0 ? (
          <p className="text-fg-muted mt-2 text-sm">
            {productos.length}{" "}
            {productos.length === 1 ? "perfume guardado" : "perfumes guardados"}.
            Recuerda: desde 3 piezas bajas 15% y el envío es gratis.
          </p>
        ) : null}
      </header>

      {!hidratado ? (
        <GridSkeleton cantidad={5} />
      ) : productos.length === 0 ? (
        <div className="border-border-soft rounded-lg border border-dashed px-6 py-16 text-center">
          <Heart size={30} className="text-fg-subtle mx-auto mb-4" aria-hidden />
          <p className="font-display mb-2 text-xl">Todavía no guardas nada</p>
          <p className="text-fg-muted mx-auto mb-7 max-w-sm text-sm leading-relaxed">
            Toca el corazón en cualquier perfume y lo encontrarás aquí, aunque
            cierres el navegador.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="gold" size="touch">
              <Link href="/catalogo">Ver el catálogo</Link>
            </Button>
            <Button asChild variant="outline" size="touch">
              <Link href="/catalogo?orden=vendidos">Los más vendidos</Link>
            </Button>
          </div>
        </div>
      ) : (
        <GridProductos productos={productos} prioritarios={4} />
      )}
    </Contenedor>
  );
}
