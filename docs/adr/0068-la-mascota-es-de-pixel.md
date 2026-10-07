# ADR 0068 — La mascota es de píxel

Fecha: 2026-10-01 · Estado: aceptada · Rehace el dibujo de
[ADR 0025](./0025-la-mascota-es-una-valvula.md), sin tocar el personaje

## Contexto

El profesor era una válvula vectorial: un `<svg>` de 64 unidades con círculos,
elipses y trazos de dos unidades, pintado a 56 px. La idea aguantaba
—[ADR 0025](./0025-la-mascota-es-una-valvula.md) explica por qué una válvula y no
otra cosa— y el dibujo no tanto:

- **A 56 px cada trazo medía 1,75 píxeles de pantalla.** El navegador lo reparte
  entre dos filas y deja un borde lavado: las cejas, la boca y el filamento, que son
  justo lo que dice el estado, eran lo más borroso del dibujo.
- **Era plano.** Un relleno y un contorno por pieza, sin luz: la cúpula de cristal
  y el zócalo de latón se distinguían por el color y nada más.
- **Las animaciones deformaban.** El parpadeo encogía los ojos con `scaleY` y la boca
  latía igual; la brasa era una elipse con la opacidad en vaivén. Funcionaba, pero
  cada gesto era una pieza que cambia de tamaño, no un muñeco que cambia de cara.

## Decisión

**La misma válvula, dibujada en píxel**: rejilla de 32×32, estilo de consola de 16
bits, pensada para verse a 64 px —dos píxeles de pantalla por uno del dibujo— y a
múltiplos enteros.

- **Se conserva todo lo que es identidad**: cúpula de cristal con la punta sellada,
  filamento en zigzag, zócalo de latón con tres patillas, ojos con brillo, cejas,
  media sonrisa, y el estado como personaje entero. Los tres detalles que salieron de
  mirar el vectorial a tamaño real siguen: la boca separada de los ojos por la
  mejilla, la boca abierta como hueco con reborde y el filamento como alambre
  plegado.
- **Dieciséis colores**, en rampas de cada material —cristal, latón, metal, verde—
  con la luz de arriba a la izquierda: reflejo en esa pared, sombra en la de
  enfrente. Contorno selectivo: el cristal lo lleva de grafito y el latón de su
  propio marrón.
- **Los colores son variables `--mascota-*` de `globals.css`, con valor por tema.**
  Doce valen igual en los dos; cuatro no. Sobre el fondo oscuro un contorno de
  grafito desaparece, y con él la punta de la cúpula, que es solo contorno: en
  oscuro el borde sube a un gris que se ve y el cristal baja un punto para no
  deslumbrar.
- **Llega como SVG de rectángulos**, con `shape-rendering="crispEdges"`: un `<path>`
  por color y capa. El dibujo lo escribe un script, `arte/mascota/build.py`, que
  genera `src/ui/mascota-pixeles.ts`; el módulo no se edita a mano.
- **Los estados son capas que se encienden y se apagan.** Atento cambia el color del
  vidrio, enciende el filamento —blanco por dentro, verde alrededor— y añade un cerco
  que late. Hablando son dos bocas que se turnan cada 150 ms y las cejas una fila más
  arriba. El parpadeo esconde los ojos abiertos 110 ms cada cinco segundos y medio.
  Todo con `step-end`, sin intermedios; con movimiento reducido no corre nada y se
  queda el gesto quieto: ojos abiertos, boca abierta, la brasa encendida.
- **El tamaño de fábrica pasa de 56 a 64 px.** 56 entre 32 no es entero, y un
  dibujo de píxel a un múltiplo no entero sale con filas dobles y filas sencillas.

## Alternativas descartadas

**Seguir con el SVG vectorial y pulirlo.** Trazos de una unidad, un degradado en el
cristal, el tamaño a 64 para que cada unidad caiga en un píxel. Es el cambio más
corto y el que menos toca. Se descarta porque arregla la nitidez y no el volumen: un
vectorial con luz pide degradados, que a ese tamaño se leen como una mancha, y las
animaciones seguirían siendo piezas que se estiran.

**Un PNG, o una hoja de sprites.** Es como se hace en un juego, y se dibuja con
cualquier editor. Se descarta por tres cosas: es una descarga más para algo que sale
en cada unidad; **no cambia con el tema**, así que harían falta dos hojas y elegir
cuál con CSS; y a un tamaño que no sea múltiplo exacto el navegador la suaviza salvo
que se acuerde de `image-rendering: pixelated`. El SVG de rectángulos es igual de
nítido a cualquier tamaño, pesa lo que pesan sus números y pinta con variables.

**Otro personaje.** Cambiar de estilo era la ocasión de cambiar de muñeco —una púa,
una nota, la rueda de quintas con cara—. Se descarta porque el problema era el trazo
y no el personaje: la válvula sigue siendo lo único de este mundo que se enciende al
escuchar, que es lo que hace el profesor, y las razones de
[ADR 0025](./0025-la-mascota-es-una-valvula.md) valen igual en píxel.

## Consecuencias

- `ui/Mascota.tsx` cambia de dibujo pero **no de interfaz**: `hablando`, `atento` y
  `className`, `role="img"` y «El profesor». El tutor de las unidades y la bienvenida
  del registro no se enteran.
- Cambiar el dibujo es cambiar `arte/mascota/build.py` y ejecutarlo; el script pasa
  Prettier por el módulo que escribe y, con `--muestra`, deja una lámina de los
  estados sobre los dos fondos para mirarla. La paleta vive dos veces —la hoja y el
  script, que la necesita para la lámina— y `ui/Mascota.test.tsx` comprueba que no se
  separan.
- `globals.css` pierde `parpadeo`, `brasa` y `hablar`, con sus clases, y gana las
  `mascota-*`, que solo se piden con `prefers-reduced-motion: no-preference`.
- El muñeco mide 8 px más, y el hueco que se le reserva al pie de las columnas
  (`HUECO_DEL_TUTOR`, y los dos que `PathScreen` escribe a mano) pasa de `3.5rem` a
  `4rem`.
- El botón del tutor ya no crece al pasar por encima (`scale-105`): sube dos
  píxeles. A 1,05 cada píxel del dibujo cae entre dos de pantalla y se emborrona,
  que es justo lo que este cambio viene a quitar.
- Se miró en los dos temas a 2× y a 4× en la lámina del script, y en un navegador
  a 64 px en el tutor de `/aprender`, con y sin movimiento reducido.

**El icono de la pestaña es el mismo profesor** (2 de octubre de 2026). Lo saca
`arte/mascota/iconos.py` de los píxeles de `build.py`, callado:

- `src/app/icon.svg`, en rectángulos con `crispEdges` y con el contorno de cada tema
  del sistema, porque el grafito del claro desaparece sobre una barra de pestañas
  oscura;
- `favicon.ico`, a 32 y a 64, solo a escala entera, para lo que no lee SVG;
- `apple-icon.png`, a 180 sobre la noche de la sala.

Si cambia el dibujo, se vuelve a ejecutar el script; `src/app/iconos.test.ts` vigila
lo que Next lee de los tres. Descartadas: una letra o la nota de la marca, que a 16
píxeles no dice nada que no diga el título; un PNG de 16, que obligaba a dibujar el
profesor otra vez y peor; y un icono distinto para cada tema, que no todos los
navegadores piden.
