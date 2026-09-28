"use client";

import { useState } from "react";
import Link from "next/link";
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
import { formatearTelefono } from "@/components/checkout/esquemas";
import { RespaldoWhatsApp, mandarSolicitud } from "@/components/cuenta/solicitud-respaldo";
import type { SolicitudEntrada } from "../../../compartido/tienda-admin";

const ASUNTOS = [
  "Estado de mi pedido",
  "Dudas antes de comprar",
  "Mayoreo y reventa",
  "Cambios y devoluciones",
  "Facturación",
  "Otro",
];

/**
 * Formulario de contacto.
 *
 * Llega al panel como solicitud de tipo `contacto` (`POST /solicitudes`).
 * Antes enseñaba «Mensaje enviado» sin mandar nada. El WhatsApp es obligatorio
 * porque es por donde contesta la tienda; el correo, opcional. Si no hay
 * servidor o no contesta, se dice que no se envió y se ofrece WhatsApp.
 */
export function FormularioContacto() {
  const [enviado, setEnviado] = useState<{ correo: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [asunto, setAsunto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [problema, setProblema] = useState<
    | { tipo: "invalida"; mensaje: string }
    | { tipo: "respaldo"; sinServidor: boolean; entrada: SolicitudEntrada }
    | null
  >(null);

  if (enviado) {
    return (
      <div
        role="status"
        className="border-success/30 bg-success/10 rounded-lg border px-6 py-8 text-center"
      >
        <div className="bg-success/20 text-success mx-auto mb-4 grid size-12 place-items-center rounded-full">
          <Check size={24} aria-hidden />
        </div>
        <p className="font-display mb-2 text-xl">Recibimos tu mensaje</p>
        <p className="text-fg-muted text-sm leading-relaxed">
          Te contestamos por WhatsApp{enviado.correo ? " o por correo" : ""} en
          horario laboral. Si es urgente, escríbenos directo por WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        const nuevos: Record<string, string> = {};

        const nombre = String(datos.get("nombre") ?? "").trim();
        const correo = String(datos.get("correo") ?? "").trim();
        const mensaje = String(datos.get("mensaje") ?? "").trim();

        if (nombre.length < 3) nuevos.nombre = "Escribe tu nombre";
        if (telefono.replace(/\D/g, "").length < 10) {
          nuevos.telefono = "Tu WhatsApp a 10 dígitos, para contestarte";
        }
        if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo))
          nuevos.correo = "Revisa el correo, parece que falta algo";
        if (!asunto) nuevos.asunto = "Elige un asunto";
        if (mensaje.length < 10)
          nuevos.mensaje = "Cuéntanos un poco más para poder ayudarte";

        setErrores(nuevos);
        if (Object.keys(nuevos).length > 0) return;

        const entrada: SolicitudEntrada = {
          tipo: "contacto",
          nombre,
          telefono,
          ...(correo ? { correo } : {}),
          mensaje: `Asunto: ${asunto}\n\n${mensaje}`,
        };
        setEnviando(true);
        setProblema(null);
        const r = await mandarSolicitud(entrada);
        setEnviando(false);
        if (r.tipo === "enviada") {
          setEnviado({ correo });
          toast.success("Recibimos tu mensaje", {
            description: "Te contestamos por WhatsApp lo antes posible.",
          });
        } else {
          setProblema(r.tipo === "respaldo" ? { ...r, entrada } : r);
        }
      }}
      className="border-border-soft bg-surface space-y-4 rounded-lg border p-5 lg:p-7"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-nombre" className="mb-1.5">
            Nombre
          </Label>
          <Input
            id="c-nombre"
            name="nombre"
            autoComplete="name"
            className="h-12"
            aria-invalid={Boolean(errores.nombre)}
          />
          {errores.nombre ? (
            <p role="alert" className="text-danger mt-1.5 text-xs">
              {errores.nombre}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="c-telefono" className="mb-1.5">
            WhatsApp
          </Label>
          <Input
            id="c-telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="477 123 4567"
            value={telefono}
            onChange={(e) => setTelefono(formatearTelefono(e.target.value))}
            className="h-12"
            aria-invalid={Boolean(errores.telefono)}
          />
          {errores.telefono ? (
            <p role="alert" className="text-danger mt-1.5 text-xs">
              {errores.telefono}
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="c-correo" className="mb-1.5 flex items-baseline gap-2">
            Correo
            <span className="text-fg-subtle text-[11px]">opcional</span>
          </Label>
          <Input
            id="c-correo"
            name="correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="h-12"
            aria-invalid={Boolean(errores.correo)}
          />
          {errores.correo ? (
            <p role="alert" className="text-danger mt-1.5 text-xs">
              {errores.correo}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <Label htmlFor="c-asunto" className="mb-1.5">
          Asunto
        </Label>
        <Select value={asunto} onValueChange={setAsunto}>
          <SelectTrigger id="c-asunto" className="h-12 w-full">
            <SelectValue placeholder="¿De qué se trata?" />
          </SelectTrigger>
          <SelectContent>
            {ASUNTOS.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errores.asunto ? (
          <p role="alert" className="text-danger mt-1.5 text-xs">
            {errores.asunto}
          </p>
        ) : null}
        {asunto === "Estado de mi pedido" ? (
          <p className="text-fg-muted mt-1.5 text-xs">
            Puedes verlo al momento en{" "}
            <Link href="/rastreo" className="text-gold-light underline underline-offset-4">
              Rastrear pedido
            </Link>{" "}
            con tu folio y tu teléfono.
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="c-mensaje" className="mb-1.5">
          Mensaje
        </Label>
        <textarea
          id="c-mensaje"
          name="mensaje"
          rows={5}
          maxLength={1800}
          placeholder="Si es sobre un pedido, incluye tu folio (REY-2026-…)"
          aria-invalid={Boolean(errores.mensaje)}
          className="border-border-strong focus-visible:border-gold placeholder:text-fg-subtle w-full rounded-md border bg-transparent px-3 py-2.5 text-base outline-none sm:text-sm"
        />
        {errores.mensaje ? (
          <p role="alert" className="text-danger mt-1.5 text-xs">
            {errores.mensaje}
          </p>
        ) : null}
      </div>

      {problema?.tipo === "invalida" ? (
        <p role="alert" className="text-danger text-sm">
          {problema.mensaje}
        </p>
      ) : null}
      {problema?.tipo === "respaldo" ? (
        <RespaldoWhatsApp entrada={problema.entrada} sinServidor={problema.sinServidor} />
      ) : null}

      <Button type="submit" variant="gold" size="touch-lg" className="w-full" disabled={enviando}>
        {enviando
          ? "Enviando…"
          : problema?.tipo === "respaldo" && !problema.sinServidor
            ? "Volver a intentar"
            : "Enviar mensaje"}
      </Button>
    </form>
  );
}
