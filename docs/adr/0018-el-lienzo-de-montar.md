# ADR 0018 — Componer tiene dos caras, y en la de montar los acordes duran

Fecha: 2026-09-07 · Estado: aceptada

## Contexto

`/componer` estaba montada sobre una pregunta: **qué acorde tengo delante**. La
rueda para elegir tonalidad, el acorde elegido, sus formas por todo el mástil, el
que se está oyendo y a dónde se suele ir desde ahí. Tres columnas, y cada una
mirando al mismo instante desde un lado.

Como inspector de un acorde funciona. Lo que no responde es la otra pregunta que
tiene quien está componiendo: **cómo va mi canción**. Esa es horizontal y en el
tiempo —qué va antes, qué dura más, dónde entra el estribillo— y no se contesta
con ninguna de las tres columnas.

Había además dos cosas construidas y sin usar donde tocaba:

- **Sonar una progresión ya funcionaba.** `audio/progression-player.ts` y
  `core/music/playback.ts` llevaban meses sonando, y solo los usaba la pantalla de
  salidas para comparar tres propuestas.
- **Las duraciones ya se medían y se tiraban.** `captureProgression` devuelve
  `CapturedStep` con los pulsos que duró cada acorde de verdad, y `capturedDegrees`
  se quedaba solo con los grados porque es lo único que una canción sabe guardar.

Y una limitación del alto que este proyecto ya se había encontrado: el propio
`ComposeScreen` documenta que **«no hay reparto bueno en un portátil: son cinco
franjas peleando por el mismo alto»**. Cualquier línea de tiempo metida ahí dentro
habría sido la sexta.

## Decisión

**Componer tiene dos caras y un conmutador, y la segunda es un lienzo de bloques.**

`Tocar` es la pantalla de siempre, sin tocar una línea. `Montar` la sustituye
entera por una lista de partes con bloques que se arrastran, se estiran y suenan.
Las dos leen la misma tonalidad, el mismo tempo y el mismo estado de sesión, y las
dos llevan debajo la misma barra de herramientas.

Que sea una cara y no una zona más es lo que impide que la pantalla se cargue: en
`Montar` la rueda se pliega a una línea —«Tonalidad: C mayor»— porque el tono se
elige una vez, y lo que ocupa la pantalla es la canción.

**Y en el montaje, un acorde dura lo que dura.** `core/music/arrangement.ts` es un
modelo nuevo y pequeño: partes con nombre, y dentro bloques de `{ grado, pulsos }`.
Es la única diferencia con `song.ts`, y es la que permite arrastrar el borde de un
bloque para que ocupe dos compases.

Tres cosas que el montaje **no** tiene, y las tres a propósito:

- **No tiene tonalidad.** Un montaje son grados; el tono lo pone quien lo mira. Es
  la misma lección de `song.ts` llevada a su conclusión: con el tono dentro habría
  dos sitios donde vive y uno se quedaría viejo. Cambiar la rueda cambia los
  treinta bloques a la vez sin tocar ninguno.
- **No genera identificadores ni lee el reloj.** Entran por parámetro, como el
  instante en `song.ts` y en `exercise.ts`.
- **No sabe guardar.** Guardar es de `song.ts`, y sigue siéndolo.

**Lo que no cambia devuelve el mismo objeto.** Todas las operaciones del montaje
comparan por referencia: soltar un bloque donde ya estaba, estirarlo hasta el ancho
que ya tenía o cambiar de modo sin perder ningún grado devuelven el montaje de
entrada, no uno igual. De esa propiedad cuelga el deshacer —que si no se llena de
gestos que no hicieron nada, y deshacer un arrastre pide seis pulsaciones— y se
comprueba con diez casos en `arrangement.test.ts`.

**Al guardar, la duración se pierde y se acepta.** Un bloque de dos compases se
escribe como el mismo grado dos veces: suena igual y cabe en el formato de
siempre, que leen la API de canciones y la de salidas. Lo que se pierde al volver a
abrirla es saber que eran un bloque y no dos, y eso no cambia ni una nota. Un test
fija la garantía que hace falta: **abrir una canción y volver a guardarla sin tocar
nada no la cambia.**

