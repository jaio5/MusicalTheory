# ADR 0120 — La primera visita no se mueve, y cada pantalla trae lo suyo

Fecha: 2026-10-08 · Estado: aceptada · Completa a
[ADR 0108](./0108-el-recorrido-sale-por-pantallas.md),
[ADR 0045](./0045-un-barril-por-pantalla-no.md) y
[ADR 0058](./0058-componer-se-descarga-por-partes.md)

## Contexto

Una pasada de Lighthouse 12 contra el servidor de producción —teléfono con la CPU
×4 y 4G lenta, y escritorio—, **en la primera visita**, que es la que decide si
alguien se queda, encontró cuatro cosas:

1. **El recorrido movía la página.** La tarjeta y el aro se colocaban animando
   `left` y `top`, y cada fotograma del deslizamiento contaba como desplazamiento:
   CLS de 0,10 a 0,30 en el teléfono en las seis rutas medidas (0,296 en
   `/aprender`, 0,275 en `/componer`). Y como la tarjeta sale tarde —se descarga
   aparte y espera a hidratar—, su párrafo era el elemento del LCP: 3,9 s en
   `/aprender`. Además medía la pieza con un `requestAnimationFrame` sesenta veces
   por segundo, y en `/afinar` salían **dos tarjetas seguidas, las dos «paso 1 de
   1»**: la bienvenida y la del afinador, cada una su tramo.
2. **Ninguna pantalla se precargaba.** Con `force-dynamic` y sin `loading.tsx`,
   Next no precarga una ruta dinámica, y cada clic en la barra esperaba al
   servidor con la pantalla de antes quieta.
3. **La portada cargaba con el marco.** El `not-found` de la raíz montaba
   `AppShell`, y lo que cuelga del layout raíz viaja en todas las rutas. Y el
   layout raíz leía la cuenta —dos consultas con la sesión abierta— y ponía el
   proveedor también alrededor de la portada, que no lo usa.
4. **Cada unidad descargaba el banco de ejercicios entero**: un trozo de 111 KB
   (34 comprimido) con las lecciones y los ejercicios de oído de todo el temario,
   porque `UnitScreen` importaba las tres clases de unidad.

## Decisión

**El recorrido se mueve con `transform` y se mide cuando algo cambia.** La
tarjeta y el aro van en `top: 0; left: 0` y se colocan con `translate`, que no
cuenta como desplazamiento. **La primera vez se ponen sin transición** —solo se
desliza lo que ya estaba puesto— y **no se pintan hasta tener sitio**: mientras
esperan a una pieza que llega tarde van con `visibility: hidden`. La medida la
hace `features/tour/seguir.ts` desde un efecto de maquetación, así que si la pieza
ya está, la tarjeta sale colocada en el mismo fotograma en que aparece. Después
mide con un `ResizeObserver` sobre la pieza y la tarjeta, el desplazamiento de
cualquier caja (en captura) y el tamaño de la ventana, y con un `MutationObserver`
sobre `#contenido` por lo que ninguno de ellos avisa: que la pieza se fue o se movió
sin crecer porque cambió lo que había encima. (Al principio era un intervalo de un
cuarto de segundo; medía cuatro veces por segundo aunque nada se moviera.) El
trozo del recorrido se pide al cargar el lanzador, no al montarse.

**La bienvenida y el tramo de la pantalla van en la misma tarjeta**
(`tramosPara`): «1 de 2» y «2 de 2», y «Entendido» o Escape dan los dos por vistos
(`marcarTramosVistos`). Y la tarjeta se coloca **dentro del hueco de trabajo**
—el `<main id="contenido">`—, no de la ventana: sin sitio limpio se pegaba a un
borde encima de la cabecera o de la barra de pantallas.

**Las pantallas de la barra se precargan al ir a pulsarlas**: `prefetch` entero
en cuanto el puntero entra, el dedo toca o llega el foco (`EnlaceDePantalla` en
`app/AppShell.tsx`). La petición de precarga empieza en el segmento de la página
—el árbol que manda el cliente marca `refetch` ahí—, así que el layout de
`(marco)` no se vuelve a pintar y **no hay una consulta a la base por enlace**:
comprobado leyendo la respuesta, que no trae el marco.

