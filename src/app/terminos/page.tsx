import type { Metadata } from "next";
import { Bloque, PaginaInfo } from "@/components/comunes/pagina-info";
import { MARCA } from "@/data/contenido";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso de la tienda en línea de AURA Perfumes.",
  robots: { index: true, follow: true },
};

export default function TerminosPage() {
  return (
    <PaginaInfo
      eyebrow="Legal"
      titulo="Términos y condiciones"
      entrada={`Al comprar en ${MARCA.nombre} aceptas estas condiciones. Están escritas para que se entiendan a la primera.`}
      actualizado="1 de agosto de 2026"
    >
      <Bloque titulo="1. Sobre esta tienda">
        <p>
          Este sitio es una demostración de comercio electrónico construida con
          datos ficticios. Las marcas, productos, precios, reseñas y pedidos que
          aparecen aquí son originales e inventados para fines de demostración, y
          no corresponden a productos reales a la venta.
        </p>
      </Bloque>

      <Bloque titulo="2. Precios y disponibilidad">
        <p>
          Los precios se muestran en pesos mexicanos (MXN) e incluyen IVA. El
          descuento por volumen se calcula sobre el total de piezas del pedido y
          se aplica automáticamente en el carrito.
        </p>
        <p>
          El inventario mostrado corresponde a la existencia real de bodega.
          Si una pieza se agota entre tu pedido y el despacho, te avisamos el
          mismo día y puedes elegir reemplazo o reembolso completo.
        </p>
      </Bloque>

      <Bloque titulo="3. Promociones">
        <p>
          La promoción 3x2 aplica sobre los modelos marcados con esa etiqueta: al
          llevar tres piezas participantes, la de menor precio no se cobra. Las
          promociones tienen fecha de término publicada y no son acumulables
          entre sí, aunque sí se suman al descuento por volumen.
        </p>
        <p>
          El cupón de bienvenida es de un solo uso por cliente y se aplica sobre
          el subtotal después del descuento por volumen.
        </p>
      </Bloque>

      <Bloque titulo="4. Pagos">
        <p>
          Aceptamos tarjeta de crédito y débito, transferencia SPEI, efectivo en
          tiendas de conveniencia y pago contra entrega en zonas seleccionadas.
          Los meses sin intereses dependen del banco emisor y del monto mínimo
          publicado en el checkout.
        </p>
      </Bloque>

      <Bloque titulo="5. Envíos y devoluciones">
        <p>
          Las condiciones de envío y la política de devoluciones se detallan en
          sus propias páginas y forman parte de estos términos.
        </p>
      </Bloque>

      <Bloque titulo="6. Propiedad intelectual">
        <p>
          La marca AURA, sus textos, su identidad visual y las descripciones de
          producto de este sitio son originales y pertenecen a sus autores. Las
          casas de perfumería mencionadas son ficticias.
        </p>
      </Bloque>

      <Bloque titulo="7. Contacto">
        <p>
          Para cualquier aclaración sobre estos términos, escríbenos a{" "}
          {MARCA.correo} o por WhatsApp al {MARCA.whatsapp}.
        </p>
      </Bloque>
    </PaginaInfo>
  );
}
