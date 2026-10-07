# ADR 0069 — La portada es una escena de píxel

> **Corregido el 2 de octubre de 2026:** «el LCP es ahora la pared» **no es cierto**: el elemento LCP es la capa de delante, que asoma tres por ciento más de área. Por eso se **precargan las tres capas** y no solo la pared —solo la pared no movía el LCP—, y el LCP baja de 1016 a 780 ms con la CPU a ×4, a costa de unos 60–90 ms de FCP (ocho kilobytes). Y la escena se pausa fuera de la vista con su propio `data-fuera`, no con `data-parada`: parar es decisión de quien mira, y salir de la vista no decide nada.

Fecha: 2026-10-01 · Estado: aceptada, sustituida en parte por [ADR 0071](./0071-la-sala-va-a-sangre-detras-del-titular.md) y [ADR 0073](./0073-las-pantallas-llenan-el-ancho.md) · Sustituye al vídeo del encabezado que
metió en su caja [ADR 0026](./0026-el-blanco-hielo.md)

## Contexto

La caja de la derecha del titular llevaba un vídeo en bucle de diez segundos,
`public/hero.mp4`, con su póster, `public/hero.jpg`. Tenía tres problemas, y el
primero bastaba para quitarlo:

- **Un riesgo de derechos.** El fotograma era un chico de anime con un parecido
  muy cercano a un personaje con dueño —Deku, de _My Hero Academia_—. Para una
  aplicación que se va a cobrar, un parecido así no es un detalle de estilo: es
  una reclamación esperando a que alguien la mande.
- **La marca de agua del generador**, una estrella abajo a la derecha. Se veía en
  cuanto se miraba la esquina, y decía de dónde había salido la imagen.
- **El peso.** 471 kB de vídeo y 57 de póster: la portada medía 720 kB en el cable,
  y 527 eran esa caja. Es la página que ve quien llega, casi siempre desde un
  teléfono. Eso sí, ya se había rebajado: el vídeo solo se pedía con movimiento
  aceptado, sin ahorro de datos y con la caja asomando, y llevaba su botón de
  parar.

La identidad de la casa ya tenía con qué sustituirlo: la mascota se acababa de
redibujar en píxel ([ADR 0068](./0068-la-mascota-es-de-pixel.md)), y su mundo es
un amplificador de válvulas de noche, que es justo lo que pedía la caja.

## Decisión

**Una escena de píxel de dieciséis bits: un local de ensayo de noche, con el
profesor sentado encima del ampli.** Pared de espuma, una bombilla desnuda, un
cartel, dos corcheas de neón, una pila de pantalla y cabezal con su rejilla y sus
pilotos, una guitarra en su soporte, un pedal, un platillo, un micro y cables por
una alfombra persa.

- **El profesor es el de la aplicación**, no un dibujo nuevo: el script de la
  escena lee las capas y la paleta de `arte/mascota/build.py`. Va con la paleta
  del tema oscuro, porque la sala lo es siempre.
- **La paleta es la de la casa**: los grafitos de `tokens.ts`, el latón en sus
  cuatro luces, el verde de `tube` y el rojo de `oxblood` para la alfombra. Tres
  grises templados para el charco de luz de la bombilla, y un pardo casi negro
  para la tarima.
- **Va en su marco oscuro en los dos temas**, como iba el vídeo: sobre el hielo es
  la única cosa oscura de la pantalla.
- **Es PNG con paleta, en tres capas y una hoja de fotogramas.** Lo escribe
  `arte/portada/build.py`, que genera `src/app/_escena/*.png` y
  `src/app/escena-pixeles.ts`. La hoja de estilos de la escena,
  `app/escena-portada.css`, pide las imágenes con `url()` relativa, y por eso
  llegan con huella en el nombre y caché larga.
- **El píxel, siempre entero.** Cada píxel del dibujo mide `--px`, y `--px` lo
  elige una consulta de contenedor según el ancho de la caja: dos en un teléfono,
  tres en el escritorio, cuatro en la tableta. Lo que no cabe del lienzo se recorta
  por los lados, que son pared y suelo de sobra. Todo lo que se mueve se mueve un
  número entero de esos píxeles.
- **Paralaje en tres capas**: con el scroll, por `animation-timeline` dentro de un
  `@supports`; con el ratón (`pointer: fine`), con dos variables CSS que escribe un
  solo `requestAnimationFrame`. Sin librería ([ADR 0057](./0057-la-rueda-gira-sin-gsap.md)).
- **Vida por fotogramas**, con `steps()` y `step-end`: el vúmetro, las válvulas,
  el piloto, el neón que duda, dos notas que suben y el profesor, que parpadea y a
  ratos se enciende en verde como cuando escucha. Y una entrada al cargar: la sala
  se enciende como una bombilla que duda y lo de delante llega desde abajo.
