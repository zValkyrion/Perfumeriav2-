// Piezas para sembrar pedidos en la tabla falsa: las usan las pruebas (con
// cifras puestas a mano, para comprobar las cuentas del panel) y el servidor
// local (con cifras calculadas por `cotizar`, para mirar las pantallas).
//
// Todo lo sembrado es de PRUEBA: nombres, teléfonos y correos inventados que
// solo existen en la memoria de este proceso.

/** Tokens falsos (los acepta `jwt-falso.mjs`): JSON en base64 con `falso: true`. */
export const token = (carga) => Buffer.from(JSON.stringify({ falso: true, ...carga })).toString("base64");

/**
 * El mismo token con forma de JWT (cabecera.carga.firma), para el navegador:
 * la tienda y el panel leen la carga de la parte central y reconocen una
 * sesión de Cognito por `iss`. La firma es de mentira; solo la acepta la API
 * empaquetada para pruebas.
 */
export function tokenNavegador(carga) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const completa = {
    falso: true,
    iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_falso",
    token_use: "id",
    exp: Math.floor(Date.now() / 1000) + 30 * 86_400,
    ...carga,
  };
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(completa)}.prueba`;
}

export const CONTACTO_VACIO = {
  correo: "",
  nombre: "",
  telefono: "",
  calle: "",
  colonia: "",
  cp: "",
  ciudad: "",
  estado: "",
  referencias: "",
};

/** La fila `PEDIDO#<folio>/META` tal como la guarda `crearPedido`. */
export function filaMeta(pedido, creadoEn) {
  return {
    PK: `PEDIDO#${pedido.folio}`,
    SK: "META",
    GSI1PK: "PEDIDOS",
    GSI1SK: `${creadoEn}#${pedido.folio}`,
    creadoEn,
    pedido,
  };
}

/**
 * Un pedido con cifras puestas a mano: lo que importa es que las cuentas del
 * panel salgan iguales a las hechas en papel, no que cuadren con los precios.
 */
export function pedidoAMano({
  folio,
  fecha,
  estatus = "Pendiente",
  contacto = {},
  total,
  piezas,
  metodo = "transferencia",
  envio = "estandar",
  escalon = "Menudeo",
  lineas,
  ahorroVolumen = 0,
  descuentoTransferencia = 0,
  descuentoCupon = 0,
  descuento3x2 = 0,
  cliente,
  extra = {},
}) {
  const items = lineas.map(({ productoId, ml, cantidad }) => ({ productoId, ml, cantidad }));
  return {
    folio,
    fecha,
    estatus,
    solicitud: { items, cupon: null, metodo, envio, contacto: { ...CONTACTO_VACIO, ...contacto }, plazo: null },
    cuenta: {
      piezasSueltas: piezas,
      piezasTotales: piezas,
      subtotalMenudeo: total + ahorroVolumen + descuentoTransferencia + descuentoCupon + descuento3x2,
      subtotal: total,
      ahorroVolumen,
      piezas3x2: 0,
      piezasGratis3x2: 0,
      descuento3x2,
      cupon: null,
      descuentoCupon,
      metodo,
      descuentoTransferencia,
      envio,
      costoEnvio: 0,
      envioGratis: true,
      comision: 0,
      total,
      escalon,
      descartados: 0,
      lineas,
    },
    ...(cliente !== undefined ? { cliente } : {}),
    ...extra,
  };
}

/* ── Datos para el servidor local ─────────────────────────────────────────── */

const NOMBRES = [
  ["Ana Martínez", "Puebla", "Puebla"],
  ["Luis Hernández", "Guadalajara", "Jalisco"],
  ["María López", "Monterrey", "Nuevo León"],
  ["Jorge Ramírez", "Querétaro", "Querétaro"],
  ["Sofía Torres", "Mérida", "Yucatán"],
  ["Carlos Flores", "León", "Guanajuato"],
  ["Daniela Cruz", "Toluca", "Estado de México"],
  ["Ricardo Gómez", "Oaxaca", "Oaxaca"],
];

/**
 * Siembra una tienda de muestra: pedidos de los últimos 40 días en todos los
 * estatus, con y sin cuenta, con perfumes, lotes y sets; solicitudes de los
 * tres tipos y cuentas en los tres grupos. Devuelve los tokens para entrar.
 */
