"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTienda } from "@/store/tienda";
import { precio } from "@/lib/format";

export function BotonAgregarLote({
  slug,
  nombre,
  precioLote,
  variante = "gold",
  className,
}: {
  slug: string;
  nombre: string;
  precioLote: number;
  variante?: "gold" | "goldOutline";
  className?: string;
}) {
  const agregarPaquete = useTienda((s) => s.agregarPaquete);
  const abrirDrawer = useTienda((s) => s.abrirDrawer);

  return (
    <Button
      variant={variante}
      size="touch"
      className={className}
      onClick={() => {
        agregarPaquete(slug, 1);
        abrirDrawer();
        toast.success(`${nombre} agregado`, {
          description: `${precio(precioLote)} MXN · envío gratis`,
        });
      }}
    >
      <Plus size={16} aria-hidden />
      Agregar lote
    </Button>
  );
}
