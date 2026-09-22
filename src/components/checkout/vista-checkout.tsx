"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  Check,
  ChevronLeft,
  CreditCard,
  HandCoins,
  MessageCircle,
  Zap,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Contenedor } from "@/components/comunes/layout";
import { Imagen } from "@/components/comunes/imagen";
import { Precio } from "@/components/comunes/precio";
import { ResumenPedido } from "@/components/carrito/resumen-pedido";
import { CP_CONOCIDOS, OPCIONES_ENVIO } from "@/data/contenido";
import {
  CLIP_LINK,
  COMISION_CONTRA_ENTREGA,
  DATOS_BANCARIOS,
  DESCUENTO_TRANSFERENCIA,
  HAY_DATOS_BANCARIOS,
  METODOS,
  TOPE_CONTRA_ENTREGA,
  type IdPago,
} from "@/data/pagos";
import { esIdEnvio, type IdEnvio } from "../../../compartido/reglas";
import { resumenCarrito } from "@/lib/carrito";
import {
  haySincronizacion,
  leerDireccionesRemotas,
  registrarPedido,
} from "@/lib/cuenta-remota";
import { avisarPedido } from "@/lib/aviso-pedido";
import { pixel } from "@/lib/pixel";
import { useSesion } from "@/lib/sesion";
import { precio as fmt } from "@/lib/format";
import { mensualidad, plazosDisponibles, type PlazoMSI } from "@/lib/volumen";
import {
  useTienda,
  type DatosExpres,
  type PedidoConfirmado,
} from "@/store/tienda";
import { esquemaContacto, formatearTelefono, type DatosContacto } from "./esquemas";
import { cn } from "@/lib/utils";

/**
 * En qué punto está cada sección del checkout.
 *
 * Las cuatro se pintan siempre: la que toca abierta, las resueltas plegadas a
 * un renglón con enlace para volver, y las que faltan apagadas. Es lo que
 * permite confirmar mirando el pedido entero —dirección, entrega, forma de pago
 * y total con la comisión dentro— en vez de recordar lo que se eligió tres
 * pantallas atrás.
 */
type EstadoSeccion = "abierta" | "hecha" | "pendiente";

/**
 * Los datos guardados de la compra exprés, quitando lo que no es del formulario
 * de contacto: la opción de envío y la forma de pago viven en sus propios pasos.
 */
function contactoDe(datos: DatosExpres): DatosContacto {
  return {
    correo: datos.correo,
    nombre: datos.nombre,
    telefono: datos.telefono,
    calle: datos.calle,
    colonia: datos.colonia,
    cp: datos.cp,
    ciudad: datos.ciudad,
    estado: datos.estado,
    referencias: datos.referencias,
  };
}

/** El icono de cada forma de pago vive aquí y no en `pagos.ts`: ese archivo es
 *  datos, y meterle componentes lo ataría a React sin necesidad. */
const ICONO_PAGO: Record<IdPago, typeof CreditCard> = {
  clip: CreditCard,
  transferencia: Building2,
  contra: HandCoins,
};

