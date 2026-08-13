import type { Metadata } from "next";
import { Bloque, PaginaInfo } from "@/components/comunes/pagina-info";
import { OPCIONES_ENVIO, PAQUETERIAS } from "@/data/contenido";
import { precio } from "@/lib/format";

export const metadata: Metadata = {
  title: "Envíos",
  description:
    "Envío gratis desde 3 piezas a todo México. Entrega en 2 a 5 días con DHL, Estafeta, FedEx o 99 Minutos y guía de rastreo el mismo día.",
};

export default function EnviosPage() {
  return (
    <PaginaInfo
      eyebrow="Ayuda"
      titulo="Envíos"
      entrada="Enviamos a todo México. Desde 3 piezas el envío corre por nuestra cuenta, sin importar el código postal."
      actualizado="1 de agosto de 2026"
    >
      <Bloque titulo="Opciones y tiempos">
        <div className="border-border-soft overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-surface text-fg-subtle border-border-soft border-b text-[11px] tracking-[0.14em] uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">
                  Servicio
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Tiempo
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  Costo
                </th>
              </tr>
            </thead>
            <tbody className="divide-border-soft divide-y">
              {OPCIONES_ENVIO.map((o) => (
                <tr key={o.id}>
                  <td className="text-fg px-4 py-3.5">
                    {o.nombre}
                    <span className="text-fg-subtle block text-xs">
                      {o.detalle}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">{o.tiempo}</td>
                  <td data-precio className="px-4 py-3.5 text-right">
                    {o.precio === 0 ? (
                      <span className="text-success font-medium">GRATIS</span>
                    ) : (
                      precio(o.precio)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          El envío estándar es gratis en pedidos de 3 piezas o más. Por debajo de
          esa cantidad cuesta {precio(149)} MXN.
        </p>
      </Bloque>

      <Bloque titulo="Cuándo sale tu pedido">
        <p>
          Los pedidos confirmados antes de la 1:00 pm de lunes a viernes salen el
          mismo día. Después de esa hora, y los fines de semana, salen el
          siguiente día hábil.
        </p>
        <p>
          En cuanto entregamos el paquete a la paquetería te mandamos el número
          de guía por correo y por WhatsApp. No tienes que pedirlo.
        </p>
      </Bloque>

      <Bloque titulo="Paqueterías con las que trabajamos">
        <p>
          Asignamos {PAQUETERIAS.join(", ")} según tu código postal, eligiendo la
          que mejor cobertura tiene en tu zona. Todos los envíos van asegurados.
        </p>
      </Bloque>

      <Bloque titulo="Cómo empacamos">
        <p>
          Cada frasco viaja en su caja original, envuelto en burbuja y dentro de
          una caja rígida con relleno. Nada va suelto. Si aun así tu pedido llega
          dañado, mándanos una foto el mismo día y lo reponemos sin costo.
        </p>
      </Bloque>

      <Bloque titulo="Si el paquete no llega">
        <p>
          Si la guía deja de moverse más de 5 días hábiles, escríbenos con tu
          folio: abrimos la investigación con la paquetería y, si no aparece,
          reponemos el pedido completo. No te dejamos negociando con la
          mensajería.
        </p>
      </Bloque>
    </PaginaInfo>
  );
}
