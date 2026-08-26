# ADR 0017 — Grabar el sonido y volver a escucharlo entero

Fecha: 2026-08-26 · Estado: aceptada · Complementa: [ADR 0003](./0003-analisis-en-el-hilo-principal.md), [ADR 0004](./0004-reconocimiento-de-acordes-por-croma.md)

## Contexto

El reconocimiento de acordes fallaba, y no por un umbral mal puesto: por lo que
el análisis en vivo **no puede hacer**, por definición.

`chord-engine.ts` decide mientras suena. Diez análisis por segundo, una media
móvil y cuatro confirmaciones seguidas antes de enseñar nada. Eso le impone tres
límites que ningún ajuste arregla:

1. **La ventana tiene que ser corta**, o el retardo se nota. Con 2048 muestras a
   48 kHz, una casilla del espectro mide 23,4 Hz. El Mi y el Fa graves están a
   4,9 Hz: caen en la misma casilla. Y ahí abajo es donde una guitarra pasa media
   canción.
2. **Solo puede mirar hacia atrás.** Las cuatro confirmaciones son cuatro décimas
   en las que el acorde ya estaba sonando y no se decía.
3. **Decide acorde a acorde**, sin saber si lo que viene después encaja con lo que
   acaba de poner.

Y hay una cuarta, más callada: de una sesión solo quedaba **la lectura del
motor**, no el sonido. Lo que se guardaba ya traía los errores dentro.

## Decisión

**Se guarda el sonido crudo mientras dura «grabar un trozo», y al parar se vuelve
a escuchar entero.**

El análisis de la grabación (`audio/offline-chords.ts`) hace lo que en vivo es
imposible:

- **Ventana de 16384 en vez de 2048.** Una casilla pasa de 23,4 Hz a 2,9 Hz: el
  Mi y el Fa graves dejan de ser la misma casilla. Es el punto entero.
- **El ruido de la sala, medido en la propia grabación** en lugar de un umbral
  escrito en un fichero. Cuando empieza a sonar, el motor en vivo todavía no sabe
  cómo suena el silencio de esa habitación; al terminar, sí.
- **Cada instante se decide sabiendo lo que vino después.** Los acordes de paso
  —el C6 que aparece entre C y Am mientras las dos manos cambian— se caen sin
  necesidad de esperar cuatro décimas.
- **La secuencia se elige entera de una vez**, con programación dinámica y los
  pesos de `nextDegrees`: de cada grado, adónde se suele ir y cuánto. Ese grafo ya
  estaba escrito y probado, y es el mismo que valida las salidas
  ([ADR 0016](./0016-salidas-en-vez-de-versiones.md)).

Hacía falta **una FFT propia** (`audio/fft.ts`): en vivo el espectro lo da el
navegador, pero un `AnalyserNode` mira lo que está entrando ahora, no un trozo de
memoria de hace dos minutos. Cuarenta líneas y se prueban solas, que es el mismo
razonamiento de [ADR 0002](./0002-deteccion-de-tono-propia.md) con la
autocorrelación.

**El audio no sale del equipo, y esto no abre esa puerta.** Las muestras se
quedan en memoria, se analizan ahí y lo que sale son símbolos. La regla 4 de la
arquitectura sigue en pie, no hay ni una línea de subida y la portada puede
seguir diciendo «0 bytes de audio enviados».

**Y va en un worker.** [ADR 0003](./0003-analisis-en-el-hilo-principal.md) decidió
que el análisis en vivo fuera en el hilo principal, y sigue siendo verdad: son
cuatro décimas de milisegundo por vuelta y un worker costaría más en mensajes que
en cálculo. Esto es lo contrario —una vez, sobre dos minutos de sonido— y está
medido: **1,1 s en un Ryzen de sobremesa**, o sea entre cinco y diez segundos en
un móvil. En el hilo principal serían diez segundos de pantalla congelada justo
al soltar la guitarra.

Con respaldo: si el worker no se puede crear, se calcula en el hilo. Se pierde
que la pantalla no se congele, no la función.

## Consecuencias

- El análisis en vivo **se queda como está**. Sigue siendo lo que se ve mientras
  tocas; lo que cambia es que ya no es la última palabra sobre un trozo grabado.
- Dos fallos que salieron al probarlo, y los dos son de los que no se ven leyendo:
  - **Medir el ruido con un percentil no vale si no hay silencio.** Una grabación
    de alguien tocando sin parar no tiene percentil 10 de sala: tiene percentil 10
    de guitarra floja, porque una cuerda decae. El umbral salía por encima de la
    propia guitarra y se detectaban **cero acordes en ocho segundos**. Va acotado
    a un cuarto de la energía típica.
  - **La ventana que cae a caballo entre el silencio y el ataque** lleva medio
    ruido y medio acorde, y colaba un acorde fantasma que además salía el primero.
    Se arregla exigiendo que un acorde ocupe al menos dos ventanas, que es la
    misma idea que el mínimo de pulsos de `core/music/capture.ts`.
- La salida es `CapturedChord[]`, **lo mismo que ya producía el motor en vivo**.
  `capture.ts` y todo lo que hay encima no se enteran de por dónde ha venido: se
  puede cambiar cómo se oye sin tocar cómo se compone.
- Un análisis vacío no pisa lo que se oyó en vivo. Perder la mejora es aceptable;
  perder la grabación no.
- Tres minutos de tope, que a 48 kHz son 34 MB en memoria. No es una regla
  musical: es por si alguien deja el botón puesto.
- **Las inversiones siguen sin distinguirse.** El croma olvida la octava
  ([ADR 0004](./0004-reconocimiento-de-acordes-por-croma.md)) y analizar después no
  cambia eso: C/E y C siguen siendo el mismo vector. Lo que mejora es la
  resolución, el ruido y la coherencia de la secuencia, no la inversión.

## Alternativas descartadas

**Ajustar los umbrales del motor en vivo.** Es lo primero que se piensa y es
donde se pierde el tiempo: los tres límites de arriba no son parámetros, son
consecuencias de decidir mientras suena. Ninguna combinación de números permite
mirar hacia delante.

**Acumular los bloques que ya lee el analizador**, en vez de grabar con
`MediaRecorder`. Parecía lo más directo: el motor ya pide bloques varias veces por
segundo. No vale, y por una razón concreta: el analizador contesta _el último
bloque_, así que leerlo cada tanto deja huecos y repeticiones. Un espectro
calculado sobre una señal con costuras se llena de faldas que no existen, que es
justo el ruido que se venía a quitar.

**Traer una librería de DSP** para la FFT. Se descarta por lo mismo que en
[ADR 0002](./0002-deteccion-de-tono-propia.md): son cuarenta líneas, se prueban
solas, y una dependencia es una dependencia que actualizar y auditar para siempre.

**Mandarle el audio a un modelo para que lo identifique.** Sería romper «0 bytes
de audio enviados», que está escrito en la primera pantalla; obligaría a otro
proveedor porque los modelos de texto no aceptan audio; y multiplicaría el coste
de la petición, del que salen los cupos de todos los planes. Y ni siquiera está
claro que acertara más: identificar acordes de una grabación es justo donde un
algoritmo de reconocimiento le gana a un modelo generalista.

**Analizar solo al final, quitando el motor en vivo.** Más simple de mantener. Se
descarta porque «la teoría se ordena mientras tocas» es el título de la portada:
ver el acorde mientras suena es la función, aunque a veces falle. Lo que se añade
es una segunda pasada, no un sustituto.
