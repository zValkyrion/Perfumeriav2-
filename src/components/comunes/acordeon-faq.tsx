import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface ItemFAQ {
  p: string;
  r: string;
  /**
   * Bloque al que pertenece la pregunta (Envíos, Pagos…). Es opcional porque
   * los FAQ cortos —el de mayoreo, el de una ficha— no ganan nada partiéndose;
   * cuando está, se pinta un rótulo cada vez que cambia.
   */
  grupo?: string;
}

/** Acordeón de preguntas frecuentes, reutilizado en home, FAQ y mayoreo. */
export function AcordeonFAQ({
  items,
  className,
}: {
  items: readonly ItemFAQ[];
  className?: string;
}) {
  return (
    <Accordion type="single" collapsible className={className}>
      {items.map((item, i) => {
        const abreGrupo = item.grupo && item.grupo !== items[i - 1]?.grupo;

        return (
          <div key={item.p}>
            {abreGrupo ? (
              <p className="text-gold-light mt-7 mb-1 text-[13px] font-bold tracking-[0.14em] uppercase first:mt-0">
                {item.grupo}
              </p>
            ) : null}

            <AccordionItem value={item.p} className="border-border-soft">
              <AccordionTrigger className="py-5 text-left text-[15px] leading-snug font-semibold hover:no-underline lg:text-base">
                {item.p}
              </AccordionTrigger>
              <AccordionContent className="text-fg-muted max-w-3xl pb-5 text-sm leading-relaxed font-medium">
                {item.r}
              </AccordionContent>
            </AccordionItem>
          </div>
        );
      })}
    </Accordion>
  );
}

/** JSON-LD de FAQPage, para que las preguntas puedan salir en buscadores. */
export function FAQJsonLd({ items }: { items: readonly ItemFAQ[] }) {
  const datos = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.p,
      acceptedAnswer: { "@type": "Answer", text: i.r },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }}
    />
  );
}
