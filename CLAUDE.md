# Caos ordenado — guía para trabajar aquí

Aplicación web para **aprender música y componer con ayuda**: escucha lo que tocas
por el micro, te enseña la teoría por unidades y te propone por dónde puede seguir
lo que llevas. Next.js 16 + React 19 + TypeScript, Tailwind v4, Zustand, Vitest.
Cuentas con Auth.js y Postgres (Drizzle), opcionales. Node 22+ y pnpm.

Hoy corre en un equipo y la usa una persona; **se publicará y se cobrará**, y eso
vive aparte en `docs/PARA-PUBLICAR.md`. **Este fichero es el mapa, no la
documentación**: el porqué está en `docs/`, en los ADR y en los comentarios.

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

**Las cuentas piden base de datos, y la da Docker:** `pnpm docker:up` levanta todo,
`pnpm docker:db` solo Postgres para usarlo con `pnpm dev`, y `pnpm docker:ia` añade
un Ollama sin clave ni factura. Escribe el `.env` que falte; si el 3000 está
ocupado, `APP_PORT`. **Para verlo funcionando**, el skill
`.claude/skills/arrancar/`: navegador de verdad, micrófono falso y las trampas de
hacerlo.

## Lo que muerde si no lo sabes

- **Después de tocar cualquier `.md`, `pnpm format`**, o `format:check` falla. Es
  el fallo más tonto y el más repetido del repositorio.
- **Un ejemplo de clase escrito en un comentario es una clase de verdad**, y una
  mal formada tumba la hoja entera con todos los tests en verde
  (`docs/ESTILO.md`). Lo caza `pnpm build`: si tocas estilos, pásalo.
- **Una barra que se abre encima de algo que crece flota, no empuja**:
  `ui/Disclosure` con `flotante`, vigilado por `screens/coherencia`.
- **La navegación cambia de sitio en `md` (768), y hay dos sitios que lo saben**:
  `AppShell` —arriba o abajo— y el tope del panel flotante de `ui/Disclosure`, que
  descuenta la barra de abajo mientras exista. Si uno se mueve, el otro también:
  separados, la rueda se sale por abajo y nadie lo ve. **Ningún test lo vigila**;
  lo caza la sonda del skill `arrancar` a los dos lados de 640 y de 768.
- **El micrófono es uno, y lo sujeta `state/use-listening.ts`**, no el componente:
  quien monte otro botón de escuchar **no guarda la entrada**.
- **La monoespaciada es solo para lo que se alinea en columna** —notas, cents, XP,
  un correo—; lo demás en la sans, y el rótulo de un apartado es `.rotulo`
  ([adr/0024](docs/adr/0024-la-interfaz-se-lee-primero.md)). **Ningún test lo
  vigila.**
- **El grabado se mide en espacios de pentagrama**, y las invariantes de la clave
  las fija `arrange/clef.test.ts`
  ([adr/0029](docs/adr/0029-la-partitura-se-dibuja-aqui.md)).
- **Un montaje son grados, y los grados no se llaman igual en mayor que en menor**:
  `state/montaje-en-su-modo.ts` lo traduce en cuanto cambia la tonalidad, y sin eso
  componer se cae entera ([adr/0030](docs/adr/0030-cambiar-de-modo-traduce-la-cancion.md)).
- **La barra de tonalidad flota y se abre sola cuando no hay tonalidad**, así que
  **lo que pongas debajo no se ve**: un aviso que dijera «elígela en la rueda de
  aquí arriba» quedaba detrás de la rueda que lo tapaba. Ha mordido en la unidad y
  en componer estrecho. Lo que cabe ahí abajo es `ui/CuatroTonalidades`, y flotar
  no se toca: está peleado dos veces y lo vigila `screens/coherencia`.
- **Las burbujas de validación del navegador salen en su idioma**, no en el de la
  aplicación. Por eso `ui/Formulario` va con `noValidate` y lo que falta se dice
  con `ui/Aviso`. Un `<form>` escrito a mano vuelve a traerlas.

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
4. **El audio no sale del dispositivo.** A la IA solo viajan símbolos; a la base de
   datos, identificadores, números y fechas.
5. **`src/server/` solo lo abre `app/`**, y no importa del navegador: un `@server/`
   en un componente se lleva Postgres al bundle del cliente.

Alias: `@core/*`, `@audio/*`, `@media/*`, `@server/*`, `@state/*`, `@features/*`,
`@ui/*`, `@/*`. Las capas de arriba importan de `@core/music` y `@core/billing`
—los índices—, no de los ficheros sueltos.

Cuatro trampas, cada una explicada donde vive: **`song.ts` solo importa tipos de
`arrangement.ts`** —el ciclo revienta en el navegador y ningún test lo ve—;
**`no-restricted-imports` no se acumula entre bloques de ESLint**, gana el último;
**el layout raíz lleva `dynamic = 'force-dynamic'`**; y **`planOf` traduce los
nombres viejos de los planes**.

## Dónde está cada cosa

