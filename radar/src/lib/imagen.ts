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

export async function comprimir(archivo: File): Promise<Blob> {
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
    lienzo.toBlob(resolve, "image/webp", CALIDAD),
  );
  // Si el navegador no sabe escribir WebP, es preferible la foto original que
  // ninguna foto.
  return blob ?? archivo;
}

export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
