"use client";

/**
 * Comprime la foto en el teléfono antes de guardarla. Con roaming, subir el JPEG
 * de 4 MB que produce cualquier cámara moderna es tirar el dinero del cliente:
 * a 1600 px y WebP 0.72 la fachada de un local se ve igual de bien y pesa ~15
 * veces menos. También es lo que hace viable guardar cientos de fotos en
 * IndexedDB sin llenar el dispositivo.
 */

const LADO_MAX = 1600;
const CALIDAD = 0.72;

/**
 * La lista de precios va en JPEG, no en WebP.
 *
 * **Textract no admite WebP** — solo JPEG, PNG, PDF y TIFF — y esa foto existe
 * justamente para que la lea una máquina. El resto siguen en WebP, que pesa
 * mucho menos y se sube con datos de roaming.
 *
 * La calidad sube un poco porque aquí lo que importa son los números impresos:
 * un artefacto de compresión sobre un 8 lo convierte en un 3.
 */
const CALIDAD_TEXTO = 0.85;

export async function comprimir(
  archivo: File,
  formato: "webp" | "jpeg" = "webp",
): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return archivo;
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    lienzo.toBlob(
      resolve,
      `image/${formato}`,
      formato === "jpeg" ? CALIDAD_TEXTO : CALIDAD,
    ),
  );
  // Si el navegador no sabe escribir ese formato, es preferible la foto
  // original que ninguna foto.
  return blob ?? archivo;
}

/**
 * Foto de producto para la tienda, preparada en el navegador.
 *
 * La misma receta que la carga del CSV (`scripts/catalogo/imagenes.ts`):
 * productos en 600×800 y sets en 800×600, la foto centrada con margen sobre
 * fondo blanco —las fotos de catálogo vienen recortadas sobre blanco, y
 * cualquier otro color dejaría un marco alrededor del frasco—, WebP y una
 * miniatura de 12 px para el difuminado mientras carga. Así una foto subida
 * desde el panel se ve igual que las demás en la tarjeta y en la galería.
 *
 * Safari no sabe escribir WebP desde un canvas: ahí sale en JPEG, que la
 * tienda sirve igual.
 */
const FORMATOS_CATALOGO = {
  producto: { ancho: 600, alto: 800, margen: 24 },
  set: { ancho: 800, alto: 600, margen: 30 },
} as const;

export interface FotoCatalogo {
  blob: Blob;
  formato: "webp" | "jpeg";
  ancho: number;
  alto: number;
  blur: string;
  sha256: string;
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => lienzo.toBlob(resolve, tipo, calidad));
}

async function codificar(
  lienzo: HTMLCanvasElement,
  calidad: number,
): Promise<{ blob: Blob; formato: "webp" | "jpeg" }> {
  const webp = await aBlob(lienzo, "image/webp", calidad);
  // Un navegador que no escribe WebP devuelve PNG sin avisar.
  if (webp && webp.type === "image/webp") return { blob: webp, formato: "webp" };
  const jpeg = await aBlob(lienzo, "image/jpeg", calidad);
  if (!jpeg) throw new Error("Este navegador no pudo preparar la foto");
  return { blob: jpeg, formato: "jpeg" };
}

function aDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(blob);
  });
}

export async function fotoDeCatalogo(
  archivo: File,
  tipo: keyof typeof FORMATOS_CATALOGO,
): Promise<FotoCatalogo> {
  const f = FORMATOS_CATALOGO[tipo];
  const bitmap = await createImageBitmap(archivo);
  // «Contener» sin recortar, ampliando si hace falta: las fotos del PDF miden
  // unos 230 px y tienen que llenar el lienzo como las demás.
  const escala = Math.min(
    (f.ancho - 2 * f.margen) / bitmap.width,
    (f.alto - 2 * f.margen) / bitmap.height,
  );
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = f.ancho;
  lienzo.height = f.alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Este navegador no pudo preparar la foto");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, f.ancho, f.alto);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, Math.round((f.ancho - w) / 2), Math.round((f.alto - h) / 2), w, h);
  bitmap.close();

  const { blob, formato } = await codificar(lienzo, 0.84);

  const mini = document.createElement("canvas");
  mini.width = 12;
  mini.height = Math.round((12 * f.alto) / f.ancho);
  mini.getContext("2d")?.drawImage(lienzo, 0, 0, mini.width, mini.height);
  const blur = await aDataUrl((await codificar(mini, 0.4)).blob);

  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return { blob, formato, ancho: f.ancho, alto: f.alto, blur, sha256 };
}

export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
