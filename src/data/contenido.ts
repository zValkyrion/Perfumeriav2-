/** Datos de marca, copy institucional y contenido editorial de la tienda. */

export const MARCA = {
  nombre: "EL REY DE LOS PERFUMES",
  tagline: "La misma fragancia. El mismo frasco. Sin pagar la etiqueta.",
  whatsapp: "477 123 4567",
  whatsappLink:
    "https://wa.me/524771234567?text=Hola%2C%20vengo%20de%20la%20tienda%20en%20l%C3%ADnea%20y%20tengo%20una%20duda",
  correo: "contacto@elreydelosperfumes.mx",
  instagram: "https://instagram.com",
  facebook: "https://facebook.com",
  tiktok: "https://tiktok.com",
  // Cifra deliberadamente modesta: da más confianza que un número redondo
  // enorme, que es lo que hace sospechar al cliente.
  clientes: 1500,
  ratingGlobal: 4.9,
} as const;

/**
 * Fin de la promoción 3x2. Fecha fija y real: el contador nunca se reinicia
 * (§1.2.2). Si ya pasó, el banner se muestra sin cuenta regresiva en vez de
 * fingir urgencia.
 */
export const FIN_PROMO_3X2 = "2026-08-31T23:59:59-06:00";

export const ANUNCIOS = [
  "✨ CALIDAD 1:1 — IDÉNTICO AL ORIGINAL",
  "🚚 ENVÍO GRATIS DESDE 3 PIEZAS",
  "💳 6 MESES SIN INTERESES",
  "🔥 3x2 EN TODA LA TIENDA",
] as const;

/**
 * Promesas de marca.
 *
 * El mensaje es la equivalencia 1:1, no la autenticidad: presumimos de que la
 * fragancia y el frasco son idénticos, sin afirmar en ningún punto que sea el
 * producto de la casa original. Prometer lo segundo sería engañoso y además
 * expondría a la tienda a una reclamación.
 */
export const GARANTIAS = [
  {
    icono: "sello",
    titulo: "Calidad 1:1",
    texto: "Misma fragancia y mismo frasco. Nadie nota la diferencia.",
  },
  {
    icono: "camion",
    titulo: "Envío gratis desde 3 piezas",
    texto: "A todo México. Llega en 2 a 5 días hábiles.",
  },
  {
    icono: "tarjeta",
    titulo: "Hasta 6 meses sin intereses",
    texto: "Con tarjetas participantes, desde $ 2,500.00 MXN.",
  },
  {
    icono: "devolucion",
    titulo: "Si no da el 1:1, te devolvemos",
    texto: "30 días para probarlo. Nosotros pagamos la guía.",
  },
] as const;

export const PASOS_ENVIO = [
  {
    titulo: "Sale sellado y con su caja",
    texto:
      "Cada frasco viaja celofanado, con burbuja y dentro de caja rígida. Listo para regalar o para poner en tu mostrador.",
  },
  {
    titulo: "Guía de rastreo el mismo día",
    texto:
      "En cuanto lo entregamos a paquetería te llega el número de guía por WhatsApp y correo. Sin tener que pedirlo.",
  },
  {
    titulo: "Entrega en 2 a 5 días",
    texto:
      "Estafeta, DHL, FedEx o 99 Minutos según tu código postal. En zonas metropolitanas suele llegar en 48 horas.",
  },
] as const;

