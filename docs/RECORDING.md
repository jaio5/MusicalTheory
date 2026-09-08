# Grabación de sesión

## Qué hace

Grabar **el sonido** de lo que estás tocando, dejarte oírlo ahí mismo y, si vale,
descargarlo a tu equipo.

Es opcional y vive donde se compone: una herramienta más de la fila de abajo de
`/componer`, junto al mástil, las ideas, las salidas, las canciones y las
sesiones. Se abre, se graba, se oye y se cierra. La aplicación funciona entera
sin tocarla nunca.

**Ya no graba vídeo.** Lo hizo, con la cámara puesta detrás de la interfaz y los
datos detectados quemados encima de la imagen; el porqué de quitarlo está en
[adr/0023](./adr/0023-grabar-solo-el-sonido.md), y el resumen es que costaba un
canvas a treinta fotogramas por segundo, un bloque de CSS que dejaba la
aplicación entera en contorno y el permiso más caro que hay, para un fichero que
había que abrir en otro programa para saber si servía.

## Lo primero: no hay subida

**El sonido no sale del dispositivo.** No hay servidor de subida, ni
almacenamiento en la nube, ni copia «temporal» en ningún sitio. El flujo entero
—micro, codificación, fichero— ocurre en el navegador, y el resultado se guarda
con una descarga normal a la carpeta que elija quien graba.

Esto no es una promesa de la interfaz: es que no existe código de subida, ni lo
habrá sin una decisión explícita registrada como ADR. Es la regla 4 de la
arquitectura.

## Permisos

El micrófono se pide **dos veces y por separado**, y es a propósito:

- **Para escuchar**, al entrar en cualquier pantalla que analice. Lo abre
  `audio/`, no guarda nada y su frase es: «Abrimos el micrófono, te decimos qué
  nota suena y cuánto le falta. El audio no sale de tu equipo.»
- **Para grabar**, solo al pulsar el botón de grabar. Lo abre `media/`, y lo que
  hace con el flujo es quedárselo.

Son dos flujos con dos vidas distintas —analizar no debería parar porque se pare
de grabar— y el navegador los reparte sin problema. El segundo permiso, en la
práctica, ya está concedido si se estaba escuchando.

Si se deniega, el mensaje dice qué ha pasado y qué hacer: «Has denegado el
micrófono. Puedes darle permiso otra vez desde el icono de la barra de
direcciones.» Denegarlo no rompe nada: se puede seguir componiendo sin grabar.

## Las mejoras de llamada van apagadas

`getUserMedia` pide `echoCancellation`, `noiseSuppression` y `autoGainControl` en
**false**. Están pensadas para una voz en una videollamada, y con una guitarra
delante se comen los armónicos y bajan el volumen en cuanto una nota se sostiene.
Lo que se quiere aquí es la señal tal cual entra.

## Cómo se graba

Sin composición ni canvas: se le da a `MediaRecorder` el flujo del micro y se
recogen los trozos.

1. `media/browser-mic-input.ts` abre el micrófono.
2. `media/stream-recorder.ts` crea el `MediaRecorder` con el contenedor que se
   haya negociado y lo arranca troceando cada segundo, para no retener una sesión
   larga entera en un solo `Blob`.
3. Al parar, los trozos se juntan en un `Blob` y se devuelve con su duración y su
   nombre.

La duración se mide **con el reloj**, no contando trozos: si el hilo se atasca,
`ondataavailable` se retrasa y el conteo mentiría. Lo que se pasa en pausa no
cuenta.

## Formatos por navegador

No hay un contenedor que funcione en todas partes. Se negocia probando candidatos
con `MediaRecorder.isTypeSupported()` y quedándose con el primero que acepte:

| Candidato                    | Dónde funciona                                              |
| ---------------------------- | ----------------------------------------------------------- |
| `audio/webm;codecs=opus`     | Chrome, Edge, Firefox. El preferido: mejor calidad por bit. |
| `audio/webm`                 | Respaldo si el navegador no sabe contestar por códec.       |
| `audio/mp4;codecs=mp4a.40.2` | Safari, que no graba WebM. El `.m4a` lo abre cualquiera.    |
| `audio/ogg;codecs=opus`      | Último recurso en Firefox antiguos.                         |

La extensión del fichero se deriva del tipo negociado, y `Recording.mimeType`
expone cuál ha sido. Si no hay ninguno soportado, el grabador entra en estado
`unsupported` y la interfaz explica que ese navegador no puede grabar, en vez de
fallar al pulsar el botón.

## Oírla primero, descargarla después

Al parar, **lo primero que sale es el reproductor** del navegador, con la toma
cargada. Después están descargar y descartar.

Ese orden es la decisión, no un detalle: antes se paraba y salía un botón para
descargar un fichero que no habías oído, así que para saber si la toma valía había
que bajarla y abrirla en otro programa. El reproductor del navegador ya sabe
buscar dentro, cambiar la velocidad y decir cuánto dura, y nada de eso lo íbamos a
hacer mejor a mano.

La descarga dispara un `<a download>` con nombre del tipo
`caos-ordenado-2026-09-08-1905.webm`. La URL del `Blob` se libera con
`URL.revokeObjectURL` al empezar la siguiente toma, al descartarla o al salir de
la pantalla: un objeto grande retenido es memoria que no vuelve.

## Coste y límites

- **La toma vive en memoria y no se guarda.** Al descartarla o al recargar, se
  pierde. Guardarla junto a las sesiones pide antes decidir cuánto se guarda y qué
  se borra, y eso es otra decisión ([adr/0023](./adr/0023-grabar-solo-el-sonido.md)).
- Un minuto de Opus son algo menos de dos megas. Una toma larga cabe de sobra en
  memoria, que es justo lo contrario de lo que pasaba con el vídeo en 1080p.
- Grabar y analizar a la vez cuesta poco: `MediaRecorder` codifica fuera del hilo
  principal, y ahí ya no hay ningún canvas compitiendo con los dos motores de
  análisis.
