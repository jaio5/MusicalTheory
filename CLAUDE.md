# Caos ordenado — guía para trabajar aquí

Aplicación web para **aprender música y componer con ayuda**: escucha lo que tocas
por el micro, te enseña la teoría por unidades y te propone por dónde puede seguir
lo que llevas. Next.js 16 + React 19 + TypeScript, Tailwind v4, Zustand, Vitest.
Cuentas con Auth.js y Postgres (Drizzle), opcionales. Node 22+ y pnpm.

Hoy corre en un equipo y la usa una persona. **Se publicará y se cobrará por
suscripción**, y todo lo que eso pide está aparte, en `docs/PARA-PUBLICAR.md`: no
se mezcla con lo que ya funciona.

**Este fichero es el mapa, no la documentación.** El porqué está en `docs/`; aquí
solo lo que hace falta para no tener que buscarlo.

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

**Para tocar cualquier cosa de cuentas hace falta base de datos, y la da Docker:**
`pnpm docker:up` levanta Postgres, aplica las migraciones y arranca la aplicación;
`pnpm docker:db` levanta solo Postgres para usarlo con `pnpm dev`; `pnpm docker:ia`
añade un Ollama al que preguntar sin clave y sin factura. El script escribe el
`.env` que falte con un `AUTH_SECRET` nuevo. Si el 3000 está ocupado, `APP_PORT`.

**Para verlo funcionando hay un skill**: `.claude/skills/arrancar/` levanta la
aplicación y la conduce con un navegador de verdad, micrófono falso incluido.
Tiene las trampas que ya han mordido —el `fullPage` que no captura, los nombres
accesibles de la rueda, el WAV que se repite en bucle—.

**Prettier también formatea el markdown.** Después de tocar cualquier `.md` hay
que pasar `pnpm format`, o `format:check` falla. Es el fallo más tonto y el más
repetido.

**Tailwind escanea los comentarios, así que un ejemplo de clase es una clase.**
Escribir en un comentario —de `.ts`, de `.tsx` o del propio CSS— algo con pinta de
utilidad genera esa utilidad de verdad. Un `shadow-[var(--` con puntos suspensivos
dentro, puesto como ejemplo en un test, se convirtió en `--tw-shadow: var(--...)`,
que no es CSS válido: **la hoja entera dejó de compilar y las nueve pantallas
devolvieron 500 con los 2.174 tests en verde**. Un ejemplo dentro de un comentario
tiene que ser una clase que se pueda generar, o no parecerse a una. Y `pnpm build`
sí lo caza: si tocas estilos, pásalo.

**Una barra que se abre encima de algo que crece necesita `tope`.** En las
pantallas de taller, `ui/Disclosure` va con `shrink-0` sobre una caja que crece:
si lo que se abre mide más que la pantalla, al que crece le tocan **cero píxeles**
y lo de debajo se queda fuera de alcance, sin scroll que valga. En un teléfono,
abrir la rueda de quintas vaciaba componer. El `tope` lo acota y lo desplaza por
dentro; y lo que se abre para elegir algo se pliega solo al elegirlo.

**El micrófono es uno, y lo sujeta el módulo `state/use-listening.ts`, no el
componente.** Dos botones lo abren —el del afinador y el de la barra— y el estado
de sesión es uno: con las referencias dentro del gancho, uno podía decir «he
parado» sin haber parado nada y el micro se quedaba abierto con el piloto
encendido. Quien monte otro botón de escuchar **no guarda la entrada**; se suelta
cuando no queda ningún consumidor montado.

**La monoespaciada es para lo que se alinea en columna**, no para la interfaz:
notas, cifrados, cents, hercios, compases, XP, un correo. Navegación, botones,
pastillas y rótulos van en la sans, y el rótulo de un apartado es la clase
`.rotulo` y no una cadena escrita a mano
([adr/0024](docs/adr/0024-la-interfaz-se-lee-primero.md)). Llegó a estar en cerca
de cien sitios y dejaba la aplicación con pinta de terminal. **Este no lo vigila
ningún test**: «esto es un dato y aquello no» no se lee en una clase.

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
4. **El audio no sale del dispositivo.** A la IA solo viajan símbolos; a la base
   de datos, identificadores de unidad, números y fechas.
