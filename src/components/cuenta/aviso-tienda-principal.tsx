import { ExternalLink, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Contenedor } from "@/components/comunes/layout";
import { SITIO_URL } from "@/lib/sitio";

/**
 * Lo que se ve de la cuenta en un build sin Cognito ni API (la copia de GitHub
 * Pages, o `npm run dev` sin variables).
 *
 * Antes se enseñaba una cuenta de muestra con pedidos, teléfonos y direcciones
 * inventados, sin pedir entrar. Un visitante los tomaba por los de alguien. Aquí
 * no hay dónde guardar una cuenta, así que se dice eso y se manda a la tienda
 * principal, que sí la tiene.
 */
export function AvisoTiendaPrincipal({
  titulo,
  texto,
  ruta,
  cta,
}: {
  titulo: string;
  texto: string;
  /** Ruta de la tienda principal a la que se manda, con barra final. */
  ruta: string;
  cta: string;
}) {
  return (
    <Contenedor className="py-16 lg:py-24">
      <div className="border-border-soft bg-surface mx-auto max-w-lg rounded-lg border p-6 text-center lg:p-8">
        <UserRound size={30} className="text-gold mx-auto mb-4" aria-hidden />
        <h1 className="font-display mb-3 text-2xl lg:text-3xl">{titulo}</h1>
        <p className="text-fg-muted mb-6 text-sm leading-relaxed">{texto}</p>
        <Button asChild variant="gold" size="touch-lg" className="w-full sm:w-auto">
          <a href={`${SITIO_URL}${ruta}`}>
            {cta}
            <ExternalLink size={16} aria-hidden />
          </a>
        </Button>
      </div>
    </Contenedor>
  );
}
