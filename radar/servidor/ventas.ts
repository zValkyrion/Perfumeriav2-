import { nivelDePiezas } from "../../compartido/niveles";
import { ESTATUS_PEDIDO, esVendido, estatusDe, type EstatusPedido } from "../../compartido/pedido";
import { ESCALONES } from "../../compartido/reglas";
import {
  ETIQUETAS_ENVIO,
  ETIQUETAS_METODO,
  type ClienteAdmin,
  type ResumenVentas,
} from "../../compartido/tienda-admin";
import { claveCliente, contactoDe, diasEntre, lineasDe, type FilaPedido } from "./pedidos-formas";
import type { Nombrador } from "./tienda";

/**
 * Las cuentas del panel de ventas y de clientes, sobre filas ya leídas.
 *
 * Puras a propósito: se calculan en la Lambda sobre el rango pedido (a este
 * volumen, unos cientos de pedidos al mes, no vale la pena mantener agregados
 * aparte), y así se prueban con cifras hechas a mano sin tabla.
 *
 * **El día es el de México** (`pedido.fecha`), no el de `creadoEn`, que va en
 * UTC: un pedido de las 8 de la noche es de ese día, no del siguiente.
 */

const redondear = (n: number) => Math.round(n * 100) / 100;

type Acumulado = { pedidos: number; ingresos: number };

function sumar(mapa: Map<string, Acumulado>, clave: string, ingresos: number) {
  const a = mapa.get(clave) ?? { pedidos: 0, ingresos: 0 };
  a.pedidos++;
  a.ingresos += ingresos;
  mapa.set(clave, a);
}

function desglose(
  mapa: Map<string, Acumulado>,
  etiquetas: Record<string, string>,
): ResumenVentas["porMetodo"] {
  // Las claves conocidas salen siempre, aunque estén en cero: el panel pinta
  // la misma tabla todos los meses y un hueco se lee como «no hubo».
  const claves = new Set([...Object.keys(etiquetas), ...mapa.keys()]);
  return [...claves]
    .map((clave) => {
      const a = mapa.get(clave) ?? { pedidos: 0, ingresos: 0 };
      return {
        clave,
        etiqueta: etiquetas[clave] ?? (clave === "" ? "Sin dato" : clave),
        pedidos: a.pedidos,
        ingresos: redondear(a.ingresos),
      };
    })
    .sort((a, b) => b.ingresos - a.ingresos || b.pedidos - a.pedidos);
}

const ETIQUETAS_ESCALON: Record<string, string> = Object.fromEntries(
  ESCALONES.map((e) => [e.nombre, `${e.nombre} (${e.max === null ? `${e.min}+` : `${e.min}–${e.max}`} piezas)`]),
);

/**
 * El resumen de ventas de un rango.
 *
 * @param filas Todos los pedidos que se tengan (no solo los del rango): los
 *   clientes recurrentes se miden contra el histórico.
 */
