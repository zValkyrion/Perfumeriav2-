import type { Metadata } from "next";
import { Bloque, PaginaInfo } from "@/components/comunes/pagina-info";
import { MARCA } from "@/data/contenido";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description:
    "Qué datos pedimos, para qué los usamos y cómo ejercer tus derechos ARCO.",
  alternates: { canonical: "/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <PaginaInfo
      eyebrow="Legal"
      titulo="Aviso de privacidad"
      entrada="Pedimos lo mínimo necesario para entregarte tu pedido, y nada más."
      actualizado="1 de agosto de 2026"
    >
      <Bloque titulo="Naturaleza de este sitio">
        <p>
          Este sitio es una demostración técnica. No existe servidor, base de
          datos ni pasarela de pago: todo ocurre dentro de tu navegador. Tu
          carrito, tus favoritos y tus preferencias se guardan únicamente en el
          almacenamiento local de tu dispositivo y no se envían a ningún lado.
        </p>
        <p>
          Puedes borrarlos en cualquier momento limpiando los datos del sitio
          desde tu navegador.
        </p>
      </Bloque>

      <Bloque titulo="Qué datos pediríamos en una tienda real">
        <p>
          Nombre, correo, teléfono y dirección de envío: los datos
          indispensables para preparar el paquete, entregarlo y avisarte por
          dónde va. Nada de fecha de nacimiento, género ni información que no
          haga falta para cumplir con el pedido.
        </p>
      </Bloque>

      <Bloque titulo="Para qué se usarían">
        <p>
          Exclusivamente para procesar el pedido, enviarte la guía de rastreo,
          emitir tu factura si la pides y atenderte por WhatsApp. Si te suscribes
          al boletín, también para mandarte ofertas; puedes darte de baja desde
          cualquier correo con un clic.
        </p>
        <p>
          No vendemos ni compartimos datos con terceros para fines publicitarios.
        </p>
      </Bloque>

      <Bloque titulo="Datos de pago">
        <p>
          En una tienda real, los datos de tarjeta los procesaría directamente la
          pasarela de pago certificada, sin que la tienda los almacene en ningún
          momento. En esta demostración el formulario de pago valida el formato
          pero no envía ni guarda absolutamente nada.
        </p>
      </Bloque>

      <Bloque titulo="Derechos ARCO">
        <p>
          Puedes solicitar el acceso, la rectificación, la cancelación o la
          oposición al tratamiento de tus datos escribiendo a {MARCA.correo}. En
          una operación real tendríamos 20 días hábiles para responder.
        </p>
      </Bloque>

      <Bloque titulo="Cookies">
        <p>
          Este sitio no usa cookies de rastreo ni de publicidad. Solo emplea el
          almacenamiento local del navegador para recordar tu carrito, tus
          favoritos y si cerraste la barra de anuncios.
        </p>
      </Bloque>
    </PaginaInfo>
  );
}