**Y lo grabado entra con sus pulsos.** `partFromCapture` es el puente que faltaba:
lo que se tocó con el micro cae en el lienzo como una parte más, con los compases
que ocupaba de verdad, y desde ahí se mueve y se estira como cualquier otra.

## Consecuencias

`core/music` gana un fichero de dominio puro y `state/` un store propio —aparte de
`session-store`, porque un montaje es trabajo de media hora y `reset()` existe para
llevarse una sesión, no una canción—. La pantalla no gana ni una dependencia: el
arrastre son Pointer Events del navegador.

Queda pendiente, y no está aquí: **los punteos** —piden una capa de melodía en el
modelo, y va con su ADR— y **que la IA ordene las partes**, que sería un sexto
camino de `paths.ts` verificado como los otros cinco.

## Alternativas descartadas

**Meter la línea de tiempo dentro de la pantalla de hoy**, como una cuarta franja
bajo las tres columnas. Es lo primero que se piensa y es lo que el propio fichero
desaconseja por escrito: con cinco franjas ya no había reparto bueno en un
portátil, y la línea de tiempo es lo que más ancho necesita de todo. Habría dado
una pantalla cargada y una línea de tiempo que no se lee, que era justo lo que
había que evitar.

**Ampliar `SongSection` para que cada grado llevase sus pulsos**, en vez de un
modelo aparte. Es más limpio de mirar: un solo modelo, sin conversión. Se descarta
porque toca el esquema de la base de datos, el contrato de dos rutas y todas las
canciones ya guardadas, y a cambio da exactamente una cosa: que al reabrir una
canción los bloques salgan agrupados como estaban. No compensa **todavía**; si
algún día el lienzo es la manera normal de componer aquí, esto es lo primero que
hay que reconsiderar.

**Usar una librería de arrastrar y soltar** —`dnd-kit` es la que tocaría—. Habría
dado teclado y accesibilidad de serie, que es la parte que más cuesta hacer bien.
Se descarta por lo que son estos bloques: filas horizontales de cajas, no un árbol
ni una rejilla libre. Los Pointer Events del navegador lo resuelven en unas cien
líneas, y el teclado son otras quince porque el montaje ya sabe mover un bloque de
sitio. Este proyecto tiene diez dependencias y se escribió su propia detección de
tono; una librería de arrastrar habría sido la más cara por lo poco que hacía
falta.

**Una manija de estirar aparte del bloque**, como cualquier editor de vídeo. Se
descarta por la regla de los cuarenta y cuatro píxeles: una manija propia sería un
control de catorce en una interfaz donde nada de lo que se pulsa baja de esa
altura, y `coherencia.test.ts` está para eso. Se resuelve con **un solo control y
dos zonas**: por el cuerpo se mueve, por los últimos dieciséis píxeles se estira, y
el cursor lo dice. Con teclado no hay zonas: las flechas mueven y con `Shift`
estiran.

**Guardar el montaje al vuelo**, en IndexedDB como las preferencias. Se descarta
por lo que ya distingue este proyecto entre una sesión y una canción: una sesión es
el rastro de lo que se tocó y se guarda sola; una canción se guarda **a propósito y
con nombre**, y para eso ya está la pestaña de Canciones. Un montaje que reaparece
solo al volver sería una tercera cosa a medio camino, y la lista de canciones se
llenaría de intentos que nadie quiso guardar.

**Deshacer con operaciones inversas** en vez de guardando montajes enteros. Es lo
que hace cualquier editor grande, y ahorra memoria. Aquí un montaje son unos cientos
de bytes y todas las funciones del dominio devuelven uno nuevo, así que la pila es
gratis y no puede descuadrarse. Escribir la inversa de cada gesto sí puede, y el que
peor se deshace —arrastrar un bloque de una parte a otra— es justo el más frecuente.
