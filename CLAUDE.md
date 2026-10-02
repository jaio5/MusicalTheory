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

**La cobertura está en el cien por cien y el tope lo exige.** Bajar de ahí
significa una de dos cosas: falta una prueba, o falta explicar por qué esa rama
no puede darse —con `v8 ignore` **y su razón**, `docs/ESTILO.md`—.

`pnpm dev` levanta en http://localhost:3000, y ninguno de los cinco necesita base
de datos ni claves. Si tocas `src/server/db/schema.ts`: `pnpm db:generate` escribe
la migración y `pnpm db:migrate` la aplica; no se aplican solas al arrancar.

**Las cuentas piden base de datos, y la da Docker:** `pnpm docker:up` levanta todo,
`pnpm docker:db` solo Postgres para usarlo con `pnpm dev`, `pnpm docker:ia` añade
un Ollama sin clave ni factura y `pnpm docker:ia-sola` levanta ese Ollama **sin la
aplicación**. Es un solo `compose.yml` con la IA en un perfil
([adr/0047](docs/adr/0047-la-ia-es-un-perfil-no-un-fichero.md)), así que
`docker compose up` no la toca y `docker compose --profile ia up` la trae.
**`docker compose down` a secas no para un perfil**: deja Ollama corriendo, y por
eso `docker:down` lleva `--profile '*'`. Escribe el `.env` que falte; si el 3000 está
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
  `ui/Disclosure` con `flotante`, vigilado por `screens/coherencia`. **La excepción
  es lo que se abre desde una fila que se desplaza** —la barra de componer en un
  teléfono—, que es un `popover` del navegador: el panel de un `Disclosure` se
  ancla dentro de la fila y ella lo recorta. Solo vale ahí, y el mismo test lo
  cierra ([adr/0065](docs/adr/0065-lo-que-se-abre-desde-una-fila-que-se-desplaza-es-un-popover.md)).
- **La navegación cambia de sitio en `md` (768), y hay tres sitios que lo saben**:
  `AppShell` —arriba o abajo—, el tope del panel flotante de `ui/Disclosure`, que
  descuenta la barra de abajo mientras exista, y el corte de 500 px de alto, donde
  el `<main>` se desplaza y la barra se pliega a iconos. Si uno se mueve, los otros
  también: separados, la rueda se sale por abajo y nadie lo ve. **Ningún test lo
  vigila**; lo caza la sonda del skill `arrancar` a los dos lados de 640 y de 768
  ([adr/0084](docs/adr/0084-lo-que-trabaja-no-se-apaga-y-el-foco-se-mueve-a-mano.md)).
- **`docker compose up -d` no reconstruye la imagen**: arranca la que ya había, y
  enseña la aplicación de la última vez que se construyó. Pasó con la portada: la
  imagen era de dos días antes y seguía saliendo el vídeo borrado. Después de
  cambiar código, `docker compose up -d --build app`; `pnpm docker:up` ya lo lleva.
- **Descargado no es cargado.** Tras cada `up`, la primera pregunta al profesor tenía
  que subir el modelo a la gráfica, 87 s o más, y la aplicación cortaba a los 120
  con «no hemos podido contactar con el modelo». Lo carga `ia-calentar` en
  `compose.yml` al levantar, sin que la aplicación lo espere
  ([adr/0075](docs/adr/0075-el-modelo-se-carga-al-levantar.md)).
- **Qué hace falta para que `docker compose up -d` traiga la IA: dos líneas en el
  `.env`.** `COMPOSE_PROFILES=ia` enciende el perfil y `OLLAMA_URL_DOCKER=http://ollama:11434`
  le dice a la aplicación dónde está. Van juntas y no sirve una sin la otra. Con
  ellas puestas no hace falta el script ni acordarse de nada, **porque `ollama` es un
  nombre fijo de la red de compose**: no depende de ninguna IP
  ([adr/0055](docs/adr/0055-la-ia-se-enciende-desde-el-env.md)).
