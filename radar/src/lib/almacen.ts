"use client";

import { normalizar, type Foto, type Proveedor } from "@/lib/tipos";

/**
 * Almacén local en IndexedDB. Es la red de seguridad de toda la app: en la calle
 * no hay señal garantizada, así que nada se guarda "al enviar" — se guarda al
 * teclear, y la sincronización con AWS (Fase 2) es un proceso aparte que lee de
 * aquí. Las fotos van como Blob: en localStorage, en base64, tres fotos revientan
 * la cuota de 5 MB.
 */

const BD = "radar";
const VERSION = 1;
const PROVEEDORES = "proveedores";
const FOTOS = "fotos";

let promesa: Promise<IDBDatabase> | null = null;

function abrir(): Promise<IDBDatabase> {
  if (promesa) return promesa;
  promesa = new Promise((resolve, reject) => {
    const req = indexedDB.open(BD, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PROVEEDORES)) {
        db.createObjectStore(PROVEEDORES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(FOTOS)) {
        const store = db.createObjectStore(FOTOS, { keyPath: "id" });
        store.createIndex("proveedorId", "proveedorId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return promesa;
}

function tx<T>(
  store: string,
  modo: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, modo);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

// ── Proveedores ────────────────────────────────────────────────────────────

export function guardarProveedor(p: Proveedor): Promise<IDBValidKey> {
  return tx(PROVEEDORES, "readwrite", (s) =>
    s.put({ ...p, actualizadoEn: new Date().toISOString() }),
  );
}

export async function leerProveedor(id: string): Promise<Proveedor | undefined> {
  const guardado = await tx<Proveedor | undefined>(PROVEEDORES, "readonly", (s) =>
    s.get(id),
  );
  // Las fichas sobreviven a los despliegues: una capturada con la versión
  // anterior no tiene los ejes nuevos, y sin esto reventaría al leerlos.
  return guardado ? normalizar(guardado) : undefined;
}

export async function listarProveedores(): Promise<Proveedor[]> {
  const todos = await tx<Proveedor[]>(PROVEEDORES, "readonly", (s) => s.getAll());
  return todos
    .map(normalizar)
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
}

export async function borrarProveedor(id: string): Promise<void> {
  const fotos = await fotosDe(id);
  await Promise.all(fotos.map((f) => borrarFoto(f.id)));
  await tx(PROVEEDORES, "readwrite", (s) => s.delete(id));
}

// ── Fotos ──────────────────────────────────────────────────────────────────

export function guardarFoto(f: Foto): Promise<IDBValidKey> {
  return tx(FOTOS, "readwrite", (s) => s.put(f));
}

export function borrarFoto(id: string): Promise<undefined> {
  return tx(FOTOS, "readwrite", (s) => s.delete(id));
}

export function fotosDe(proveedorId: string): Promise<Foto[]> {
  return abrir().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(FOTOS, "readonly");
        const req = t.objectStore(FOTOS).index("proveedorId").getAll(proveedorId);
        req.onsuccess = () => resolve(req.result as Foto[]);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function contarFotos(): Promise<number> {
  return tx<number>(FOTOS, "readonly", (s) => s.count());
}

/** Espacio disponible, para avisar antes de que el teléfono se llene en calle. */
export async function espacio(): Promise<{ usadoMb: number; disponibleMb: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return {
    usadoMb: Math.round((usage / 1_048_576) * 10) / 10,
    disponibleMb: Math.round(((quota - usage) / 1_048_576) * 10) / 10,
  };
}
