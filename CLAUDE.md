# Caos ordenado — guía para trabajar aquí

Aplicación web que escucha la guitarra por el micro y ordena la teoría mientras
tocas. Next.js 16 + React 19 + TypeScript, Tailwind v4, Zustand, Vitest.
Cuentas con Auth.js y Postgres (Drizzle), opcionales. Node 22+ y pnpm.

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

`pnpm dev` levanta en http://localhost:3000, y ninguno de los cinco necesita base
de datos ni claves. Si tocas `src/server/db/schema.ts`: `pnpm db:generate` escribe
la migración y `pnpm db:migrate` la aplica; no se aplican solas al arrancar.

**Prettier también formatea el markdown.** Después de tocar cualquier `.md` hay
que pasar `pnpm format`, o `format:check` falla. Es el fallo más tonto y el más
repetido.

## Las capas y quién importa a quién

```
app/ → features/ → state/ → audio/ ↘
     ↘           → ui/              core/
      server/    → media/ ──────────↗
```

Cinco reglas, todas menos la cuarta vigiladas por ESLint:

1. **`core/` es TypeScript puro**, dominio musical y planes. Si un test de `core/`
   necesita un `window`, la pieza está mal colocada.
2. **Un `feature` no importa de otro `feature`.** Lo compartido sube a `core/`,
   `ui/` o `state/`.
3. **`audio/` y `media/` exponen interfaces que `features/` consume.** Nada de
   `AudioContext` suelto dentro de un componente.
4. **El audio y el vídeo no salen del dispositivo.** A la IA solo viajan símbolos;
   a la base de datos, identificadores de unidad, números y fechas.
5. **`src/server/` solo lo abre `app/`, y no importa del navegador.** Un import de
   `@server/` desde un componente se lleva Postgres y la cadena de conexión al
   bundle del cliente. Vigilado en los dos sentidos.

Alias: `@core/*`, `@audio/*`, `@media/*`, `@server/*`, `@state/*`, `@features/*`,
`@ui/*`, `@/*`. Las capas de arriba importan de `@core/music` y `@core/billing`
—los índices—, no de los ficheros sueltos.

Tres trampas al tocar esto: **`no-restricted-imports` no se acumula entre bloques de
ESLint** —el último gana, y por eso las reglas 2 y 5 van juntas—; **el layout raíz
lleva `dynamic = 'force-dynamic'`** porque sin eso un build hecho sin base de datos
prerenderiza la cuenta anónima dentro del HTML; y **`planOf` traduce los nombres
viejos de los planes** (`estudiante` → Básico, `conservatorio` → Pro), porque un
renombrado no puede degradar a quien había pagado.

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
| Planes, permisos y si una unidad la abre el plan    | `src/core/billing/` (`plans.ts`, `access.ts`)  |
| Meta diaria, racha, medallas, punto de partida      | `core/music/progress.ts`                       |
| La cola de repaso de lo fallado                     | `core/music/review.ts`                         |
| Tarjetas de plan y ventana de pago                  | `features/account/`, `src/app/planes/`         |
| El avatar de arriba y lo que cuelga de él           | `features/account/AccountMenu.tsx`             |
| Cuentas, contraseñas, base de datos y cupos         | `src/server/`                                  |
| Si alguien puede pedirle algo al modelo             | `server/entitlements.ts` + `ai-usage.ts`       |
| Por dónde se cobrará (hoy no se cobra)              | `src/server/billing/`                          |
| Tokens de diseño                                    | `src/ui/tokens.ts` (+ espejo en `globals.css`) |

`/aprender` es **solo el camino**, y cada cosa que se hace tiene su dirección:
`/aprender/[unidad]` y `/aprender/repaso`. Después `/profesor`, `/componer`,
`/afinar`, `/planes` con `/planes/[plan]` para pagar, `/registro` para crear la
cuenta, `/cuenta` con sus cuatro anclas —`#perfil`, `#suscripcion`, `#contrasena`
y `#privacidad`, que son las del desplegable del avatar— y la portada `/`.

## La documentación, y qué contesta cada fichero

Leer el que toque antes de tocar código de esa zona. **Son la fuente del porqué.**

