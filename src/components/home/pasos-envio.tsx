import { Contenedor, TituloSeccion } from "@/components/comunes/layout";
import { PASOS_ENVIO } from "@/data/contenido";

/** Así recibes tu pedido (§8.11). */
export function PasosEnvio() {
  return (
    <Contenedor>
      <TituloSeccion
        eyebrow="Sin sorpresas"
        titulo="Así recibes tu pedido"
        descripcion="De nuestra bodega a tu puerta, con guía de rastreo desde el primer día."
      />

      <ol className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        {PASOS_ENVIO.map((p, i) => (
          <li key={p.titulo} className="border-border-soft border-t pt-5">
            <span
              data-precio
              aria-hidden
              className="text-gold-gradient font-display block text-4xl leading-none"
            >
              0{i + 1}
            </span>
            <h3 className="font-display mt-3 text-xl leading-tight">{p.titulo}</h3>
            <p className="text-fg-muted mt-2 text-sm leading-relaxed">{p.texto}</p>
          </li>
        ))}
      </ol>
    </Contenedor>
  );
}
