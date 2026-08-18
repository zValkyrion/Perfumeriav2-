import type { Metadata } from "next";
import { AcordeonFAQ, FAQJsonLd } from "@/components/comunes/acordeon-faq";
import { PaginaInfo } from "@/components/comunes/pagina-info";
import { FAQ_CATALOGO, FAQ_HOME, FAQ_MAYOREO } from "@/data/contenido";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description:
    "Envíos, originalidad, mayoreo, pagos, meses sin intereses, devoluciones y facturación. Todo lo que preguntan antes de comprar.",
  alternates: { canonical: "/faq" },
};

export default function FAQPage() {
  return (
    <>
      {/* Solo FAQ_HOME: las preguntas de mayoreo se marcan en /mayoreo, que es
          su página. Emitirlas en las dos hacía que la misma pregunta viviera en
          dos FAQPage y Google atribuye el resultado enriquecido a una sola. El
          acordeón visual de abajo sí las muestra todas. */}
      <FAQJsonLd items={FAQ_HOME} />
      <PaginaInfo
        eyebrow="Ayuda"
        titulo="Preguntas frecuentes"
        entrada="Lo que más nos preguntan por WhatsApp, resuelto aquí. Si falta algo, escríbenos y lo agregamos."
      >
        <section>
          <h2 className="font-display mb-2 text-xl lg:text-2xl">
            Compra, envíos y devoluciones
          </h2>
          <AcordeonFAQ items={FAQ_HOME} />
        </section>

        {/* Estas no van en la home —son de producto, no de compra— pero aquí
            son justo lo que busca quien llega desde un buscador preguntando si
            de verdad huele igual. */}
        <section>
          <h2 className="font-display mb-2 text-xl lg:text-2xl">
            El producto y su calidad
          </h2>
          <AcordeonFAQ items={FAQ_CATALOGO} />
        </section>

        <section>
          <h2 className="font-display mb-2 text-xl lg:text-2xl">
            Mayoreo y reventa
          </h2>
          <AcordeonFAQ items={FAQ_MAYOREO} />
        </section>
      </PaginaInfo>
    </>
  );
}
