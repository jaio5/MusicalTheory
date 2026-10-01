# Detección de tono

## Qué problema hay que resolver

Convertir el flujo del micro en «ahora suena un Sol, 7 cents alto», varias
veces por segundo, sin librerías de DSP y sin que se note el coste en el hilo
principal.

## El método: autocorrelación

De las tres familias posibles —cruces por cero, FFT y autocorrelación— se usa
la tercera.

- **Cruces por cero** es barata y falla con cualquier armónico fuerte. Una
  cuerda de guitarra tiene muchos.
- **FFT** da una resolución en frecuencia que depende del tamaño de la ventana.
  Con 2048 muestras a 48 kHz cada casilla mide 23,4 Hz: en la zona grave de la
  guitarra eso es medio tono de error. Habría que interpolar de todas formas.
- **Autocorrelación** compara la señal consigo misma desplazada. El
  desplazamiento donde mejor coincide es el periodo, y la frecuencia es su
  inversa. Trabaja en el dominio del tiempo, donde la resolución la marca la
  frecuencia de muestreo, no el tamaño de la ventana.

El razonamiento completo está en
[adr/0002](./adr/0002-deteccion-de-tono-propia.md).

## Los parámetros

| Parámetro                  | Valor         | Por qué                                                                                                                                                                                                      |
| -------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ventana                    | 2048 muestras | A 48 kHz son 42,7 ms: caben dos periodos completos del Mi grave (82,4 Hz, periodo 12,1 ms) con margen. Menos ventana no permitiría detectar la sexta cuerda; más añadiría retardo perceptible.               |
| Rango                      | 70 – 1400 Hz  | Por debajo de 70 Hz no hay guitarra: el Mi2 está en 82,4 Hz y 70 deja margen para una afinación baja. Por encima de 1400 Hz ya solo hay armónicos y ruido; el traste 15 de la primera cuerda está en 987 Hz. |
| Umbral de RMS al enganchar | 0,006         | Nivel mínimo para empezar a detectar una nota nueva. Alto a propósito: evita que el afinador arranque con el ruido de fondo del ampli.                                                                       |
| Umbral de RMS al seguir    | 0,0015        | Nivel mínimo para seguir una nota ya enganchada. Cuatro veces más bajo, porque una cuerda pulsada decae desde el primer instante.                                                                            |
| Confianza al enganchar     | 0,9           | El pico de autocorrelación normalizado. Por debajo, la lectura se descarta: preferible no decir nada a decir una nota inventada.                                                                             |
| Confianza al seguir        | 0,75          | Al decaer, la nota se ensucia respecto al ruido de fondo y el pico baja. Exigirle lo mismo que al principio cortaría la detección con la nota todavía sonando.                                               |
| Margen de silencio         | 600 ms        | Lo que se espera sin señal antes de dar la nota por terminada.                                                                                                                                               |
| Cadencia                   | cada 50 ms    | Veinte lecturas por segundo. Bastante para que el afinador se sienta continuo, poco para no saturar el hilo.                                                                                                 |

### Por qué hay dos umbrales y no uno

Una cuerda pulsada empieza fuerte y cae. Con un solo umbral pasa lo que se ve
en cuanto lo pruebas con una guitarra de verdad: la nota se detecta medio
segundo y desaparece, aunque siga oyéndose perfectamente.

La solución es la de cualquier compuerta de ruido: **cuesta más entrar que
quedarse**. Enganchar una nota nueva exige nivel y confianza altos, para no
disparar con el ruido; una vez enganchada, se sigue con umbrales bastante más
bajos hasta que la nota muere de verdad. Cuando muere, el siguiente ataque
vuelve a tener que superar el umbral alto.

Eso vive en el motor, no en la detección: `detectPitch` recibe los umbrales
como parámetro y el motor decide cuáles pasarle según tenga o no una nota
enganchada.

## Interpolación parabólica

El pico de la autocorrelación cae entre dos muestras. Sin más, el error de
frecuencia sería de una muestra completa de periodo, que en la zona aguda es
mucho: a 1000 Hz con 48 kHz de muestreo, el periodo son 48 muestras, y
equivocarse en una es un error de más de 30 cents.

