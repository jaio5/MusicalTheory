# ADR 0023 — Grabarse tocando es grabar el sonido, no el vídeo

Fecha: 2026-09-08 · Estado: aceptada

## Contexto

Desde la fase de grabación, «grabarte tocando» significaba **vídeo con la cámara
y los datos detectados quemados encima**. Para conseguirlo hacían falta cuatro
piezas: `media/browser-camera-input.ts` pedía la cámara,
`media/canvas-session-recorder.ts` componía cámara y overlay en un canvas a
treinta fotogramas por segundo, `media/overlay.ts` decidía qué texto iba en cada
sitio, y `globals.css` tenía un bloque de cuarenta líneas —`body.grabando`— que
dejaba **la aplicación entera en contorno y letra** para que se viera la cámara
por detrás, con sus `!important` y sus excepciones para los SVG.

Encima, componer pagaba una franja fija arriba del todo para el botón de grabar,
que en el móvil había que esconder porque no cabía. Con la de escuchar y el
encabezado propio de la pantalla, eran tres franjas antes de que empezara la
pantalla: ciento setenta píxeles de un portátil gastados en no hacer nada.

Y todo eso servía para un vídeo que **no se ve nunca dentro de la aplicación**: se
paraba de grabar y salía un botón para descargarlo. Para saber si la toma valía
había que bajarse el fichero y abrirlo en otro programa.

Lo que se quiere volver a oír al terminar de tocar es **la toma**. El vídeo pide
además trípode, encuadre y pantalla grande, y el permiso de cámara es el más caro
que se le puede pedir a alguien que ha entrado a mirar unos acordes.

## Decisión

**Se graba el sonido y solo el sonido.** `MediaRecorder` sobre el flujo del
micrófono, contenedor negociado por navegador —Opus en WebM donde se puede, AAC
en MP4 para Safari— y un fichero que se descarga aquí.

**El resultado se oye antes que nada.** Al parar sale el reproductor del
navegador, que ya sabe buscar dentro de la toma y decir cuánto dura; descargar y
tirar vienen después. Ese es el orden en el que se decide si una toma vale.

**Grabar deja de ser una franja y pasa a ser una herramienta**, en la misma fila
de abajo que el mástil, las ideas, las salidas, las canciones y las sesiones. Se
abre, se graba, se oye y se cierra. Y por eso mismo **vuelve al móvil**: la razón
por la que estaba escondida ahí era la franja, no la función.

Se van, enteros: `camera-input.ts`, `browser-camera-input.ts`,
`canvas-session-recorder.ts`, `overlay.ts` y el bloque `body.grabando` del CSS.
Entran `mic-input.ts`, `browser-mic-input.ts` y `stream-recorder.ts`, que juntos
ocupan menos de la mitad.

Lo que **no** cambia es la regla 4 de la arquitectura: el sonido no sale del
equipo. Se graba en memoria, se descarga desde el propio navegador y no hay ni una
línea de subida.

## Consecuencias

`media/` pasa a ser la capa de «grabar a fichero» y ya no la de «cámara y
composición». `play-quietly.ts` se queda porque lo usa el vídeo de la portada, que
es un fichero nuestro y no una cámara.

El micro se abre **dos veces** cuando se graba mientras se escucha: una vez lo
tiene `audio/` para analizar y otra `media/` para grabar. Es a propósito y no un
descuido: son dos flujos con dos vidas distintas —analizar no debería parar porque
se pare de grabar— y el navegador los reparte sin problema. Si algún día pesa, lo
que hay que compartir es el `MediaStream`, no el `AudioContext`.

Las mejoras de llamada del navegador van apagadas al grabar —cancelación de eco,
supresión de ruido y control automático de volumen—. Están pensadas para una voz,
y con una guitarra delante se comen los armónicos y bajan el volumen en cuanto una
nota se sostiene.

## Alternativas descartadas

**Dejar la cámara como opción escondida detrás de un ajuste.** Es lo barato: no se
borra nada y quien la quiera la enciende. Se descarta porque el coste no era el
botón, era todo lo que colgaba de él: el `body.grabando` con sus `!important`
condiciona **cómo se puede escribir el resto de la interfaz** —cada fondo nuevo
hay que pensarlo dos veces— y un canvas a treinta fotogramas por segundo compite
con los dos motores de análisis que ya corren. Una función que casi nadie usa no
puede cobrar peaje a todo lo demás.

**Grabar vídeo sin overlay**, que quita el canvas y deja `MediaRecorder` sobre el
flujo de la cámara. Es mucho más simple que lo que había, pero conserva lo que de
verdad estorbaba: el permiso de cámara, el trípode y una toma que hay que mirar en
otro programa.

**Guardar la toma en el navegador**, en IndexedDB, junto a las sesiones. Tendría
sentido —ahí ya vive el rastro de lo que se tocó— y se descarta **de momento** por
tamaño: un minuto de Opus son casi dos megas, y las sesiones que hay ahora son
unos cuantos kilobytes de símbolos. Guardar audio pide antes decidir cuánto se
guarda y qué se borra, y eso es otra decisión. Mientras tanto, la toma vive hasta
que se descarga o se descarta, y se dice.

**Analizar la toma al pararla** para sacar los acordes con calma, que es lo que ya
hace `audio/offline-chords.ts` con lo que escucha el analizador
([adr/0017](./0017-escuchar-la-grabacion-entera.md)). No se descarta: no se hace
todavía. Son dos caminos que hoy no se cruzan —uno guarda muestras en memoria para
analizar, el otro trozos comprimidos para descargar— y juntarlos es trabajo de
verdad, no un empalme.