- **Y un Ollama del equipo, en cambio, solo lo encuentra el script.** Su dirección es
  la IP de `eth0`, **cambia al reiniciar**, y en `compose.yml` no hay ninguna fija que
  valga —`host.docker.internal` apunta a Windows, no a WSL, y la puerta del puente
  tampoco llega—. Ése es el camino de `pnpm docker:up`
  ([adr/0050](docs/adr/0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md)).
- **Los dos Ollama chocan en el 11434.** Con uno nativo corriendo, el contenedor no
  puede publicar ahí y `up` falla con «port is already allocated». Se mueve con
  `OLLAMA_PORT` —aquí el 11435—, y solo afecta a mirarlo desde fuera: dentro de
  compose la aplicación le habla por el nombre y por el 11434 de la red interna. Es
  el mismo choque que el 5432 de Postgres.
- **Al grabar se cuentan dos compases y la claqueta sigue sonando**, y lo que se
  apunta empieza **un pulso después del último clic**: ahí cae el compás uno, y
  equivocarse desplaza la canción entera un pulso (`state/cuenta-atras.ts`). **Suena
  porque el clic es un golpe de ruido agudo y no un tono**: no tiene periodo y cae
  fuera de lo que miran los motores. Cambiarle el timbre rompe la toma
  ([adr/0072](docs/adr/0072-la-claqueta-suena-toda-la-toma.md), que sustituye al
  [0053](docs/adr/0053-la-claqueta-cuenta-y-se-calla.md)).
- **El micrófono es uno, y lo sujeta `state/use-listening.ts`**, no el componente:
  quien monte otro botón de escuchar **no guarda la entrada**. **Sigue abierto al
  navegar**, porque el marco vive en `app/(marco)/layout.tsx` y no se desmonta, y sus
  motores se descargan al pulsar, no al cargar: quien importe `@audio/web-audio-input`
  o un motor desde un componente los devuelve a todas las pantallas
  ([adr/0079](docs/adr/0079-el-marco-se-monta-una-vez-y-el-micro-sobrevive-a-navegar.md)).
- **Grabar sin escribir es un papel de la toma, no otra pantalla.** Había una
  pastilla «Grabar» en la fila de abajo que hacía lo mismo menos transcribir, con
  **su propio micrófono** —dos `getUserMedia` sobre el mismo aparato son dos
  permisos y dos pilotos—. Ahora es `solo-grabar`, el tercer papel: no escribe, no
  cuenta compases y no pide tonalidad
  ([adr/0056](docs/adr/0056-grabar-es-un-papel-de-la-toma.md)). **Lo que no se
  conservó**: la pantalla de componer pide tonalidad antes que nada, así que para
  llegar a «Solo grabar» hay que elegir una aunque no se use.
- **Una toma dice lo que es, y sin eso los dos motores compiten.** El croma y el de
  tono corren a la vez sobre la misma entrada, así que apuntar leía de los dos y un
  punteo entraba con acordes inventados encima. Se elige rítmica o punteo antes de
  tocar y solo se apunta lo de ese papel
  ([adr/0048](docs/adr/0048-una-toma-dice-lo-que-es.md)). **Quien añada otra entrada
  que apunte tiene que decirlo también**, o se queda con el de por defecto sin
  enterarse.
- **Dieciséis colores, los de la sala de la portada, y ninguno más**: un tono de
  Tailwind o un color entre corchetes lo caza `coherencia.test.ts`. Lo puesto lleva
  su `.piloto` y el latón relleno es solo para la acción. Y **una clase de
  `@layer components` no admite `hover:`**: lo que se pida con variante va en
  `@utility` ([adr/0070](docs/adr/0070-la-sala-encendida.md)).
- **La monoespaciada es solo para lo que se alinea en columna** —notas, cents, XP,
  un correo—; lo demás en la sans, y el rótulo de un apartado es `.rotulo`
  ([adr/0024](docs/adr/0024-la-interfaz-se-lee-primero.md)). **Ningún test lo
  vigila.**