La solución es ajustar una parábola por los tres puntos alrededor del máximo
—el pico y sus dos vecinos— y quedarse con el vértice, que cae entre muestras.
El error baja a menos de un cent en todo el rango útil.

## Captura: las tres opciones que se desactivan

`getUserMedia` se pide con:

```
audio: {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}
```

Las tres están pensadas para videollamadas y las tres estropean el análisis:

- **`echoCancellation`** aplica un filtro adaptativo que asume que la voz y el
  altavoz están correlacionados. Con una guitarra sostenida, el cancelador la
  interpreta como eco y la atenúa: la nota se desvanece mientras suena.
- **`noiseSuppression`** recorta las bandas que considera ruido. Un tono
  sostenido y estable es justo lo que sus modelos marcan como ruido de fondo,
  así que ataca a la fundamental.
- **`autoGainControl`** cambia el nivel continuamente. Como se decide si hay
  señal con un umbral de RMS, un control de ganancia automático hace que ese
  umbral no signifique nada: el ruido de fondo acaba subiendo hasta cruzarlo.

## Dónde vive el cálculo

**Ahora mismo, en el hilo principal, fuera del ciclo de render.** El bucle es un
`setInterval` dentro de `AutocorrelationPitchEngine`, no un
`requestAnimationFrame`: así el análisis no depende de que React pinte, y
seguir renderizando no cambia la cadencia.

El coste real es menor de lo que parece. No son 2048 × 2048 comparaciones: la
búsqueda está acotada al rango de la guitarra, así que los desplazamientos van
de 34 a 686 muestras a 48 kHz. Eso son unos **1,2 millones de multiplicaciones
por análisis** y unos 23 millones por segundo, que en JavaScript moderno se
resuelven en un par de milisegundos de cada ventana de 50.

La energía acumulada del bloque se calcula una sola vez y sirve para normalizar
todos los desplazamientos, que es lo que evita recorrer el bloque otra vez por
cada uno.

Llevarlo a un `AudioWorklet` sigue siendo la salida si esto se queda corto
cuando haya rueda de quintas y mástil animándose a la vez. Por qué no se ha
hecho ya está en [adr/0003](./adr/0003-analisis-en-el-hilo-principal.md).

## Dos pasadas: mientras suena y al parar

Hasta la fase de las salidas solo había una: el motor decidía mientras sonaba, y
lo que quedaba guardado era su lectura. Ahora hay dos, y hacen cosas distintas.

**En vivo** manda `chord-engine.ts` y no ha cambiado: diez análisis por segundo,
media móvil y cuatro confirmaciones. Es lo que se ve mientras tocas, y arrastra
tres límites que no son parámetros mal puestos sino consecuencias de decidir en
el momento: la ventana tiene que ser corta o el retardo se nota, solo puede mirar
hacia atrás, y decide acorde a acorde.

**Al parar de grabar** entra `audio/offline-chords.ts`, que tiene el trozo entero
delante:

|                 | En vivo                    | Al parar                           |
| --------------- | -------------------------- | ---------------------------------- |
| Ventana         | 2048 · 23,4 Hz por casilla | 16384 · **2,9 Hz por casilla**     |
| Contexto        | Solo lo anterior           | Lo anterior y lo posterior         |
| Umbral de ruido | Fijo, escrito aquí         | **Medido en la propia grabación**  |
| Decisión        | Acorde a acorde            | **La secuencia entera de una vez** |

Lo de la ventana es el punto entero: el Mi y el Fa graves están a 4,9 Hz, así que
con 23,4 Hz por casilla caen en la misma y ahí abajo es donde una guitarra pasa
media canción.

Y lo de la secuencia usa el grafo que ya estaba escrito, `nextDegrees` —de cada
grado, adónde se suele ir y cuánto—, con programación dinámica. Un acorde suelto
que no pega con sus vecinos se cae aunque el espectro lo apoye.

