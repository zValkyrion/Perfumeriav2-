import { Skeleton } from "@/components/ui/skeleton";
import type { Producto } from "@/types";
import { TarjetaProducto } from "./tarjeta-producto";
import { cn } from "@/lib/utils";

/** Rejilla del catálogo: 2 columnas en móvil para poder comparar (§6.3). */
export function GridProductos({
  productos,
  className,
  prioritarios = 0,
  maxMovil,
}: {
  productos: Producto[];
  className?: string;
  /** Cuántas tarjetas cargan su imagen con prioridad (las del primer fold). */
  prioritarios?: number;
  /** Límite máximo de productos visibles en móvil. El resto se muestra a partir de md. */
  maxMovil?: number;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 2xl:grid-cols-5",
        className,
      )}
    >
      {productos.map((p, i) => {
        const ocultarEnMovil = maxMovil !== undefined && i >= maxMovil;
        return (
          <div
            key={p.id}
            className={cn("animate-subir", ocultarEnMovil && "hidden md:block")}
            style={{ animationDelay: `${Math.min(i, 12) * 55}ms` }}
          >
            <TarjetaProducto producto={p} prioridad={i < prioritarios} />
          </div>
        );
      })}
    </div>
  );
}

/** Esqueleto con la misma caja que la tarjeta real: CLS ≈ 0 (§15). */
export function SkeletonProducto() {
  return (
    <div className="border-border-soft bg-surface skeleton-oro overflow-hidden rounded-md border">
      <Skeleton className="bg-surface-2 aspect-3/4 rounded-none" />
      <div className="space-y-2 p-3 lg:p-3.5">
        <Skeleton className="bg-surface-2 h-2.5 w-1/2" />
        <Skeleton className="bg-surface-2 h-4 w-4/5" />
        <Skeleton className="bg-surface-2 h-3 w-1/3" />
        <Skeleton className="bg-surface-2 h-5 w-2/3" />
        <Skeleton className="bg-surface-2 h-3 w-2/5" />
      </div>
    </div>
  );
}

export function GridSkeleton({ cantidad = 10 }: { cantidad?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 2xl:grid-cols-5">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} style={{ animationDelay: `${i * 45}ms` }} className="animate-aparecer">
          <SkeletonProducto />
        </div>
      ))}
    </div>
  );
}
