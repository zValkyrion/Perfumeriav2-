import { Droplets, Flower2, TreePine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Nota } from "@/types";

const NIVELES: {
  tipo: Nota["tipo"];
  titulo: string;
  cuando: string;
  icono: LucideIcon;
}[] = [
  {
    tipo: "salida",
    titulo: "Salida",
    cuando: "Primeros 15 minutos",
    icono: Droplets,
  },
  {
    tipo: "corazon",
    titulo: "Corazón",
    cuando: "De 20 minutos a 2 horas",
    icono: Flower2,
  },
  {
    tipo: "fondo",
    titulo: "Fondo",
    cuando: "Lo que queda el resto del día",
    icono: TreePine,
  },
];

/** Pirámide olfativa (§10.8). */
export function PiramideOlfativa({ notas }: { notas: Nota[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {NIVELES.map((nivel) => {
        const propias = notas.filter((n) => n.tipo === nivel.tipo);
        if (!propias.length) return null;
        const Icono = nivel.icono;

        return (
          <div
            key={nivel.tipo}
            className="border-border-soft bg-surface rounded-md border p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <Icono size={16} className="text-gold" aria-hidden strokeWidth={1.6} />
              <div>
                <p className="text-sm font-medium">{nivel.titulo}</p>
                <p className="text-fg-subtle text-[11px]">{nivel.cuando}</p>
              </div>
            </div>

            <ul className="flex flex-wrap gap-1.5">
              {propias.map((n) => (
                <li
                  key={n.nombre}
                  className="border-border-strong text-fg-muted rounded-full border px-2.5 py-1 text-xs"
                >
                  {n.nombre}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
