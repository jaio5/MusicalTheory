# Caos ordenado — guía para trabajar aquí

Aplicación web que escucha la guitarra por el micro y ordena la teoría mientras
tocas. Next.js 16 + React 19 + TypeScript, Tailwind v4, Zustand, Vitest.
Node 22+ y pnpm.

**Este fichero es el mapa, no la documentación.** El porqué de cada cosa ya está
escrito en `docs/`; aquí solo está lo que hace falta para no tener que buscarlo.

## Antes de dar nada por terminado

Los cinco tienen que pasar. Corren solos en cada empujón
(`.github/workflows/ci.yml`).

```bash
pnpm test         # vitest
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint, incluidas las reglas de capas
pnpm format:check # prettier
pnpm build        # build de producción
```

`pnpm dev` levanta en http://localhost:3000.

**Prettier también formatea el markdown.** Después de tocar cualquier `.md` hay
que pasar `pnpm format`, o `format:check` falla. Es el fallo más tonto y el más
repetido.

## Las capas y quién importa a quién

```
app/ → features/ → state/ → audio/ ↘
                 → ui/              core/
                 → media/ ──────────↗
```

Cuatro reglas, las dos primeras vigiladas por ESLint:

1. **`core/` es TypeScript puro.** No importa de otras capas ni conoce el
   navegador. Si un test de `core/` necesita un `window`, la pieza está mal
   colocada.
2. **Un `feature` no importa de otro `feature`.** Lo compartido sube a `core/`,
   `ui/` o `state/`.
3. **`audio/` y `media/` exponen interfaces que `features/` consume.** Nada de
   `AudioContext` suelto dentro de un componente.
4. **El audio y el vídeo no salen del dispositivo.** A la IA solo viajan
   símbolos: tonalidad, escala, nombres de notas, grado.

Alias: `@core/*`, `@audio/*`, `@media/*`, `@state/*`, `@features/*`, `@ui/*`,
`@/*`. Las capas de arriba importan de `@core/music` (el índice), no de los
ficheros sueltos.

## Dónde está cada cosa

| Busco...                                            | Está en                                        |
| --------------------------------------------------- | ---------------------------------------------- |
| Teoría musical: escalas, acordes, grados, tonalidad | `src/core/music/`                              |
| Funciones armónicas y sustitución (T/S/D)           | `core/music/harmonic-function.ts`              |
| Qué acorde proponer y en qué orden                  | `core/music/suggestions.ts` + `styles.ts`      |
| Detección de tono (autocorrelación)                 | `src/audio/autocorrelation.ts`                 |
| Detección de acordes (croma + plantillas)           | `audio/chroma.ts`, `audio/chord-engine.ts`     |
| Mástil, afinaciones, formas de acorde               | `src/core/instrument/`                         |
| Estado de sesión y persistencia                     | `src/state/` (IndexedDB)                       |
| Grabación con cámara                                | `src/media/`                                   |
| Rutas de servidor de la IA                          | `src/app/api/ideas`, `src/app/api/teacher`     |
| Tokens de diseño                                    | `src/ui/tokens.ts` (+ espejo en `globals.css`) |

Las tres pantallas son `/aprender`, `/componer` y `/afinar`, más la portada `/`.

## La documentación, y qué contesta cada fichero

Leer el que toque antes de tocar código de esa zona. **No están de adorno: son
la fuente del porqué.**

| Fichero                | Contesta                                                       |
| ---------------------- | -------------------------------------------------------------- |
| `docs/ARCHITECTURE.md` | Capas, qué importa qué, notas para quien viene de Angular      |
| `docs/DOMAIN-MUSIC.md` | La teoría que implementa el código, en lenguaje de músico      |
| `docs/AUDIO-PITCH.md`  | Cómo se detecta el tono y el acorde, y qué limitaciones tienen |
| `docs/RECORDING.md`    | Permisos, canvas, formatos, descarga local                     |
| `docs/AI.md`           | Contrato de los route handlers                                 |
| `docs/DESPLIEGUE.md`   | Qué hace falta para publicar y qué se rompe según dónde        |
| `docs/ROADMAP.md`      | Fases hechas y deuda, viva y pagada                            |
| `docs/adr/`            | Decisiones con sus alternativas descartadas                    |

**Toda decisión con alternativas reales se escribe como ADR**, numerado y con la
sección de descartadas. Los cuatro que hay: dominio puro (0001), detección de
tono propia (0002), análisis en el hilo principal (0003) y reconocimiento de
acordes por croma (0004).

**Cuando cambies comportamiento, actualiza el documento que lo describía.** El
ROADMAP llegó a afirmar que el reconocimiento de acordes era imposible cuando
llevaba dos commits implementado, y AUDIO-PITCH se contradecía a sí mismo treinta
líneas más abajo.

## Cómo se escribe aquí

- **Todo en español**: código comentado, tests, documentación y commits.
- Los comentarios explican **por qué**, no qué. El repositorio es consistente en
  esto; conviene leer un fichero vecino antes de escribir uno nuevo.
- Las notas se escriben en cifrado anglosajón —C, D, E— en toda la aplicación, y
  cada tonalidad decide si usa sostenidos o bemoles según su sitio en la rueda.
- Commits: `tipo(ámbito): frase en minúscula y sin tildes`, contando el efecto
  que se nota, no el fichero que se tocó. Ejemplo real:
  `fix(mastil): se ve entero al abrirlo, sin arrastrar nada`.
- Interfaz pensada para leerse **a un metro y con las dos manos ocupadas**: nada
  por debajo de 12 px, diagramas grandes, y el significado de un color o una
  letra siempre al lado del color o la letra.

## Detalles de los tests

- Vitest corre en **entorno `node` por defecto**. Un test que necesite DOM lleva
  `// @vitest-environment jsdom` en la primera línea.
- `include` es `src/**/*.test.ts(x)`: los tests viven al lado del código.
- `src/audio/main-thread-cost.test.ts` es un guardián de rendimiento con topes
  holgados a propósito. Si falla, es una regresión algorítmica, no ruido.

## Lo que este proyecto no hace

- **No sube nada a ningún servidor.** Ni audio, ni vídeo. No hay una línea de
  código de subida y no la habrá sin un ADR.
- La detección de tono es **monofónica** y pide señal limpia: con distorsión se
  detecta la octava de arriba. Para acordes hay otro análisis, y solo en
  componer.
- El reconocimiento de acordes duda con inversiones: el croma olvida la octava,
  así que C/E y C son el mismo vector.
