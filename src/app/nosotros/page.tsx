import type { Metadata } from "next";
import { Bloque, PaginaInfo } from "@/components/comunes/pagina-info";
import { MARCA } from "@/data/contenido";
import { numero } from "@/lib/format";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Quiénes somos: un distribuidor mexicano de perfumería fina que vende al menudeo y al mayoreo desde 3 piezas.",
};

export default function NosotrosPage() {
  return (
    <PaginaInfo
      eyebrow="Quiénes somos"
      titulo="Perfumería fina para quien emprende y para quien se consiente."
      entrada={`Somos un distribuidor mexicano de perfumes de diseñador, árabes e inspirados. Empezamos vendiendo por WhatsApp desde una sala en León y hoy despachamos a más de ${numero(MARCA.clientes)} clientes y revendedores en todo el país.`}
    >
      <Bloque titulo="Por qué existimos">
        <p>
          Cuando arrancamos, comprar perfume original en México significaba
          pagar precio de tienda departamental o arriesgarse en un tianguis. En
          medio no había nada: ni catálogo serio, ni precios claros, ni alguien
          que te explicara la diferencia entre un Eau de Toilette y un Parfum.
        </p>
        <p>
          EL REY DE LOS PERFUMES se construyó para ocupar ese hueco. Trabajamos con distribuidores
          autorizados, publicamos el precio real en la ficha —no un “consulta
          disponibilidad”— y damos el mismo trato a quien compra un frasco que a
          quien compra cincuenta.
        </p>
      </Bloque>

      <Bloque titulo="Dos clientes, una sola tienda">
        <p>
          La mitad de nuestros pedidos son de una o dos piezas: gente que se está
          dando un gusto. La otra mitad son revendedoras y revendedores que
          compran de 12 piezas para arriba y viven de ese margen.
        </p>
        <p>
          Por eso el precio baja solo al agregar piezas al carrito, sin registros
          ni papeleo. Desde 3 piezas ya hay 15% de descuento y envío gratis; con
          12 o más se llega al precio de distribuidor.
        </p>
      </Bloque>

      <Bloque titulo="Cómo garantizamos la originalidad">
        <p>
          Cada pieza llega sellada de fábrica, con su celofán original. Compramos
          por lote a distribuidores autorizados y conservamos la trazabilidad de
          cada uno.
        </p>
        <p>
          Si al recibir tu pedido tienes cualquier duda sobre la autenticidad, te
          devolvemos el 100% de tu dinero y nosotros pagamos la guía de retorno.
          Sin peritajes ni discusiones.
        </p>
      </Bloque>

      <Bloque titulo="Personas, no bots">
        <p>
          Nuestro WhatsApp lo contesta gente que conoce el catálogo y que ha
          olido lo que vende. Si preguntas qué llevarte para una boda en agosto
          en Mérida, la respuesta va a ser distinta que para una oficina en
          Toluca en enero. Ese es el punto.
        </p>
      </Bloque>
    </PaginaInfo>
  );
}
