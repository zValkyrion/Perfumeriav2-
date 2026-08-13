import type { Metadata } from "next";
import { Bloque, PaginaInfo } from "@/components/comunes/pagina-info";

export const metadata: Metadata = {
  title: "Cambios y devoluciones",
  description:
    "30 días para devolver, nosotros pagamos la guía. Y si no es original, te devolvemos el 100% de tu dinero.",
};

export default function DevolucionesPage() {
  return (
    <PaginaInfo
      eyebrow="Ayuda"
      titulo="Cambios y devoluciones"
      entrada="Tienes 30 días naturales para devolver o cambiar tu compra. La guía de retorno la pagamos nosotros."
      actualizado="1 de agosto de 2026"
    >
      <Bloque titulo="Qué aceptamos">
        <p>
          Aceptamos devoluciones de perfumes que conserven al menos el 90% de su
          contenido y vengan con su caja. Entendemos que hay que probarlo para
          saber si te queda: unos cuantos disparos no invalidan nada.
        </p>
        <p>
          Los sets y lotes se devuelven completos. Si solo un modelo del lote no
          te rotó, mira la política de cambio por rotación más abajo.
        </p>
      </Bloque>

      <Bloque titulo="Cómo hacerlo">
        <p>
          Escríbenos por WhatsApp con tu folio y dinos si quieres cambio,
          devolución del dinero o saldo a favor. Te mandamos la guía prepagada
          por correo el mismo día.
        </p>
        <p>
          Una vez que recibimos el paquete en bodega, el reembolso sale en un
          máximo de 5 días hábiles al mismo método con el que pagaste. El saldo a
          favor se aplica al instante y no vence.
        </p>
      </Bloque>

      <Bloque titulo="Garantía de originalidad">
        <p>
          Si al recibir tu pedido tienes cualquier duda sobre la autenticidad, te
          devolvemos el 100% de tu dinero. Sin peritaje, sin discusión y sin
          costo de envío para ti. Es la promesa sobre la que está construida la
          tienda.
        </p>
      </Bloque>

      <Bloque titulo="Cambio por rotación, para mayoreo">
        <p>
          En los lotes de 24 y 50 piezas cambiamos hasta el 20% del pedido por
          otro modelo dentro de los primeros 60 días, sin costo. Solo pedimos que
          las piezas estén selladas.
        </p>
        <p>
          Es la forma de que no te quedes con inventario parado si un modelo no
          funciona en tu zona.
        </p>
      </Bloque>

      <Bloque titulo="Qué no podemos aceptar">
        <p>
          Perfumes con menos del 90% de contenido, piezas sin caja o con el
          atomizador dañado por uso, y devoluciones fuera del plazo de 30 días.
          En esos casos podemos ofrecer saldo parcial: escríbenos y lo vemos caso
          por caso.
        </p>
      </Bloque>
    </PaginaInfo>
  );
}