- **El mástil se estira a lo ancho del hueco, y el hueco solo pone el techo**
  ([adr/0046](docs/adr/0046-el-mastil-solo-ocupa-lo-que-dibuja.md)): con el alto
  fijo reservaba hasta 206 px de bandas vacías en una ventana alta. Mide su caja y
  reparte los trastes por ella, entre dos topes: con proporción fija salía un cuadrado en
  medio y sin tope una tira ([adr/0040](docs/adr/0040-ni-cuadrado-ni-tira.md)). De paso
  se descubrió que **el suelo del arreglo era mentira**: decía 160 px y necesita
  220 por debajo de 1280 —contando los 44 de la tira de un área plegada, que va
  debajo—. Lo mide `auditar-componer.mjs` del skill `arrancar`.
- **El grabado se mide en espacios de pentagrama**, y las invariantes de la clave
  las fija `arrange/clef.test.ts`
  ([adr/0029](docs/adr/0029-la-partitura-se-dibuja-aqui.md)).
- **Un bloque guarda un grado y una especie** —una séptima, o una de las seis
  simples: `quinta`, `sus2`, `sus4`, `dim`, `aug`, `menor`—, y quien lo traduce a
  acorde es `blockChord`, no `resolveDegree`: con el grado a secas, un `C5` se
  enseña, se ensaya y se dibuja como un `C`
  ([adr/0035](docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)). **Cuando la
  calidad no encuentra grado, lo pone la fundamental y la especie dice lo que
  es**, y el orden importa: la tríada se busca primero o todos los menores
  arrastrarían especie ([adr/0042](docs/adr/0042-la-especie-dice-lo-que-el-grado-no-sabe.md)).
- **Un montaje son grados, y los grados no se llaman igual en mayor que en menor**:
  `state/montaje-en-su-modo.ts` lo traduce en cuanto cambia la tonalidad, y sin eso
  componer se cae entera ([adr/0030](docs/adr/0030-cambiar-de-modo-traduce-la-cancion.md)).
- **En el móvil hay tiras que no caben y se arrastran**, y sin pista parecen
  rotas: la última pastilla sale partida contra el borde. La clase `hay-mas-al-lado`
  de `globals.css` lo dice **solo cuando de verdad queda algo**, sin medir nada —dos
  capas de fondo que viajan con el contenido tapan a otras dos pegadas al marco—. La
  bandeja de abajo de componer ya no es una de ellas: en un teléfono se pliega a
  «Más».
- **El muñeco del profesor flota encima de la columna que se desplaza**, y lo
  último de ella queda debajo: quien lo monte reserva `HUECO_DEL_TUTOR`
  (`learn/Tutor.tsx`) al pie de esa columna.
- **«Se ve» no es `top >= 0`**, y por eso `traerLaCancionALaVista` pregunta quién hay
  en el borde de la canción: encima flotan la tonalidad y las tiras de área, así que
  la parte puede estar en el píxel 116 y estar tapada. Se reserva hueco con
  `scroll-margin-top`, sacado del alto de lo que tapa y no de un número a mano.
- **La barra de tonalidad flota y se abre sola cuando no hay tonalidad**, así que
  **lo que pongas debajo no se ve**: un aviso que dijera «elígela en la rueda de
  aquí arriba» quedaba detrás de la rueda que lo tapaba. Ha mordido en la unidad y
  en componer estrecho. Lo que cabe ahí abajo es `ui/CuatroTonalidades`, y flotar
  no se toca: está peleado dos veces y lo vigila `screens/coherencia`.
