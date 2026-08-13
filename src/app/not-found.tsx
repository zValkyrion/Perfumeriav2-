import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Contenedor } from "@/components/comunes/layout";

export default function NoEncontrado() {
  return (
    <Contenedor className="py-20 lg:py-32">
      <div className="mx-auto max-w-lg text-center">
        <p
          data-precio
          aria-hidden
          className="font-display text-gold-gradient text-7xl leading-none"
        >
          404
        </p>
        <h1 className="font-display mt-4 text-3xl leading-tight lg:text-4xl">
          Esta página se evaporó
        </h1>
        <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
          El enlace que seguiste no existe o el producto ya no está en catálogo.
          Prueba por aquí:
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button asChild variant="gold" size="touch">
            <Link href="/catalogo">Ver el catálogo</Link>
          </Button>
          <Button asChild variant="outline" size="touch">
            <Link href="/promociones">Promociones 3x2</Link>
          </Button>
          <Button asChild variant="outline" size="touch">
            <Link href="/lotes">Lotes de mayoreo</Link>
          </Button>
        </div>
      </div>
    </Contenedor>
  );
}
