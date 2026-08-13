import { z } from "zod";

/** Validación del checkout. Ningún dato sale del navegador: no hay backend. */

export const esquemaContacto = z.object({
  correo: z
    .string()
    .min(1, "Necesitamos tu correo para mandarte la guía de rastreo")
    .email("Revisa el correo, parece que falta algo"),
  nombre: z
    .string()
    .min(3, "Escribe tu nombre completo")
    .max(80, "Ese nombre es demasiado largo"),
  telefono: z
    .string()
    .min(1, "Sin teléfono la paquetería no puede entregarte")
    .regex(
      /^[\d\s()+-]{10,17}$/,
      "El teléfono debe tener 10 dígitos, por ejemplo 477 123 4567",
    ),
  calle: z.string().min(5, "Incluye calle y número"),
  colonia: z.string().min(3, "Escribe tu colonia"),
  cp: z.string().regex(/^\d{5}$/, "El código postal son 5 dígitos"),
  ciudad: z.string().min(2, "Escribe tu ciudad"),
  estado: z.string().min(2, "Escribe tu estado"),
  referencias: z.string().max(180, "Máximo 180 caracteres").optional(),
});

export type DatosContacto = z.infer<typeof esquemaContacto>;

const soloDigitos = (s: string) => s.replace(/\D/g, "");

export const esquemaTarjeta = z.object({
  numero: z
    .string()
    .min(1, "Escribe el número de tu tarjeta")
    .refine((v) => soloDigitos(v).length >= 15 && soloDigitos(v).length <= 16, {
      message: "El número de tarjeta debe tener 15 o 16 dígitos",
    }),
  titular: z.string().min(5, "Escribe el nombre tal como aparece en la tarjeta"),
  vencimiento: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Usa el formato MM/AA")
    .refine((v) => {
      const [mes, anio] = v.split("/");
      const fin = new Date(2000 + Number(anio), Number(mes), 0);
      return fin >= new Date();
    }, "Esa tarjeta ya venció"),
  cvv: z.string().regex(/^\d{3,4}$/, "El CVV son 3 dígitos (4 en American Express)"),
});

export type DatosTarjeta = z.infer<typeof esquemaTarjeta>;

/** Máscara 4242 4242 4242 4242 mientras se escribe. */
export function formatearTarjeta(valor: string): string {
  return soloDigitos(valor)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Máscara MM/AA. */
export function formatearVencimiento(valor: string): string {
  const d = soloDigitos(valor).slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Máscara 477 123 4567. */
export function formatearTelefono(valor: string): string {
  const d = soloDigitos(valor).slice(0, 10);
  const partes = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean);
  return partes.join(" ");
}

export const esquemaDistribuidor = z.object({
  nombre: z.string().min(3, "Escribe tu nombre"),
  whatsapp: z
    .string()
    .regex(/^[\d\s()+-]{10,17}$/, "Escribe un WhatsApp a 10 dígitos"),
  ciudad: z.string().min(3, "¿Desde qué ciudad vendes?"),
  volumen: z.string().min(1, "Elige un volumen estimado"),
});

export type DatosDistribuidor = z.infer<typeof esquemaDistribuidor>;