- **Entrar tiene tope de intentos, y va antes de comprobar la contraseña**, con tres
  claves: comprobar primero gastaría el `scrypt` que el tope viene a proteger
  ([adr/0054](docs/adr/0054-entrar-tiene-tope-de-intentos.md), que sustituye en parte
  el [0078](docs/adr/0078-los-topes-se-cuentan-con-la-direccion-que-vio-nuestro-proxy.md)).
  **Y la dirección sale de `TRUSTED_PROXY_HOPS`**: sin ella no se cree ninguna
  cabecera y todos comparten un contador; detrás de un proxy hay que ponerla.
- **Las burbujas de validación del navegador salen en su idioma**, no en el de la
  aplicación. Por eso `ui/Formulario` va con `noValidate` y lo que falta se dice
  con `ui/Aviso`. Un `<form>` escrito a mano vuelve a traerlas. `Aviso` monta su
  región viva **vacía y antes** del mensaje: nacer con el texto dentro no se lee.
- **Mientras suena el micro, un objeto nuevo repinta la pantalla entera.** La
  lectura cambia veinte veces por segundo y la tonalidad detectada dos: se
  selecciona el dato suelto (`s.reading?.midi`), y `selectActiveKey` devuelve una
  de 24 tonalidades fijas. Y en el lienzo, **una flecha nueva hacia `PartRow`
  anula su `memo`** sin que falle nada: ningún test lo vigila
  ([adr/0059](docs/adr/0059-memo-a-mano-y-no-el-compilador.md)).

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

**Un barril de pantallas se lleva todas al paquete de todas.** `app/screens/index.ts`
hacía que `/afinar` descargara el lienzo de componer: las ocho rutas pesaban los
mismos 288 KB, con los seis comandos en verde —ni los tests ni las capas miran lo
que viaja por el cable—. Cada página importa su pantalla **del módulo**, y
`package.json` declara `sideEffects: ["*.css"]` para que un índice de `core/` no
arrastre lo que nadie usa ([adr/0045](docs/adr/0045-un-barril-por-pantalla-no.md)).
Lo mide `peso-de-las-rutas.mjs` del skill `arrancar`. **`/componer` descarga por
partes**: lo que no se ve al entrar llega con `lazy`, y por eso se importa de su
módulo y no del índice, que lo traería de golpe
([adr/0058](docs/adr/0058-componer-se-descarga-por-partes.md)).

Cuatro trampas, cada una explicada donde vive: **`song.ts` solo importa tipos de
`arrangement.ts`** —el ciclo revienta en el navegador y ningún test lo ve—;
**`no-restricted-imports` no se acumula entre bloques de ESLint**, gana el último;
**el layout raíz lleva `dynamic = 'force-dynamic'`**, que `app/(marco)/` hereda; y **`planOf` traduce los
nombres viejos de los planes**.

## Dónde está cada cosa