El espectro lo calcula una FFT propia (`audio/fft.ts`): en vivo lo da el
navegador, pero un `AnalyserNode` mira lo que entra ahora, no un trozo de memoria
de hace dos minutos.

**Va en un worker**, y esa es la diferencia con [adr/0003](./adr/0003-analisis-en-el-hilo-principal.md):
analizar dos minutos son 1,1 s en un sobremesa y hasta diez en un móvil. El
razonamiento entero, con lo que se descartó, está en
[adr/0017](./adr/0017-escuchar-la-grabacion-entera.md).

**El audio no sale del equipo.** Las muestras se quedan en memoria, se analizan
ahí y lo que sale son símbolos.

## La toma: el clic suena, y se transcribe todo

En «Tocando» se cuentan dos compases y **el clic sigue sonando toda la toma**,
con el tempo y el compás de la pantalla y el volumen que se elija (quitarlo no
para el pulso: el metrónomo sigue contando en silencio). El compás uno cae un
pulso después del último clic de la cuenta, medido desde **cuándo suena** ese
clic —el reloj del audio más lo que tarda el altavoz— y no desde el aviso del
temporizador (`audio/metronome.ts`, `state/cuenta-atras.ts`).

**El micro oye el clic, y eso se resuelve por su timbre, no por su tiempo.** La
onda cuadrada de 1000/1600 Hz que había tiene periodo dentro del rango del motor
de tono: metía un Si 5 en cada silencio y partía las notas largas en el pulso.
El golpe es ahora **ruido filtrado por encima de 4,5 kHz**: no se repite, así que
la autocorrelación no le encuentra periodo, y vive donde no mira ningún motor.
Detrás hay dos redes más: la entrada analiza a través de dos pasos bajos a 3 kHz
(`web-audio-input.ts`), y un ataque de la misma nota solo cuenta si el nivel
vuelve a la mitad de su golpe inicial —un clic o un hueco del sonido no llegan—.

**El punteo se transcribe de cada análisis** (`transcribirPunteo`, en
`core/music/melody.ts`), no del historial de la sesión, que guarda veinticuatro
entradas y apunta la misma nota cada cuarto de segundo. Con cada análisis hay
ataques —la misma altura que vuelve a sonar fuerte es otra nota—, finales —una
nota acaba cuando deja de oírse, y si se apagó sola, se dejó sonar hasta la
siguiente—, silencios, y fuera las fantasmas: un análisis suelto con otra altura
entre dos iguales se corrige a la de sus vecinas, y una nota de un análisis no
cuenta. Cada instante se descuenta lo que tarda el motor en reconocer una nota
(40 ms) y se cuadra en la semicorchea, prefiriendo el sitio fuerte en los
empates.

**La rítmica se cuadra en la rejilla de la toma** (`captureProgression` con
`startedAt`): cada cambio cae en su pulso, descontado lo que tarda el motor de
acordes en decirlo (520 ms, medido), y el último acaba cuando dejó de sonar. Una
cuatríada oída se escribe como su tríada, porque con una guitarra el croma casi
siempre ve cuatro notas (el quinto armónico de la quinta es la séptima mayor), y
el motor de acordes mira hasta 1000 Hz y no hasta 2200: por encima no hay
fundamentales de guitarra, solo armónicos.

**No hay tope de compases.** Una toma larga se reparte en varias partes seguidas
—64 notas o 32 bloques cada una, cortando en una barra donde la parte de antes
acaba justo, para que al tocarlas seguidas cada nota caiga donde se tocó—, y a
los diez minutos se
para sola escribiendo lo tocado.

### Lo medido

Con una guitarra sintética de Karplus-Strong (`audio/guitarra-sintetica.ts`, y el
mismo algoritmo en Python para los WAV) a 90 pulsos, en Chromium con el sonido
metido como micrófono, el clic de la aplicación colándose en él a 0,6 de su
nivel, y comparando lo escrito en la partitura con lo tocado:

