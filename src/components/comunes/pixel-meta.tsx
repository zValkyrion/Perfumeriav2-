"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { PIXEL_ID } from "@/lib/pixel";

/**
 * Carga el pixel de Meta y cuenta las vistas de página.
 *
 * El `PageView` hay que dispararlo a mano en cada cambio de ruta: la tienda
 * navega sin recargar, así que el snippet de Meta —pensado para sitios que
 * piden una página nueva en cada clic— solo contaría la primera. Sin esto, una
 * campaña que manda tráfico al catálogo registra una visita y ninguna más
 * aunque la persona recorra veinte fichas.
 *
 * La primera vista la cuenta el propio snippet al inicializarse, y por eso el
 * efecto salta la ruta con la que se montó: contarla otra vez duplicaría cada
 * sesión y falsearía el costo por resultado.
 */
export function PixelMeta() {
  const ruta = usePathname();
  const primera = useRef(true);

  useEffect(() => {
    if (!PIXEL_ID) return;
    if (primera.current) {
      primera.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [ruta]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');
fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