export const FAQ_HOME = [
  {
    p: "¿Qué significa que sean 1:1?",
    r: "Que replican al detalle la fragancia y el frasco de la casa en la que se inspiran: la misma pirámide olfativa, la misma evolución en la piel y una botella idéntica en forma, peso y acabado. No son el producto de esa casa ni lo vendemos como tal: es una equivalencia 1:1 a una fracción del precio, sin pagar la etiqueta ni la publicidad.",
  },
  {
    p: "¿Cuánto tarda mi pedido en llegar?",
    r: "Entre 2 y 5 días hábiles a todo México. En zonas metropolitanas normalmente llega en 48 horas. Los pedidos hechos antes de la 1:00 pm salen el mismo día; después de esa hora salen al día hábil siguiente.",
  },
  {
    p: "¿Desde cuántas piezas tengo precio de mayoreo?",
    r: "Desde 3 piezas ya bajas 15% y el envío te sale gratis. Con 6 piezas el descuento sube a 25% y con 12 o más llegas a 40%, que es el precio de distribuidor. No necesitas registrarte ni comprobar nada: el precio baja solo al agregar las piezas al carrito.",
  },
  {
    p: "¿Puedo mezclar modelos distintos para llegar al mayoreo?",
    r: "Sí, y es lo que recomendamos. El descuento se calcula sobre el total de piezas del pedido, no por modelo. Puedes armar 12 piezas con doce fragancias diferentes y aun así pagas precio de distribuidor.",
  },
  {
    p: "¿Cómo puedo pagar?",
    r: "Tarjeta de crédito o débito, transferencia SPEI, efectivo en OXXO y pago contra entrega en zonas seleccionadas. Con tarjetas participantes tienes 3, 6, 9 o 12 meses sin intereses según el monto de tu compra.",
  },
  {
    p: "¿Desde qué monto hay meses sin intereses?",
    r: "Desde $ 1,200.00 MXN tienes 3 meses; desde $ 2,500.00 MXN, 6 meses; desde $ 5,000.00 MXN, 9 meses; y desde $ 8,000.00 MXN, 12 meses. El plazo se elige en el paso de pago y se muestra la mensualidad exacta antes de confirmar.",
  },
  {
    p: "¿De verdad huele igual? ¿Y cuánto dura?",
    r: "Igual de salida, igual en el corazón e igual en el fondo: es la misma construcción olfativa, no un parecido lejano. En duración trabajamos con concentraciones altas, así que un Eau de Parfum nuestro rinde de 6 a 9 horas y un Parfum pasa de 10. Si al probarlo sientes que no da el 1:1 que prometemos, lo devuelves dentro de 30 días y pagamos nosotros la guía.",
  },
  {
    p: "¿El frasco también es idéntico?",
    r: "Sí: misma forma, mismo peso de vidrio, mismo tipo de tapa y el mismo atomizador de rocío fino. Es la parte que más miran quienes revenden, porque un frasco ligero o un atomizador que gotea delatan el producto al instante. Puedes girar uno en tres dimensiones en nuestra página de inicio.",
  },
  {
    p: "¿Qué pasa si el perfume no me gusta?",
    r: "Tienes 30 días naturales para devolverlo. Solo pedimos que conserve al menos el 90% de su contenido y su caja. Nosotros generamos y pagamos la guía de retorno, y te devolvemos el dinero o te damos saldo a favor, como prefieras.",
  },
  {
    p: "¿Tienen pago contra entrega?",
    r: "Sí, en zonas metropolitanas de León, Guadalajara, CDMX, Monterrey, Puebla y Querétaro para pedidos de hasta $ 3,000.00 MXN. Al elegir tu código postal en el checkout te decimos si tu domicilio califica.",
  },
  {
    p: "¿Cuánto dura un perfume en la piel?",
    r: "Depende de la concentración. Un Eau de Toilette rinde de 4 a 6 horas, un Eau de Parfum de 6 a 9, y un Parfum puede pasar de 10. En cada ficha de producto verás la barra de duración y proyección medida en piel, no la que dice el fabricante.",
  },
  {
    p: "¿Facturan?",
    r: "Sí, sin costo adicional. Puedes solicitar tu factura desde tu cuenta dentro de los 30 días del mes en que compraste, o escribirnos por WhatsApp con tu folio y tus datos fiscales y la emitimos el mismo día.",
  },
] as const;

export const FAQ_MAYOREO = [
  {
    p: "¿Necesito RFC o acta constitutiva para comprar al mayoreo?",
    r: "No. El precio de mayoreo se activa por volumen, no por papeleo. Compras 3 piezas y ya tienes 15%. Si además quieres factura, la emitimos con tus datos fiscales sin problema.",
  },
  {
    p: "¿Cuál es el pedido mínimo?",
    r: "No hay mínimo. Puedes comprar una sola pieza a precio de menudeo. El mayoreo empieza en 3 piezas y de ahí el precio va bajando por escalones.",
  },
  {
    p: "¿A cómo debo revender?",
    r: "Con cada lote te mandamos una lista de precios sugeridos. Como referencia, vendiendo al precio de menudeo que publicamos en la tienda tu margen va del 28% en el lote de 6 piezas hasta el 55% en el de 50.",
  },
  {
    p: "¿Puedo elegir qué modelos vienen en mi lote?",
    r: "En los lotes armados no, porque el precio depende de esa mezcla exacta. Si quieres elegir modelo por modelo, agrega las piezas sueltas al carrito: a partir de 12 llegas al mismo 40% de descuento del precio distribuidor.",
  },
  {
    p: "¿Qué pasa si un modelo no me rota?",
    r: "En los lotes de 24 y 50 piezas te cambiamos hasta el 20% del pedido por otro modelo dentro de los primeros 60 días, sin costo. Solo pedimos que las piezas estén selladas.",
  },
  {
    p: "¿Manejan precios especiales para volúmenes mayores a 50 piezas?",
    r: "Sí. A partir de 100 piezas trabajamos precio negociado y asignamos un asesor. Escríbenos por WhatsApp con el volumen estimado y te mandamos la propuesta el mismo día.",
  },
] as const;