| Toma                               | Antes                      | Después                         |
| ---------------------------------- | -------------------------- | ------------------------------- |
| Punteo de 20 notas, altura         | 3/20                       | 20/20                           |
| Punteo, ataque en su casilla       | 3/20                       | 20/20                           |
| Punteo, duración                   | 2/20                       | 20/20                           |
| Punteo, notas fantasma             | 0 (solo apuntaba 4)        | 0                               |
| Punteo con la onda cuadrada sumada | 3/20, 2/20, 2/20 y 1 falsa | 20/20, 20/20, 18/20 y 3 falsas  |
| Rítmica C–Am–F/G–C, acordes leídos | 0/5                        | 4/5 (el Am sale como C, dudoso) |
| Rítmica, cambios en su pulso       | 0/5                        | 4/5                             |
| Rítmica, largos                    | 0/5                        | 3/5                             |

El «antes» apuntaba cuatro o cinco notas porque el historial se quedaba con las
últimas veinticuatro entradas, y en la rítmica todo acorde salía como cuatríada
y se descartaba. Las cifras del «después» las fija `audio/toma-sintetica.test.ts`
con la misma señal. Con la máquina muy cargada (carga 15 a 20) algunas tomas en
Chromium salieron peor; las sondas mostraron que el sonido de prueba llegaba
desplazado al análisis, que es cosa del micrófono fingido y no se ha visto con
uno de verdad —pero no se ha medido con uno de verdad—.

**Lo que no aguanta:** el La menor de la postura abierta se lee Esus4 y C6 y se
escribe como Do, marcado como dudoso; no hay tresillos ni ligaduras en la
partitura, así que un tresillo cae en la semicorchea más cercana y una nota de
más de cuatro pulsos sale partida en dos iguales; y la latencia de entrada del
micro no se descuenta, porque el navegador no la da de forma fiable.

## Limitaciones que hay que asumir

