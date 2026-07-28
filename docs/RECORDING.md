# Grabación de sesión

## Qué hace

Grabar en vídeo al que toca, con los datos que la app va detectando —nota,
desviación en cents, tonalidad, acorde— **quemados encima de la imagen**, y
dejar el fichero descargado en su equipo.

Es opcional y transversal: se puede activar tanto en modo aprender como en modo
componer, y la app funciona entera sin tocarla nunca.

## Lo primero: no hay subida

**El vídeo y el audio no salen del dispositivo.** No hay servidor de subida, ni
almacenamiento en la nube, ni copia «temporal» en ningún sitio. El flujo entero
—cámara, micro, composición, codificación— ocurre en el navegador, y el
resultado se guarda con una descarga normal del navegador a la carpeta que el
usuario elija.

Esto no es una promesa de la interfaz: es que no existe código de subida, ni lo
habrá sin una decisión explícita registrada como ADR.

## Permisos

Se piden dos, por separado y en momentos distintos:

- **Micrófono**, al entrar en cualquier modo que escuche. Frase:
  «Necesitamos el micrófono para escuchar la guitarra y detectar qué nota
  suena. El audio no sale de tu equipo.»
- **Cámara**, solo al pulsar «grabar». Frase:
  «Necesitamos la cámara para grabarte tocando. El vídeo se queda en tu equipo
  y lo descargas tú.»

Cada permiso se explica **antes** de disparar el diálogo del navegador, con una
frase que dice para qué es. Si el usuario deniega, el mensaje dice qué ha
pasado y qué hacer: «Has denegado el acceso a la cámara. Puedes grabarte
volviendo a darle permiso desde el icono del candado de la barra de
direcciones.»

Denegar la cámara no rompe nada: se puede seguir tocando sin grabar.

## Cómo se compone la imagen

`MediaRecorder` no sabe dibujar encima del vídeo, así que el overlay se compone
a mano:

1. Un `<video>` oculto reproduce el flujo de la cámara.
2. En cada fotograma se dibuja ese vídeo sobre un `<canvas>`.
3. Encima se dibujan los datos del momento: nota grande, cents, tonalidad,
   acorde. Se piden mediante una función que devuelve el estado actual, para
   que el compositor no dependa ni del dominio ni del store.
4. `canvas.captureStream(fps)` convierte el canvas en un flujo de vídeo.
5. Ese flujo se une con las pistas de audio en un `MediaStream` nuevo, y eso es
   lo que entra en `MediaRecorder`.

Los datos van **quemados**, no como pista de subtítulos: el vídeo se comparte
en sitios que no entienden de subtítulos, y la gracia es que se vean.

## Formatos por navegador

No hay un contenedor que funcione en todas partes. Se negocia probando
candidatos con `MediaRecorder.isTypeSupported()` y quedándose con el primero
que acepte:

| Candidato                         | Dónde funciona                                                 |
| --------------------------------- | -------------------------------------------------------------- |
| `video/webm;codecs=vp9,opus`      | Chrome, Edge, Firefox. Es el preferido: mejor calidad por bit. |
| `video/webm;codecs=vp8,opus`      | Respaldo en Firefox y en Chrome antiguos.                      |
| `video/mp4;codecs=avc1,mp4a.40.2` | Safari, que no graba WebM.                                     |

La extensión del fichero descargado se deriva del tipo que se haya negociado, y
`Recording.mimeType` expone cuál ha sido. Si no hay ninguno soportado, el
recorder entra en estado `unsupported` y la interfaz explica que ese navegador
no puede grabar, en vez de fallar al pulsar el botón.

## La descarga

Al parar, se juntan los trozos en un `Blob`, se crea una URL con
`URL.createObjectURL` y se dispara un `<a download>` con nombre sugerido del
tipo `caos-ordenado-2026-07-28-1930.webm`. La URL se libera con
`URL.revokeObjectURL` en cuanto termina: un objeto grande retenido es memoria
que no vuelve.

## Coste y límites

- Componer en canvas a 30 fps con overlay cuesta CPU. Si el equipo no llega, se
  baja a 24 fps antes que perder el análisis de tono: la app es primero un
  asistente y después una grabadora.
- Una sesión larga en 1080p ocupa cientos de megas en memoria antes de la
  descarga. Se troceará en fragmentos y se avisará por encima de cierta
  duración.
- La cámara y el análisis de audio compiten. Si se nota, la grabación baja
  primero de resolución.

## Por qué la cámara se veía negra

La primera versión ponía el vídeo en `position: fixed` con `z-index: -10` y
volvía transparente la interfaz del grabador. No se veía nada, y el motivo es de
orden de pintado: un elemento con z negativo se pinta por encima del lienzo de la
página pero **por debajo de los fondos de los bloques en flujo**, y los ancestros
del grabador —el `div` raíz y el `body`— seguían siendo opacos porque la clase
estaba en un descendiente y no llegaba a ellos.

La marca de grabación va ahora en el `body`, así que la transparencia alcanza a
todos los ancestros y el vídeo aparece donde tiene que aparecer: encima del
lienzo y debajo de la interfaz entera.

Dos cosas más tapaban la cámara sin ser fondos CSS:

- **La rueda de quintas** es un disco negro pintado con `fill` de SVG, que
  `background-color` no toca. Se apagan solo los rellenos que son fondo
  (`fill-surface`, `fill-background`); los puntos del diagrama y las letras se
  quedan, que es la información.
- **El texto apagado** no se lee sobre vídeo. Al grabar sube casi al color
  normal, y todo lleva sombra.

Lo marcado con `data-senal` conserva su color con un aro oscuro para que se lea
sobre lo que sea que haya detrás: el piloto de grabación, el de escucha y el
punto verde o rojo de cada acorde. Es lo único que da tiempo a mirar mientras
tocas.

Comprobado en un Chromium de verdad con cámara falsa
(`--use-fake-device-for-media-stream`), pulsando el botón y mirando la captura,
no razonándolo sobre el papel.
