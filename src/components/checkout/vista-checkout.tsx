"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Banknote,
  Building2,
  Check,
  ChevronLeft,
  CreditCard,
  HandCoins,
  Lock,
  Store,
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
import { CP_CONOCIDOS, CP_CONTRA_ENTREGA, OPCIONES_ENVIO } from "@/data/contenido";
import { resumenCarrito } from "@/lib/carrito";
import { guardarPedidoRemoto } from "@/lib/cuenta-remota";
import { precio as fmt } from "@/lib/format";
import { mensualidad, plazosDisponibles, type PlazoMSI } from "@/lib/volumen";
import { useTienda } from "@/store/tienda";
import {
  esquemaContacto,
  esquemaTarjeta,
  formatearTarjeta,
  formatearTelefono,
  formatearVencimiento,
  type DatosContacto,
} from "./esquemas";
import { cn } from "@/lib/utils";

const PASOS = ["Contacto y envío", "Envío", "Pago"] as const;

export function VistaCheckout() {
  const router = useRouter();
  const hidratado = useTienda((s) => s.hidratado);
  const carrito = useTienda((s) => s.carrito);
  const cupon = useTienda((s) => s.cupon);
  const confirmarPedido = useTienda((s) => s.confirmarPedido);

  const [paso, setPaso] = useState(0);
  const [contacto, setContacto] = useState<DatosContacto | null>(null);
  const [envio, setEnvio] = useState<string>("estandar");
  const [metodo, setMetodo] = useState("tarjeta");
  const [plazo, setPlazo] = useState<PlazoMSI | null>(null);
  const [enviando, setEnviando] = useState(false);

  const resumenBase = resumenCarrito(carrito, cupon);
  const opcion = OPCIONES_ENVIO.find((o) => o.id === envio) ?? OPCIONES_ENVIO[0];
  const costoEnvio = resumenBase.envioGratis && envio === "estandar" ? 0 : opcion.precio;
  const total = resumenBase.subtotal - resumenBase.descuentoCupon + costoEnvio;

  const resumen = { ...resumenBase, envio: costoEnvio, total };
  const contraEntregaOk = contacto ? CP_CONTRA_ENTREGA.has(contacto.cp) : false;

  if (!hidratado) {
    return (
      <Contenedor className="py-16">
        <div className="mx-auto h-40 max-w-md animate-pulse rounded-lg bg-white/5" />
      </Contenedor>
    );
  }

  if (resumenBase.vacio) {
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

  function finalizar(metodoPago: string) {
    if (!contacto) return;
    setEnviando(true);

    const folio = `AUR-2026-${String(
      847 + (carrito.reduce((n, i) => n + i.cantidad, 0) % 500),
    ).padStart(5, "0")}`;
    const fecha = new Date().toISOString().slice(0, 10);

    // Queda en la cuenta para que aparezca en /cuenta desde cualquier aparato.
    // Sin sesión —o sin red— falla en silencio y el pedido sigue existiendo en
    // esta pestaña: cortar la confirmación por no haber podido guardar la copia
    // sería castigar al comprador por un problema del servidor.
    guardarPedidoRemoto({
      folio,
      fecha,
      estatus: "Pendiente",
      total,
      piezas: resumenBase.piezasTotales,
      items: carrito,
    }).catch(() => {});

    confirmarPedido({
      folio,
      fecha,
      correo: contacto.correo,
      nombre: contacto.nombre,
      ciudad: contacto.ciudad,
      estado: contacto.estado,
      envio: opcion.nombre,
      diasEntrega: opcion.tiempo,
      metodoPago,
      total,
      piezas: resumenBase.piezasTotales,
      items: carrito,
    });

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

      {/* Stepper visual */}
      <ol className="mb-8 flex items-center gap-2 lg:gap-4">
        {PASOS.map((nombre, i) => {
          const hecho = i < paso;
          const activo = i === paso;
          return (
            <li key={nombre} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => i < paso && setPaso(i)}
                disabled={i > paso}
                className={cn(
                  "flex items-center gap-2 text-left",
                  i < paso && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border text-xs font-medium transition-colors",
                    hecho && "bg-gold-gradient text-bg border-transparent",
                    activo && "border-gold text-gold-light",
                    !hecho && !activo && "border-border-strong text-fg-subtle",
                  )}
                >
                  {hecho ? <Check size={14} aria-hidden /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-sm sm:block",
                    activo ? "text-fg" : "text-fg-subtle",
                  )}
                >
                  {nombre}
                </span>
              </button>
              {i < PASOS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-px flex-1",
                    hecho ? "bg-gold/50" : "bg-border-soft",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-10">
        <div className="min-w-0">
          {paso === 0 ? (
            <PasoContacto
              inicial={contacto}
              onListo={(datos) => {
                setContacto(datos);
                setPaso(1);
              }}
            />
          ) : null}

          {paso === 1 ? (
            <PasoEnvio
              valor={envio}
              onCambio={setEnvio}
              envioGratis={resumenBase.envioGratis}
              onAtras={() => setPaso(0)}
              onSiguiente={() => setPaso(2)}
            />
          ) : null}

          {paso === 2 ? (
            <PasoPago
              metodo={metodo}
              onMetodo={setMetodo}
              plazo={plazo}
              onPlazo={setPlazo}
              total={total}
              contraEntregaOk={contraEntregaOk}
              enviando={enviando}
              onAtras={() => setPaso(1)}
              onFinalizar={finalizar}
            />
          ) : null}
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
                    {gratis ? "GRATIS" : o.precio === 0 ? "GRATIS" : fmt(o.precio)}
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
  contraEntregaOk,
  enviando,
  onAtras,
  onFinalizar,
}: {
  metodo: string;
  onMetodo: (v: string) => void;
  plazo: PlazoMSI | null;
  onPlazo: (p: PlazoMSI | null) => void;
  total: number;
  contraEntregaOk: boolean;
  enviando: boolean;
  onAtras: () => void;
  onFinalizar: (metodoPago: string) => void;
}) {
  const plazos = plazosDisponibles(total);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(esquemaTarjeta),
    mode: "onBlur",
  });

  return (
    <section>
      <h2 className="font-display mb-4 text-xl">¿Cómo quieres pagar?</h2>

      <Tabs value={metodo} onValueChange={onMetodo}>
        <TabsList className="mb-5 grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
          <TabsTrigger value="tarjeta" className="flex-col gap-1 py-2.5 text-xs">
            <CreditCard size={16} aria-hidden />
            Tarjeta
          </TabsTrigger>
          <TabsTrigger value="msi" className="flex-col gap-1 py-2.5 text-xs">
            <Banknote size={16} aria-hidden />
            Meses
          </TabsTrigger>
          <TabsTrigger value="transferencia" className="flex-col gap-1 py-2.5 text-xs">
            <Building2 size={16} aria-hidden />
            Transfer.
          </TabsTrigger>
          <TabsTrigger value="oxxo" className="flex-col gap-1 py-2.5 text-xs">
            <Store size={16} aria-hidden />
            OXXO
          </TabsTrigger>
          <TabsTrigger value="contra" className="flex-col gap-1 py-2.5 text-xs">
            <HandCoins size={16} aria-hidden />
            Contra entrega
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tarjeta">
          <form
            onSubmit={handleSubmit(() => onFinalizar("Tarjeta de crédito/débito"))}
            className="space-y-4"
            noValidate
          >
            <Campo label="Número de tarjeta" id="numero" error={errors.numero?.message}>
              <Input
                id="numero"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="4242 4242 4242 4242"
                className="h-12"
                aria-invalid={Boolean(errors.numero)}
                {...register("numero", {
                  onChange: (e) => {
                    e.target.value = formatearTarjeta(e.target.value);
                  },
                })}
              />
            </Campo>

            <Campo label="Nombre del titular" id="titular" error={errors.titular?.message}>
              <Input
                id="titular"
                autoComplete="cc-name"
                placeholder="Como aparece en la tarjeta"
                className="h-12"
                aria-invalid={Boolean(errors.titular)}
                {...register("titular")}
              />
            </Campo>

            <div className="grid grid-cols-2 gap-4">
              <Campo
                label="Vencimiento"
                id="vencimiento"
                error={errors.vencimiento?.message}
              >
                <Input
                  id="vencimiento"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/AA"
                  maxLength={5}
                  className="h-12"
                  aria-invalid={Boolean(errors.vencimiento)}
                  {...register("vencimiento", {
                    onChange: (e) => {
                      e.target.value = formatearVencimiento(e.target.value);
                    },
                  })}
                />
              </Campo>

              <Campo label="CVV" id="cvv" error={errors.cvv?.message}>
                <Input
                  id="cvv"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  maxLength={4}
                  className="h-12"
                  aria-invalid={Boolean(errors.cvv)}
                  {...register("cvv")}
                />
              </Campo>
            </div>

            <p className="text-fg-subtle flex items-center gap-1.5 text-[11px]">
              <Lock size={12} aria-hidden />
              Demostración: no se procesa ningún cobro ni se guarda ningún dato.
            </p>

            <BotonesPago
              enviando={enviando}
              onAtras={onAtras}
              etiqueta={`Pagar ${fmt(total)} MXN`}
              tipo="submit"
            />
          </form>
        </TabsContent>

        <TabsContent value="msi">
          {plazos.length === 0 ? (
            <p className="border-border-soft text-fg-muted rounded-md border px-4 py-5 text-sm">
              Los meses sin intereses arrancan desde $ 1,200.00 MXN. Agrega una
              pieza más y se activan.
            </p>
          ) : (
            <>
              <p className="text-fg-muted mb-3 text-sm">
                Elige tu plazo. Sin intereses con tarjetas participantes.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {plazos.map((p) => {
                  const pago = mensualidad(total, p)!;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onPlazo(p)}
                      aria-pressed={plazo === p}
                      className={cn(
                        "rounded-md border px-4 py-3 text-left transition-colors",
                        plazo === p
                          ? "border-gold bg-gold-muted"
                          : "border-border-soft hover:border-border-strong",
                      )}
                    >
                      <span className="block text-sm font-medium">
                        {p} meses sin intereses
                      </span>
                      <span
                        data-precio
                        className="text-gold-light block text-lg"
                      >
                        {fmt(pago)}
                        <span className="text-fg-subtle text-xs"> / mes</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-6">
            <BotonesPago
              enviando={enviando}
              onAtras={onAtras}
              deshabilitado={plazos.length > 0 && plazo === null}
              etiqueta={
                plazo
                  ? `Pagar en ${plazo} meses de ${fmt(mensualidad(total, plazo)!)}`
                  : "Elige un plazo"
              }
              onClick={() => onFinalizar(`${plazo} meses sin intereses`)}
            />
          </div>
        </TabsContent>

        <TabsContent value="transferencia">
          <InfoPago
            titulo="Transferencia SPEI"
            texto="Al confirmar te mandamos por correo y WhatsApp la CLABE y el monto exacto. Apartamos tu pedido 24 horas y lo enviamos en cuanto entra el pago."
          />
          <BotonesPago
            enviando={enviando}
            onAtras={onAtras}
            etiqueta="Confirmar pedido"
            onClick={() => onFinalizar("Transferencia SPEI")}
          />
        </TabsContent>

        <TabsContent value="oxxo">
          <InfoPago
            titulo="Efectivo en OXXO"
            texto="Te generamos un código de barras con vigencia de 48 horas. Puedes pagarlo en cualquier OXXO del país; el pedido sale al día hábil siguiente de tu pago."
          />
          <BotonesPago
            enviando={enviando}
            onAtras={onAtras}
            etiqueta="Generar código OXXO"
            onClick={() => onFinalizar("Efectivo en OXXO")}
          />
        </TabsContent>

        <TabsContent value="contra">
          {contraEntregaOk ? (
            <InfoPago
              titulo="Pago contra entrega disponible en tu zona"
              texto="Pagas en efectivo al repartidor cuando recibas el paquete. Disponible para pedidos de hasta $ 3,000.00 MXN en tu código postal."
            />
          ) : (
            <div className="border-border-soft mb-5 rounded-md border px-4 py-4">
              <p className="mb-1 text-sm font-medium">
                No disponible en tu código postal
              </p>
              <p className="text-fg-muted text-sm leading-relaxed">
                El pago contra entrega opera en zonas metropolitanas de León,
                Guadalajara, CDMX, Monterrey, Puebla y Querétaro. Elige otro
                método para continuar.
              </p>
            </div>
          )}
          <BotonesPago
            enviando={enviando}
            onAtras={onAtras}
            deshabilitado={!contraEntregaOk}
            etiqueta="Confirmar pedido"
            onClick={() => onFinalizar("Pago contra entrega")}
          />
        </TabsContent>
      </Tabs>
    </section>
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
