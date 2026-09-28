"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  esquemaDistribuidor,
  formatearTelefono,
  type DatosDistribuidor,
} from "@/components/checkout/esquemas";
import {
  RespaldoWhatsApp,
  mandarSolicitud,
  type ResultadoSolicitud,
} from "@/components/cuenta/solicitud-respaldo";
import { useSesion } from "@/lib/sesion";
import type { SolicitudEntrada } from "../../../compartido/tienda-admin";

const VOLUMENES = [
  "Menos de 12 piezas al mes",
  "De 12 a 24 piezas al mes",
  "De 25 a 50 piezas al mes",
  "Más de 50 piezas al mes",
];

/**
 * Alta de distribuidor (§11).
 *
 * Llega al panel como solicitud de tipo `distribuidor` (`POST /solicitudes`).
 * Antes decía «Recibimos tus datos» sin mandar nada y el prospecto se perdía;
 * ahora, si no hay servidor o no contesta, se dice que **no** se envió y se
 * ofrece mandarlo por WhatsApp ya escrito.
 */
export function FormularioDistribuidor() {
  const { perfil } = useSesion();
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [problema, setProblema] = useState<
    | Extract<ResultadoSolicitud, { tipo: "invalida" }>
    | { tipo: "respaldo"; sinServidor: boolean; entrada: SolicitudEntrada }
    | null
  >(null);
  // El Select ya es controlado, así que su valor vive en useState y se
  // sincroniza con el formulario por setValue. Evita `watch()`, que el
  // compilador de React no puede memoizar.
  const [volumen, setVolumen] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<DatosDistribuidor>({
    resolver: zodResolver(esquemaDistribuidor),
    mode: "onBlur",
  });

  if (listo) {
    return (
      <div
        role="status"
        className="border-success/30 bg-success/10 rounded-lg border px-6 py-8 text-center"
      >
        <div className="bg-success/20 text-success mx-auto mb-4 grid size-12 place-items-center rounded-full">
          <Check size={24} aria-hidden />
        </div>
        <p className="font-display mb-2 text-xl">Recibimos tus datos</p>
        <p className="text-fg-muted text-sm leading-relaxed">
          Te escribimos por WhatsApp al número que dejaste para resolver tus
          dudas y ayudarte a armar tu primer pedido de mayoreo.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(async (datos) => {
        const entrada: SolicitudEntrada = {
          tipo: "distribuidor",
          nombre: datos.nombre.trim(),
          telefono: datos.whatsapp.trim(),
          ciudad: datos.ciudad.trim(),
          volumen: datos.volumen,
          ...(perfil?.correo ? { correo: perfil.correo } : {}),
        };
        setEnviando(true);
        setProblema(null);
        const r = await mandarSolicitud(entrada);
        setEnviando(false);
        if (r.tipo === "enviada") {
          setListo(true);
          toast.success("Recibimos tus datos", {
            description: "Un asesor te escribe por WhatsApp.",
          });
        } else {
          setProblema(r.tipo === "respaldo" ? { ...r, entrada } : r);
        }
      })}
      noValidate
      className="border-border-soft bg-surface space-y-4 rounded-lg border p-5 lg:p-7"
    >
      <div>
        <p className="eyebrow mb-1.5">Quiero ser distribuidor</p>
        <h3 className="font-display text-2xl leading-tight">
          Déjanos tus datos y te armamos la propuesta
        </h3>
        <p className="text-fg-muted mt-2 text-sm leading-relaxed">
          Sin compromiso. Te escribimos por WhatsApp para resolver tus dudas
          sobre precios por volumen, lotes y envíos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="dist-nombre" className="mb-1.5">
            Nombre
          </Label>
          <Input
            id="dist-nombre"
            autoComplete="name"
            placeholder="Tu nombre"
            className="h-12"
            aria-invalid={Boolean(errors.nombre)}
            {...register("nombre")}
          />
          {errors.nombre ? (
            <p role="alert" className="text-danger mt-1.5 text-xs">
              {errors.nombre.message}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="dist-whatsapp" className="mb-1.5">
            WhatsApp
          </Label>
          <Input
            id="dist-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="477 123 4567"
            className="h-12"
            aria-invalid={Boolean(errors.whatsapp)}
            {...register("whatsapp", {
              onChange: (e) => {
                e.target.value = formatearTelefono(e.target.value);
              },
            })}
          />
          {errors.whatsapp ? (
            <p role="alert" className="text-danger mt-1.5 text-xs">
              {errors.whatsapp.message}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="dist-ciudad" className="mb-1.5">
            Ciudad
          </Label>
          <Input
            id="dist-ciudad"
            autoComplete="address-level2"
            placeholder="León, Gto."
            className="h-12"
            aria-invalid={Boolean(errors.ciudad)}
            {...register("ciudad")}
          />
          {errors.ciudad ? (
            <p role="alert" className="text-danger mt-1.5 text-xs">
              {errors.ciudad.message}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="dist-volumen" className="mb-1.5">
            Volumen estimado
          </Label>
          <input type="hidden" {...register("volumen")} />
          <Select
            value={volumen}
            onValueChange={(v) => {
              setVolumen(v);
              setValue("volumen", v, { shouldValidate: true });
            }}
          >
            <SelectTrigger id="dist-volumen" className="h-12 w-full">
              <SelectValue placeholder="Elige una opción" />
            </SelectTrigger>
            <SelectContent>
              {VOLUMENES.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.volumen ? (
            <p role="alert" className="text-danger mt-1.5 text-xs">
              {errors.volumen.message}
            </p>
          ) : null}
        </div>
      </div>

      {problema?.tipo === "invalida" ? (
        <p role="alert" className="text-danger text-sm">
          {problema.mensaje}
        </p>
      ) : null}
      {problema?.tipo === "respaldo" ? (
        <RespaldoWhatsApp entrada={problema.entrada} sinServidor={problema.sinServidor} />
      ) : null}

      <Button
        type="submit"
        variant="gold"
        size="touch-lg"
        className="w-full"
        disabled={enviando}
      >
        {enviando
          ? "Enviando…"
          : problema?.tipo === "respaldo" && !problema.sinServidor
            ? "Volver a intentar"
            : "Quiero la propuesta"}
      </Button>
    </form>
  );
}
