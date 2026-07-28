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

## Fase 1 — Motor de tono y afinador

Implementar `AudioWorkletPitchEngine` y `WebAudioInput` según
[AUDIO-PITCH.md](./AUDIO-PITCH.md), y encima el afinador: nota grande,
desviación en cents, indicación de si hay que subir o bajar.

- Autocorrelación con interpolación parabólica, ventana de 2048 muestras.
- `getUserMedia` con `echoCancellation`, `noiseSuppression` y `autoGainControl`
  desactivados, y la frase que explica para qué se pide el micro.
- Store de sesión mínimo en `state/`: nota actual, cents, estado de la entrada.
- Estado «no se oye nada» explícito, en vez de congelar la última nota.

**Terminada cuando**: se puede afinar la guitarra entera sin mirar otra app, y
la lectura es estable con la guitarra en limpio.

## Fase 2 — Rueda de quintas y mástil

- Rueda de quintas que gira hasta poner arriba la tonalidad detectada. GSAP para
  el giro, con `prefers-reduced-motion` respetado: sin movimiento, salto directo.
- Mástil de quince trastes con la escala elegida marcada, tónicas destacadas.
- La nota que suena se ilumina en el mástil.

**Terminada cuando**: al tocar unos compases la rueda gira sola al tono correcto
y el mástil muestra la escala en esa tonalidad.

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
