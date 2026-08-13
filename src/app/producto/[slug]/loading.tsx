import { Contenedor } from "@/components/comunes/layout";
import { Skeleton } from "@/components/ui/skeleton";

/** Estado de carga de la ficha, con la misma retícula 55/45 del contenido. */
export default function CargandoProducto() {
  return (
    <Contenedor className="py-5 lg:py-8">
      <Skeleton className="bg-surface-2 mb-5 h-3 w-72 max-w-full" />

      <div className="lg:grid lg:grid-cols-[55fr_45fr] lg:items-start lg:gap-12">
        <div className="skeleton-oro">
          <Skeleton className="bg-surface-2 aspect-3/4 w-full rounded-md" />
        </div>

        <div className="mt-7 space-y-4 lg:mt-0">
          <Skeleton className="bg-surface-2 h-3 w-32" />
          <Skeleton className="bg-surface-2 h-10 w-3/4" />
          <Skeleton className="bg-surface-2 h-4 w-48" />
          <Skeleton className="bg-surface-2 h-16 w-full" />
          <Skeleton className="bg-surface-2 h-9 w-full" />
          <Skeleton className="bg-surface-2 h-44 w-full rounded-md" />
          <Skeleton className="bg-surface-2 h-12 w-full rounded-full" />
          <Skeleton className="bg-surface-2 h-11 w-full rounded-full" />
        </div>
      </div>
    </Contenedor>
  );
}
