# Caos ordenado

Aplicación web que escucha la guitarra por el micro y ordena la teoría mientras
tocas. Tres pantallas, cada una para una cosa:

- **Aprender** — teoría a base de preguntas, escritas en la tonalidad en la que
  estés, con un profesor al que preguntarle lo que sea y la escala para tocarla
  de verdad, validada por el micro.
- **Componer** — eliges tonalidad en la rueda, encadenas acordes y ves de cuántas
  maneras se hacen a lo largo del mástil y a dónde puedes ir desde ahí.
  Reconoce el acorde que estás tocando, lleva metrónomo y te graba con la cámara
  detrás de la interfaz.
- **Afinar** — ocho afinaciones, de la estándar al open D, y nada más en
  pantalla.

La portada cuenta qué es y trae el afinador de verdad para probarlo sin entrar.

## Cómo arrancarlo

Requiere Node 22 o superior y pnpm.

```bash
pnpm install
cp .env.example .env.local   # solo para la IA: el profesor y las ideas
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

Los cinco corren solos en cada empujón: [.github/workflows/ci.yml](./.github/workflows/ci.yml).

## Cómo publicarlo

Hace falta un servidor de Node —hay dos rutas de servidor para que la clave de
Anthropic no llegue nunca al navegador— y HTTPS, o no hay permiso de micrófono.
Los tres caminos, con sus comandos, en
[docs/DESPLIEGUE.md](./docs/DESPLIEGUE.md).

## Aviso: hace falta señal limpia

La detección de tono es **monofónica** y necesita señal sin distorsión.

- Una sola nota cada vez. Un acorde rasgueado no lo identifica el afinador: la
  autocorrelación devuelve un periodo, no varios. Para acordes hay otro análisis
  —espectro y plantillas— y solo en componer; acierta con tríadas y séptimas
  sostenidas en limpio y duda con inversiones.
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
- [AI.md](./docs/AI.md) — contrato de los route handlers de ideas y profesor.
- [DESPLIEGUE.md](./docs/DESPLIEGUE.md) — qué hace falta para publicarlo y qué
  se rompe según dónde.
- [ROADMAP.md](./docs/ROADMAP.md) — fases y deuda anotada.
- [adr/](./docs/adr/) — decisiones con sus alternativas descartadas.
