import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * Fotos del catálogo: de la foto original a lo que sirve CloudFront.
 *
 * La clave de cada imagen lleva la huella de la foto **de origen** y de esta
 * receta. Dos consecuencias:
 *
 * - Una foto que no cambió conserva su clave, así que no se vuelve a subir ni a
 *   procesar: la carga de 300 productos toca solo los que cambiaron.
 * - Una foto que cambió recibe clave nueva, y por eso cada archivo puede
 *   servirse con caché de un año. Nunca hay que invalidar nada en CloudFront.
 *
 * Si se cambia el tamaño, el fondo o la calidad, se sube `RECETA` y todas las
 * claves cambian a la vez.
 */
export const RECETA = "v1";

/**
 * Productos en 3:4 —el formato de las tarjetas y la galería— y sets en 4:3.
 * Fondo blanco porque las fotos del catálogo vienen recortadas sobre blanco:
 * cualquier otro color dejaría un marco alrededor de cada frasco.
 */
const FORMATOS = {
  producto: { ancho: 600, alto: 800, margen: 24, carpeta: "productos" },
  set: { ancho: 800, alto: 600, margen: 30, carpeta: "sets" },
} as const;

export type TipoImagen = keyof typeof FORMATOS;

export function claveImagen(tipo: TipoImagen, codigo: string, origen: Buffer): string {
  const huella = createHash("sha1")
    .update(RECETA)
    .update(tipo)
    .update(origen)
    .digest("hex")
    .slice(0, 12);
  return `${FORMATOS[tipo].carpeta}/${codigo}/${huella}.webp`;
}

export function medidas(tipo: TipoImagen) {
  return { ancho: FORMATOS[tipo].ancho, alto: FORMATOS[tipo].alto };
}

export interface ImagenProcesada {
  datos: Buffer;
  ancho: number;
  alto: number;
  blur: string;
}

export async function procesarFoto(
  origen: Buffer,
  tipo: TipoImagen,
): Promise<ImagenProcesada> {
  const f = FORMATOS[tipo];
  // Las fotos del PDF miden unos 230 px: se amplían para llenar el lienzo. Un
  // enfoque suave compensa lo que la ampliación difumina.
  const foto = await sharp(origen)
    .resize({
      width: f.ancho - 2 * f.margen,
      height: f.alto - 2 * f.margen,
      fit: "inside",
      kernel: "lanczos3",
    })
    .sharpen({ sigma: 0.6 })
    .toBuffer();

  const datos = await sharp({
    create: { width: f.ancho, height: f.alto, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: foto, gravity: "center" }])
    .webp({ quality: 84, effort: 5 })
    .toBuffer();

  const mini = await sharp(datos).resize(12).webp({ quality: 40 }).toBuffer();

  return {
    datos,
    ancho: f.ancho,
    alto: f.alto,
    blur: `data:image/webp;base64,${mini.toString("base64")}`,
  };
}
