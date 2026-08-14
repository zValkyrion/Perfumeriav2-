import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Contenedor } from "@/components/comunes/layout";
import { TituloRevelado } from "@/components/comunes/efectos";
import { Frasco3D } from "./frasco-3d";

const DETALLES = [
  "Vidrio grueso con base maciza, no plástico metalizado",
  "Atomizador calibrado: rocío fino y parejo, sin goteo",
  "Celofán de fábrica intacto en cada pieza que enviamos",
  "Tapa imantada que cierra sin holgura",
];

/**
 * Bloque del frasco (§8, sección propia).
 *
 * Es la única pieza manipulable de la home y por eso se le da su propio
 * espacio: en perfumería el envase es parte del producto, y poder girarlo
 * responde a la duda real de "¿se ve barato?" mejor que cualquier foto.
 */
export function BloqueFrasco() {
  return (
    <Contenedor>
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <div className="border-border-soft bg-surface/40 relative overflow-hidden rounded-lg border">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 60% at 50% 35%, rgba(201,162,39,.14), transparent 70%)",
            }}
          />
          <Frasco3D />
        </div>

        <div>
          <p className="eyebrow mb-3">El detalle</p>
          <TituloRevelado texto="Gíralo. Mira el acabado." className="titular-medio" />

          <p className="text-fg-muted mt-4 text-[15px] leading-relaxed">
            En perfumería el envase es parte de lo que compras. Por eso no
            trabajamos con frascos ligeros ni atomizadores que escupen: el peso
            del vidrio y el rocío se notan desde el primer disparo, y son lo
            primero que revisa quien revende.
          </p>

          <ul className="mt-6 space-y-2.5">
            {DETALLES.map((d) => (
              <li
                key={d}
                className="text-fg-muted flex items-start gap-2.5 text-sm"
              >
                <Check size={16} className="text-gold mt-0.5 shrink-0" aria-hidden />
                {d}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="gold" size="touch">
              <Link href="/catalogo">Ver el catálogo</Link>
            </Button>
            <Button asChild variant="goldOutline" size="touch">
              <Link href="/nosotros">Qué significa 1:1</Link>
            </Button>
          </div>
        </div>
      </div>
    </Contenedor>
  );
}
