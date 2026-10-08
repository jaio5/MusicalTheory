# Caos ordenado — guía para trabajar aquí

Aplicación web para **aprender música y componer con ayuda**: escucha lo que tocas
por el micro, te enseña la teoría por unidades y te propone por dónde puede seguir
lo que llevas. Next.js 16 + React 19 + TypeScript, Tailwind v4, Zustand, Vitest.
Cuentas con Auth.js y Postgres (Drizzle), opcionales. Node 22+ y pnpm.

Hoy corre en un equipo y la usa una persona; **se publicará y se cobrará**, y eso
vive aparte en `docs/PARA-PUBLICAR.md`. **Este fichero es el mapa, no la
documentación**: el porqué está en `docs/`, en los ADR y en los comentarios.

**Lo que sabes de Next.js es de una versión anterior.** La que vale es la que
trae el paquete, en `node_modules/next/dist/docs/`, y lo recuerda @AGENTS.md. Ese
bloque va en inglés y **no se toca**: lo reescribe `next dev`, y si falta lo pega
al final de este fichero.

## Antes de dar nada por terminado

Los seis tienen que pasar. Corren solos en cada empujón
(`.github/workflows/ci.yml`).

```bash
pnpm test         # vitest
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint, incluidas las reglas de capas
pnpm format:check # prettier
pnpm coverage     # vitest con cobertura: el tope está en el 100 %
pnpm build        # build de producción
```

**La cobertura está en el cien por cien y el tope lo exige**: bajar de ahí es que
falta una prueba o falta explicar la rama con `v8 ignore` **y su razón**
(`docs/ESTILO.md`). `pnpm dev` levanta en http://localhost:3000 y no necesita base
de datos ni claves. Las cuentas piden Postgres y lo da Docker (`pnpm docker:up`);
**para verlo funcionando**, el skill `.claude/skills/arrancar/`. Todo lo de Docker,
el `.env` y los puertos: [docs/TRAMPAS.md](docs/TRAMPAS.md).

## Lo que muerde si no lo sabes

Una línea cada una; el porqué, las demás trampas y los enlaces, en [docs/TRAMPAS.md](docs/TRAMPAS.md).

- **Tras tocar un `.md`, `pnpm format`.** **Un ejemplo de clase en un comentario es una clase de verdad**: lo caza `pnpm build` (`docs/ESTILO.md`).
- **Lo que se abre sobre algo que crece flota** (`ui/Disclosure`); desde una fila que se desplaza es un `popover` (`adr/0065`). **Los cortes de la navegación son `barra-arriba` y `ventana-baja`** y los vigila un test (`adr/0122`).
- **El texto corrido va al cuerpo, sin `text-sm`** (`adr/0122`). **Dieciséis colores y ninguno más**; `@layer components` no admite `hover:` (`adr/0070`). **Un `data-tour` lo busca algún paso** (`adr/0108`).
- **Un `loading` de Next en `(marco)` convierte los 404 en 200**, y la cuenta la lee el layout de `(marco)` (`adr/0120`). **Tocando va en diferido y el lienzo no** (`adr/0058`).
- **Las pestañas se avisan por `BroadcastChannel`** (`adr/0118`). **Lo que mide reloj va en `*.reloj.test.ts`** (`adr/0121`).
- **El micrófono es uno** (`state/use-listening.ts`, `adr/0079`). **`docker compose up -d` no reconstruye** y `down` no para un perfil: `pnpm docker:up` y `pnpm docker:down`. Todo escucha en `127.0.0.1` y la aplicación entra como `caos_app` (`adr/0055`, `adr/0117`).
- **Un modelo nuevo va a `MODEL_PRICES`** antes de ponerlo en `ANTHROPIC_MODEL` (`adr/0103`). **`planOf` traduce los nombres viejos** (`adr/0104`); **las variables de Stripe van juntas** (`adr/0105`).
- **Aprender no pide tonalidad**; la escala se lee con `selectEscala` (`adr/0109`). **El bajo solo desempata acordes con las mismas notas** (`adr/0107`). **Los exámenes de la IA solo van a la API con `--api`** (`adr/0112`).
- **Sin cuenta solo cuenta la vuelta quien dice que sí**, borrar la cuenta llama a `olvidarCuenta` y sin `TITULAR_*` no se abre al público (`adr/0110`, `adr/0111`).
- **El techo `IA_TOPE_*_USD` cierra la IA también a quien paga** (`adr/0114`). **El SDK va con `maxRetries: 0`** y una ruta que llame al modelo pasa por `responderConModelo`. **El tope por minuto es por cuenta; el de dirección existe con `TRUSTED_PROXY_HOPS`.**
- **La marca del prompt no se escribe a mano**, un tope de texto libre se cuenta con `tokensEnElPeorCaso`, y una regex sobre texto ajeno se recorta antes (`adr/0115`). Una clave de tope no lleva nada de fuera en claro (`adr/0113`, `adr/0116`).
- **Un barril de pantallas las lleva todas al paquete de todas** (`adr/0045`). **`@core/music` hace `export *` de `salidas`**, cuyo índice nombra cada export; **`ui/` tiene tres piezas conectadas** y ESLint cierra el resto (`adr/0124`). Y `song.ts` solo importa tipos de `arrangement.ts`.