| Busco...                                                 | Está en                                                   |
| -------------------------------------------------------- | --------------------------------------------------------- |
| Teoría musical: escalas, acordes, grados, tonalidad      | `src/core/music/`                                         |
| Funciones armónicas y sustitución (T/S/D)                | `core/music/harmonic-function.ts`                         |
| Qué acorde proponer y en qué orden                       | `core/music/suggestions.ts` + `styles.ts`                 |
| Con qué se rearmoniza, y cómo se comprueba               | `core/music/reharmonization.ts`                           |
| Por dónde puede tirar lo que tocas, y qué lo valida      | `core/music/paths.ts`                                     |
| Lo que tocas, convertido en compases                     | `core/music/capture.ts`                                   |
| La armadura, y qué nota va en cada línea                 | `core/music/circle-of-fifths.ts`                          |
| El punteo: alturas, figuras y cómo se escribe cada nota  | `core/music/melody.ts`                                    |
| Detección de tono (autocorrelación)                      | `src/audio/autocorrelation.ts`                            |
| Detección de acordes en vivo (croma + plantillas)        | `audio/chroma.ts`, `audio/chord-engine.ts`                |
| Volver a escuchar lo grabado, con calma                  | `audio/offline-chords.ts`, `audio/fft.ts`                 |
| Abrir y cerrar el `AudioContext`, en un solo sitio       | `audio/audio-context.ts`                                  |
| Mástil, afinaciones, formas de acorde                    | `src/core/instrument/`                                    |
| Estado de sesión y persistencia                          | `src/state/` (IndexedDB)                                  |
| Lo que se recuerda de una vez para otra                  | `state/workspace.ts` (tono, estilo, escala)               |
| Quién abre el micro, y por qué es uno solo               | `state/use-listening.ts`                                  |
| Cómo se presta ese micro a quien graba                   | `audio/stream-source.ts` (`StreamSource`)                 |
| El acorde del bloque que tienes elegido                  | `state/acorde-elegido.ts`                                 |
| Las teclas del banco de componer                         | `state/atajos-del-banco.ts` (`ATAJOS`)                    |
| Lo que el copiloto propone y nadie ha aceptado           | `state/propuesta.ts`, `arrange/BloqueFantasma`            |
| Oír una progresión desde un componente                   | `state/use-progression-player.ts`                         |
| Un estado que se mira y al que uno se apunta             | `core/estado-observable.ts` (`Emisor`)                    |
| Grabar el sonido y descargarlo                           | `src/media/`, `features/recorder/`                        |
| Rutas de servidor de la IA                               | `app/api/ideas`, `/teacher`, `/versiones`                 |
| El cuerpo común de las tres rutas, y sus puertas         | `server/ai-route.ts`, `server/ai-gate.ts`                 |
| La llamada al modelo, y el único sitio con el SDK        | `server/ask-model.ts`                                     |
| Quién contesta —API, modelo de casa o dominio—           | `server/ai-model.ts`, `local-model.ts`                    |
| Por dónde entra texto libre, y qué lo acota              | `features/learn/teacher-contract.ts`                      |
| Una canción guardada, y qué papel hace cada parte        | `core/music/song.ts` (`ROLES`), `server/songs-repo.ts`    |
| El montaje por bloques, y lo que dura cada acorde        | `core/music/arrangement.ts` + `state/`                    |
| El lienzo: arrastrar bloques, estirarlos, escucharlos    | `features/arrange/`                                       |
| Componer tocando: el micro escribe lo que suena          | `arrange/TocarParaEscribir` + `state/use-tocar-y-apuntar` |
| Lo tocado convertido en una parte, para los dos sitios   | `state/apuntar-lo-tocado.ts`                              |
| Ensayar lo escrito y puntuarlo                           | `core/music/ensayo.ts` + `state/use-ensayo.ts`            |
| El reparto del banco: áreas, divisores, espacios         | `state/banco.ts`, `ui/Area`, `ui/Divisor`                 |
| El pentagrama, y la clave de sol dibujada                | `arrange/Staff.tsx` + `arrange/clef.ts`                   |
| Guardar y abrir tus canciones                            | `features/songs/`, `src/app/api/canciones`                |
| Salidas de lo que tocas, y su verificación               | `features/versions/` (se llamará `salidas/`)              |
| Planes, permisos y si una unidad la abre el plan         | `src/core/billing/` (`plans.ts`, `access.ts`)             |
| Meta diaria, racha, medallas, y lo que suma componer     | `core/music/progress.ts` (`practiceCompose`)              |
| Que lo compuesto llegue al avance sin saltarse capas     | `state/hechos-de-componer.ts`                             |
| La cola de repaso de lo fallado                          | `core/music/review.ts`                                    |
| Cuentas, contraseñas, base de datos y cupos              | `src/server/`                                             |
| El marco de una pantalla y sus apartados                 | `src/ui/Screen.tsx` (`Screen`, `WorkHeader`)              |
| Lo que se ve cuando todavía no hay nada                  | `src/ui/Vacio.tsx`, `ui/EmpezarPorTonalidad`              |
| Un formulario, y el error que se anuncia                 | `src/ui/Formulario.tsx`, `src/ui/Aviso.tsx`               |
| La tonalidad plegada en una línea, con su rueda          | `features/wheel/BarraDeTonalidad.tsx`                     |
| Leer lo que llega de fuera, y el error que contestó      | `core/parse.ts`, `state/api-error.ts`                     |
| Tokens de diseño y las dos paletas                       | `src/ui/tokens.ts` (+ espejo en `globals.css`)            |
| El rótulo de un apartado y un enlace dentro de una frase | `.rotulo` y `.enlace` en `app/globals.css`                |

