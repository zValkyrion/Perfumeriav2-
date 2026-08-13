import { Contenedor } from "@/components/comunes/layout";
import { GridSkeleton } from "@/components/producto/grid-productos";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Estado de carga del catálogo. Reproduce la caja real —cabecera, barra lateral
 * y rejilla— para que al llegar el contenido nada se mueva de sitio (§15).
 */
export default function CargandoCatalogo() {
  return (
    <Contenedor className="py-6 lg:py-10">
      <Skeleton className="bg-surface-2 mb-5 h-3 w-40" />
      <Skeleton className="bg-surface-2 mb-3 h-10 w-64" />
      <Skeleton className="bg-surface-2 mb-8 h-4 w-full max-w-xl" />

      <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
        <aside className="hidden space-y-4 lg:block">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="bg-surface-2 h-11 w-full" />
          ))}
        </aside>

        <div>
          <div className="mb-5 flex items-center justify-between">
            <Skeleton className="bg-surface-2 h-4 w-24" />
            <Skeleton className="bg-surface-2 h-11 w-40 rounded-full" />
          </div>
          <GridSkeleton cantidad={10} />
        </div>
      </div>
    </Contenedor>
  );
}