export function sembrarDemo({ puras, catalogo, tabla, agregarUsuario, ahora = new Date() }) {
  const fuente = puras.fuenteDeCatalogo(catalogo);
  const nombrar = puras.nombradorDe(catalogo);
  const vendibles = catalogo.productos.filter((p) => p.visible && !p.agotado).slice(0, 40);
  const lote = catalogo.lotes[0];
  const set = catalogo.sets.find((s) => s.visible && !s.agotado);

  const cuentas = {
    // El correo del dueño, para que la API lo reconozca como superadmin
    // (`compartido/equipo.ts`). Vive solo en la memoria de este proceso.
    superadmin: { sub: "demo-superadmin", correo: "carlos.acosta12121998@gmail.com", nombre: "Dueño de Prueba", grupos: ["admins"] },
    admin: { sub: "demo-admin", correo: "admin@prueba.local", nombre: "Admin de Prueba", grupos: ["admins"] },
    proveedor: { sub: "demo-proveedor", correo: "campo@prueba.local", nombre: "Equipo de Campo", grupos: ["proveedores"] },
    cliente: { sub: "demo-cliente", correo: "cliente@prueba.local", nombre: "Ana Martínez", telefono: "+525512340000", grupos: ["clientes"] },
    otro: { sub: "demo-cliente-2", correo: "luis@prueba.local", nombre: "Luis Hernández", grupos: ["clientes"] },
    sinConfirmar: { sub: "demo-cliente-3", correo: "nueva@prueba.local", nombre: "Cuenta sin confirmar", grupos: ["clientes"], estado: "UNCONFIRMED" },
  };
  for (const c of Object.values(cuentas)) {
    agregarUsuario({ ...c, creado: new Date(ahora.getTime() - 50 * 86_400_000) });
  }

  const ESTATUS = ["Pendiente", "Pagado", "En preparación", "En camino", "Entregado", "Cancelado"];
  const METODOS = ["transferencia", "clip", "contra"];
  let n = 1900;
  const anio = puras.fechaMexico(ahora).slice(0, 4);
  for (let i = 0; i < 34; i++) {
    const creado = new Date(ahora.getTime() - ((i * 29) % 40) * 86_400_000 - (i % 9) * 3_600_000);
    const creadoEn = creado.toISOString();
    const fecha = puras.fechaMexico(creado);
    const [nombre, ciudad, estado] = NOMBRES[i % NOMBRES.length];
    const conCuenta = i % 4 === 0 ? cuentas.cliente : i % 7 === 0 ? cuentas.otro : null;
    const items =
      i % 6 === 0
        ? [{ productoId: lote.slug, ml: 0, cantidad: 1 }]
        : i % 5 === 0 && set
          ? [{ productoId: set.slug, ml: 0, cantidad: 1 }, { productoId: vendibles[i % 40].codigo, ml: 100, cantidad: 2 }]
          : [
              { productoId: vendibles[i % 40].codigo, ml: 100, cantidad: 1 + (i % 4) * 3 },
              { productoId: vendibles[(i * 7) % 40].codigo, ml: 100, cantidad: 1 + (i % 3) },
            ];
    const metodo = METODOS[i % 3];
    const solicitud = {
      items,
      cupon: i % 8 === 3 ? "REY10" : null,
      metodo,
      envio: i % 5 === 2 ? "express" : "estandar",
      contacto: {
        ...CONTACTO_VACIO,
        nombre: conCuenta?.nombre ?? nombre,
        telefono: conCuenta === cuentas.cliente ? "55 1234 0000" : `55 5${String(100 + (i % NOMBRES.length)).padStart(3, "0")} ${String(1000 + i).slice(-4)}`,
        correo: conCuenta?.correo ?? "",
        calle: `Calle de Prueba ${i + 1}`,
        colonia: "Centro",
        cp: "72000",
        ciudad,
        estado,
      },
      plazo: metodo === "clip" && i % 2 === 0 ? 3 : null,
    };
    const cotizacion = puras.cotizar(items, fuente, { cupon: solicitud.cupon, metodo, envio: solicitud.envio });
    const folio = `REY-${anio}-${String(n++).padStart(5, "0")}`;
    const pedido = puras.armarPedidoNuevo({
      folio,
      fecha,
      creadoEn,
      solicitud,
      cotizacion,
      nombrar,
      cliente: conCuenta ? { sub: conCuenta.sub, correo: conCuenta.correo } : null,
    });
    // Avanza por la línea de tiempo hasta su estatus, con quién y cuándo.
    const destino = ESTATUS[i % ESTATUS.length];
    const pasos = destino === "Cancelado" ? ["Cancelado"] : ESTATUS.slice(1, ESTATUS.indexOf(destino) + 1);
    let momento = creado.getTime();
    for (const estatus of pasos) {
      momento += 5 * 3_600_000;
      pedido.historial.push({ estatus, en: new Date(momento).toISOString(), por: estatus === "Cancelado" && i % 2 ? "cliente" : "Admin de Prueba" });
    }
    pedido.estatus = destino;
    pedido.actualizadoEn = pedido.historial.at(-1).en;
    if (destino === "En camino" || destino === "Entregado") {
      pedido.paqueteria = i % 2 ? "estafeta" : "dhl";
      pedido.guia = `PRUEBA${String(i).padStart(6, "0")}`;
      pedido.notaCliente = "Tu paquete va en camino. Cualquier duda, escríbenos por WhatsApp.";
    }
    if (i % 9 === 0) pedido.notaInterna = "Cliente de prueba: confirmar pago antes de surtir.";
    tabla.set(`PEDIDO#${folio}#META`, filaMeta(pedido, creadoEn));
    if (conCuenta) {
      tabla.set(`USER#${conCuenta.sub}#PEDIDO#${folio}`, {
        PK: `USER#${conCuenta.sub}`,
        SK: `PEDIDO#${folio}`,
        creadoEn,
        pedido: { folio, fecha, estatus: "Pendiente", total: cotizacion.total, piezas: cotizacion.piezasTotales, items },
      });
    }
  }
  tabla.set("CONTADOR#PEDIDOS", { PK: "CONTADOR", SK: "PEDIDOS", valor: n - 1 });

  // Un folio de la fórmula vieja, que solo vive como copia en «Mis pedidos».
  tabla.set(`USER#${cuentas.cliente.sub}#PEDIDO#AUR-2025-01100`, {
    PK: `USER#${cuentas.cliente.sub}`,
    SK: "PEDIDO#AUR-2025-01100",
    creadoEn: "2025-11-20T18:00:00.000Z",
    pedido: { folio: "AUR-2025-01100", fecha: "2025-11-20", estatus: "Entregado", total: 1650, piezas: 3, items: [{ productoId: vendibles[0].codigo, ml: 100, cantidad: 3 }] },
  });

  const solicitudes = [
    { tipo: "distribuidor", nombre: "Distribuidora de Prueba", telefono: "5550001111", ciudad: "Puebla", negocio: "Tienda de prueba", volumen: "50 piezas al mes", mensaje: "Quiero vender en mi tienda." },
    { tipo: "contacto", nombre: "Persona de Prueba", telefono: "5550002222", correo: "contacto@prueba.local", mensaje: "¿Hacen envíos a Chiapas?" },
    { tipo: "factura", nombre: "Ana Martínez", telefono: "5512340000", correo: cuentas.cliente.correo, folio: `REY-${anio}-01900`, rfc: "XAXX010101000", razonSocial: "PRUEBA SA DE CV", regimen: "601", cpFiscal: "72000", usoCfdi: "G03" },
    { tipo: "distribuidor", nombre: "Otra Distribuidora", telefono: "5550003333", ciudad: "León", volumen: "100 piezas" },
  ];
  solicitudes.forEach((s, i) => {
    const creadaEn = new Date(ahora.getTime() - (i * 3 + 1) * 86_400_000).toISOString();
    const id = `demo-solicitud-${i + 1}`;
    const estado = ["nueva", "en proceso", "nueva", "cerrada"][i];
    tabla.set(`SOLICITUD#${id}#META`, {
      PK: `SOLICITUD#${id}`,
      SK: "META",
      GSI1PK: "SOLICITUDES",
      GSI1SK: `${creadaEn}#${id}`,
      solicitud: { ...s, id, creadaEn, actualizadaEn: creadaEn, estado, nota: null, sub: s.tipo === "factura" ? cuentas.cliente.sub : null },
    });
  });

  // Luis pidió entrar al equipo: «Equipo y cuentas» la enseña por aceptar.
  const pidio = new Date(ahora.getTime() - 2 * 3_600_000).toISOString();
  tabla.set(`EQUIPO#${cuentas.otro.sub}#SOLICITUD`, {
    PK: `EQUIPO#${cuentas.otro.sub}`,
    SK: "SOLICITUD",
    GSI1PK: "EQUIPO",
    GSI1SK: `${pidio}#${cuentas.otro.sub}`,
    solicitud: {
      sub: cuentas.otro.sub,
      nombre: cuentas.otro.nombre,
      correo: cuentas.otro.correo,
      mensaje: "Soy Luis, voy a apoyar con las visitas a proveedores en Guadalajara.",
      estado: "pendiente",
      creadaEn: pidio,
      resueltaEn: null,
      resueltaPor: null,
      grupo: null,
    },
  });

  const tokenDe = (c) =>
    tokenNavegador({
      sub: c.sub,
      email: c.correo,
      email_verified: true,
      name: c.nombre,
      ...(c.telefono ? { phone_number: c.telefono } : {}),
      "cognito:groups": c.grupos,
    });
  return {
    sesiones: {
      superadmin: { token: tokenDe(cuentas.superadmin), nombre: cuentas.superadmin.nombre },
      admin: { token: tokenDe(cuentas.admin), nombre: cuentas.admin.nombre },
      proveedor: { token: tokenDe(cuentas.proveedor), nombre: cuentas.proveedor.nombre },
      cliente: { token: tokenDe(cuentas.cliente), nombre: cuentas.cliente.nombre },
      otro: { token: tokenDe(cuentas.otro), nombre: cuentas.otro.nombre },
    },
    pedidos: 34,
  };
}