| Busco...                                                      | Está en                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Teoría musical: escalas, acordes, grados, tonalidad           | `src/core/music/`                                                                  |
| Funciones armónicas y sustitución (T/S/D)                     | `core/music/harmonic-function.ts`                                                  |
| La teoría que se le da al profesor, y cómo se comprueba       | `core/music/glossary.ts` (adr/0076)                                                |
| El examen del profesor contra el modelo de casa               | `scripts/examen-del-profesor.ts`                                                   |
| Qué acorde proponer y en qué orden                            | `core/music/suggestions.ts` + `styles.ts`                                          |
| Con qué se rearmoniza, y cómo se comprueba                    | `core/music/reharmonization.ts`                                                    |
| Por dónde puede tirar lo que tocas, y qué lo valida           | `core/music/paths.ts`                                                              |
| Lo que tocas, convertido en compases                          | `core/music/capture.ts`                                                            |
| La armadura, y qué nota va en cada línea                      | `core/music/circle-of-fifths.ts`                                                   |
| El punteo: alturas, figuras y cómo se escribe cada nota       | `core/music/melody.ts`                                                             |
| Detección de tono (autocorrelación)                           | `src/audio/autocorrelation.ts`                                                     |
| Detección de acordes en vivo (croma + plantillas)             | `audio/chroma.ts`, `audio/chord-engine.ts`                                         |
| Volver a escuchar lo grabado, con calma                       | `audio/offline-chords.ts`, `audio/fft.ts`                                          |
| Abrir y cerrar el `AudioContext`, en un solo sitio            | `audio/audio-context.ts`                                                           |
| Mástil, afinaciones, formas de acorde                         | `src/core/instrument/`                                                             |
| Estado de sesión y persistencia                               | `src/state/` (IndexedDB)                                                           |
| Lo que se recuerda de una vez para otra                       | `state/workspace.ts` (tono, estilo, escala)                                        |
| Quién abre el micro, y por qué es uno solo                    | `state/use-listening.ts`                                                           |
| Cómo se presta ese micro a quien graba                        | `audio/stream-source.ts` (`StreamSource`)                                          |
| La cuenta atrás antes de apuntar, y dónde cae el compás 1     | `state/cuenta-atras.ts`                                                            |
| El volumen del clic, y si hay una toma sonando                | `state/claqueta.ts`                                                                |
| El clic: ruido filtrado, y con qué se filtra                  | `audio/metronome.ts`, `audio/biquad.ts`                                            |
| El acorde del bloque que tienes elegido                       | `state/acorde-elegido.ts`                                                          |
| Las teclas del banco de componer                              | `state/atajos-del-banco.ts` (`ATAJOS`)                                             |
| Lo que el copiloto propone y nadie ha aceptado                | `state/propuesta.ts`, `arrange/BloqueFantasma`                                     |
| Oír una progresión desde un componente                        | `state/use-progression-player.ts`                                                  |
| Un estado que se mira y al que uno se apunta                  | `core/estado-observable.ts` (`Emisor`)                                             |
| Grabar el sonido y descargarlo                                | `src/media/` + `arrange/TocarParaEscribir` («Solo grabar»)                         |
| Llevarte la canción a un secuenciador                         | `core/music/midi.ts`, `media/descargar.ts`                                         |
| Rutas de servidor de la IA                                    | `app/api/teacher`, `/versiones`                                                    |
| El cuerpo común de las dos rutas, y sus puertas               | `server/ai-route.ts`, `server/ai-gate.ts`                                          |
| La llamada al modelo, y el único sitio con el SDK             | `server/ask-model.ts`                                                              |
| Quién contesta —API, modelo de casa o dominio—                | `server/ai-model.ts`, `local-model.ts`                                             |
| Por dónde entra texto libre, y qué lo acota                   | `learn/teacher-contract.ts`, `versions/contract.ts`                                |
| Una canción guardada, y qué papel hace cada parte             | `core/music/song.ts` (`ROLES`), `server/songs-repo.ts`                             |
| Un acorde cualquiera, convertido en bloque                    | `core/music/capture.ts` (`comoBloque`)                                             |
| El montaje por bloques, y lo que dura cada acorde             | `core/music/arrangement.ts` + `state/`                                             |
| El lienzo: arrastrar bloques, estirarlos, escucharlos         | `features/arrange/`                                                                |
| La cola de acordes que hay que preguntar, y su panel          | `arrangement.ts` (`bloquesEnDuda`) + `arrange/CorregirAcorde`                      |
| Componer tocando: el micro escribe lo que suena               | `arrange/TocarParaEscribir` + `state/use-tocar-y-apuntar`                          |
| Lo tocado convertido en una parte, para los dos sitios        | `state/apuntar-lo-tocado.ts`                                                       |
| Qué se estaba tocando en una toma, y qué motor la lee         | `core/music/capture.ts` (`PapelDeLaToma`)                                          |
| Ensayar lo escrito y puntuarlo                                | `core/music/ensayo.ts` + `state/use-ensayo.ts`                                     |
| El reparto del banco: áreas, divisores, espacios              | `state/banco.ts`, `ui/Area`, `ui/Divisor`                                          |
| El pentagrama, y la clave de sol dibujada                     | `arrange/Staff.tsx` + `arrange/clef.ts`                                            |
| Guardar y abrir tus canciones                                 | `features/songs/`, `src/app/api/canciones`                                         |
| Salidas de lo que tocas, y su verificación                    | `features/versions/` (se llamará `salidas/`)                                       |
| Planes, permisos y si una unidad la abre el plan              | `src/core/billing/` (`plans.ts`, `access.ts`)                                      |
| Cuántas preguntas del cupo gasta cada petición                | `core/billing/cost.ts` (`unidadesDe`, adr/0067)                                    |
| Meta diaria, racha, medallas, y lo que suma componer          | `core/music/progress.ts` (`practiceCompose`)                                       |
| Que lo compuesto llegue al avance sin saltarse capas          | `state/hechos-de-componer.ts`, `learn/use-ganancia-al-componer`                    |
| La cola de repaso de lo fallado                               | `core/music/review.ts`                                                             |
| Por qué una pregunta sale o vuelve a la cola                  | `core/music/review.ts` (`mergeReview` manda)                                       |
| Cuentas, contraseñas, base de datos y cupos                   | `src/server/`                                                                      |
| El tope de intentos al entrar, y por qué son dos claves       | `server/auth.ts`, `core/auth-errors.ts`                                            |
| El marco de una pantalla, su ancho y lo que va al lado        | `src/ui/Screen.tsx` (`Screen`, `aside`, `WorkHeader`)                              |
| La diana de cada tonalidad en la rueda                        | `features/wheel/WheelOfFifths.tsx` (`DIANA`, adr/0074)                             |
| Lo que se ve cuando todavía no hay nada                       | `src/ui/Vacio.tsx`, `ui/EmpezarPorTonalidad`                                       |
| Un formulario, y el error que se anuncia                      | `src/ui/Formulario.tsx`, `src/ui/Aviso.tsx`                                        |
| La tonalidad plegada en una línea, con su rueda               | `features/wheel/BarraDeTonalidad.tsx`                                              |
| Leer lo que llega de fuera, y el error que contestó           | `core/parse.ts`, `state/api-error.ts`                                              |
| Tokens de diseño y las dos paletas                            | `src/ui/tokens.ts` (+ espejo en `globals.css`; `border-strong` para controles)     |
| Las tres letras, y desde dónde se sirven                      | `app/fuentes.ts`, `app/_fuentes/`                                                  |
| El piloto, el hueco y la ventana del profesor                 | `.piloto`, `.hueco`, `.ventana-pixel` en `app/globals.css`                         |
| El marco común, montado una vez para las pantallas de trabajo | `app/(marco)/layout.tsx` (las páginas viven en `src/app/(marco)/`)                 |
| Qué se ve cuando una pantalla revienta o no existe            | `app/Averia.tsx`; `error.tsx`, `(marco)/error.tsx`, `global-error.tsx`             |
| La marca del prompt, y cómo se borra en cualquier disfraz     | `core/marca.ts`                                                                    |
| El reparto de opciones de una pregunta, estable por unidad    | `core/music/baraja.ts`                                                             |
| Traer a la vista lo enfocado en una tira que se desplaza      | `ui/use-traer-a-la-vista.ts`                                                       |
| Cerrar un `popover` cuando el foco se va                      | `ui/cerrar-al-salir-el-foco.ts`                                                    |
| Listar los micrófonos sin abrir ninguno                       | `audio/entradas-de-audio.ts`                                                       |
| Qué trae cada plan, con las palabras de las tarjetas          | `features/account/lo-que-va-con-plan.ts`                                           |
| Quién revisa un cambio y quién pone al día la documentación   | `.claude/agents/` (`revisor`, `documentalista`)                                    |
| El rótulo de un apartado y un enlace dentro de una frase      | `.rotulo` y `.enlace` en `app/globals.css`                                         |
| El profesor, y de dónde salen sus píxeles                     | `ui/Mascota.tsx`; los dibuja `arte/mascota/build.py`                               |
| El icono de la pestaña y el de la pantalla de inicio          | `app/icon.svg`, `favicon.ico`, `apple-icon.png`; los saca `arte/mascota/iconos.py` |
| La escena de la portada, y de dónde salen sus capas           | `app/EscenaPortada.tsx`; la dibuja `arte/portada/build.py`                         |