5. **`src/server/` solo lo abre `app/`, y no importa del navegador.** Un import de
   `@server/` desde un componente se lleva Postgres y la cadena de conexión al
   bundle del cliente. Vigilado en los dos sentidos.

Alias: `@core/*`, `@audio/*`, `@media/*`, `@server/*`, `@state/*`, `@features/*`,
`@ui/*`, `@/*`. Las capas de arriba importan de `@core/music` y `@core/billing`
—los índices—, no de los ficheros sueltos.

Cuatro trampas al tocar esto: **`core/music/song.ts` no puede importar valores de
`arrangement.ts`** —solo tipos—, porque `arrangement` importa los topes de `song`
y el ciclo revienta en tiempo de ejecución con un `Cannot access antes de
initialization` que **ningún test ve**, solo el navegador; los topes de lo que se
guarda van todos en `song.ts`; **`no-restricted-imports` no se acumula entre bloques de ESLint** —el último gana, y por eso las reglas 2 y 5 van juntas—; **el layout raíz
lleva `dynamic = 'force-dynamic'`** porque sin eso un build hecho sin base de datos
prerenderiza la cuenta anónima dentro del HTML; y **`planOf` traduce los nombres
viejos de los planes** (`estudiante` → Básico, `conservatorio` → Pro), porque un
renombrado no puede degradar a quien había pagado.

## Dónde está cada cosa

