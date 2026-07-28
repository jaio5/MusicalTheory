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

| Parámetro        | Valor         | Por qué                                                                                                                                                                                                      |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ventana          | 2048 muestras | A 48 kHz son 42,7 ms: caben dos periodos completos del Mi grave (82,4 Hz, periodo 12,1 ms) con margen. Menos ventana no permitiría detectar la sexta cuerda; más añadiría retardo perceptible.               |
| Rango            | 70 – 1400 Hz  | Por debajo de 70 Hz no hay guitarra: el Mi2 está en 82,4 Hz y 70 deja margen para una afinación baja. Por encima de 1400 Hz ya solo hay armónicos y ruido; el traste 15 de la primera cuerda está en 987 Hz. |
| Umbral de RMS    | 0,01          | Por debajo se considera silencio y no se emite lectura. Evita que el afinador baile con el ruido de fondo del ampli.                                                                                         |
| Confianza mínima | 0,9           | El pico de autocorrelación normalizado. Por debajo la lectura se descarta: es preferible no decir nada a decir una nota inventada.                                                                           |
| Cadencia         | cada 50 ms    | Veinte lecturas por segundo. Bastante para que el afinador se sienta continuo, poco para no saturar el hilo.                                                                                                 |

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

El análisis va a un `AudioWorklet` o, como mínimo, fuera del camino de render.
La razón: 2048 muestras por 2048 desplazamientos son cuatro millones de
multiplicaciones por análisis, veinte veces por segundo. En el hilo principal
eso compite con la animación de la rueda de quintas y se nota.

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
