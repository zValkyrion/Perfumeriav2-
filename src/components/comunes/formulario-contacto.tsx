"use client";

import { useState } from "react";
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

const ASUNTOS = [
  "Estado de mi pedido",
  "Dudas antes de comprar",
  "Mayoreo y reventa",
  "Cambios y devoluciones",
  "Facturación",
  "Otro",
];

export function FormularioContacto() {
  const [enviado, setEnviado] = useState(false);
  const [asunto, setAsunto] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});

  if (enviado) {
    return (
      <div className="border-success/30 bg-success/10 rounded-lg border px-6 py-8 text-center">
        <div className="bg-success/20 text-success mx-auto mb-4 grid size-12 place-items-center rounded-full">
          <Check size={24} aria-hidden />
        </div>
        <p className="font-display mb-2 text-xl">Mensaje enviado</p>
        <p className="text-fg-muted text-sm leading-relaxed">
          Te contestamos por correo, normalmente en menos de una hora en horario
          laboral. Si es urgente, escríbenos por WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        const nuevos: Record<string, string> = {};

        const nombre = String(datos.get("nombre") ?? "").trim();
        const correo = String(datos.get("correo") ?? "").trim();
        const mensaje = String(datos.get("mensaje") ?? "").trim();

        if (nombre.length < 3) nuevos.nombre = "Escribe tu nombre";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo))
          nuevos.correo = "Revisa el correo, parece que falta algo";
        if (!asunto) nuevos.asunto = "Elige un asunto";
        if (mensaje.length < 10)
          nuevos.mensaje = "Cuéntanos un poco más para poder ayudarte";

        setErrores(nuevos);
        if (Object.keys(nuevos).length > 0) return;

        setEnviado(true);
        toast.success("Mensaje enviado", {
          description: "Te contestamos por correo lo antes posible.",
        });
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
          <Label htmlFor="c-correo" className="mb-1.5">
            Correo
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
      </div>

      <div>
        <Label htmlFor="c-mensaje" className="mb-1.5">
          Mensaje
        </Label>
        <textarea
          id="c-mensaje"
          name="mensaje"
          rows={5}
          maxLength={800}
          placeholder="Si es sobre un pedido, incluye tu folio (AUR-2026-…)"
          aria-invalid={Boolean(errores.mensaje)}
          className="border-border-strong focus-visible:border-gold placeholder:text-fg-subtle w-full rounded-md border bg-transparent px-3 py-2.5 text-sm outline-none"
        />
        {errores.mensaje ? (
          <p role="alert" className="text-danger mt-1.5 text-xs">
            {errores.mensaje}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="gold" size="touch-lg" className="w-full">
        Enviar mensaje
      </Button>
    </form>
  );
}