## Las capas y quién importa a quién

```
app/ → features/ → state/ → audio/ ↘
     ↘           → ui/              core/
      server/    → media/ ──────────↗
```

Cinco reglas, todas menos la cuarta vigiladas por ESLint:

1. **`core/` es TypeScript puro.** Si un test de `core/` necesita un `window`, la
   pieza está mal colocada.
2. **Un `feature` no importa de otro.** Lo compartido sube a `core/`, `ui/` o
   `state/`.
3. **`audio/` y `media/` exponen interfaces**: nada de `AudioContext` suelto en un
   componente.
4. **El audio no sale del dispositivo.** A la IA viajan símbolos y el texto libre que
   escribes (hasta 240 caracteres); a la base, correo, nombre, identificadores,
   números, fechas y nombres de sección.
5. **`src/server/` solo lo abre `app/`**, y no importa del navegador.

Alias: `@core/*`, `@audio/*`, `@media/*`, `@server/*`, `@state/*`, `@features/*`,
`@ui/*`, `@/*`. Las capas de arriba importan de `@core/music` y `@core/billing`
—los índices—, no de los ficheros sueltos.

## Dónde está cada cosa

La tabla completa —cuentas, topes, analítica, titular, arranque, la marca— está en
[docs/ENCONTRAR-UN-FICHERO.md](docs/ENCONTRAR-UN-FICHERO.md); esto es lo que más se busca.

| Busco...                                      | Está en                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Teoría musical, y qué acorde proponer         | `src/core/music/`, `suggestions.ts`, `progressions.ts`                                  |
| Las salidas: motor, pantalla y ruta           | `core/music/salidas/` (`salidasPosibles`), `features/salidas/`, `app/api/salidas`       |
| Detección de tono y de acordes                | `audio/autocorrelation.ts`, `chroma.ts` (`leerEspectro`, 0107)                          |
| Medir el motor con grabaciones; leer un WAV   | `scripts/medir-tomas.ts`, `core/music/medir-tomas.ts`, `core/wav.ts`                    |
| La canción: bloques, partes, lienzo           | `core/music/arrangement.ts`, `song.ts`, `features/arrange/`, `arrange/cabezal.ts`       |
| Lo que /componer pide al abrir, y lo diferido | `app/screens/componer/diferidos.tsx` (0058)                                             |
| Decir que la canción vive en este navegador   | `features/songs/EnEsteNavegador.tsx` (0118)                                             |
| La escala de una tonalidad, y cómo se lee     | `state/workspace.ts` (`escalaDeLaTonalidad`), `state/session-store.ts` (`selectEscala`) |
| El recorrido de la primera visita             | `features/tour/` (`tramos.ts`, `seguir.ts`), `state/recorrido.ts`                       |
| Retomar una unidad; saber si hay red          | `learn/sitio-en-la-unidad.ts` (0123), `learn/use-en-linea.ts`                           |
| Por qué no abre el micro; cifras con coma     | `core/error-del-micro.ts`, `core/cifras.ts`                                             |
| La cejilla de una forma de acorde             | `core/instrument/voicings.ts` (`cejillaDe`)                                             |
| Una dirección que no existe                   | `app/LaDireccionNoExiste.tsx`, `app/(marco)/not-found.tsx`                              |
| La IA: rutas, llamada al modelo, qué cuesta   | `server/ai-route.ts`, `ask-model.ts`, `core/billing/cost.ts`                            |
| Planes, cupos, ingreso neto, pago anual       | `src/core/billing/` (`cost.ts`: `netoDeUnCobroMicros`), 0105/0106                       |
| Cuentas, la edad para crearlas                | `src/server/`, `users.ts` (`createUser`), `account/AccessForm`                          |

