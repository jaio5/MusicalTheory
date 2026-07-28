# Caos ordenado

Aplicación web que escucha la guitarra por el micro y acompaña al que toca en
dos modos:

- **Aprender** — afinador, escalas sobre el mástil y ejercicios que se validan
  solos cuando la nota suena limpia.
- **Componer** — detecta la tonalidad de lo que estás tocando, muestra los
  acordes diatónicos, los caminos habituales desde el acorde actual y pide
  ideas a un modelo.

Encima de los dos modos hay una grabación opcional con cámara, con los datos
detectados quemados en el vídeo.

**Estado**: fase 1. Funciona el afinador: escucha por el micro, detecta la nota
y dice cuánto se desvía en cents. Lo siguiente son la rueda de quintas y el
mástil; el detalle está en [docs/ROADMAP.md](./docs/ROADMAP.md).

## Cómo arrancarlo

Requiere Node 20 o superior y pnpm.

```bash
pnpm install
cp .env.example .env.local   # solo hace falta para la fase 5, las ideas de IA
pnpm dev                     # http://localhost:3000
```

## Cómo pasar los tests

```bash
pnpm test        # una pasada
pnpm test:watch  # en watch
pnpm typecheck   # tipos
pnpm lint        # ESLint, incluidas las reglas de capas
pnpm build       # build de producción
```

## Aviso: hace falta señal limpia

La detección de tono es **monofónica** y necesita señal sin distorsión.

- Una sola nota cada vez. Un acorde rasgueado no se identifica: la
  autocorrelación devuelve un periodo, no varios.
- **Sin distorsión.** Un previo saturado genera armónicos que pueden superar a
  la fundamental, y entonces el analizador detecta la octava de arriba. Con
  Guitar Rig, usa el canal limpio antes de los pedales.
- Deja que la nota suene. El ataque de la púa tarda unos 30 ms en estabilizarse.

## Privacidad

El audio y el vídeo no salen del dispositivo. No hay subida a ningún servidor.
A la IA solo viajan símbolos: tonalidad, escala, nombres de notas y grado
actual. Ver [docs/AI.md](./docs/AI.md) y
[docs/RECORDING.md](./docs/RECORDING.md).

## Documentación

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — capas, qué importa qué y por qué,
  con notas para quien viene de Angular.
- [DOMAIN-MUSIC.md](./docs/DOMAIN-MUSIC.md) — la teoría que implementa el
  código, en lenguaje de músico.
- [AUDIO-PITCH.md](./docs/AUDIO-PITCH.md) — cómo se detecta el tono y qué
  limitaciones tiene.
- [RECORDING.md](./docs/RECORDING.md) — permisos, composición en canvas,
  formatos y descarga local.
- [AI.md](./docs/AI.md) — contrato del route handler.
- [ROADMAP.md](./docs/ROADMAP.md) — fases y deuda anotada.
- [adr/](./docs/adr/) — decisiones con sus alternativas descartadas.