| Busco...                                                  | Está en                                        |
| --------------------------------------------------------- | ---------------------------------------------- |
| Teoría musical: escalas, acordes, grados, tonalidad       | `src/core/music/`                              |
| Funciones armónicas y sustitución (T/S/D)                 | `core/music/harmonic-function.ts`              |
| Qué acorde proponer y en qué orden                        | `core/music/suggestions.ts` + `styles.ts`      |
| Detección de tono (autocorrelación)                       | `src/audio/autocorrelation.ts`                 |
| Detección de acordes en vivo (croma + plantillas)         | `audio/chroma.ts`, `audio/chord-engine.ts`     |
| Volver a escuchar lo grabado, con calma                   | `audio/offline-chords.ts`, `audio/fft.ts`      |
| Mástil, afinaciones, formas de acorde                     | `src/core/instrument/`                         |
| Estado de sesión y persistencia                           | `src/state/` (IndexedDB)                       |
| Lo que se recuerda de una vez para otra                   | `state/workspace.ts` (tono, estilo, escala)    |
| Quién abre el micro, y por qué es uno solo                | `state/use-listening.ts`                       |
| Grabar el sonido y descargarlo                            | `src/media/`, `features/recorder/`             |
| Rutas de servidor de la IA                                | `app/api/ideas`, `/teacher`, `/versiones`      |
| Las puertas de toda petición a la IA                      | `server/ai-gate.ts`                            |
| La llamada al modelo, y el único sitio con el SDK         | `server/ask-model.ts`                          |
| Quién contesta —API, modelo de casa o dominio—            | `server/ai-model.ts`, `local-model.ts`         |
| Lo que tocas, convertido en compases                      | `core/music/capture.ts`                        |
| Con qué se rearmoniza, y cómo se comprueba                | `core/music/reharmonization.ts`                |
| Por dónde puede tirar lo que tocas, y qué lo valida       | `core/music/paths.ts`                          |
| Una canción guardada: grados, tonalidad y secciones       | `core/music/song.ts` + `server/songs-repo.ts`  |
| El montaje por bloques, y lo que dura cada acorde         | `core/music/arrangement.ts` + `state/`         |
| El lienzo: arrastrar bloques, estirarlos, escucharlos     | `features/arrange/`                            |
| El pentagrama, y la clave de sol dibujada                 | `arrange/Staff.tsx` + `arrange/clef.ts`        |
| El punteo: alturas, figuras y cómo se escribe cada nota   | `core/music/melody.ts`                         |
| La armadura de una tonalidad, y qué nota va en cada línea | `core/music/circle-of-fifths.ts`               |
| Planes, permisos y si una unidad la abre el plan          | `src/core/billing/` (`plans.ts`, `access.ts`)  |
| Meta diaria, racha, medallas, punto de partida            | `core/music/progress.ts`                       |
| La cola de repaso de lo fallado                           | `core/music/review.ts`                         |
| Guardar y abrir tus canciones                             | `features/songs/`, `src/app/api/canciones`     |
| Salidas de lo que tocas, y su verificación                | `features/versions/` (se llamará `salidas/`)   |
| Cuentas, contraseñas, base de datos y cupos               | `src/server/`                                  |
| Por dónde entra texto libre, y qué lo acota               | `features/learn/teacher-contract.ts`           |
| El marco de una pantalla y sus apartados                  | `src/ui/Screen.tsx` (`Screen`, `WorkHeader`)   |
| Lo que se ve cuando todavía no hay nada                   | `src/ui/Vacio.tsx`, `ui/EmpezarPorTonalidad`   |
| Leer lo que llega de fuera, y el error que contestó       | `core/parse.ts`, `state/api-error.ts`          |
| Tokens de diseño y las dos paletas                        | `src/ui/tokens.ts` (+ espejo en `globals.css`) |
| El cuerpo común de las tres rutas de IA                   | `server/ai-route.ts`                           |
| Un estado que se mira y al que uno se apunta              | `core/estado-observable.ts` (`Emisor`)         |
| Abrir y cerrar el `AudioContext`, en un solo sitio        | `audio/audio-context.ts`                       |
| Oír una progresión desde un componente                    | `state/use-progression-player.ts`              |
| El error de un formulario, y que se anuncie               | `src/ui/Aviso.tsx`                             |
| Un formulario que se envía sin recargar la página         | `src/ui/Formulario.tsx`                        |
| La tonalidad plegada en una línea, con su rueda           | `features/wheel/BarraDeTonalidad.tsx`          |
| El rótulo de un apartado, en un solo sitio                | `.rotulo` en `app/globals.css`                 |
| Un enlace dentro de una frase                             | `.enlace` en `app/globals.css`                 |

**`/componer` tiene dos caras y un conmutador**: `Tocar` —la rueda, el acorde y sus
formas— y `Montar`, el lienzo de bloques que se arrastran y suenan
([adr/0018](docs/adr/0018-el-lienzo-de-montar.md)). Nunca las dos a la vez: la
línea de tiempo necesita el ancho entero. Dentro de `Montar`, **la partitura es
lo que se ve al entrar** y los bloques están a un toque: son la misma canción con
dos pieles ([adr/0019](docs/adr/0019-punteos-y-partitura.md)). En partitura los
acordes van dentro, cifrados encima del pentagrama, y se ponen pulsando,
arrastrando hasta el compás o escribiendo el cifrado.

`/aprender` es **solo el camino**, y cada cosa tiene su dirección:
`/aprender/[unidad]` y `/aprender/repaso`. Después `/profesor`, `/componer`,
`/afinar`, `/planes` con `/planes/[plan]`, `/registro`, `/cuenta` con sus cuatro
anclas —`#perfil`, `#suscripcion`, `#contrasena`, `#privacidad`— y la portada `/`.

## La documentación, y qué contesta cada fichero

Leer el que toque antes de tocar código de esa zona. **Son la fuente del porqué.**

