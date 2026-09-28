"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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
import type { SolicitudEntrada } from "../../../compartido/tienda-admin";
import { RespaldoWhatsApp, mandarSolicitud } from "./solicitud-respaldo";

/**
 * Los regímenes fiscales más comunes entre quienes compran para revender. No
 * es el catálogo completo del SAT: quien tenga otro lo escribe en «Otro».
 */
const REGIMENES = [
  "601 · General de Ley Personas Morales",
  "603 · Personas Morales con Fines no Lucrativos",
  "605 · Sueldos y Salarios",
  "606 · Arrendamiento",
  "612 · Personas Físicas con Actividades Empresariales y Profesionales",
  "616 · Sin obligaciones fiscales",
  "621 · Incorporación Fiscal",
  "625 · Actividades Empresariales a través de Plataformas Tecnológicas",
  "626 · Régimen Simplificado de Confianza",
];

const USOS_CFDI = [
  "G01 · Adquisición de mercancías",
  "G03 · Gastos en general",
  "S01 · Sin efectos fiscales",
];

/** El mismo patrón que valida el servidor: persona moral (12) o física (13). */
const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

/**
 * «Solicitar factura» de un pedido.
 *
 * El FAQ prometía la factura «desde tu cuenta» sin que existiera. Esto la
 * pide de verdad: llega al panel como solicitud de tipo `factura`, con el
 * folio, y el equipo la emite. No se guardan datos fiscales en la cuenta
 * (todavía): se piden aquí cada vez.
 */
