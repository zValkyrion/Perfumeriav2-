import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface ItemFAQ {
  p: string;
  r: string;
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
      {items.map((item) => (
        <AccordionItem
          key={item.p}
          value={item.p}
          className="border-border-soft"
        >
          <AccordionTrigger className="py-5 text-left text-[15px] leading-snug font-normal hover:no-underline lg:text-base">
            {item.p}
          </AccordionTrigger>
          <AccordionContent className="text-fg-muted max-w-3xl pb-5 text-sm leading-relaxed">
            {item.r}
          </AccordionContent>
        </AccordionItem>
      ))}
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
