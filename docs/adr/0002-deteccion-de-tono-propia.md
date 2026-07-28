# ADR 0002 — Detección de tono propia con Web Audio, sin librerías de DSP

Fecha: 2026-07-28 · Estado: aceptada

## Contexto

La aplicación necesita saber qué nota suena, veinte veces por segundo, con
precisión suficiente para un afinador: por debajo de un cent de error en el
rango de la guitarra. La entrada es limpia y monofónica —tarjeta externa,
Guitar Rig en canal limpio— así que no hace falta resolver el caso difícil de
audio polifónico ni de grabación de sala.

## Decisión

Implementar la detección con **autocorrelación e interpolación parabólica del
pico**, directamente sobre Web Audio, sin librerías externas. Los parámetros
—ventana de 2048 muestras, rango de 70 a 1400 Hz, umbral de RMS, cadencia de
50 ms— están en [AUDIO-PITCH.md](../AUDIO-PITCH.md).

## Alternativas descartadas

**FFT con el `AnalyserNode`.** Es lo que da el navegador de serie y no cuesta
nada montarlo. Se descarta por resolución: con 2048 muestras a 48 kHz, cada
casilla del espectro mide 23,4 Hz. En el Mi grave (82,4 Hz) eso es casi medio
tono de incertidumbre. Ampliar la ventana mejora la resolución pero añade
retardo, y de todas formas haría falta interpolar el pico. Si hay que interpolar
igual, la autocorrelación en el dominio del tiempo da mejor precisión para el
mismo coste.

**Cruces por cero.** Es el método más barato y el más frágil. Una cuerda de
guitarra produce armónicos fuertes que generan cruces extra, y el resultado
salta de octava constantemente. Descartado sin más.

**Una librería (`pitchy`, `pitchfinder`, YIN empaquetado).** Es la opción
sensata en un proyecto con prisa: implementan YIN o McLeod, están probadas y
funcionan. Se descarta por dos razones. La primera es que el enunciado del
proyecto pide Web Audio a pelo, y el objetivo declarado incluye entender el
mecanismo, no solo tener el resultado. La segunda es que un afinador es
justamente la pieza donde interesa poder ajustar umbrales, porque cada cadena de
señal se comporta distinto, y con una caja negra eso se hace a ciegas.

**YIN en vez de autocorrelación normalizada.** YIN es mejor: la función de
diferencia acumulada elimina buena parte de los saltos de octava. Se descarta
_por ahora_ por complejidad, no por criterio. Con señal limpia la
autocorrelación normalizada con umbral de confianza es suficiente. Si aparecen
saltos de octava en uso real, la siguiente parada es YIN, y la interfaz
`PitchEngine` está pensada para que sea cambiar la implementación.

## Consecuencias

**A favor**

- Precisión por debajo de un cent en todo el rango útil, gracias a la
  interpolación parabólica.
- Los umbrales están a mano y se pueden ajustar con la guitarra en la mano.
- Cero dependencias en el camino crítico del audio.
- La interfaz `PitchEngine` permite sustituir el algoritmo sin tocar la interfaz
  de usuario.

**En contra**

- **Es monofónica.** Dos cuerdas a la vez dan una lectura inestable. No se puede
  detectar un acorde rasgueado, y eso condiciona el modo componer, que trabaja
  con el histórico de notas sueltas.
- **La distorsión la confunde.** Si el segundo armónico domina, se detecta la
  octava de arriba. La app pide señal limpia y lo dice en la interfaz.
- **Cuesta CPU.** Cuatro millones de multiplicaciones por análisis, veinte veces
  por segundo. Obliga a sacar el cálculo del hilo principal a un
  `AudioWorklet`, que es más código que un `requestAnimationFrame`.
- **Hay que probarlo con señal real.** Los tests unitarios pueden usar señales
  sintéticas, pero el ajuste fino de umbrales solo sale tocando.