- **Movimiento reducido o ahorro de datos: quieta.** La hoja de fotogramas solo se
  pide con la escena viva, así que en esos dos casos no se descarga. Lo quieto ya
  está entero en las capas, con todo encendido. Lo que se mueve en bucle tiene su
  botón de parar (WCAG 2.2.2), que también suelta el puntero.

## Por qué PNG y no SVG de rectángulos

Es la pregunta obvia, porque la mascota es SVG de rectángulos con `crispEdges`.
La mascota lo es porque **cambia con el tema**: pinta con variables `--mascota-*`.
La escena no cambia con nada, así que esa ventaja no existe, y queda el coste: son
35.424 píxeles con textura —la malla del altavoz, las cuñas de la espuma, la luz
tramada—, que como rectángulos serían decenas de miles de números dentro del HTML
de la portada. Las cuatro imágenes pesan ocho kilobytes entre todas.

## Consecuencias

- **La portada pasa de 720 kB a 205** en el cable, medida con
  `peso-de-las-rutas.mjs`: los medios bajan de 527 kB a 9 y el JavaScript se queda
  en los 167 de antes. La hoja de la escena viaja aparte y solo a la portada.
- **El LCP es ahora la pared de la escena**, y llega con el primer pintado. El velo
  de la entrada va encima y no lo retrasa. CLS 0 en 390, 768 y 1280.
- Sale `app/HeroVideo.tsx` con su test, `public/hero.mp4` y `public/hero.jpg`.
  **`public/` se queda vacía y deja de existir**, así que el `Dockerfile` ya no la
  copia. Sale también `media/play-quietly.ts`, que
  [ADR 0023](./0023-grabar-solo-el-sonido.md) conservó solo porque lo usaba el vídeo.
- La caja del encabezado deja de llevar `entra`: su desplazamiento de 0,75 rem
  movía la escena por fracciones de píxel mientras duraba. La escena trae su
  entrada.
- Cambiar la escena es cambiar `arte/portada/build.py` y ejecutarlo; con
  `--muestra` deja láminas de los tres encuadres y un GIF de los fotogramas.
  `app/escena.test.ts` vigila que las imágenes midan lo que dice el módulo, que
  cada tira tenga su animación y que los cortes de escala no enseñen el borde.
- **Lo que se pierde**: el movimiento de verdad, que un vídeo tiene y una escena por
  fotogramas no. Y en una pantalla con escala de sistema no entera —un Windows al
  125 %—, el píxel entero en CSS no lo es en pantalla: ahí se reparte como en
  cualquier imagen.

## Alternativas descartadas

**Regenerar el vídeo sin el parecido.** Pedir otro clip al mismo generador con otro
personaje. Es el cambio más corto y conserva la caja tal cual. Se descarta porque
**el riesgo no era ese personaje, era el método**: un generador de vídeo no dice de
qué se ha alimentado, y el siguiente parecido se descubre igual que este, mirando
una captura con calma después de publicarlo. Seguiría pesando medio mega, y la
marca de agua habría que quitarla a mano en cada fotograma.

**Un modelo 3D con three.js**, o reconstruido de una imagen con img2threejs: el
mismo local, girable, con luz de verdad. Es lo más vistoso de las cinco opciones.
Se descarta por peso y por la gama media: three.js son unos 150 kB comprimidos
antes del modelo, casi lo mismo que todo el JavaScript de la portada, y un WebGL
en bucle en la primera página que abre un teléfono modesto se come la batería y
los fotogramas del resto de la página. Y no es el idioma de la casa: el profesor
es de píxel desde [ADR 0068](./0068-la-mascota-es-de-pixel.md).

**Una ilustración estática.** La misma escena, sin capas ni fotogramas. Es lo más
barato de mantener y pesa lo mismo. Se descarta porque la caja está al lado de un
titular que habla de tocar y escuchar, y lo único que dice que esto está vivo es
que se mueva algo: un piloto que late, una nota que sube. Con movimiento reducido
sí sale estática, y se ve entera; la ilustración es el suelo, no el techo.

**Dejar la caja vacía**, o quitarla y que el titular ocupe todo el ancho. Es lo más
minimalista, y [ADR 0026](./0026-el-blanco-hielo.md) ya lo descartó una vez con
dos razones que siguen valiendo: es lo único que enseña de qué va esto antes de
leer una palabra, y sobre el hielo la caja oscura es lo que se lleva la mirada.
Sin ella, la portada en escritorio es media pantalla de texto y media de blanco.
