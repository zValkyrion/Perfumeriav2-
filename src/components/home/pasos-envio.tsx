import { Contenedor, TituloSeccion } from "@/components/comunes/layout";
import { PASOS_ENVIO } from "@/data/contenido";

/** Así recibes tu pedido (§8.11). */
export function PasosEnvio() {
  return (
    <Contenedor>
      <TituloSeccion
        revelado
        eyebrow="Sin sorpresas"
        titulo="Así recibes tu pedido"
        descripcion="De nuestra bodega a tu puerta, con guía de rastreo desde el primer día."
      />

      {/* Los pasos entran uno tras otro y su filete superior se dibuja de
          izquierda a derecha: se lee como una secuencia, no como tres cajas. */}
      <ol className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        {PASOS_ENVIO.map((p, i) => (
          <li
            key={p.titulo}
            style={{ animationDelay: `${i * 140}ms` }}
            className="animate-subir group relative pt-5"
          >
            <span
              aria-hidden
              className="bg-border-soft absolute inset-x-0 top-0 h-px origin-left"
            />
            <span
              aria-hidden
              style={{ transitionDelay: `${i * 140}ms` }}
              className="rule-gold absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
            />
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