export function resumenVentas(
  filas: FilaPedido[],
  desde: string,
  hasta: string,
  opciones: { nombrar?: Nombrador; truncado?: boolean } = {},
): ResumenVentas {
  const enRango = filas.filter((f) => f.pedido.fecha >= desde && f.pedido.fecha <= hasta);

  const porDia = new Map(
    diasEntre(desde, hasta).map((fecha) => [fecha, { fecha, pedidos: 0, vendidos: 0, ingresos: 0, piezas: 0 }]),
  );
  const porEstatus = new Map<EstatusPedido, { pedidos: number; total: number }>(
    ESTATUS_PEDIDO.map((e) => [e, { pedidos: 0, total: 0 }]),
  );
  const porMetodo = new Map<string, Acumulado>();
  const porEnvio = new Map<string, Acumulado>();
  const porEscalon = new Map<string, Acumulado>();
  const productos = new Map<string, { productoId: string; ml: number; nombre: string; piezas: number; ingresos: number }>();
  const clientes = new Map<
    string,
    { clave: string; nombre: string; telefono: string; correo: string; pedidos: number; ingresos: number; ultimo: string }
  >();
  const descuentos = { volumen: 0, transferencia: 0, cupon: 0, tresPorDos: 0 };

  let vendidos = 0;
  let pendientes = 0;
  let cancelados = 0;
  let ingresos = 0;
  let porCobrar = 0;
  let piezas = 0;

  for (const fila of enRango) {
    const p = fila.pedido;
    const estatus = estatusDe(p.estatus);
    const total = p.cuenta?.total ?? 0;
    const piezasPedido = p.cuenta?.piezasTotales ?? 0;
    const dia = porDia.get(p.fecha);
    if (dia) dia.pedidos++;

    const e = porEstatus.get(estatus)!;
    e.pedidos++;
    e.total += total;

    if (estatus === "Pendiente") {
      pendientes++;
      porCobrar += total;
    }
    if (estatus === "Cancelado") cancelados++;
    if (!esVendido(estatus)) continue;

    vendidos++;
    ingresos += total;
    piezas += piezasPedido;
    if (dia) {
      dia.vendidos++;
      dia.ingresos += total;
      dia.piezas += piezasPedido;
    }

    sumar(porMetodo, p.cuenta?.metodo ?? p.solicitud?.metodo ?? "", total);
    sumar(porEnvio, p.cuenta?.envio ?? p.solicitud?.envio ?? "", total);
    sumar(porEscalon, p.cuenta?.escalon ?? "", total);

    for (const l of lineasDe(p, opciones.nombrar)) {
      const clave = `${l.productoId}|${l.ml}`;
      const a = productos.get(clave) ?? { productoId: l.productoId, ml: l.ml, nombre: l.nombre, piezas: 0, ingresos: 0 };
      a.piezas += l.cantidad;
      a.ingresos += l.subtotal;
      productos.set(clave, a);
    }

    const contacto = contactoDe(p.solicitud);
    const clave = claveCliente(p);
    const c = clientes.get(clave) ?? {
      clave,
      nombre: "",
      telefono: "",
      correo: "",
      pedidos: 0,
      ingresos: 0,
      ultimo: "",
    };
    c.pedidos++;
    c.ingresos += total;
    // Los datos de contacto, los del pedido más reciente: la gente cambia de correo.
    if (fila.creadoEn >= c.ultimo) {
      c.ultimo = fila.creadoEn;
      c.nombre = contacto.nombre || c.nombre;
      c.telefono = contacto.telefono || c.telefono;
      c.correo = contacto.correo || p.cliente?.correo || c.correo;
    }
    clientes.set(clave, c);

    descuentos.volumen += p.cuenta?.ahorroVolumen ?? 0;
    descuentos.transferencia += p.cuenta?.descuentoTransferencia ?? 0;
    descuentos.cupon += p.cuenta?.descuentoCupon ?? 0;
    descuentos.tresPorDos += p.cuenta?.descuento3x2 ?? 0;
  }

  // Recurrente = dos o más pedidos vendidos en todo el histórico.
  const vendidosHistoricos = new Map<string, number>();
  for (const f of filas) {
    if (!esVendido(estatusDe(f.pedido.estatus))) continue;
    const clave = claveCliente(f.pedido);
    vendidosHistoricos.set(clave, (vendidosHistoricos.get(clave) ?? 0) + 1);
  }
  let clientesNuevos = 0;
  let clientesRecurrentes = 0;
  for (const clave of clientes.keys()) {
    if ((vendidosHistoricos.get(clave) ?? 0) >= 2) clientesRecurrentes++;
    else clientesNuevos++;
  }

  return {
    desde,
    hasta,
    pedidos: enRango.length,
    vendidos,
    pendientes,
    cancelados,
    ingresos: redondear(ingresos),
    porCobrar: redondear(porCobrar),
    ticketPromedio: vendidos ? redondear(ingresos / vendidos) : 0,
    piezas,
    porDia: [...porDia.values()].map((d) => ({ ...d, ingresos: redondear(d.ingresos) })),
    porEstatus: ESTATUS_PEDIDO.map((estatus) => {
      const e = porEstatus.get(estatus)!;
      return { estatus, pedidos: e.pedidos, total: redondear(e.total) };
    }),
    porMetodo: desglose(porMetodo, ETIQUETAS_METODO),
    porEnvio: desglose(porEnvio, ETIQUETAS_ENVIO),
    porEscalon: desglose(porEscalon, ETIQUETAS_ESCALON),
    topProductos: [...productos.values()]
      .map((a) => ({ ...a, ingresos: redondear(a.ingresos) }))
      .sort((a, b) => b.ingresos - a.ingresos || b.piezas - a.piezas)
      .slice(0, 15),
    topClientes: [...clientes.values()]
      .map((c) => ({
        clave: c.clave,
        nombre: c.nombre,
        telefono: c.telefono,
        correo: c.correo,
        pedidos: c.pedidos,
        ingresos: redondear(c.ingresos),
      }))
      .sort((a, b) => b.ingresos - a.ingresos || b.pedidos - a.pedidos)
      .slice(0, 10),
    descuentos: {
      volumen: redondear(descuentos.volumen),
      transferencia: redondear(descuentos.transferencia),
      cupon: redondear(descuentos.cupon),
      tresPorDos: redondear(descuentos.tresPorDos),
    },
    clientesNuevos,
    clientesRecurrentes,
    truncado: opciones.truncado === true,
  };
}

