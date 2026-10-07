# ADR 0061 — El afinador no se mueve mientras escucha

Fecha: 2026-09-30 · Estado: aceptada

## Contexto

`/afinar` centraba su bloque a lo alto con `my-auto`, para no dejar dos tercios de
negro debajo de una nota que se mira desde tres metros. Es la regla de centrar de
`docs/ESTILO.md`, y parada sigue valiendo.

Escuchando, no. **Un bloque centrado se mueve entero cada vez que algo crece
dentro**: la mitad de lo que crece lo empuja hacia arriba y la otra mitad hacia
abajo. Y mientras se afina crecen cosas sin que nadie toque nada: la primera nota
sustituye al «esperando», el aviso de «Sin señal» o de «La señal no llega limpia»
se montaba y se desmontaba cada medio segundo mientras se gira la clavija, la
frase de la cuerda pasa de una línea a dos en un teléfono, y el selector de
entrada aparece cuando llegan los permisos. Medido en la auditoría, **entre 0,19
y 0,31 de CLS** al pulsar «Escuchar la guitarra» y afinar un rato; «bueno» es
por debajo de 0,1. Y lo que se movía era justo la nota.

## Decisión

**Escuchando, el bloque se ancla arriba; parado, se sigue centrando.** Anclado,
lo que crece solo empuja lo que tiene debajo, y lo de arriba —la afinación
plegada, la nota y la aguja— se queda donde estaba.

**Y lo que aparece y desaparece tiene su hueco reservado:**

- El aviso de señal vive siempre en el mismo `<p>`, vacío cuando no hay nada que
  avisar, con dos líneas de alto en estrecho y una desde `md`.
- La frase de la cuerda reserva dos líneas por debajo de `sm`.
- **El medidor de nivel no escribe ninguna frase.** Llevaba la suya —«llega poca
  señal» o «llega señal de sobra»— y se turnaba cada ~700 ms con el aviso de
  debajo de la nota, que dice otra cosa de la misma señal. Se quita; su número se
  escribe con el nivel refrescado a cuatro por segundo.
- La barra del medidor se mueve con `transform: scaleX()` y no con `width`, así
  que seguir al nivel veinte veces por segundo no recoloca nada.

### Un solo aviso, y que no parpadee

Medido después de lo anterior, escuchando se veían todavía tres cosas: el aviso de
nivel alternando entre dos frases, «La señal no llega limpia» sobre una nota limpia
y la tarjeta creciendo de 320 a 645 px al enganchar la primera nota. Se resuelve
con tres piezas:

- **Un solo aviso, por prioridad:** sin señal, luego suciedad, luego poca señal.
  Antes de la primera nota lo dice la propia espera («Te oigo, pero no engancho…» o
  «Esperando…», esta última con lo de subir el volumen).
- **Histéresis** (`use-estable.ts`): cada estado tiene un umbral para entrar y otro
  para salir —el nivel usa los dos del motor, 0,006 para enganchar y 0,0015 para
  soltar; la claridad entra por debajo de 0,93 y sale a partir de 0,95— y se
  queda **al menos 1,5 s**. El primer cambio es inmediato. «Sin señal» solo cuenta
  después de la primera nota.
- **La zona de la nota se reserva desde el «esperando»**: debajo de la espera va la
  misma nota con los huecos vacíos, `invisible`, `inert` y `aria-hidden`. Mide lo
  que medirá la nota porque es la misma pieza.

Y dos cosas de la pantalla de al lado: las seis cuerdas de la afinación son
etiquetas y no cajas con relieve —parecían botones y no hacían nada— y el selector
de entrada lleva su rótulo «Micrófono» a la vista.

## Consecuencias

El paso de parado a escuchando —el selector de afinación se pliega y el bloque
deja de centrarse— **se hace al pedir el micro, no al tenerlo**. El permiso tarda
más de medio segundo, y lo que se recoloca pasado ese plazo ya no cuenta como
respuesta al clic. Hecho al pulsar, es el salto que se ha pedido.

El que queda es **uno**: la primera nota sustituye al «esperando». Los repetidos,
que eran los que sumaban, desaparecen; el último en irse fue la frase de arriba
del «esperando», que también se turna y en un teléfono ocupa una línea o dos.

En una ventana alta, escuchando queda aire debajo del afinador. Es el precio: el
bloque escuchando mide más de quinientos píxeles, así que en un portátil el aire
es poco, y en un monitor grande es preferible a una nota que se desplaza.

**Medido después**, con `pnpm start`, el micro falso de Chromium y ocho pasadas
por ancho: **0,055 a 390 px y 0,018 a 1440**, igual en todas, frente a 0,31 y 0,19
antes. Antes de reservar la frase de arriba, a 390 variaba entre 0,06 y 0,24 según
cayera el pitido del micro falso respecto al umbral.

## Alternativas descartadas

**Reservar el alto de la zona de la nota con un número.** Pedido primero, y es lo
mismo que se descartó arriba para todo el bloque: la nota mide 96 px en un
teléfono y 128 en una pantalla ancha, la aguja otros 112 y las frases parten en
una o dos líneas según el ancho. Se queda corto en un sitio y largo en otro. La
copia invisible no escribe ninguno.

**Subir el tiempo de refresco del aviso en vez de añadir histéresis.** Refrescar
el nivel a 4 Hz ya estaba hecho y no basta: una señal que ronda el umbral lo cruza
en cualquier muestra, así que a cuatro por segundo sigue parpadeando, solo que más
despacio.

**Seguir centrando y dar al bloque un alto fijo.** Con el alto constante, centrar
no mueve nada. Se descarta porque el alto del bloque depende de cuántas líneas
parte cada frase a cada ancho, y fijarlo es poner un número a mano que se queda
corto en un teléfono —y recorta— o largo en un monitor —y vuelve el hueco negro—.
Lo que se reserva aquí es solo lo que cambia, y su alto se sabe: una o dos líneas.

**Seguir centrando y reservar solo los avisos.** Quita la mitad del problema, la
que se repite cada medio segundo, pero deja la nota moviéndose con la primera
lectura, con el cambio de cuerda en un teléfono y con el selector de entrada.

**Esconder los avisos con `visibility: hidden` en vez de vaciarlos.** Reserva
exactamente lo que ocupa la frase, sin un alto escrito a mano. Se descarta porque
los avisos son dos frases de largo distinto que se turnan en el mismo sitio:
habría que dejar montada siempre la más larga, escondida, para que el hueco no
cambie al pasar de una a otra, y eso es más truco que un alto mínimo de una o dos
líneas.