**Es monofónico.** La autocorrelación devuelve _un_ periodo. Si suenan dos
cuerdas a la vez, el resultado no es «las dos notas»: es una lectura inestable
que salta entre ellas o se va a un periodo intermedio sin sentido musical. Para
afinar y para practicar escalas es suficiente; para detectar un acorde rasgueado
no sirve. Por eso el modo componer no le pregunta a este motor qué acorde suena:
lo saca de otro análisis distinto, el de «[Reconocer acordes](#reconocer-acordes)»
más abajo.

Y **el afinador lo dice cuando pasa**: con señal entrando y ninguna lectura, en
vez de «esperando a que suene algo» —que se contradecía con el medidor de nivel
lleno dos líneas más abajo— dice que te oye y no engancha, y que pruebes una
cuerda sola. Es la misma regla de decir cuándo se duda que sigue el
reconocimiento de acordes.

**La distorsión la confunde.** Un previo saturado genera armónicos que pueden
superar en energía a la fundamental. Cuando el segundo armónico domina, la
autocorrelación encuentra un pico igual de bueno en la mitad del periodo y
devuelve la octava de arriba. Y con la caída de octava del subarmónico ocurre
lo contrario. **La app pide señal limpia**, y eso hay que decirlo en la
interfaz, no esconderlo: con Guitar Rig, el canal limpio antes de los pedales.

**Necesita nota sostenida.** El ataque de una púa tarda unos 30 ms en
estabilizarse. La primera lectura tras pulsar suele ser mala; por eso hay
umbral de confianza y por eso el ejercicio del modo aprender valida cuando la
nota lleva sonando limpia un rato, no en el primer análisis.

**La frecuencia de muestreo la decide el navegador.** No se asume 44 100 ni
48 000: se lee del contexto una vez arrancado y todos los cálculos parten de
ahí.

**Por encima del rango detecta un subarmónico, no silencio.** Una señal a
2000 Hz también es periódica a 1000 Hz, y ese pico sí cae dentro del rango
buscado. No afecta a la guitarra —el traste 24 de la primera cuerda está en
1319 Hz— pero conviene saberlo, y hay un test que lo fija para que no se
confunda con un fallo.

**El hueco entre dos púas no apaga la nota.** El motor espera 250 ms sin señal
antes de avisar de que ya no suena nada. Sin esa espera, la pantalla parpadearía
en cada silencio de la mano derecha.

## Reconocer acordes

La autocorrelación no puede: busca **un** periodo, y un acorde tiene tres o
cuatro a la vez. Para acordes se usa otra cosa, y solo en componer —el afinador
afina cuerda a cuerda, y analizar el espectro allí sería gastar batería por
gusto—.

El camino es: espectro → croma → plantillas.

**El croma** son doce números, uno por nota, olvidando la octava. Lo difícil no
es doblar octavas, es que los armónicos mienten: una sexta al aire suena con su
quinta y su tercera mayor encima por física pura, y un croma ingenuo lee un
acorde de E mayor donde solo hay una cuerda pulsada. Por eso no se suma el
espectro entero sino sus picos, y cada pico se descuenta —no se borra— si otro
más grave y más fuerte lo explica como armónico suyo.

**Las plantillas** son las especies que ya conocía el dominio. Se compara por
coseno, que castiga a la vez lo que suena y no debería y lo que debería y no
suena. Hacen falta las dos mitades: contando solo lo que sobra, un acorde de
cinco notas gana siempre; contando solo lo que falta, Am y C6 son
indistinguibles.

**Dos ventanas.** El tono quiere una ventana corta para responder al ataque; el
acorde quiere una larga, porque separar dos notas vecinas en las cuerdas graves
pide resolución en frecuencia. Son dos analizadores sobre la misma entrada:
2048 muestras para el tono, 8192 para el espectro.

**Lo que sale no es el último análisis** sino lo que se ha mantenido cuatro
décimas. Un rasgueo pasa por media docena de acordes falsos antes de asentarse,
y al cambiar de acorde la media móvil ve los dos a la vez —de C a Am se ve un
C6, que es literalmente cierto—. El suavizado y las confirmaciones se ajustan
juntos para que ese acorde de paso no llegue a confirmarse.

**Lo que no hace.** No entra solo en la canción: se propone y lo confirmas tú, y
al confirmarlo entra como bloque —con su especie si la tiene— y no en una lista
aparte ([adr/0032](./adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
Acierta con tríadas y séptimas sostenidas en limpio; con inversiones y omitidos
duda —C sin fundamental es Em—, y con distorsión fuerte el espectro se llena de
basura y falla. Es un detector de plantillas, no una red entrenada.

**Una nota sola se lee como su acorde mayor, y no es un descuido del descuento
de armónicos: es su límite.** Una cuerda pulsada suena con su quinta —tercer
armónico— y su tercera mayor —quinto— encima, así que un croma ingenuo ve un
acorde mayor donde hay una cuerda. `discountHarmonics` está justo para eso y
rebaja los picos que otro más grave explica. El problema es que **en un acorde de
verdad pasa lo mismo**: en un Do rasgueado, el Sol también es el tercer armónico
del Do, así que también se rebaja. Los dos casos salen con la misma forma —la
fundamental a 1 y las otras dos alrededor de 0,2—, y la compresión de sonoridad
(`LOUDNESS_EXPONENT`) las vuelve a levantar a las dos por igual.

Consecuencia práctica, comprobada tocando: **un punteo de dos notas iguales
seguidas se apunta como acordes.** Lo que distinguiría los dos casos es si los
picos de la tercera y la quinta son más fuertes de lo que el modelo de armónicos
predice, y eso el descuento actual lo tira al aplanarlos todos al mismo 0,2.
Arreglarlo pide calibrar contra grabaciones de guitarra de verdad; está en el
[ROADMAP](./ROADMAP.md) y **no se arregla adivinando desde un test sintético**,
porque la guitarra de mentira de los tests tiene justo los armónicos que se le
pusieron.

Por qué este método y no otro, con lo que se descartó por el camino, en
[adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md).

## Lo que se apunta lleva su duda

`readChord` no devuelve solo el acorde: devuelve también los candidatos que
compitieron y **el margen**, que es cuánto se despega el elegido del segundo.

**Hay dos maneras de equivocarse, y la confianza mira las dos.**

El margen mide la ambigüedad: un 0,90 con el segundo en 0,89 es un empate resuelto
casi a cara o cruz, y un 0,85 con el segundo en 0,60 es una certeza. La puntuación
mide otra cosa, cuánto se parece el croma a una plantilla, y eso depende del
instrumento, de la sala y de la pastilla.

Hacen falta las dos porque **un acorde puede ganar de calle y no parecerse a
nada**: una cuerda que roza o una nota que no llegó a sonar dejan un croma que solo
una plantilla explica —mal, pero sola—, y eso sale con margen de sobra. Así que la
confianza es la peor de las dos holguras:

```
confianza = min( margen , puntuación − PARECIDO_MINIMO )
```

Las dos son diferencias de puntuación, así que se comparan con el mismo
`DUDOSO = 0,06` sin convertir nada. `PARECIDO_MINIMO` es 0,78, el suelo por debajo
del cual no hay acorde, y vive en un solo sitio: de él cuelga la mitad de la
confianza. El porqué entero, y el fallo de guitarra que lo destapó, en
[adr/0043](./adr/0043-dos-maneras-de-equivocarse.md).

Esa duda **sobrevive a los dos colapsos** de `captureProgression`: al fundir
fotogramas repetidos y al fundir grados iguales seguidos se conserva la peor
confianza, no la media. Si en alguno de esos análisis el motor estuvo a punto de
decir otra cosa —o se pareció bastante menos—, el acorde entero es dudoso.

**Lo analizado en diferido lleva la misma duda.** «Grabar un trozo y analizarlo»
usaba `bestChord`, que contesta el acorde a secas, así que llegaba al lienzo sin
margen y sin puntuación: confianza 1 por omisión, certeza absoluta. Ahora usa
`readChord`, y la confianza de un tramo es la de su peor ventana **de las que
oyeron ese acorde por su cuenta** —la programación dinámica extiende un acorde por
encima de ventanas que oyeron otra cosa, y la puntuación de esas habla de ese otro
acorde—. Un tramo que ninguna ventana oyó lo puso la vecindad y no el sonido: sale
con la duda máxima.

Y lo que no se pudo leer deja de ser un contador: `Capture.unread` dice cuándo
sonó, cuánto duró, qué se oyó y por qué se cayó. Varios acordes que no caben en la
tonalidad son casi siempre la misma cosa —que la tonalidad detectada no es la que
se estaba tocando—, y eso solo se ve si se enseña.

El razonamiento entero está en
[adr/0020](./adr/0020-lo-que-se-oyo-y-lo-que-se-supo.md).

## La tonalidad se detecta con notas sueltas, no rasgueando

Vale la pena decirlo aparte porque la interfaz llegó a prometer lo contrario.

La tonalidad se deduce de un **histograma de alturas**: cada nota que el motor de
tono reconoce suma en su casilla, y cada medio segundo se correlaciona el
histograma con los veinticuatro perfiles. El motor de tono es el de
autocorrelación, y es **monofónico**: con un acorde sonando no entrega ninguna
nota, así que el histograma no se llena y no hay nada que correlacionar.

Es decir: **rasgueando acordes, la tonalidad no se detecta nunca.** Tocando la
escala, sale en cuatro o cinco segundos.

Comprobado tocándole a la aplicación dos ficheros por el micrófono falso: uno de
la progresión G–C–D–Em, doce segundos y cero detección; otro de la escala de Sol
arriba y abajo, que la saca a los pocos compases —como Mi menor, que comparte
armadura con Sol mayor y es una lectura correcta para un histograma sin contexto
armónico—.

Lo que sí oye un rasgueo es el **motor de croma**, que es otro y responde a otra
pregunta: qué acorde suena ahora, no en qué tonalidad estás. Los dos corren a la
vez y no se hablan.

Por eso la interfaz dice «toca unas notas sueltas y la detecto sola» y no «toca
unos compases». La frase de antes era verdad solo a veces, que es la peor clase de
verdad en una promesa.
