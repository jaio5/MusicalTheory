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

## Limitaciones que hay que asumir

**Es monofónico.** La autocorrelación devuelve _un_ periodo. Si suenan dos
cuerdas a la vez, el resultado no es «las dos notas»: es una lectura inestable
que salta entre ellas o se va a un periodo intermedio sin sentido musical. Para
afinar y para practicar escalas es suficiente; para detectar un acorde rasgueado
no sirve. El modo componer trabaja por eso con el histórico de notas sueltas,
no con reconocimiento de acordes.

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

**Lo que no hace.** No entra solo en el camino: se propone y lo confirmas tú.
Acierta con tríadas y séptimas sostenidas en limpio; con inversiones y omitidos
duda —C sin fundamental es Em—, y con distorsión fuerte el espectro se llena de
basura y falla. Es un detector de plantillas, no una red entrenada.