| Fichero                    | Contesta                                                        |
| -------------------------- | --------------------------------------------------------------- |
| `docs/ESTILO.md`           | Cómo se escribe: idioma, comentarios, interfaz, temas, tests    |
| `docs/ARCHITECTURE.md`     | Capas, qué importa qué, notas para quien viene de Angular       |
| `docs/DOMAIN-MUSIC.md`     | La teoría que implementa el código, en lenguaje de músico       |
| `docs/AUDIO-PITCH.md`      | Cómo se detecta el tono y el acorde, y qué limitaciones tienen  |
| `docs/RECORDING.md`        | Permisos, canvas, formatos, descarga local                      |
| `docs/AI.md`               | Contrato de los route handlers y las puertas del gasto          |
| `docs/CUENTAS-Y-PLANES.md` | Qué da cada plan, qué cuesta la IA y qué se guarda de ti        |
| `docs/ROADMAP.md`          | **Lo que falta**, ordenado por lo que estorba a diario          |
| `docs/PARA-PUBLICAR.md`    | **Lo que hará falta al publicar y cobrar.** Nada está en marcha |
| `docs/HISTORIA.md`         | Las veinte fases hechas, una línea cada una                     |
| `docs/DESPLIEGUE.md`       | Qué hace falta para publicar y qué se rompe según dónde         |
| `docs/adr/`                | Decisiones con sus alternativas descartadas                     |

**Toda decisión con alternativas reales se escribe como ADR**, numerado y con sus
descartadas. Van veintisiete.

**Cuando cambies comportamiento, actualiza el documento que lo describía.** El
ROADMAP llegó a afirmar que el reconocimiento de acordes era imposible cuando
llevaba dos commits implementado.

Y una regla de tiempo verbal, que es lo que costó entender el proyecto: **los
documentos hablan en presente y solo de lo que se puede comprobar.** Lo que no se
ha ejecutado nunca vive en `PARA-PUBLICAR.md` y se dice que no se ha ejecutado.

## Lo que este proyecto no hace

- **No sube audio.** Ni una línea de código de subida, y no la habrá sin un ADR.
  Con cuenta sí sube el avance: identificadores, números y fechas.
- **No graba vídeo.** Lo hizo —cámara detrás de la interfaz, datos quemados
  encima— y se quitó entera con su capa y su bloque de CSS: pedía trípode,
  pantalla grande y el permiso más caro que hay, para un fichero que había que
  abrir en otro programa ([adr/0023](docs/adr/0023-grabar-solo-el-sonido.md)).
  Ahora se graba el sonido, se oye ahí mismo y se descarga si vale.
- **No cobra todavía.** El cobrador de hoy cambia el plan sin cobrar, a propósito y
  con su ADR. Se cobrará al publicar; lo que eso pide está en `PARA-PUBLICAR.md`.
- **No tiene vidas ni corazones.** Fallar no bloquea: se explica y se sigue.
- **No pide una tarjeta.** La ventana de pago enseña plan, precio y un aviso de que
  no se cobra.
- **No examina a nadie** para colocarle de nivel: el curso de partida se elige
  ([adr/0007](docs/adr/0007-elegir-por-donde-empezar.md)).
- **No exige cuentas.** Sin `DATABASE_URL` y `AUTH_SECRET` todo el mundo es anónimo
  con plan gratis y el avance se queda en su navegador.
- **No manda correos sin configurarlo**, y la pantalla lo dice en vez de prometer
  un correo que no llega.
- **No detecta la tonalidad rasgueando.** Sale de un histograma de alturas que
  llena el motor de tono, y ese es monofónico: con un acorde sonando no entrega
  ninguna nota. Con la escala tarda cuatro segundos; con acordes no llega nunca.
  La interfaz lo dice así —«toca unas notas sueltas»— desde que se comprobó con
  dos ficheros por el micrófono falso.
- La detección de tono es **monofónica** y pide señal limpia. Para acordes hay otro
  análisis, y el reconocimiento **duda con inversiones**: el croma olvida la
  octava, así que C/E y C son el mismo vector. Lo que sí hace es **decir cuándo
  duda**: un acorde oído por poco margen sale marcado y se corrige pulsándolo
  ([adr/0020](docs/adr/0020-lo-que-se-oyo-y-lo-que-se-supo.md)).
