"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, ExternalLink, MapPin, MessageCircle, Search } from "lucide-react";
import { CARGOS, LADAS, PAISES, TIPOS_PROVEEDOR } from "@/data/catalogo";
import { MapaPunto } from "@/components/mapa-punto";
import { SelectorHorario } from "@/components/captura/selector-horario";
import { Boton, Campo, Chips, Selector, SelectorAbierto, Tarjeta } from "@/components/ui";
import { direccionDe, enlaceMapa, ubicacionActual } from "@/lib/geo";
import type { Proveedor, TipoProveedor } from "@/lib/tipos";
import { enlaceWhatsapp } from "@/lib/utils";

export function PasoIdentidad({
  proveedor,
  actualizar,
}: {
  proveedor: Proveedor;
  actualizar: (cambios: Partial<Proveedor>) => void;
}) {
  return (
    <div className="grid gap-3">
      <Tarjeta titulo="Identificación">
        <div className="grid gap-3">
          <Campo
            etiqueta="Nombre del negocio *"
            placeholder="Perfumes del Centro"
            value={proveedor.nombre}
            autoFocus={proveedor.nombre === ""}
            onChange={(e) => actualizar({ nombre: e.target.value })}
          />
          <Chips<TipoProveedor>
            etiqueta="Tipo de proveedor"
            opciones={TIPOS_PROVEEDOR}
            valor={proveedor.tipo}
            onChange={(v) => actualizar({ tipo: proveedor.tipo === v ? null : v })}
          />
          <div className="grid grid-cols-[6.5rem_1fr] gap-3">
            {/* La lada va aparte porque nadie la escribe en su propio país, y
                sin ella el enlace de WhatsApp no abre desde el extranjero —
                que es exactamente donde se está usando esto. */}
            <Selector
              etiqueta="Lada"
              opciones={LADAS.map((l) => ({ valor: l.valor, etiqueta: l.etiqueta }))}
              valor={proveedor.lada || null}
              onChange={(v) => actualizar({ lada: v ?? "" })}
            />
            <Campo
              etiqueta="Teléfono *"
              type="tel"
              inputMode="tel"
              placeholder="55 1234 5678"
              value={proveedor.telefono}
              onChange={(e) => actualizar({ telefono: e.target.value })}
            />
          </div>
          <Campo
            etiqueta="WhatsApp"
            type="tel"
            inputMode="tel"
            placeholder="Solo si es distinto al teléfono"
            value={proveedor.whatsapp}
            onChange={(e) => actualizar({ whatsapp: e.target.value })}
          />
          {(proveedor.whatsapp || proveedor.telefono) && (
            <a
              href={enlaceWhatsapp(
                proveedor.lada,
                proveedor.whatsapp || proveedor.telefono,
                proveedor.contactoNombre,
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 text-[14px] font-medium text-info"
            >
              <MessageCircle size={16} />
              Escribir por WhatsApp
            </a>
          )}
        </div>
      </Tarjeta>

      <Ubicacion proveedor={proveedor} actualizar={actualizar} />

      <Tarjeta titulo="Contacto y datos" pista="Opcional. Se puede completar al salir.">
        <div className="grid gap-3">
          <Campo
            etiqueta="Contacto"
            placeholder="Con quién hablaste"
            value={proveedor.contactoNombre}
            onChange={(e) => actualizar({ contactoNombre: e.target.value })}
          />
          <SelectorAbierto
            etiqueta="Cargo"
            opciones={CARGOS}
            valor={proveedor.contactoCargo}
            onChange={(v) => actualizar({ contactoCargo: v })}
            placeholder="¿Qué cargo tiene?"
          />
          <Campo
            etiqueta="Correo"
            type="email"
            inputMode="email"
            value={proveedor.email}
            onChange={(e) => actualizar({ email: e.target.value })}
          />
          <Campo
            etiqueta="Redes o sitio web"
            placeholder="@usuario o sitio.com"
            value={proveedor.redes}
            onChange={(e) => actualizar({ redes: e.target.value })}
          />
          <SelectorHorario
            horario={proveedor.horario}
            onChange={(horario) => actualizar({ horario })}
          />
          <Campo
            etiqueta="Razón social"
            placeholder="Para facturación"
            value={proveedor.razonSocial}
            onChange={(e) => actualizar({ razonSocial: e.target.value })}
          />
        </div>
      </Tarjeta>
    </div>
  );
}

function Ubicacion({
  proveedor,
  actualizar,
}: {
  proveedor: Proveedor;
  actualizar: (cambios: Partial<Proveedor>) => void;
}) {
  const [ubicando, setUbicando] = useState(false);
  const [buscandoDir, setBuscandoDir] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const temporizadorDir = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Cada consulta lleva número: si el punto se mueve otra vez mientras una
      respuesta viaja, la vieja llega tarde y no debe pisar la nueva dirección. */
  const consulta = useRef(0);

  const rellenarDireccion = useCallback(
    async (lat: number, lng: number) => {
      const mia = ++consulta.current;
      setBuscandoDir(true);
      const dir = await direccionDe(lat, lng);
      if (mia !== consulta.current) return dir;
      if (dir) actualizar({ direccion: dir.texto, ciudad: dir.ciudad, pais: dir.pais });
      setBuscandoDir(false);
      return dir;
    },
    [actualizar],
  );

  const usarGps = useCallback(async () => {
    setUbicando(true);
    setAviso(null);
    try {
      const u = await ubicacionActual();
      actualizar({
        lat: u.lat,
        lng: u.lng,
        precisionGps: u.precision,
        origenUbicacion: "gps",
      });
      // Una precisión de cientos de metros casi siempre significa que la posición
      // vino del wifi o de la IP, no del satélite. Vale más avisarlo que dejar
      // que alguien confíe en un punto que está a diez cuadras.
      if (u.precision > 100) {
        setAviso(
          `El dispositivo reporta ±${u.precision} m: probablemente lo sacó de la red, no del GPS. Corrige el punto en el mapa.`,
        );
      }
      await rellenarDireccion(u.lat, u.lng);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo ubicar");
    } finally {
      setUbicando(false);
    }
  }, [actualizar, rellenarDireccion]);

  // En una ficha nueva el GPS se pide solo: es el dato que más cuesta recuperar
  // después y el que nadie se acuerda de tocar al salir del local.
  useEffect(() => {
    if (proveedor.lat === null && proveedor.nombre === "") void usarGps();
    // Solo al abrir una ficha nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moverAMano = useCallback(
    (lat: number, lng: number) => {
      // El punto puesto a dedo no tiene "precisión" en el sentido del GPS, y
      // dejar el ±X anterior sería mentir sobre un dato nuevo.
      actualizar({ lat, lng, precisionGps: null, origenUbicacion: "manual" });
      setAviso(null);

      // La dirección sigue al punto sola. Va con 700 ms de espera porque
      // Nominatim admite una petición por segundo y corregir el pin son tres o
      // cuatro toques seguidos: solo el último merece viajar.
      if (temporizadorDir.current) clearTimeout(temporizadorDir.current);
      consulta.current++;
      setBuscandoDir(true);
      temporizadorDir.current = setTimeout(() => {
        void rellenarDireccion(lat, lng).then((dir) => {
          if (!dir) {
            setBuscandoDir(false);
            setAviso("Sin red para resolver la dirección. Se puede escribir a mano.");
          }
        });
      }, 700);
    },
    [actualizar, rellenarDireccion],
  );

  // Una consulta pendiente no debe dispararse después de salir de la pantalla.
  useEffect(() => {
    return () => {
      if (temporizadorDir.current) clearTimeout(temporizadorDir.current);
    };
  }, []);

  const buscarDireccion = async () => {
    if (proveedor.lat === null || proveedor.lng === null) return;
    const dir = await rellenarDireccion(proveedor.lat, proveedor.lng);
    if (!dir) {
      setBuscandoDir(false);
      setAviso("Sin red para resolver la dirección. Se puede escribir a mano.");
    }
  };

  return (
    <Tarjeta
      titulo="Ubicación"
      pista="El punto del mapa es el dato que manda. Muévelo hasta la puerta del local y la dirección se actualiza sola."
    >
      <div className="grid gap-3">
        <MapaPunto lat={proveedor.lat} lng={proveedor.lng} onCambio={moverAMano} />

        <div className="flex gap-2">
          <Boton
            variante="secundario"
            onClick={usarGps}
            disabled={ubicando}
            className="flex-1"
          >
            <Crosshair size={18} />
            {ubicando ? "Buscando…" : "Usar mi GPS"}
          </Boton>
          <Boton
            variante="secundario"
            onClick={buscarDireccion}
            disabled={buscandoDir || proveedor.lat === null}
            className="flex-1"
          >
            <Search size={18} />
            {buscandoDir ? "Buscando…" : "Dirección"}
          </Boton>
        </div>

        {aviso && (
          <p className="rounded-lg border border-border-strong bg-bg px-3 py-2 text-[13px] text-warning">
            {aviso}
          </p>
        )}

        {proveedor.lat !== null && proveedor.lng !== null ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border-strong px-3 py-2 text-[13px]">
            <span className="tabular-nums text-fg-muted">
              <MapPin size={13} className="mr-1 inline align-[-2px]" />
              {proveedor.lat.toFixed(5)}, {proveedor.lng.toFixed(5)}
              <span className="text-fg-subtle">
                {proveedor.origenUbicacion === "manual"
                  ? " · puesto a mano"
                  : proveedor.precisionGps !== null
                    ? ` · GPS ±${proveedor.precisionGps} m`
                    : ""}
              </span>
            </span>
            <a
              href={enlaceMapa(proveedor.lat, proveedor.lng)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 shrink-0 items-center gap-1 font-medium text-info"
            >
              Abrir <ExternalLink size={14} />
            </a>
          </div>
        ) : (
          <p className="text-[13px] text-fg-subtle">
            Todavía sin punto. Toca el mapa donde estás parado.
          </p>
        )}

        <Campo
          etiqueta="Dirección"
          pista={
            buscandoDir ? "Buscando la dirección de este punto…" : undefined
          }
          placeholder="Se completa sola al mover el punto, si hay red"
          value={proveedor.direccion}
          onChange={(e) => actualizar({ direccion: e.target.value })}
        />
        <Campo
          etiqueta="Ciudad"
          value={proveedor.ciudad}
          onChange={(e) => actualizar({ ciudad: e.target.value })}
        />
        {/* El país lo rellena el geocodificador, pero si viene con una grafía
            distinta ("Mexico", "México") deja de agrupar. El selector lo fija;
            lo que llegue de fuera y no coincida aparece bajo "Otro". */}
        <SelectorAbierto
          etiqueta="País"
          opciones={PAISES}
          valor={proveedor.pais}
          onChange={(v) => actualizar({ pais: v })}
          placeholder="¿Qué país?"
        />
      </div>
    </Tarjeta>
  );
}