/* ── Clientes ─────────────────────────────────────────────────────────── */

/** Una cuenta de Cognito, en lo que le importa al panel. */
export type CuentaCognito = {
  sub: string;
  usuario: string;
  nombre: string;
  correo: string;
  telefono: string;
  grupos: string[];
  registradoEn: string | null;
  estado: string | null;
};

/**
 * Une las cuentas de Cognito con los compradores que salen de los pedidos.
 *
 * Quien compró con cuenta se junta con su cuenta por el `sub`. Quien compró sin
 * cuenta queda como `tel:<10 dígitos>`: no se le pega a una cuenta con el
 * mismo teléfono, porque el teléfono de un pedido lo escribe cualquiera y
 * juntar a dos personas distintas en una ficha es peor que tenerlas separadas.
 */
export function clientesDe(filas: FilaPedido[], cuentas: CuentaCognito[]): ClienteAdmin[] {
  const mapa = new Map<string, ClienteAdmin & { _ultimoCreado: string }>();
  const conCuenta = new Set(cuentas.map((c) => c.sub));

  for (const c of cuentas) {
    mapa.set(c.sub, {
      clave: c.sub,
      sub: c.sub,
      nombre: c.nombre || c.correo,
      correo: c.correo,
      telefono: c.telefono,
      grupos: c.grupos,
      registradoEn: c.registradoEn,
      estadoCuenta: c.estado,
      pedidos: 0,
      pedidosVendidos: 0,
      piezas: 0,
      ingresos: 0,
      ultimoPedido: null,
      ciudad: null,
      nivel: "",
      _ultimoCreado: "",
    });
  }

  for (const f of filas) {
    const p = f.pedido;
    const clave = claveCliente(p);
    const contacto = contactoDe(p.solicitud);
    const c = mapa.get(clave) ?? {
      clave,
      sub: p.cliente?.sub ?? null,
      nombre: "",
      correo: "",
      telefono: "",
      grupos: [],
      registradoEn: null,
      estadoCuenta: null,
      pedidos: 0,
      pedidosVendidos: 0,
      piezas: 0,
      ingresos: 0,
      ultimoPedido: null,
      ciudad: null,
      nivel: "",
      _ultimoCreado: "",
    };
    c.pedidos++;
    if (esVendido(estatusDe(p.estatus))) {
      c.pedidosVendidos++;
      c.piezas += p.cuenta?.piezasTotales ?? 0;
      c.ingresos += p.cuenta?.total ?? 0;
    }
    if (f.creadoEn >= c._ultimoCreado) {
      c._ultimoCreado = f.creadoEn;
      c.ultimoPedido = p.fecha;
      c.ciudad = contacto.ciudad || c.ciudad;
      // Lo de la cuenta manda sobre lo que se escribió en un pedido.
      if (!conCuenta.has(clave)) {
        c.nombre = contacto.nombre || c.nombre;
        c.telefono = contacto.telefono || c.telefono;
        c.correo = contacto.correo || p.cliente?.correo || c.correo;
      } else {
        c.telefono = c.telefono || contacto.telefono;
        c.nombre = c.nombre || contacto.nombre;
      }
    }
    mapa.set(clave, c);
  }

  return [...mapa.values()]
    .map((c): ClienteAdmin => {
      // `_ultimoCreado` solo servía para decidir qué contacto es el más reciente.
      const limpio: ClienteAdmin & { _ultimoCreado?: string } = { ...c };
      delete limpio._ultimoCreado;
      return { ...limpio, ingresos: redondear(c.ingresos), nivel: nivelDePiezas(c.piezas).actual.nombre };
    })
    .sort(
      (a, b) =>
        (b.ultimoPedido ?? "").localeCompare(a.ultimoPedido ?? "") ||
        a.nombre.localeCompare(b.nombre, "es"),
    );
}