| Fichero                    | Contesta                                                       |
| -------------------------- | -------------------------------------------------------------- |
| `docs/ARCHITECTURE.md`     | Capas, qué importa qué, notas para quien viene de Angular      |
| `docs/DOMAIN-MUSIC.md`     | La teoría que implementa el código, en lenguaje de músico      |
| `docs/AUDIO-PITCH.md`      | Cómo se detecta el tono y el acorde, y qué limitaciones tienen |
| `docs/RECORDING.md`        | Permisos, canvas, formatos, descarga local                     |
| `docs/AI.md`               | Contrato de los route handlers y las dos puertas del gasto     |
| `docs/CUENTAS-Y-PLANES.md` | Qué da cada plan, qué cuesta la IA y qué se guarda de ti       |
| `docs/DESPLIEGUE.md`       | Qué hace falta para publicar y qué se rompe según dónde        |
| `docs/ROADMAP.md`          | Fases hechas y deuda, viva y pagada                            |
| `docs/adr/`                | Decisiones con sus alternativas descartadas                    |

**Toda decisión con alternativas reales se escribe como ADR**, numerado y con sus
descartadas. Los siete: dominio puro, tono propio, análisis en el hilo principal,
acordes por croma, cuentas y fusión del avance, planes y cobro como puerto, y punto de
partida con una pantalla por cosa.

**Cuando cambies comportamiento, actualiza el documento que lo describía.** El
ROADMAP llegó a afirmar que el reconocimiento de acordes era imposible cuando
llevaba dos commits implementado, y AUDIO-PITCH se contradecía a sí mismo treinta
líneas más abajo.

## Cómo se escribe aquí

- **Todo en español**: código comentado, tests, documentación y commits.
- Los comentarios explican **por qué**, no qué. Lee un fichero vecino antes de
  escribir uno nuevo: el repositorio es consistente en esto.
- Notas en cifrado anglosajón —C, D, E—, y cada tonalidad decide sostenidos o
  bemoles según su sitio en la rueda.
- Commits: `tipo(ámbito): frase en minúscula y sin tildes`, contando el efecto que
  se nota. Ejemplo real: `fix(mastil): se ve entero al abrirlo, sin arrastrar nada`.
- Interfaz para leerse **a un metro y con las dos manos ocupadas**: nada por debajo
  de 12 px, diagramas grandes, y el significado de un color al lado del color.

## Detalles de los tests

- Vitest corre en **entorno `node` por defecto**. Un test que necesite DOM lleva
  `// @vitest-environment jsdom` en la primera línea.
- `include` es `src/**/*.test.ts(x)`: los tests viven al lado del código.
- `src/audio/main-thread-cost.test.ts` es un guardián de rendimiento con topes
  holgados a propósito. Si falla, es una regresión algorítmica, no ruido.
- Nada toca Postgres: lo que se prueba de las cuentas es lo puro —planes, permisos,
  fusión de avances, cola de repaso, cifrado—. El camino con base de datos de verdad
  **está sin probar**, y está dicho en el ROADMAP.

## Lo que este proyecto no hace

- **No sube audio ni vídeo.** Ni una línea de código de subida, y no la habrá sin un
  ADR. Con cuenta sí sube el avance: identificadores, números y fechas.
- **No cobra.** Los planes funcionan y el cobrador de hoy los cambia sin cobrar, a
  propósito y con su ADR. Cualquiera con cuenta puede darse el plan más alto.
- **No tiene vidas ni corazones**, aunque lo de aprender imite a Duolingo en lo
  demás: fallar no bloquea, se explica y se sigue.
- **No pide una tarjeta.** La ventana de pago enseña plan, precio y un aviso de que
  no se cobra; unos campos de tarjeta que no van a ninguna pasarela serían un
  decorado que se parece demasiado a un cobro de verdad.
- **No examina a nadie para colocarle de nivel.** El curso de partida se elige en un
  desplegable, y elegirlo no da por hechas las unidades anteriores
  ([adr/0007](docs/adr/0007-elegir-por-donde-empezar.md)).
- **No exige cuentas.** Sin `DATABASE_URL` y `AUTH_SECRET` —las dos— nadie entra,
  todo el mundo es anónimo con plan gratis y el avance se queda en su navegador.
- **No manda correos**, así que no hay «he olvidado mi contraseña» ni cambio de
  dirección: las dos cosas piden escribir a un buzón para confirmarlo. La
  contraseña se cambia sabiéndola, en `/cuenta#contrasena`.
- La detección de tono es **monofónica** y pide señal limpia: con distorsión se
  detecta la octava de arriba. Para acordes hay otro análisis, y solo en
  componer.
- El reconocimiento de acordes duda con inversiones: el croma olvida la octava,
  así que C/E y C son el mismo vector.
