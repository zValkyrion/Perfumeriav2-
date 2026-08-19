# Radar de Proveedores

> **La fuente de verdad de este módulo es [MEMORIA.md](MEMORIA.md).** Ahí están la
> infraestructura desplegada, las decisiones con su porqué, la bitácora de cambios
> y las reglas para quien trabaje aquí — persona o IA. Léelo antes de tocar nada.

App de campo para evaluar proveedores de perfumería. Plan completo y decisiones
de arquitectura: [`../RADAR_PLAN.md`](../RADAR_PLAN.md).

Es una app **independiente** de la landing de EL REY DE LOS PERFUMES: su propio `package.json`, su
propio deploy. La landing sigue exportándose estática a GitHub Pages sin
enterarse de que esto existe.

## Correr

```bash
npm --prefix radar install
npm --prefix radar run dev         # http://localhost:3100
npm --prefix radar run probar      # 22 pruebas contra producción
npm --prefix radar run desplegar   # sst deploy --stage produccion
```

**En producción:** https://devfq5kjop78h.cloudfront.net

Para probar la cámara y el GPS hace falta abrirla desde el teléfono, y ambos
exigen HTTPS o `localhost`. Lo más rápido en la práctica: desplegar la Fase 1 y
usar la URL real.

## Estado: en producción

Funciona **sin backend y sin señal**. Todo se guarda en IndexedDB del navegador:

- PIN de equipo (provisional, ver abajo) y firma de quién captura.
- Ficha completa de proveedor en 3 pasos, con autoguardado en cada tecla.
- GPS al abrir la ficha **y mapa para corregir el punto a mano** — el GPS del
  navegador miente cuando sale del wifi o de la IP.
- Cámara directa, con compresión a 1600 px WebP antes de guardar.
- Análisis automático por criterio (calidad, precio, confiabilidad, versatilidad,
  capacidad, comercial, trato) con fortalezas, riesgos y veredicto escrito.
- Guion de preguntas: lo que no se preguntó se lista y se manda por WhatsApp.
- Comparación lado a lado de 2 o más proveedores.
- Vista de ficha guardada: ver, editar y eliminar.
- Instalable en el teléfono y abre sin señal (service worker + manifest).
- Copia de seguridad en JSON (los datos, no las fotos).

Y sincroniza con AWS: DynamoDB `Elrey_proveedores`, fotos en S3, API en Lambda.

### El PIN es un pestillo, no una cerradura

Está escrito en `src/lib/sesion.ts` y esta app es un SPA estático: cualquiera que
abra la URL puede leerlo en el JavaScript. Sirve para que nadie entre por
accidente, no para proteger datos. En la Fase 1 se muda a SSM Parameter Store y
lo valida una Lambda. Hasta entonces **la URL es el secreto de verdad**.

## Gobernanza de datos

Los campos que se repiten tienen **vocabulario controlado**: cargo, país, origen
de la esencia, días y horas del horario, lada, tipo de promoción. Antes eran
texto libre y por eso no se podían agrupar — "Dueño", "dueño" y "propietario"
son tres valores para la base de datos y el mismo para una persona.

Ninguno cierra la puerta: **siempre hay "Otro" con texto libre y dejarlo vacío
sigue siendo válido.** Forzar una opción en la calle produce datos peores que un
hueco honesto, porque quien no encuentra la suya elige la más parecida y ese
error ya no se detecta nunca.

Siguen libres a propósito: nombre, razón social, contacto, correo, redes,
dirección, ciudad y notas.

## La regla del dato ausente

**`null` significa "no se preguntó", y no es lo mismo que un valor malo.** Todos
los ejes nacen en `null`; el análisis solo puntúa lo respondido y reparte el peso
entre lo que sí se sabe. Por eso cada puntaje viaja con su **cobertura**: un 75
sostenido por dos respuestas y un 75 con la ficha entera no son el mismo 75, y
mostrarlos igual es lo que hace que alguien firme con el proveedor equivocado.

## Diseño

La paleta, los nombres de token y la tipografía están copiados del tema que la
landing sirve de verdad (`data-tema="mayoreo"`): fondo claro, acento rojo, todo
en Inter. Si algún día la tienda cambia de tema, esta app **no** se entera sola —
hay que traer los valores nuevos a `src/app/globals.css`.

Lo único que no se copia es la ergonomía: nada táctil por debajo de 48px, campos
de 16px (si no, iOS hace zoom al enfocarlos) y foco siempre visible.

## Mapa del código

| Archivo | Qué resuelve |
| --- | --- |
| `src/lib/tipos.ts` | El contrato de datos. Es el mismo que guardará DynamoDB |
| `src/lib/almacen.ts` | IndexedDB: proveedores y fotos (Blob) |
| `src/lib/analisis.ts` | Criterios, cobertura, riesgos, veredicto, costo por ml |
| `src/data/preguntas.ts` | El guion de la visita: la pregunta literal de cada eje |
| `src/components/comparar/` | Comparación lado a lado |
| `src/components/captura/promociones.tsx` | Escalera de volumen y precio efectivo |
| `src/components/captura/selector-horario.tsx` | Horario estructurado |
| `src/lib/geo.ts` | GPS, dirección inversa, distancia |
| `src/lib/imagen.ts` | Compresión de fotos en el dispositivo |
| `src/components/mapa-punto.tsx` | Mapa Leaflet para poner el punto a mano |
| `src/components/captura/` | Los tres pasos del formulario |
| `src/components/ficha/` | Ver, editar y eliminar una ficha guardada |
| `public/sw.js` | Service worker: la app abre sin señal |
| `src/data/catalogo.ts` | Etiquetas y opciones en español |