**`/componer` es un banco de trabajo de áreas** que se pliegan y se arrastran, con
**tres espacios de trabajo que son tres maneras de escribir la misma canción**:
`Tocando` —el micro escribe lo que suena—, `Escribir` —bloques y partitura, las dos
pieles de lo mismo ([adr/0019](docs/adr/0019-punteos-y-partitura.md))— y `Ensayar`,
que la toca contra el metrónomo y la puntúa. Cada espacio trae su reparto de fábrica
([adr/0031](docs/adr/0031-componer-es-un-banco-de-trabajo.md),
[adr/0034](docs/adr/0034-tres-maneras-de-escribir-la-misma-cancion.md)). `/aprender` es **solo el
camino**; lo demás son `/aprender/[unidad]`, `/aprender/repaso`, `/profesor`,
`/afinar`, `/planes` con `/planes/[plan]`, `/registro`, `/cuenta` con sus anclas
—`#perfil`, `#suscripcion`, `#contrasena`, `#privacidad`— y la portada `/`.

## La documentación, y qué contesta cada fichero

Leer el que toque antes de tocar código de esa zona. **Son la fuente del porqué.**

| Fichero                    | Contesta                                                          |
| -------------------------- | ----------------------------------------------------------------- |
| `docs/ESTILO.md`           | Cómo se escribe: idioma, comentarios, interfaz, temas, tests      |
| `docs/ARCHITECTURE.md`     | Capas, qué importa qué, notas para quien viene de Angular         |
| `docs/DOMAIN-MUSIC.md`     | La teoría que implementa el código, en lenguaje de músico         |
| `docs/AUDIO-PITCH.md`      | Cómo se detecta el tono y el acorde, y qué limitaciones tienen    |
| `docs/RECORDING.md`        | Permisos, canvas, formatos, descarga local                        |
| `docs/AI.md`               | Contrato de los route handlers y las puertas del gasto            |
| `docs/CUENTAS-Y-PLANES.md` | Qué da cada plan, qué cuesta la IA y qué se guarda de ti          |
| `docs/ROADMAP.md`          | **Lo que falta**, ordenado por lo que estorba a diario            |
| `docs/PARA-PUBLICAR.md`    | **Lo que hará falta al publicar y cobrar.** Nada está en marcha   |
| `docs/HISTORIA.md`         | Las fases hechas, una línea cada una, y los fallos que enseñaron  |
| `docs/DESPLIEGUE.md`       | Qué hace falta para publicar y qué se rompe según dónde           |
| `docs/adr/`                | Decisiones con sus alternativas descartadas. Van treinta y cuatro |

Tres reglas sobre lo que se escribe aquí: **toda decisión con alternativas reales
se escribe como ADR** con sus descartadas; **cuando cambies comportamiento,
actualiza el documento que lo describía** —el ROADMAP llegó a decir que reconocer
acordes era imposible cuando llevaba dos commits funcionando—; y **los documentos
hablan en presente y solo de lo que se puede comprobar**, que lo no ejecutado vive
en `PARA-PUBLICAR.md` diciendo que no se ha ejecutado.

## Lo que este proyecto no hace

- **No sube audio**, y no lo hará sin un ADR. Con cuenta sí sube el avance:
  identificadores, números y fechas.
- **No graba vídeo**: lo hizo y se quitó entero
  ([adr/0023](docs/adr/0023-grabar-solo-el-sonido.md)).
- **No cobra todavía**, a propósito y con su ADR, ni pide una tarjeta.
- **No tiene vidas ni corazones**: fallar no bloquea, se explica y se sigue.
- **No examina a nadie** para colocarle de nivel
  ([adr/0007](docs/adr/0007-elegir-por-donde-empezar.md)).
- **No exige cuentas.** Sin `DATABASE_URL` y `AUTH_SECRET` todo el mundo es anónimo,
  con plan gratis y el avance en su navegador.
- **No manda correos sin configurarlo**, y la pantalla lo dice.
- **No detecta la tonalidad rasgueando**: el motor de tono es monofónico, así que la
  interfaz pide «unas notas sueltas».
- **No acierta siempre con los acordes**: el croma olvida la octava, así que duda
  con las inversiones. Lo que sí hace es **decir cuándo duda**
  ([adr/0020](docs/adr/0020-lo-que-se-oyo-y-lo-que-se-supo.md)). El detalle, en
  `docs/AUDIO-PITCH.md`.