**`/componer` es un banco de trabajo de áreas** que se pliegan y se arrastran, con
**tres espacios de trabajo que son tres maneras de escribir la misma canción**:
`Tocando` —el micro escribe lo que suena—, `Escribir` —bloques y partitura, las dos
pieles de lo mismo ([adr/0019](docs/adr/0019-punteos-y-partitura.md))— y `Ensayar`,
que la toca contra el metrónomo y la puntúa. Cada espacio trae su reparto de fábrica
([adr/0031](docs/adr/0031-componer-es-un-banco-de-trabajo.md),
[adr/0034](docs/adr/0034-tres-maneras-de-escribir-la-misma-cancion.md)). `/aprender` es **solo el
camino**; lo demás son `/aprender/[unidad]`, `/aprender/repaso`, `/profesor`,
`/afinar`, `/planes` con `/planes/[plan]`, `/registro`, `/cuenta` con sus anclas
—`#perfil`, `#suscripcion`, `#contrasena`, `#privacidad`— y la portada `/`. **Las páginas viven en
`src/app/(marco)/`**, menos la portada, que no lleva barra.

## La documentación, y qué contesta cada fichero

Leer el que toque antes de tocar código de esa zona. **Son la fuente del porqué.**

| Fichero                        | Contesta                                                         |
| ------------------------------ | ---------------------------------------------------------------- |
| `docs/ESTILO.md`               | Cómo se escribe: idioma, comentarios, interfaz, temas, tests     |
| `docs/ENCONTRAR-UN-FICHERO.md` | Cómo está ordenado el código y cómo llegar al fichero que buscas |
| `docs/ARCHITECTURE.md`         | Capas, qué importa qué, notas para quien viene de Angular        |
| `docs/DOMAIN-MUSIC.md`         | La teoría que implementa el código, en lenguaje de músico        |
| `docs/AUDIO-PITCH.md`          | Cómo se detecta el tono y el acorde, y qué limitaciones tienen   |
| `docs/RECORDING.md`            | Permisos, canvas, formatos, descarga local                       |
| `docs/AI.md`                   | Contrato de los route handlers y las puertas del gasto           |
| `docs/CUENTAS-Y-PLANES.md`     | Qué da cada plan, qué cuesta la IA y qué se guarda de ti         |
| `docs/ROADMAP.md`              | **Lo que falta**, ordenado por lo que estorba a diario           |
| `docs/PARA-PUBLICAR.md`        | **Lo que hará falta al publicar y cobrar.** Nada está en marcha  |
| `docs/HISTORIA.md`             | Las fases hechas, una línea cada una, y los fallos que enseñaron |
| `docs/DESPLIEGUE.md`           | Qué hace falta para publicar y qué se rompe según dónde          |
| `docs/adr/`                    | Decisiones con sus alternativas descartadas. Van ochenta y seis  |

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
- **No acierta siempre con los acordes**, y con una guitarra delante falla más de lo
  que decía: el croma olvida la octava —duda con las inversiones— y, sobre todo,
  **una nota sola tiene la misma forma que su acorde mayor** después del descuento
  de armónicos, así que un punteo se lee como acordes. Lo que sí hace es **decir
  cuándo duda**, y la duda son **dos cosas**: el empate con el segundo candidato y
  lo poco que se parece ([adr/0020](docs/adr/0020-lo-que-se-oyo-y-lo-que-se-supo.md),
  [adr/0043](docs/adr/0043-dos-maneras-de-equivocarse.md)). Lo medido tocando está
  en `docs/ROADMAP.md`; el porqué, en `docs/AUDIO-PITCH.md`.
