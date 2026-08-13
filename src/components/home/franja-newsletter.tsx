import { Contenedor } from "@/components/comunes/layout";
import { Newsletter } from "@/components/layout/newsletter";

/** Franja de captura de correo (§8.14). */
export function FranjaNewsletter() {
  return (
    <section className="grain border-border-soft relative isolate overflow-hidden border-y">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 120% at 50% 100%, rgba(201,162,39,0.14), transparent 65%)",
        }}
      />

      <Contenedor>
        <div className="mx-auto max-w-xl py-14 text-center lg:py-20">
          <p className="eyebrow mb-3">Boletín AURA</p>
          <h2 className="font-display text-[26px] leading-tight tracking-tight text-balance lg:text-[36px]">
            10% de descuento en tu primera compra.
          </h2>
          <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
            Recibe ofertas exclusivas y lanzamientos antes que nadie. Un correo
            a la semana, sin relleno.
          </p>

          <div className="mx-auto mt-6 max-w-md text-left">
            <Newsletter compacto={false} />
          </div>
        </div>
      </Contenedor>
    </section>
  );
}
