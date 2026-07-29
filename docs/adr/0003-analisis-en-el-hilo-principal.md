# ADR 0003 — El análisis de tono corre en el hilo principal, no en un AudioWorklet

Fecha: 2026-07-28 · Estado: aceptada · Revisa: [ADR 0002](./0002-deteccion-de-tono-propia.md)

> Medido el 29 de julio de 2026, ya con el segundo motor de
> [ADR 0004](./0004-reconocimiento-de-acordes-por-croma.md) sumando carga. El
> resultado confirma la decisión: se queda en el hilo principal. Los números,
> abajo en «[Medición](#medición)».

## Contexto

En la fase 0, `docs/AUDIO-PITCH.md` daba por hecho que el análisis viviría en un
`AudioWorklet`, con el argumento de que cuatro millones de multiplicaciones
veinte veces por segundo competirían con la animación de la interfaz.

Al implementarlo, ese número resultó estar mal. La búsqueda no recorre todos los
desplazamientos posibles: está acotada al rango de la guitarra, de 70 a 1400 Hz,
que a 48 kHz son desplazamientos de 34 a 686 muestras. Con una ventana de 2048,
eso son unas 1,2 millones de multiplicaciones por análisis, no cuatro. Unos 23
millones por segundo.

## Decisión

El análisis corre **en el hilo principal**, en un `setInterval` dentro de
`AutocorrelationPitchEngine`, fuera del ciclo de render de React.

La detección en sí (`detectPitch`) es una función pura en `audio/`, sin estado y
sin dependencias del navegador, así que moverla a otro hilo más adelante no
obliga a reescribirla: solo cambia quién la llama.

## Alternativas descartadas

**`AudioWorklet`.** Es la respuesta correcta a largo plazo y sigue siendo la
salida prevista. Se descarta ahora por un motivo concreto: el módulo de un
worklet se carga por URL con `audioWorklet.addModule()`, fuera del grafo de
módulos de la aplicación. Con Turbopack eso significa, hoy, dejar un fichero
JavaScript suelto en `public/`, sin tipos, sin lint y sin pasar por los tests.
Es decir: **una segunda copia del algoritmo**, en otro lenguaje efectivo, que se
desincronizaría del original a la primera corrección de umbrales. El coste de esa
duplicación es mayor que los dos milisegundos que ahorra.

**Un `Web Worker` con `postMessage`.** Mantiene una sola copia en TypeScript,
porque el bundler sí resuelve `new Worker(new URL('./x.ts', import.meta.url))`.
Se descarta por ahora porque mete un salto asíncrono en el camino de la lectura
y complica el ciclo de vida —arrancar, parar, limpiar— a cambio de un ahorro que
todavía no se ha medido como necesario. Es la primera opción a probar cuando
haga falta.

**Analizar menos veces por segundo.** Bajar de 20 a 10 análisis por segundo
partiría el coste por dos, pero el afinador dejaría de sentirse continuo. Se
prefiere gastar CPU en lo que el usuario nota.

## Consecuencias

**A favor**

- Una sola implementación del algoritmo, tipada, con lint y con tests.
- El ciclo de vida es trivial: arrancar y parar un temporizador.
- El análisis no depende de `requestAnimationFrame`, así que renderizar más o
  menos no cambia la cadencia de lectura.

**En contra**

- El coste está en el mismo hilo que la interfaz. Con la rueda de quintas y el
  mástil animándose a la vez (fase 2) puede empezar a notarse.
- `setInterval` no garantiza la cadencia: si el hilo se atasca, los análisis se
  retrasan. El motor lo asume trabajando siempre con el bloque más reciente que
  le da la entrada, sin acumular retraso.
- Un navegador puede ralentizar los temporizadores de una pestaña en segundo
  plano. Para un afinador que se mira mientras se usa no es un problema, pero
  hay que recordarlo cuando llegue la grabación.

**Cuándo revisar esto**: cuando la fase 2 esté animando la rueda y el mástil, o
si aparece jitter visible en la aguja. La medida a mirar es el tiempo de cada
análisis, no la sensación.

## Medición

Hecha el 29 de julio de 2026 con
[`main-thread-cost.test.ts`](../../src/audio/main-thread-cost.test.ts), que
queda en la suite para que una regresión del algoritmo salte sola. Señales
sintéticas de guitarra: E2 para el tono —el periodo más largo es el peor caso—
y un C mayor en posición abierta para el acorde, también con el espectro sucio
que deja la distorsión.

| Operación                     | Por pasada | Cadencia | Por segundo                    |
| ----------------------------- | ---------- | -------- | ------------------------------ |
| `detectPitch` (2048 muestras) | 0,78 ms    | 20 Hz    | 15,7 ms                        |
| `signalRms`                   | 0,004 ms   | 20 Hz    | 0,1 ms                         |
| `chromaFromSpectrum` (limpio) | 0,006 ms   | 10 Hz    | 0,06 ms                        |
| `chromaFromSpectrum` (sucio)  | 0,015 ms   | 10 Hz    | 0,15 ms                        |
| `bestChord`                   | 0,041 ms   | 10 Hz    | 0,41 ms                        |
| **Total**                     |            |          | **16,2 ms/s — 1,6 % del hilo** |

**El segundo motor no duplicó nada.** Era la sospecha razonable al añadirlo, y
es falsa: el análisis de acordes cuesta 0,5 ms por segundo contra los 15,7 del
tono, unas treinta veces menos. Trabaja sobre un espectro que el navegador ya ha
calculado en su propio hilo, mientras que la autocorrelación hace sus 1,2
millones de multiplicaciones aquí. El 97 % del coste es `detectPitch`, y quien
quiera optimizar algo tiene que mirar ahí y en ningún otro sitio.

La peor ráfaga —los dos análisis cayendo en el mismo instante— son 0,84 ms, un
5 % de un fotograma de 16,7 ms.

**Qué no dice esta medida.** Está tomada en Node sobre V8, en un Ryzen 7 5800X
de sobremesa. No es un navegador ni es un móvil. El cálculo es JavaScript puro y
el orden de magnitud debería viajar bien, pero un teléfono de gama media anda
entre cinco y diez veces por detrás: ahí serían 80–160 ms por segundo, hasta un
16 % del hilo, con ráfagas de medio fotograma. Sigue sin ser un problema, y sí
es el punto donde volver a medir en el aparato de verdad antes de tocar nada.

**Conclusión.** No se mueve a un `Web Worker`. La alternativa sigue descrita
arriba como primera opción para cuando haga falta, pero hoy no hace falta: se
estaría pagando un salto asíncrono y un ciclo de vida más complicado por
recuperar el 1,6 % de un hilo.