**`/componer` es un banco de trabajo de áreas** con tres espacios, tres maneras de
escribir la misma canción: `Tocando`, `Escribir` y `Ensayar`. **Se entra por
`Escribir` con solo la canción abierta**
([adr/0109](docs/adr/0109-lo-que-se-da-por-hecho-al-empezar.md)). Las demás rutas:
`/aprender` (solo el camino), `/aprender/[unidad]`, `/aprender/repaso`, `/profesor`,
`/afinar`, `/planes` con `/planes/[plan]`, `/registro`, `/cuenta`, `/olvidada`,
`/privacidad`, `/aviso-legal` y la portada `/`. Las páginas viven en `src/app/(marco)/`, menos la
portada. Hay **dos planes de pago, Básico y Medio, con pago anual**.

## La documentación, y qué contesta cada fichero

Leer el que toque antes de tocar código de esa zona. **Son la fuente del porqué.**

| Fichero                        | Contesta                                                              |
| ------------------------------ | --------------------------------------------------------------------- |
| `docs/ESTILO.md`               | Cómo se escribe: idioma, comentarios, interfaz, temas, tests          |
| `docs/ENCONTRAR-UN-FICHERO.md` | Cómo está ordenado el código y la tabla completa «busco X»            |
| `docs/TRAMPAS.md`              | Lo que solo se descubre tropezando, con su porqué y sus enlaces       |
| `docs/ARCHITECTURE.md`         | Capas, qué importa qué, notas para quien viene de Angular             |
| `docs/DOMAIN-MUSIC.md`         | La teoría que implementa el código, en lenguaje de músico             |
| `docs/AUDIO-PITCH.md`          | Cómo se detecta el tono y el acorde, y qué limitaciones tienen        |
| `docs/RECORDING.md`            | Permisos, formatos, descarga local del sonido                         |
| `docs/AI.md`                   | Contrato de los route handlers y las puertas del gasto                |
| `docs/CUENTAS-Y-PLANES.md`     | Qué da cada plan, qué cuesta la IA y qué se guarda de ti              |
| `docs/MEDIR.md`                | Medir el motor con guitarras reales y la IA contra la API             |
| `docs/VALIDAR.md`              | Validar con personas: sesiones, entrevistas, umbrales, cuándo parar   |
| `docs/ROADMAP.md`              | **Lo que falta**, ordenado por lo que estorba a diario                |
| `docs/PARA-PUBLICAR.md`        | **Lo que hará falta al publicar y cobrar**, y lo escrito sin ejecutar |
| `docs/HISTORIA.md`             | Las fases hechas, una línea cada una, y los fallos que enseñaron      |
| `docs/DESPLIEGUE.md`           | Qué hace falta para publicar y qué se rompe según dónde               |
| `docs/adr/`                    | Decisiones con sus alternativas descartadas. Van ciento veinticinco   |

Tres reglas: **toda decisión con alternativas reales se escribe como ADR** con sus
descartadas; **cuando cambies comportamiento, actualiza el documento que lo
describía**; y **los documentos hablan en presente y solo de lo que se puede
comprobar**, que lo no ejecutado vive en `PARA-PUBLICAR.md` diciéndolo. Todo en
español; los comentarios explican **por qué**. Commits: `tipo(ámbito): frase en
minúscula y sin tildes`, contando el efecto: `fix(mastil): se ve entero al abrirlo`.

## Lo que este proyecto no hace

Cada una, con su porqué, en [docs/TRAMPAS.md](docs/TRAMPAS.md).

- **No sube audio** (con cuenta sí sube el avance y las canciones, sin sonido)
  **ni graba vídeo** ([adr/0023](docs/adr/0023-grabar-solo-el-sonido.md)).
- **No cobra todavía**, ni pide una tarjeta. **No esconde el texto del Grado Profesional**: viaja en el JS; se cobra el camino y la IA (`adr/0116`).
- **No tiene vidas ni corazones, ni examina a nadie** para colocarle de nivel.
- **No exige cuentas**, **no las crea a menores de 14** ni **manda correos sin configurarlo**.
- **No usa analítica de terceros ni cookies de seguimiento** ([adr/0110](docs/adr/0110-contar-sin-seguir.md)).
- **No detecta la tonalidad rasgueando**: el motor de tono es monofónico.
- **No acierta siempre con los acordes**: una nota sola sale como su quinta (`C5`), y
  el acierto solo está medido con guitarra sintética
  ([adr/0107](docs/adr/0107-los-armonicos-se-miden-en-su-serie.md)).
