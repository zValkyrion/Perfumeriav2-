import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NAVEGACION } from "@/data/navegacion";
import { cn } from "@/lib/utils";

/**
 * Mega-menú de escritorio (§7.3).
 *
 * Se abre con `group-hover` y `group-focus-within`, sin estado de React: es
 * navegable con teclado, no cuesta un solo kilobyte de JavaScript y no puede
 * quedarse abierto por un render perdido.
 */
export function MegaMenu() {
  return (
    <nav aria-label="Principal" className="relative hidden lg:block">
      {/* Seis enlaces cortos: centrados ocupan la barra en vez de amontonarse
          en la esquina izquierda de un contenedor ancho. */}
      <ul className="flex items-center justify-center gap-2">
        {NAVEGACION.map((seccion) => (
          <li key={seccion.label} className="group">
            <Link
              href={seccion.href}
              className={cn(
                "subrayado-nav hover:text-fg inline-flex h-11 items-center rounded-full px-3 text-[13px] font-medium tracking-wide transition-colors",
                seccion.destacado
                  ? "text-gold-light hover:text-gold uppercase"
                  : "text-fg-muted",
              )}
            >
              {seccion.label}
            </Link>

            {seccion.grupos ? (
              <div
                className={cn(
                  "invisible absolute inset-x-0 top-full z-50 -translate-y-1.5 opacity-0 transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
                  "group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
                )}
              >
                <div className="border-border-soft bg-bg/95 mt-2 rounded-lg border p-7 backdrop-blur-xl">
                  <div
                    className={cn(
                      "grid gap-8",
                      seccion.promo ? "grid-cols-[1fr_auto_320px]" : "grid-cols-3",
                    )}
                  >
                    <div
                      className={cn(
                        "grid gap-8",
                        seccion.grupos.length > 2 ? "grid-cols-3" : "grid-cols-2",
                      )}
                    >
                      {seccion.grupos.map((grupo, i) => (
                        <div
                          key={i}
                          // Las columnas aterrizan una tras otra al abrir:
                          // guía la lectura de izquierda a derecha.
                          style={{ transitionDelay: `${60 + i * 55}ms` }}
                          className="translate-y-1 opacity-0 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                        >
                          <p className="eyebrow mb-3 min-h-4">{grupo.titulo}</p>
                          <ul className="space-y-1">
                            {grupo.enlaces.map((e) => (
                              <li key={e.href + e.label}>
                                <Link
                                  href={e.href}
                                  className="text-fg-muted hover:text-gold-light flex items-baseline gap-2 py-1 text-sm transition-colors"
                                >
                                  {e.label}
                                  {e.nota ? (
                                    <span className="text-fg-subtle text-[11px]">
                                      {e.nota}
                                    </span>
                                  ) : null}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {seccion.promo ? (
                      <>
                        <div aria-hidden className="bg-border-soft w-px" />
                        <div>
                          <p className="font-display mb-2 text-xl">
                            {seccion.promo.titulo}
                          </p>
                          <p className="text-fg-muted mb-4 text-sm leading-relaxed">
                            {seccion.promo.texto}
                          </p>
                          <Link
                            href={seccion.promo.href}
                            className="text-gold-light hover:text-gold group/cta inline-flex items-center gap-1.5 text-sm font-medium"
                          >
                            {seccion.promo.cta}
                            <ArrowRight
                              size={14}
                              aria-hidden
                              className="transition-transform group-hover/cta:translate-x-0.5"
                            />
                          </Link>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