export function VistaCheckout() {
  const router = useRouter();
  const hidratado = useTienda((s) => s.hidratado);
  const carrito = useTienda((s) => s.carrito);
  const cupon = useTienda((s) => s.cupon);
  const confirmarPedido = useTienda((s) => s.confirmarPedido);

  const sesion = useSesion();

  const consumirExpres = useTienda((s) => s.consumirExpres);
  const guardarExpres = useTienda((s) => s.guardarExpres);
  const olvidarExpres = useTienda((s) => s.olvidarExpres);

  /**
   * Entrada exprés: se viene de «Comprar en 1 toque».
   *
   * Se lee **en el primer render** y no en un efecto, porque de esto dependen
   * los valores iniciales de medio formulario: escribirlos después obligaría a
   * pintar el paso de contacto vacío y sustituirlo enseguida, que es un parpadeo
   * y además un `setState` dentro de un efecto.
   *
   * Se puede leer aquí sin suscribirse porque cuando esta pantalla monta, la
   * ficha de producto ya puso la bandera: se llega navegando, sin recargar. Si
   * alguien entra directo a `/checkout/`, la bandera no existe —no se guarda— y
   * el checkout arranca normal, que es justo lo que debe pasar.
   */
  const [inicioExpres] = useState(() => {
    const s = useTienda.getState();
    return s.entradaExpres && s.expres ? s.expres : null;
  });

  const [paso, setPaso] = useState(inicioExpres ? 3 : 0);
  const [maxPaso, setMaxPaso] = useState(inicioExpres ? 3 : 0);
  const [contacto, setContacto] = useState<DatosContacto | null>(() =>
    inicioExpres ? contactoDe(inicioExpres) : null,
  );
  const [envio, setEnvio] = useState<string>(inicioExpres?.envio ?? "estandar");
  const [metodo, setMetodo] = useState<IdPago>(inicioExpres?.metodo ?? "clip");
  const [plazo, setPlazo] = useState<PlazoMSI | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modoExpres, setModoExpres] = useState(inicioExpres !== null);

  /**
   * La bandera vale por una sola entrada.
   *
   * Sin apagarla, volver atrás desde la confirmación o recargar saltaría el
   * formulario otra vez — incluso cuando lo que la persona quiere es justamente
   * cambiar la dirección.
   */
  useEffect(() => {
    consumirExpres();
  }, [consumirExpres]);

  /**
   * Trae la dirección predeterminada de la cuenta y rellena el primer paso.
   *
   * Es para lo que sirve guardarla: la pantalla de la cuenta promete tenerla
   * lista para el siguiente pedido, y una libreta que el checkout ignora
   * convierte esa frase en mentira.
   *
   * El correo sale de la sesión y no de la dirección, porque la dirección es a
   * dónde se manda el paquete y el correo es a dónde va la guía de rastreo.
   */
  useEffect(() => {
    if (modoExpres) return;
    if (!haySincronizacion() || !sesion.perfil) return;
    const perfil = sesion.perfil;
    let vivo = true;
    leerDireccionesRemotas()
      .then((r) => {
        const d = r.direcciones.find((x) => x.predeterminada) ?? r.direcciones[0];
        if (!vivo || !d) return;
        // Solo si no hay nada escrito ya: volver atrás en el formulario no
        // puede pisar lo que la persona acaba de teclear.
        setContacto((actual) =>
          actual ?? {
            correo: perfil.correo,
            nombre: d.nombre || perfil.nombre,
            telefono: d.telefono,
            calle: d.calle,
            colonia: d.colonia,
            cp: d.cp,
            ciudad: d.ciudad,
            estado: d.estado,
          },
        );
      })
      .catch(() => {
        // Sin red se llena a mano, como siempre.
      });
    return () => {
      vivo = false;
    };
  }, [sesion.perfil, modoExpres]);

  const envioElegido: IdEnvio = esIdEnvio(envio) ? envio : "estandar";
  const opcion = OPCIONES_ENVIO.find((o) => o.id === envioElegido) ?? OPCIONES_ENVIO[0];

  // Aquí no se suma ni se resta nada a mano: el total lo calcula `cotizar`, la
  // misma función con la que el servidor cobra. Cuando el checkout rehacía la
  // cuenta por su lado, bastaba con olvidar un concepto para anunciar una cifra
  // y cobrar otra.
  const resumen = resumenCarrito(carrito, cupon, { metodo, envio: envioElegido });
  const { comision, total } = resumen;
  const costoEnvio = resumen.envio;
  // El contra entrega por encima del tope se cobra con Clip.
  const metodoEfectivo: IdPago = resumen.metodo ?? metodo;

  // Dos cotizaciones más, porque dependen de la forma de pago y la persona puede
  // estar mirando otra: lo que costaría con Clip —la base de los meses sin
  // intereses— y si el pedido cabe bajo el tope del contra entrega.
  const comoClip = resumenCarrito(carrito, cupon, { metodo: "clip", envio: envioElegido });
  const comoTransferencia = resumenCarrito(carrito, cupon, {
    metodo: "transferencia",
    envio: envioElegido,
  });
  const contraEntregaOk =
    resumenCarrito(carrito, cupon, { metodo: "contra", envio: envioElegido }).metodo ===
    "contra";

  /**
   * Una sección es «hecha» si ya se respondió alguna vez, no solo si queda por
   * encima de la abierta.
   *
   * Es lo que hace que «Cambiar» sirva de algo: al volver al primer bloque para
   * corregir una calle, la entrega y el pago siguen resueltos y a la vista, y se
   * salta directo a confirmar. Midiéndolo contra la sección abierta, corregir un
   * dato apagaba los tres bloques siguientes y obligaba a recorrer el checkout
   * entero otra vez — que es justo el paseo que la página de una sola pantalla
   * venía a quitar.
   */
  const estadoDe = (i: number): EstadoSeccion =>
    paso === i ? "abierta" : i <= maxPaso ? "hecha" : "pendiente";

  /** Abre una sección y recuerda hasta dónde se ha llegado. */
  function irA(n: number) {
    setPaso(n);
    setMaxPaso((m) => Math.max(m, n));
  }

  const elegido = METODOS.find((m) => m.id === metodoEfectivo) ?? METODOS[0]!;
  // El plazo entra en la etiqueta porque a la hora de cobrar cambia lo que hay
  // que hacer: no es lo mismo un cargo único que doce mensualidades.
  const etiquetaPago =
    metodoEfectivo === "clip" && plazo
      ? `Clip · ${plazo} meses sin intereses`
      : elegido.etiqueta;

  /**
   * `InitiateCheckout` para el pixel de Meta: el evento con el que la campaña
   * aprende a quién le sirve enseñarle anuncios. Se manda una sola vez por
   * visita a esta pantalla, cuando el carrito ya se leyó de `localStorage` —
   * antes de eso el valor sería cero y ensuciaría la señal.
   */
  const avisado = useRef(false);
  useEffect(() => {
    if (!hidratado || avisado.current || carrito.length === 0) return;
    avisado.current = true;
    pixel("InitiateCheckout", {
      currency: "MXN",
      value: total - comision,
      num_items: resumen.piezasTotales,
      content_ids: carrito.map((i) => i.productoId),
      content_type: "product",
    });
    // Solo depende de la hidratación: es un disparo único, no un seguimiento
    // del total mientras la persona cambia de envío.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado]);

  if (!hidratado) {
    return (
      <Contenedor className="py-16">
        <div className="mx-auto h-40 max-w-md animate-pulse rounded-lg bg-white/5" />
      </Contenedor>
    );
  }

  if (resumen.vacio) {
    return (
      <Contenedor className="py-20 text-center">
        <h1 className="font-display mb-3 text-3xl">No hay nada que pagar</h1>
        <p className="text-fg-muted mb-7">
          Tu carrito está vacío. Agrega algunas piezas y vuelve.
        </p>
        <Button asChild variant="gold" size="touch-lg">
          <Link href="/catalogo">Ver el catálogo</Link>
        </Button>
      </Contenedor>
    );
  }

  async function finalizar(metodoPago: string) {
    if (!contacto || enviando) return;
    setEnviando(true);

    // El cobro con Clip vive fuera de la tienda y se abre en otra pestaña —no se
    // sustituye esta— para que el comprador vuelva a su comprobante al terminar.
    // Se abre **antes** de esperar al servidor: los navegadores solo dejan abrir
    // pestañas como respuesta directa a un clic, y después de un `await` ya no
    // lo es. El enlace de cobro no depende del folio.
    if (metodoEfectivo === "clip" && CLIP_LINK) {
      window.open(CLIP_LINK, "_blank", "noopener,noreferrer");
    }

    // El servidor pone el folio —con un contador, así que no se repite— y el
    // total, que recalcula con los precios del catálogo. También guarda la copia
    // en «Mis pedidos» si hay sesión. Si no hay servidor o no contesta, el pedido
    // sigue adelante con la cifra de este navegador y un folio local que se
    // reconoce por la «L»: cortar la compra por un problema de red sería
    // castigar al comprador, y el WhatsApp de la confirmación la recoge igual.
    const registrado = await registrarPedido({
      items: carrito,
      cupon,
      metodo: metodoEfectivo,
      envio: envioElegido,
      contacto: {
        correo: contacto.correo,
        nombre: contacto.nombre,
        telefono: contacto.telefono,
        calle: contacto.calle,
        colonia: contacto.colonia,
        cp: contacto.cp,
        ciudad: contacto.ciudad,
        estado: contacto.estado,
        referencias: contacto.referencias ?? "",
      },
    }).catch(() => null);

    const hoy = new Date();
    const pedido: PedidoConfirmado = {
      folio:
        registrado?.folio ??
        `AUR-${hoy.getFullYear()}-L${hoy.getTime().toString(36).toUpperCase()}`,
      fecha: registrado?.fecha ?? hoy.toISOString().slice(0, 10),
      correo: contacto.correo,
      nombre: contacto.nombre,
      telefono: contacto.telefono,
      calle: contacto.calle,
      colonia: contacto.colonia,
      cp: contacto.cp,
      ciudad: contacto.ciudad,
      estado: contacto.estado,
      referencias: contacto.referencias,
      envio: opcion.nombre,
      diasEntrega: opcion.tiempo,
      metodoPago,
      metodoId: registrado?.metodo ?? metodoEfectivo,
      comision: registrado?.comision ?? comision,
      descuentoTransferencia:
        registrado?.descuentoTransferencia ?? resumen.descuentoTransferencia,
      total: registrado?.total ?? total,
      piezas: resumen.piezasTotales,
      items: carrito,
    };

    // El aviso a la tienda: si hay webhook configurado, sale ahora mismo con
    // los datos de contacto. Si no, queda el WhatsApp de la pantalla de
    // gracias, que es el camino que siempre funciona.
    avisarPedido(pedido);

    // Y queda listo el «Comprar en 1 toque» de la próxima visita. Se guarda al
    // confirmar y no al escribir el formulario: unos datos a medio teclear, o
    // los de un pedido que se abandonó, no son la dirección a la que esta
    // persona quiere que le llegue lo siguiente.
    guardarExpres({
      correo: contacto.correo,
      nombre: contacto.nombre,
      telefono: contacto.telefono,
      calle: contacto.calle,
      colonia: contacto.colonia,
      cp: contacto.cp,
      ciudad: contacto.ciudad,
      estado: contacto.estado,
      referencias: contacto.referencias,
      envio,
      metodo: metodoEfectivo,
    });

    pixel("Purchase", {
      currency: "MXN",
      value: pedido.total,
      num_items: resumen.piezasTotales,
      content_ids: carrito.map((i) => i.productoId),
      content_type: "product",
    });

    confirmarPedido(pedido);
    router.push("/checkout/confirmacion");
  }

  return (
    <Contenedor className="py-6 lg:py-10">
      <div className="mb-7 flex items-center justify-between gap-4">
        <h1 className="font-display text-[28px] leading-tight tracking-tight lg:text-[38px]">
          Finalizar compra
        </h1>
        <Link
          href="/carrito"
          className="text-fg-muted hover:text-fg inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft size={15} aria-hidden />
          Volver al carrito
        </Link>
      </div>

      {/* Aviso de la compra exprés, con su salida.
          Saltarse tres formularios está muy bien hasta el día que el pedido va
          a otra dirección. Sin una forma visible de decir «estos datos no», la
          rapidez se convierte en una trampa: el enlace lo borra todo y devuelve
          al formulario en blanco. */}
      {modoExpres ? (
        <div className="border-gold/35 bg-gold-muted mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border px-4 py-3">
          <p className="flex items-center gap-2 text-sm">
            <Zap size={15} className="text-gold shrink-0" aria-hidden />
            Compra exprés: usamos los datos de tu última compra.
          </p>
          <button
            type="button"
            onClick={() => {
              olvidarExpres();
              setModoExpres(false);
              setContacto(null);
              setPaso(0);
              // También el recorrido: si no, las secciones de entrega y pago
              // seguirían plegadas «como hechas» enseñando los datos de la
              // compra anterior, que es justo lo que se acaba de descartar.
              setMaxPaso(0);
            }}
            className="text-gold-light text-xs underline underline-offset-4"
          >
            Usar otros datos
          </button>
        </div>
      ) : null}

      {/* Las cuatro secciones a la vez, la que toca abierta y las hechas
          plegadas en un renglón.
          Antes era un paso por pantalla: para comprobar la dirección desde el
          paso de pago había que retroceder dos veces y volver a avanzar. Aquí el
          pedido entero se lee de arriba abajo y cada bloque se abre donde está,
          que es como se revisa una compra en la práctica. */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-3">
          <Seccion
            n={1}
            titulo="Contacto y envío"
            estado={estadoDe(0)}
            onEditar={() => setPaso(0)}
            resumen={
              contacto ? (
                <>
                  <p className="text-fg">{contacto.nombre}</p>
                  <p>
                    {contacto.telefono} · {contacto.correo}
                  </p>
                  <p>
                    {contacto.calle}, {contacto.colonia}, {contacto.cp}{" "}
                    {contacto.ciudad}
                  </p>
                </>
              ) : null
            }
          >
            <PasoContacto
              // Remonta una sola vez cuando llega la dirección guardada: el
              // formulario lee sus valores iniciales al montarse, así que sin
              // esto el prellenado no se vería nunca.
              key={contacto ? "con-datos" : "vacio"}
              inicial={contacto}
              onListo={(datos) => {
                setContacto(datos);
                irA(1);
              }}
            />
          </Seccion>

          <Seccion
            n={2}
            titulo="Entrega"
            estado={estadoDe(1)}
            onEditar={() => setPaso(1)}
            resumen={
              <p>
                <span className="text-fg">{opcion.nombre}</span> · {opcion.tiempo}{" "}
                ·{" "}
                {costoEnvio === 0 ? (
                  <span className="text-success">gratis</span>
                ) : (
                  fmt(costoEnvio)
                )}
              </p>
            }
          >
            <PasoEnvio
              valor={envio}
              onCambio={setEnvio}
              envioGratis={resumen.envioGratis}
              onAtras={() => setPaso(0)}
              onSiguiente={() => irA(2)}
            />
          </Seccion>

          <Seccion
            n={3}
            titulo="Pago"
            estado={estadoDe(2)}
            onEditar={() => setPaso(2)}
            resumen={
              <p>
                <span className="text-fg">{etiquetaPago}</span>
                {comision > 0 ? ` · incluye ${fmt(comision)} de cobro en destino` : ""}
              </p>
            }
          >
            <PasoPago
              metodo={metodoEfectivo}
              onMetodo={setMetodo}
              plazo={plazo}
              onPlazo={setPlazo}
              total={comoClip.total}
              totalTransferencia={comoTransferencia.total}
              ahorroTransferencia={comoTransferencia.descuentoTransferencia}
              contraEntregaOk={contraEntregaOk}
              onAtras={() => setPaso(1)}
              onSiguiente={() => {
                pixel("AddPaymentInfo", { currency: "MXN", value: total });
                irA(3);
              }}
            />
          </Seccion>

          <Seccion n={4} titulo="Revisar y confirmar" estado={estadoDe(3)}>
            {contacto ? (
              <PasoConfirmar
                telefono={contacto.telefono}
                metodo={metodoEfectivo}
                etiqueta={etiquetaPago}
                plazo={plazo}
                comision={comision}
                total={total}
                enviando={enviando}
                onAtras={() => setPaso(2)}
                onFinalizar={finalizar}
              />
            ) : null}
          </Seccion>
        </div>

        <div className="mt-8 lg:sticky lg:top-24 lg:mt-0">
          <ResumenLineas resumen={resumen} />
          <div className="mt-4">
            <ResumenPedido resumen={resumen} conCupon={paso === 0} />
          </div>
        </div>
      </div>
    </Contenedor>
  );
}

/**
 * Una sección del checkout: abierta, ya resuelta o todavía por llegar.
 *
 * Las resueltas se pliegan a su resumen con un enlace para volver. Las que
 * faltan se enseñan apagadas y sin contenido: saber cuánto queda es la mitad de
 * lo que un formulario largo tiene que comunicar, y una sección que aparece de
 * la nada al terminar la anterior no lo dice.
 */
function Seccion({
  n,
  titulo,
  estado,
  resumen,
  onEditar,
  children,
}: {
  n: number;
  titulo: string;
  estado: EstadoSeccion;
  resumen?: React.ReactNode;
  onEditar?: () => void;
  children: React.ReactNode;
}) {
  const abierta = estado === "abierta";
  const hecha = estado === "hecha";

  return (
    <section
      aria-current={abierta ? "step" : undefined}
      className={cn(
        "rounded-lg border transition-colors",
        abierta
          ? "border-border-strong bg-surface"
          : "border-border-soft",
        estado === "pendiente" && "opacity-55",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium",
            hecha && "bg-gold-gradient text-bg border-transparent",
            abierta && "border-gold text-gold-light",
            estado === "pendiente" && "border-border-strong text-fg-subtle",
          )}
        >
          {hecha ? <Check size={13} aria-hidden /> : n}
        </span>

        <h2 className={cn("flex-1 text-[15px]", abierta ? "text-fg" : "text-fg-muted")}>
          {titulo}
        </h2>

        {hecha && onEditar ? (
          <button
            type="button"
            onClick={onEditar}
            className="text-gold-light inline-flex items-center gap-1 text-xs underline underline-offset-4"
          >
            <Pencil size={12} aria-hidden />
            Cambiar
          </button>
        ) : null}
      </div>

      {hecha && resumen ? (
        <div className="text-fg-muted border-border-soft border-t px-4 py-3 text-[13px] leading-relaxed sm:px-5">
          {resumen}
        </div>
      ) : null}

      {abierta ? (
        <div className="border-border-soft border-t px-4 py-5 sm:px-5">{children}</div>
      ) : null}
    </section>
  );
}

/* ── Paso 1 ───────────────────────────────────────────────────────────── */

function PasoContacto({
  inicial,
  onListo,
}: {
  inicial: DatosContacto | null;
  onListo: (d: DatosContacto) => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<DatosContacto>({
    resolver: zodResolver(esquemaContacto),
    defaultValues: inicial ?? undefined,
    mode: "onBlur",
  });

  return (
    <form onSubmit={handleSubmit(onListo)} className="space-y-5" noValidate>
      <section>
        <h2 className="font-display mb-4 text-xl">Contacto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Correo electrónico"
            id="correo"
            error={errors.correo?.message}
            className="sm:col-span-2"
          >
            <Input
              id="correo"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              className="h-12"
              aria-invalid={Boolean(errors.correo)}
              {...register("correo")}
            />
          </Campo>

          <Campo label="Nombre completo" id="nombre" error={errors.nombre?.message}>
            <Input
              id="nombre"
              autoComplete="name"
              placeholder="Andrea Villaseñor"
              className="h-12"
              aria-invalid={Boolean(errors.nombre)}
              {...register("nombre")}
            />
          </Campo>

          <Campo label="WhatsApp" id="telefono" error={errors.telefono?.message}>
            <Input
              id="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="477 123 4567"
              className="h-12"
              aria-invalid={Boolean(errors.telefono)}
              {...register("telefono", {
                onChange: (e) => {
                  e.target.value = formatearTelefono(e.target.value);
                },
              })}
            />
          </Campo>
        </div>
      </section>

      <section>
        <h2 className="font-display mb-4 text-xl">Dirección de envío</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Calle y número"
            id="calle"
            error={errors.calle?.message}
            className="sm:col-span-2"
          >
            <Input
              id="calle"
              autoComplete="address-line1"
              placeholder="Blvd. Adolfo López Mateos 1842, int. 4"
              className="h-12"
              aria-invalid={Boolean(errors.calle)}
              {...register("calle")}
            />
          </Campo>

          <Campo label="Colonia" id="colonia" error={errors.colonia?.message}>
            <Input
              id="colonia"
              autoComplete="address-line2"
              placeholder="Jardines del Moral"
              className="h-12"
              aria-invalid={Boolean(errors.colonia)}
              {...register("colonia")}
            />
          </Campo>

          <Campo
            label="Código postal"
            id="cp"
            error={errors.cp?.message}
            ayuda="Autocompletamos ciudad y estado"
          >
            <Input
              id="cp"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder="37160"
              className="h-12"
              aria-invalid={Boolean(errors.cp)}
              {...register("cp", {
                onChange: (e) => {
                  const cp = e.target.value.replace(/\D/g, "").slice(0, 5);
                  e.target.value = cp;
                  const conocido = CP_CONOCIDOS[cp];
                  if (conocido) {
                    setValue("ciudad", conocido.ciudad, {
                      shouldValidate: true,
                    });
                    setValue("estado", conocido.estado, {
                      shouldValidate: true,
                    });
                  }
                },
              })}
            />
          </Campo>

          <Campo label="Ciudad" id="ciudad" error={errors.ciudad?.message}>
            <Input
              id="ciudad"
              autoComplete="address-level2"
              placeholder="León"
              className="h-12"
              aria-invalid={Boolean(errors.ciudad)}
              {...register("ciudad")}
            />
          </Campo>

          <Campo label="Estado" id="estado" error={errors.estado?.message}>
            <Input
              id="estado"
              autoComplete="address-level1"
              placeholder="Guanajuato"
              className="h-12"
              aria-invalid={Boolean(errors.estado)}
              {...register("estado")}
            />
          </Campo>

          <Campo
            label="Referencias"
            id="referencias"
            opcional
            error={errors.referencias?.message}
            className="sm:col-span-2"
          >
            <Input
              id="referencias"
              placeholder="Portón negro, entre Nogal y Framboyán"
              className="h-12"
              {...register("referencias")}
            />
          </Campo>
        </div>
      </section>

      <Button type="submit" variant="gold" size="touch-lg" className="w-full">
        Continuar al envío
      </Button>
    </form>
  );
}

/* ── Paso 2 ───────────────────────────────────────────────────────────── */

function PasoEnvio({
  valor,
  onCambio,
  envioGratis,
  onAtras,
  onSiguiente,
}: {
  valor: string;
  onCambio: (v: string) => void;
  envioGratis: boolean;
  onAtras: () => void;
  onSiguiente: () => void;
}) {
  return (
    <section>
      <h2 className="font-display mb-4 text-xl">¿Cómo quieres recibirlo?</h2>

      <RadioGroup value={valor} onValueChange={onCambio} className="space-y-3">
        {OPCIONES_ENVIO.map((o) => {
          const gratis = o.id === "estandar" && envioGratis;
          return (
            <label
              key={o.id}
              htmlFor={`envio-${o.id}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-4 transition-colors",
                valor === o.id
                  ? "border-gold bg-gold-muted"
                  : "border-border-soft hover:border-border-strong",
              )}
            >
              <RadioGroupItem
                id={`envio-${o.id}`}
                value={o.id}
                className="mt-0.5"
              />
              <span className="flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{o.nombre}</span>
                  <span
                    data-precio
                    className={gratis ? "text-success font-medium" : ""}
                  >
                    {/* «Gratis» lo decide el pedido, no la tarifa: ninguna de
                        las tres opciones cuesta cero por sí sola. */}
                    {gratis ? "GRATIS" : fmt(o.precio)}
                  </span>
                </span>
                <span className="text-fg-muted mt-0.5 block text-sm">
                  {o.tiempo}
                </span>
                <span className="text-fg-subtle mt-0.5 block text-xs">
                  {o.detalle}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          variant="gold"
          size="touch-lg"
          className="flex-1"
          onClick={onSiguiente}
        >
          Continuar al pago
        </Button>
        <Button variant="outline" size="touch-lg" onClick={onAtras}>
          Atrás
        </Button>
      </div>
    </section>
  );
}

/* ── Paso 3 ───────────────────────────────────────────────────────────── */

function PasoPago({
  metodo,
  onMetodo,
  plazo,
  onPlazo,
  total,
  totalTransferencia,
  ahorroTransferencia,
  contraEntregaOk,
  onAtras,
  onSiguiente,
}: {
  metodo: IdPago;
  onMetodo: (v: IdPago) => void;
  plazo: PlazoMSI | null;
  onPlazo: (p: PlazoMSI | null) => void;
  /** Total pagando con Clip: es el valor del pedido lo que abre los meses. */
  total: number;
  /** Total y ahorro pagando por transferencia, para enseñarlos en su pestaña. */
  totalTransferencia: number;
  ahorroTransferencia: number;
  contraEntregaOk: boolean;
  onAtras: () => void;
  onSiguiente: () => void;
}) {
  const plazos = plazosDisponibles(total);

  return (
    <section>
      <h2 className="font-display mb-4 text-xl">¿Cómo quieres pagar?</h2>

      <Tabs value={metodo} onValueChange={(v) => onMetodo(v as IdPago)}>
        <TabsList className="mb-5 grid h-auto w-full grid-cols-3 gap-1">
          {METODOS.map((m) => {
            const Icono = ICONO_PAGO[m.id];
            // El contra entrega no se ofrece por encima del tope, y la pestaña
            // se apaga en vez de dejar elegirlo y negarlo después: enseñar una
            // opción que al pulsarla dice que no es peor que no enseñarla.
            const apagada = m.id === "contra" && !contraEntregaOk;
            return (
              <TabsTrigger
                key={m.id}
                value={m.id}
                disabled={apagada}
                className="flex-col gap-1 py-2.5 text-xs"
              >
                <Icono size={16} aria-hidden />
                {m.nombre}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="clip">
          <InfoPago
            titulo="Clip · crédito, débito y efectivo"
            texto={
              CLIP_LINK
                ? "Al confirmar te llevamos a la pantalla segura de Clip. Puedes pagar con tarjeta de crédito o débito, o en efectivo en tiendas afiliadas. Tu pedido queda apartado mientras completas el pago."
                : "Aceptamos crédito, débito y efectivo a través de Clip. Al confirmar tu pedido te mandamos el enlace de cobro por WhatsApp al número que dejaste, y lo apartamos mientras tanto."
            }
          />

          {plazos.length > 0 ? (
            <>
              <p className="text-fg-muted mb-3 text-sm">
                Tu compra alcanza meses sin intereses con tarjetas participantes.
                Elige un plazo si quieres diferirla.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <BotonPlazo
                  activo={plazo === null}
                  titulo="Un solo pago"
                  cifra={fmt(total)}
                  nota="Hoy"
                  onClick={() => onPlazo(null)}
                />
                {plazos.map((p) => (
                  <BotonPlazo
                    key={p}
                    activo={plazo === p}
                    titulo={`${p} meses sin intereses`}
                    cifra={fmt(mensualidad(total, p)!)}
                    nota="/ mes"
                    onClick={() => onPlazo(p)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-fg-subtle text-[13px]">
              Los meses sin intereses arrancan desde {fmt(1200)} MXN.
            </p>
          )}
        </TabsContent>

        <TabsContent value="transferencia">
          {ahorroTransferencia > 0 ? (
            <p className="border-gold/30 bg-gold-muted mb-4 rounded-md border px-4 py-3 text-sm">
              Pagando por depósito o transferencia te descontamos{" "}
              {Math.round(DESCUENTO_TRANSFERENCIA * 100)}% más:{" "}
              <span className="text-gold-light font-medium">
                pagas {fmt(totalTransferencia)}
              </span>{" "}
              y ahorras {fmt(ahorroTransferencia)} extra.
            </p>
          ) : null}
          <InfoPago
            titulo="Depósito o transferencia"
            texto={
              HAY_DATOS_BANCARIOS
                ? `Transfiere por SPEI o deposita en ventanilla a la cuenta de ${DATOS_BANCARIOS.titular} en ${DATOS_BANCARIOS.banco}. Al confirmar te mandamos la CLABE y el monto exacto por WhatsApp, y apartamos tu pedido 24 horas.`
                : "Al confirmar te mandamos por WhatsApp la CLABE, el nombre del titular y el monto exacto. Apartamos tu pedido 24 horas y lo enviamos en cuanto entra el pago; solo hay que mandarnos el comprobante por el mismo chat."
            }
          />
          {HAY_DATOS_BANCARIOS ? (
            <dl className="border-border-soft mb-5 grid gap-2 rounded-md border px-4 py-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Banco</dt>
                <dd>{DATOS_BANCARIOS.banco}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">Titular</dt>
                <dd className="text-right">{DATOS_BANCARIOS.titular}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-muted">CLABE</dt>
                <dd data-precio className="text-gold-light">
                  {DATOS_BANCARIOS.clabe}
                </dd>
              </div>
            </dl>
          ) : null}
        </TabsContent>

        <TabsContent value="contra">
          <InfoPago
            titulo="Pago contra entrega"
            texto={`Pagas en efectivo al repartidor cuando recibas el paquete. El servicio de cobro en destino cuesta ${fmt(
              COMISION_CONTRA_ENTREGA,
            )} y se suma al total; disponible en pedidos menores a ${fmt(
              TOPE_CONTRA_ENTREGA,
            )} MXN.`}
          />
          <p className="text-fg-subtle mb-5 text-[13px]">
            Te confirmamos por WhatsApp el día de entrega para que alguien pueda
            recibir y pagar.
          </p>
        </TabsContent>
      </Tabs>

      {!contraEntregaOk ? (
        <p className="text-fg-subtle mb-1 text-[12px]">
          El pago contra entrega se ofrece en pedidos menores a{" "}
          {fmt(TOPE_CONTRA_ENTREGA)} MXN. Para montos mayores lo acordamos por
          WhatsApp.
        </p>
      ) : null}

      <BotonesPago
        enviando={false}
        onAtras={onAtras}
        etiqueta="Revisar el pedido"
        onClick={onSiguiente}
      />
    </section>
  );
}

/* ── Paso 4 ───────────────────────────────────────────────────────────── */

/**
 * El botón que cierra la compra.
 *
 * No repite la dirección ni el método: las tres secciones de arriba ya están
 * plegadas a la vista con lo que se eligió. Repetirlo aquí obligaría a leer dos
 * veces lo mismo y a mantener dos sitios donde el mismo dato puede quedar
 * desfasado. Lo que sí vive aquí es el total —con la comisión ya dentro— y qué
 * va a pasar en cuanto se pulse.
 */
function PasoConfirmar({
  telefono,
  metodo,
  etiqueta,
  plazo,
  comision,
  total,
  enviando,
  onAtras,
  onFinalizar,
}: {
  telefono: string;
  metodo: IdPago;
  etiqueta: string;
  plazo: PlazoMSI | null;
  comision: number;
  total: number;
  enviando: boolean;
  onAtras: () => void;
  onFinalizar: (metodoPago: string) => void;
}) {
  const cta =
    metodo === "clip" && CLIP_LINK
      ? `Pagar ${fmt(total)} con Clip`
      : metodo === "transferencia"
        ? "Confirmar y recibir la CLABE"
        : `Confirmar pedido · ${fmt(total)}`;

  return (
    <div>
      <div className="border-gold/35 bg-gold-muted flex items-baseline justify-between rounded-md border px-4 py-3.5">
        <span className="font-medium">Total a pagar</span>
        <Precio valor={total} moneda className="text-gold-light text-lg" />
      </div>

      {comision > 0 ? (
        <p className="text-fg-muted mt-2 text-[13px]">
          Incluye {fmt(comision)} del servicio de cobro en destino.
        </p>
      ) : null}

      {metodo === "clip" && plazo ? (
        <p className="text-fg-muted mt-2 text-[13px]">
          {plazo} pagos de{" "}
          <span className="text-gold-light">
            {fmt(mensualidad(total, plazo) ?? total / plazo)}
          </span>{" "}
          sin intereses, con tarjetas participantes.
        </p>
      ) : null}

      <p className="text-fg-subtle mt-3 flex items-start gap-1.5 text-[12px]">
        <MessageCircle size={13} aria-hidden className="mt-0.5 shrink-0" />
        Al confirmar te escribimos por WhatsApp al {telefono} para cerrar el pago
        y darte el día de entrega.
      </p>

      <BotonesPago
        enviando={enviando}
        onAtras={onAtras}
        etiqueta={cta}
        onClick={() => onFinalizar(etiqueta)}
      />
    </div>
  );
}

function BotonPlazo({
  activo,
  titulo,
  cifra,
  nota,
  onClick,
}: {
  activo: boolean;
  titulo: string;
  cifra: string;
  nota: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "rounded-md border px-4 py-3 text-left transition-colors",
        activo
          ? "border-gold bg-gold-muted"
          : "border-border-soft hover:border-border-strong",
      )}
    >
      <span className="block text-sm font-medium">{titulo}</span>
      <span data-precio className="text-gold-light block text-lg">
        {cifra}
        <span className="text-fg-subtle text-xs"> {nota}</span>
      </span>
    </button>
  );
}

/* ── Piezas compartidas ───────────────────────────────────────────────── */

function Campo({
  label,
  id,
  error,
  ayuda,
  opcional,
  className,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  ayuda?: string;
  opcional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5 flex items-baseline gap-2">
        {label}
        {opcional ? (
          <span className="text-fg-subtle text-[11px]">opcional</span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-danger mt-1.5 text-xs">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-fg-subtle mt-1.5 text-xs">{ayuda}</p>
      ) : null}
    </div>
  );
}

function InfoPago({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="border-border-soft bg-surface mb-5 rounded-md border px-4 py-4">
      <p className="mb-1 text-sm font-medium">{titulo}</p>
      <p className="text-fg-muted text-sm leading-relaxed">{texto}</p>
    </div>
  );
}

function BotonesPago({
  enviando,
  onAtras,
  etiqueta,
  onClick,
  tipo = "button",
  deshabilitado = false,
}: {
  enviando: boolean;
  onAtras: () => void;
  etiqueta: string;
  onClick?: () => void;
  tipo?: "button" | "submit";
  deshabilitado?: boolean;
}) {
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
      <Button
        type={tipo}
        variant="gold"
        size="touch-lg"
        className="flex-1"
        onClick={onClick}
        disabled={enviando || deshabilitado}
      >
        {enviando ? "Procesando…" : etiqueta}
      </Button>
      <Button type="button" variant="outline" size="touch-lg" onClick={onAtras}>
        Atrás
      </Button>
    </div>
  );
}

/** Líneas del pedido, colapsables en móvil (§12). */
function ResumenLineas({
  resumen,
}: {
  resumen: ReturnType<typeof resumenCarrito>;
}) {
  return (
    <details className="border-border-soft bg-surface rounded-lg border" open>
      <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm lg:pointer-events-none">
        <span className="font-medium">
          Tu pedido ({resumen.piezasTotales}{" "}
          {resumen.piezasTotales === 1 ? "pieza" : "piezas"})
        </span>
        <Precio valor={resumen.total} className="text-gold-light" />
      </summary>

      <ul className="divide-border-soft divide-y px-5 pb-4">
        {resumen.lineas.map((l) => (
          <li key={l.clave} className="flex items-center gap-3 py-3">
            <span className="bg-bg relative size-14 shrink-0 overflow-hidden rounded">
              <Imagen src={l.imagen} alt="" sizes="56px" />
              <span
                data-precio
                className="bg-gold-gradient text-bg absolute -top-1 -right-1 grid size-5 place-items-center rounded-full text-[10px] font-semibold"
              >
                {l.item.cantidad}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{l.nombre}</span>
              <span className="text-fg-subtle block text-[11px]">
                {l.subtitulo}
              </span>
            </span>
            <Precio valor={l.subtotal} className="shrink-0 text-sm" />
          </li>
        ))}
      </ul>
    </details>
  );
}