export function FormularioFactura({
  folio,
  inicial,
  onCerrar,
}: {
  folio: string;
  inicial: { nombre: string; telefono: string; correo: string };
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [telefono, setTelefono] = useState(formatearTelefono(inicial.telefono));
  const [correo, setCorreo] = useState(inicial.correo);
  const [rfc, setRfc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [regimen, setRegimen] = useState("");
  const [cpFiscal, setCpFiscal] = useState("");
  const [usoCfdi, setUsoCfdi] = useState(USOS_CFDI[0]!);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<
    | { tipo: "enviada" }
    | { tipo: "invalida"; mensaje: string }
    | { tipo: "respaldo"; sinServidor: boolean; entrada: SolicitudEntrada }
    | null
  >(null);

  if (resultado?.tipo === "enviada") {
    return (
      <div
        role="status"
        className="border-success/30 bg-success/10 rounded-lg border p-5 text-center"
      >
        <div className="bg-success/20 text-success mx-auto mb-3 grid size-10 place-items-center rounded-full">
          <Check size={20} aria-hidden />
        </div>
        <p className="font-display mb-1 text-lg">Recibimos tu solicitud de factura</p>
        <p className="text-fg-muted text-sm leading-relaxed">
          La emitimos con los datos que nos diste para el pedido {folio} y te la
          mandamos {correo ? `a ${correo}` : "por WhatsApp"}. Si falta algo, te
          escribimos.
        </p>
        <Button variant="ghost" size="touch" className="mt-3" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = rfc.trim().toUpperCase().replace(/\s+/g, "");
    const nuevos: Record<string, string> = {};
    if (nombre.trim().length < 3) nuevos.nombre = "Escribe tu nombre";
    if (telefono.replace(/\D/g, "").length < 10) nuevos.telefono = "Un WhatsApp de 10 dígitos";
    if (correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim())) {
      nuevos.correo = "Revisa el correo";
    }
    if (!RFC.test(limpio)) nuevos.rfc = "El RFC tiene 12 o 13 caracteres, sin guiones ni espacios";
    if (razonSocial.trim().length < 3) nuevos.razonSocial = "Escribe la razón social tal como está en tu constancia";
    if (!regimen) nuevos.regimen = "Elige tu régimen fiscal";
    if (!/^\d{5}$/.test(cpFiscal)) nuevos.cpFiscal = "El código postal fiscal son 5 dígitos";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    const entrada: SolicitudEntrada = {
      tipo: "factura",
      folio,
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      correo: correo.trim() || undefined,
      rfc: limpio,
      razonSocial: razonSocial.trim(),
      regimen,
      cpFiscal,
      usoCfdi,
    };
    setEnviando(true);
    const r = await mandarSolicitud(entrada);
    setEnviando(false);
    setResultado(r.tipo === "respaldo" ? { ...r, entrada } : r);
  }

  const campo = (
    id: string,
    etiqueta: string,
    valor: string,
    poner: (v: string) => void,
    extra: React.ComponentProps<typeof Input> = {},
  ) => (
    <div>
      <Label htmlFor={`factura-${id}`} className="mb-1 text-xs">
        {etiqueta}
      </Label>
      <Input
        id={`factura-${id}`}
        value={valor}
        onChange={(e) => {
          poner(e.target.value);
          setResultado(null);
        }}
        aria-invalid={Boolean(errores[id])}
        className="h-11"
        {...extra}
      />
      {errores[id] ? (
        <p role="alert" className="text-danger mt-1 text-xs">
          {errores[id]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="border-border-soft bg-surface space-y-3 rounded-lg border p-5"
    >
      <div>
        <h2 className="font-display text-lg">Solicitar factura</h2>
        <p className="text-fg-muted mt-1 text-sm leading-relaxed">
          Pedido <span data-precio>{folio}</span>. Usa los datos de tu constancia
          de situación fiscal. La emitimos cuando el pago esté confirmado.
        </p>
      </div>

      {campo("rfc", "RFC", rfc, (v) => setRfc(v.toUpperCase()), {
        autoComplete: "off",
        maxLength: 13,
        placeholder: "XAXX010101000",
      })}
      {campo("razonSocial", "Razón social o nombre", razonSocial, setRazonSocial, {
        autoComplete: "organization",
      })}

      <div>
        <Label htmlFor="factura-regimen" className="mb-1 text-xs">
          Régimen fiscal
        </Label>
        <Select
          value={regimen}
          onValueChange={(v) => {
            setRegimen(v);
            setResultado(null);
          }}
        >
          <SelectTrigger
            id="factura-regimen"
            className="h-11 w-full"
            aria-invalid={Boolean(errores.regimen)}
          >
            <SelectValue placeholder="Elige tu régimen" />
          </SelectTrigger>
          <SelectContent>
            {REGIMENES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
            <SelectItem value="Otro (lo aclaro por WhatsApp)">Otro (lo aclaro por WhatsApp)</SelectItem>
          </SelectContent>
        </Select>
        {errores.regimen ? (
          <p role="alert" className="text-danger mt-1 text-xs">
            {errores.regimen}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {campo("cpFiscal", "CP fiscal", cpFiscal, (v) => setCpFiscal(v.replace(/\D/g, "").slice(0, 5)), {
          inputMode: "numeric",
          maxLength: 5,
          placeholder: "37000",
        })}
        <div>
          <Label htmlFor="factura-uso" className="mb-1 text-xs">
            Uso del CFDI
          </Label>
          <Select value={usoCfdi} onValueChange={setUsoCfdi}>
            <SelectTrigger id="factura-uso" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USOS_CFDI.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {campo("correo", "Correo para mandarte la factura", correo, setCorreo, {
        type: "email",
        inputMode: "email",
        autoComplete: "email",
      })}
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("nombre", "Tu nombre", nombre, setNombre, { autoComplete: "name" })}
        {campo("telefono", "WhatsApp", telefono, (v) => setTelefono(formatearTelefono(v)), {
          type: "tel",
          inputMode: "tel",
          autoComplete: "tel",
        })}
      </div>

      {resultado?.tipo === "invalida" ? (
        <p role="alert" className="text-danger text-sm">
          {resultado.mensaje}
        </p>
      ) : null}
      {resultado?.tipo === "respaldo" ? (
        <RespaldoWhatsApp entrada={resultado.entrada} sinServidor={resultado.sinServidor} />
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" variant="gold" size="touch" className="flex-1" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </Button>
        <Button type="button" variant="outline" size="touch" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
