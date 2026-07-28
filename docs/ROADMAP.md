# Roadmap

Estado a 28 de julio de 2026.

## Fase 0 — Esqueleto y dominio · hecha

- [x] Configuración: `package.json`, `tsconfig.json` con paths absolutos,
      Tailwind, ESLint, Prettier, Vitest, `.env.example`, `.gitignore`.
- [x] `core/music/notes.ts`: frecuencia, MIDI, clase de altura, nombre y cents.
- [x] `core/music/scales.ts`: nueve escalas.
- [x] `core/music/chords.ts`: tríadas diatónicas con cifrado y grado romano.
- [x] `core/music/keys.ts`: detección de tonalidad con perfiles de Krumhansl,
      tres candidatas con puntuación e histograma que decae.
- [x] `core/music/progressions.ts`: caminos entre grados con criterio de rock y
      catálogo de progresiones.
- [x] Tests del dominio.
- [x] Interfaces declaradas sin implementar: `AudioInput`, `PitchEngine`,
      `CameraInput`, `SessionRecorder`.
- [x] Tokens de diseño en `ui/tokens.ts`.
- [x] Documentación y dos ADR.
- [ ] `reference/prototype.jsx`: el prototipo no estaba disponible al arrancar.

## Fase 1 — Motor de tono y afinador · hecha

- [x] `detectPitch`: autocorrelación normalizada con interpolación parabólica,
      probada contra tonos sintéticos de las seis cuerdas al aire con menos de
      un cent de error.
- [x] `WebAudioInput`: `getUserMedia` con `echoCancellation`,
      `noiseSuppression` y `autoGainControl` desactivados, y los errores del
      navegador traducidos a frases que dicen qué ha pasado y qué hacer.
- [x] `AutocorrelationPitchEngine`: bucle a 20 análisis por segundo, con margen
      de silencio para que el hueco entre dos púas no apague la nota.
- [x] Store de sesión en `state/`, sin conocer la capa de audio.
- [x] Afinador: nota grande, cents, aguja, cuerda más cercana y aviso cuando la
      señal no llega limpia.
- [x] Estado «no se oye nada» explícito, en vez de congelar la última nota.
- [x] Umbrales de enganche y de seguimiento separados, tras probar con guitarra
      real: con un solo umbral la nota se perdía a los pocos instantes.
- [ ] Pendiente de más rodaje: los valores actuales salen de una sola prueba y
      de señales sintéticas.

El análisis se quedó en el hilo principal en vez de ir a un `AudioWorklet`;
el porqué está en [adr/0003](./adr/0003-analisis-en-el-hilo-principal.md).

## Fase 2 — Rueda de quintas y mástil · hecha

- [x] `core/instrument/guitar.ts`: la afinación y los trastes suben a core,
      porque los usan el afinador y el mástil y un feature no importa de otro.
- [x] `core/music/circle-of-fifths.ts`: orden de la rueda, relativas, ángulos y
      el giro por el camino corto.
- [x] El store acumula lo tocado en el histograma y recalcula la tonalidad dos
      veces por segundo, no veinte.
- [x] Rueda de quintas que gira con GSAP hasta poner arriba la tonalidad, con
      `prefers-reduced-motion` respetado desde `ui/motion.ts`.
- [x] Las tres candidatas con su puntuación, y la posibilidad de fijar una
      tonalidad a mano o volver a la detección.
- [x] Mástil de quince trastes con la escala elegida, tónicas destacadas y la
      nota que suena encendida.
- [ ] Pendiente de prueba tocando: cuánto tarda la detección en asentarse y si
      la vida media de veinte segundos es la buena.

Las etiquetas de la rueda giran con ella, como en el aparato de cartón: la que
queda arriba se lee derecha y las demás quedan inclinadas.

## Fase 3 — Modo aprender

- La escala subiendo y bajando, nota a nota, sobre el mástil.
- Validación por detección: el ejercicio avanza cuando la nota suena limpia el
  tiempo suficiente, no en el primer análisis.
- Nota de referencia sintetizada con un oscilador, para comparar de oído.

**Terminada cuando**: se puede practicar una escala completa sin tocar el ratón.

## Fase 4 — Modo componer

- Acordes diatónicos de la tonalidad detectada.
- Caminos habituales desde el acorde actual, ordenados por frecuencia de uso.
- Historial de notas tocadas, que alimenta el histograma de tonalidad.

**Terminada cuando**: se puede improvisar y ver en pantalla en qué tono se está
y a dónde se puede ir.

## Fase 5 — Ideas de IA

Route handler `/api/ideas` según [AI.md](./AI.md): validación de entrada,
salida estructurada, validación de la respuesta contra el dominio, un reintento
y errores en español.

**Terminada cuando**: pedir «un giro para romper el bucle» devuelve una
progresión que la app puede resolver a acordes reales.

## Fase 6 — Grabación con cámara

Composición en canvas y `MediaRecorder` según [RECORDING.md](./RECORDING.md).
Overlay con nota, tonalidad y acorde quemados. Descarga local.

**Terminada cuando**: se puede grabar una toma de tres minutos y descargarla con
los datos visibles.

## Fase 7 — Persistencia local de sesiones

Guardar sesiones en IndexedDB: tonalidades detectadas, progresiones probadas,
ideas guardadas. Sin cuenta y sin servidor.

**Terminada cuando**: al volver a abrir la app aparece lo último en lo que se
estaba trabajando.

## Deuda técnica anotada

- **Escritura con bemoles.** Todo se escribe con sostenidos. En Fa mayor debería
  poner Bb, no A#. Afecta a la presentación, no al cálculo.
- **Cuatríadas y tensiones.** El dominio solo hace tríadas. El modo componer las
  va a pedir.
- **Tokens duplicados.** `ui/tokens.ts` y `app/globals.css` tienen los mismos
  valores escritos dos veces. Si crece la paleta, generar el CSS desde el TS.
- **Reconocimiento de acordes.** La detección es monofónica. Un acorde rasgueado
  no se identifica; el modo componer trabaja con el histórico de notas sueltas.
- **Umbrales con poco rodaje.** Los cuatro umbrales se ajustaron tras la primera
  prueba con guitarra. Faltan más equipos, más salas y más pastillas.
- **Sin medidor de nivel.** No hay forma de ver en pantalla cuánta señal llega,
  que es justo lo que haría falta para ajustar los umbrales sin adivinar.
- **La rueda no se puede pulsar.** Fijar una tonalidad se hace con el
  desplegable, que es lo accesible; pulsar en la rueda es lo que la gente va a
  intentar. Hacerlo bien son doce elementos con rol de botón y su teclado.
- **Trastes igual de anchos.** En una guitarra se estrechan hacia el puente. Es
  a propósito, porque el diagrama se lee mejor, pero no es el mástil real.
- **Análisis en el hilo principal.** Puede empezar a notarse cuando la fase 2
  anime la rueda y el mástil. La salida prevista es un Web Worker.
- **Sin selector de dispositivo.** `WebAudioInput` acepta un `deviceId` pero la
  interfaz todavía no deja elegir entrada: usa la que tenga el sistema por
  defecto.