**La cuenta se lee en el layout de `(marco)`**, que es donde se usa, y las
direcciones inventadas las recoge `(marco)/[...resto]/page.tsx` con `notFound()`,
que se pinta con `(marco)/not-found.tsx` dentro del marco. El `not-found` de la
raíz queda sin `AppShell`. El título lo remata la plantilla del layout raíz
(`%s · Caos ordenado`).

**Cada unidad descarga lo de su tipo**: `TheoryUnit`, `EarUnit` y la prueba de
tocar llegan con `lazy` desde su módulo, con «Abriendo la unidad…» en su sitio
mientras llegan. `ear.ts` no se parte: su trozo son 11 KB comprimidos y solo lo
pide una unidad de oído o el repaso.

## Consecuencias

Medido con Lighthouse 12 en el servidor de producción, teléfono, primera visita:

| Ruta                  | CLS antes | CLS ahora | LCP antes | LCP ahora |
| --------------------- | --------- | --------- | --------- | --------- |
| `/aprender`           | 0,296     | 0         | 3,9 s     | 3,3 s     |
| `/aprender/e1-grados` | 0,158     | 0         | 3,7 s     | 2,3 s     |
| `/componer`           | 0,275     | 0         | 3,2 s     | 2,7 s     |
| `/afinar`             | 0,097     | 0         | 3,3 s     | 3,0 s     |

En `/aprender` el LCP ya no es la tarjeta sino un párrafo de la pantalla, que
espera a hidratar. Y `/aprender/e1-grados` baja de 249 a 206 KB de JavaScript
(`peso-de-las-rutas.mjs`). Con la pantalla precargada, el clic cambia en unos
110 ms y sin ninguna petición nueva; **eso se midió precargando al verse**, y la
precarga al ir a pulsar está pendiente de medir en producción: quien pulsa sin
haber pasado el puntero —un dedo— la empieza con el `touchstart`.

- La tarjeta tarda en salir lo que tarda en aparecer su pieza, hasta tres
  segundos: antes salía en medio y saltaba.
- Un test que monte el recorrido necesita un `ResizeObserver` de mentira y una
  caja para la pieza: jsdom no trae ninguno de los dos.
- Una unidad recién abierta hidrata su contenido una ida y vuelta después: el HTML
  llega entero, y lo que espera es solo el trozo de su tipo.

## Alternativas descartadas

- **Un `(marco)/loading.tsx`**, que es lo que recomienda la documentación de Next
  para las rutas dinámicas. Se probó y se midió: dentro de su espera, el
  `notFound()` de `/aprender/no-existe`, `/planes/gratis` o una dirección
  inventada contestaba **200** con `noindex` en vez de 404, y que la unidad que no
  existe sea un 404 de verdad ya era una decisión tomada.
- **`prefetch` entero al verse el enlace.** También se midió: la barra está
  siempre a la vista, y cada pantalla descargaba el código de las otras tres
  —de 196 a 281 KB en `/afinar`, con el lienzo de componer dentro—, que es
  deshacer [ADR 0045](./0045-un-barril-por-pantalla-no.md).
- **Sacar la tarjeta solo tras la primera interacción**, para que no cuente en el
  LCP. Es esconder la bienvenida a quien llega, que es para quien existe.
- **Dejar la bienvenida y el tramo por separado y numerarlos seguidos.** Seguían
  siendo dos tarjetas, la segunda saliendo donde estaba la primera.
- **Partir `ear.ts` por clase de ejercicio.** Con la unidad ya dividida por tipo,
  lo que quedaba eran 11 KB comprimidos para una unidad de oído: no compensa un
  `import()` por clase.
- **Un `browserslist` moderno** para quitar los polyfills que señala Lighthouse.
  El de serie de esta versión ya es el moderno (Chrome 111, Safari 16.4), y lo que
  marca son los 1,4 KB de `polyfill-module` que Next mete siempre, con
  cualquier lista (`next/dist/client/app-globals.js`).
