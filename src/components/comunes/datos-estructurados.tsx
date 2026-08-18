import { jsonLd } from "@/lib/jsonld";

/** Inyecta un bloque de JSON-LD. Un `datos` por bloque, nunca dos mezclados. */
export function DatosEstructurados({ datos }: { datos: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(datos) }}
    />
  );
}
