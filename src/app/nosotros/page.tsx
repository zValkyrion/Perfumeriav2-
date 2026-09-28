import type { Metadata } from "next";
import { Bloque, PaginaInfo } from "@/components/comunes/pagina-info";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Quiénes somos: un distribuidor mexicano de perfumería fina que vende al menudeo y al mayoreo desde 3 piezas.",
  alternates: { canonical: "/nosotros" },
};

export default function NosotrosPage() {
  // La entrada seguía con «empezamos en una sala en León y hoy despachamos a
  // más de 1,500 clientes», y «Dos clientes» afirmaba que la mitad de los
  // pedidos son de una o dos piezas: historia y cifras de la plantilla, sin
  // respaldo (MEMORIA §0.3, no inventar datos).
  return (
    <PaginaInfo
      eyebrow="Quiénes somos"
      titulo="La misma fragancia. El mismo frasco. Sin pagar la etiqueta."
      entrada="Hacemos perfumería 1:1: equivalencias exactas de las grandes fragancias, en olor y en frasco, a una fracción del precio. Vendemos por pieza y al mayoreo, con envío a todo el país."
    >
      <Bloque titulo="Por qué existimos">
        <p>
          Un perfume de gama alta cuesta lo que cuesta por tres motivos: la
          fórmula, el frasco y la etiqueta. De esos tres, el último es el más
          caro y el único que no se huele. Ahí es donde entramos.
        </p>
        <p>
          EL REY DE LOS PERFUMES nació para que no tengas que elegir entre pagar
          precio de tienda departamental o arriesgarte en un tianguis con algo
          que se evapora en veinte minutos. Publicamos el precio real en la
          ficha —no un “consulta disponibilidad”— y damos el mismo trato a quien
          compra un frasco que a quien compra cincuenta.
        </p>
      </Bloque>

      <Bloque titulo="Dos clientes, una sola tienda">
        <p>
          Nos compra gente que se está dando un gusto con una o dos piezas, y
          revendedoras y revendedores que compran de diez perfumes para arriba y
          viven de ese margen.
        </p>
        <p>
          Por eso el precio baja solo al agregar piezas al carrito, sin registros
          ni papeleo. Desde 3 perfumes ya hay 10% de descuento y envío gratis; con
          20 o más se llega al precio de distribuidor, y pagando por
          transferencia se suma 10% más.
        </p>
      </Bloque>

      <Bloque titulo="Qué quiere decir 1:1, exactamente">
        <p>
          Quiere decir que replicamos la construcción olfativa completa, no un
          parecido de salida: las mismas notas arriba, el mismo corazón y el
          mismo fondo, con la misma evolución en la piel a lo largo del día. Y
          que el frasco es idéntico en forma, peso de vidrio, tapa y
          atomizador.
        </p>
        <p>
          Lo que no somos: no somos la casa original ni vendemos su producto.
          Somos su equivalencia exacta a una fracción del precio. Lo decimos
          claro porque un cliente que sabe lo que compra vuelve, y uno que se
          siente engañado no.
        </p>
        <p>
          Si al probarlo consideras que no cumple ese 1:1, tienes 30 días para
          devolverlo. Nosotros pagamos la guía de retorno, sin discusiones.
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