export const RAZONES_MAYOREO = [
  {
    titulo: "Sin mínimo y sin papeleo",
    texto:
      "Tres piezas y ya tienes precio de mayoreo. Ni RFC, ni contrato, ni cuota de inscripción.",
  },
  {
    titulo: "Mezclas los modelos que quieras",
    texto:
      "El descuento se calcula sobre el total de piezas del pedido, no por modelo. Armas el surtido a tu gusto.",
  },
  {
    titulo: "Envío gratis siempre",
    texto:
      "Desde 3 piezas el envío corre por nuestra cuenta, a cualquier código postal del país.",
  },
  {
    titulo: "Inventario real",
    texto:
      "Lo que ves en stock es lo que hay en bodega. No vendemos sobre pedido ni te dejamos esperando semanas.",
  },
  {
    titulo: "Cambio de modelo que no rota",
    texto:
      "En lotes de 24 y 50 piezas cambiamos hasta el 20% del pedido en los primeros 60 días, sin costo.",
  },
  {
    titulo: "Te atienden personas",
    texto:
      "Un asesor real por WhatsApp que conoce el catálogo y te dice qué se está moviendo en tu zona.",
  },
] as const;

export const TESTIMONIOS_MAYOREO = [
  {
    autor: "Yatzil Contreras",
    ciudad: "Irapuato, Gto.",
    tiempo: "2 años vendiendo",
    texto:
      "Empecé con el lote de 6 porque no quería arriesgar. Lo vendí en diez días y desde entonces pido el de 24 cada mes. Hoy es de donde sale la colegiatura de mis hijos.",
  },
  {
    autor: "Ricardo Peñaloza",
    ciudad: "Mérida, Yuc.",
    tiempo: "1 año vendiendo",
    texto:
      "Tengo una barbería y empecé vendiendo perfume a los clientes mientras esperaban. Ahora el mostrador de perfumes deja más que dos sillas de corte.",
  },
  {
    autor: "Brenda Sarmiento",
    ciudad: "Tijuana, B.C.",
    tiempo: "3 años vendiendo",
    texto:
      "Lo que me convenció fue poder mezclar modelos. Otros mayoristas te obligan a llevar doce iguales y se te queda parado el inventario. Aquí armo el surtido según lo que me piden.",
  },
  {
    autor: "Gustavo Lira",
    ciudad: "Puebla, Pue.",
    tiempo: "8 meses vendiendo",
    texto:
      "Pedí un lote de 50 en marzo y lo terminé en seis semanas. La guía de rastreo llegó el mismo día y el paquete venía bien empacado, ni un frasco maltratado.",
  },
] as const;

export const OPCIONES_ENVIO = [
  {
    id: "estandar",
    nombre: "Estándar",
    tiempo: "3 a 5 días hábiles",
    precio: 0,
    detalle: "Estafeta o DHL · gratis en pedidos de 3 piezas o más",
  },
  {
    id: "express",
    nombre: "Express",
    tiempo: "1 a 2 días hábiles",
    precio: 180,
    detalle: "FedEx Día Siguiente · disponible en zonas metropolitanas",
  },
  {
    id: "mismo-dia",
    nombre: "Mismo día",
    tiempo: "Hoy, antes de las 9 pm",
    precio: 250,
    detalle: "99 Minutos · solo CDMX y área metropolitana",
  },
] as const;

export type IdEnvio = (typeof OPCIONES_ENVIO)[number]["id"];

export const METODOS_PAGO = [
  "Visa",
  "Mastercard",
  "American Express",
  "PayPal",
  "Mercado Pago",
  "OXXO",
] as const;

export const PAQUETERIAS = ["DHL", "Estafeta", "FedEx", "99 Minutos"] as const;

/** Códigos postales que autocompletan estado y ciudad en el checkout (§12). */
export const CP_CONOCIDOS: Record<string, { ciudad: string; estado: string }> = {
  "37160": { ciudad: "León", estado: "Guanajuato" },
  "37000": { ciudad: "León", estado: "Guanajuato" },
  "44100": { ciudad: "Guadalajara", estado: "Jalisco" },
  "45050": { ciudad: "Zapopan", estado: "Jalisco" },
  "06700": { ciudad: "Ciudad de México", estado: "CDMX" },
  "03100": { ciudad: "Ciudad de México", estado: "CDMX" },
  "64000": { ciudad: "Monterrey", estado: "Nuevo León" },
  "66220": { ciudad: "San Pedro Garza García", estado: "Nuevo León" },
  "72000": { ciudad: "Puebla", estado: "Puebla" },
  "76000": { ciudad: "Querétaro", estado: "Querétaro" },
  "97000": { ciudad: "Mérida", estado: "Yucatán" },
  "22000": { ciudad: "Tijuana", estado: "Baja California" },
  "20000": { ciudad: "Aguascalientes", estado: "Aguascalientes" },
  "91000": { ciudad: "Xalapa", estado: "Veracruz" },
  "80000": { ciudad: "Culiacán", estado: "Sinaloa" },
};

/** Códigos postales con pago contra entrega disponible. */
export const CP_CONTRA_ENTREGA = new Set([
  "37160",
  "37000",
  "44100",
  "45050",
  "06700",
  "03100",
  "64000",
  "66220",
  "72000",
  "76000",
]);
