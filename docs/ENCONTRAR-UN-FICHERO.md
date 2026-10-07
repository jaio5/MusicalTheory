# Encontrar un fichero

Este documento contesta una sola pregunta: **quiero cambiar algo, ¿dónde está?**

No explica por qué las capas son así —eso es
[ARCHITECTURE.md](./ARCHITECTURE.md)— ni qué hace cada pieza. Solo enseña a
navegar.

## La única regla que hace falta entender

No está ordenado por tipo de fichero. **No hay una carpeta `components` y otra
`hooks`**: está ordenado por **quién puede depender de quién**.

```
app/  →  features/  →  state/  →  audio/  ↘
      ↘              →  ui/               core/
       server/       →  media/  ──────────↗
```

Cada capa solo puede importar de las que tiene a su derecha. `core/` no importa de
nadie. Lo vigila un test —[`src/capas.test.ts`](../src/capas.test.ts)— y ESLint, así
que si te equivocas de sitio te lo dicen antes de que funcione.

Eso significa que **la profundidad te dice de qué trata un fichero**: cuanto más a
la derecha, menos sabe de la pantalla y más de la música.

## Las siete carpetas, en el orden en que se buscan

| Carpeta                    | Qué hay                                               | Vas ahí cuando buscas                 |
| -------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `src/app/`                 | Las catorce rutas y las nueve pantallas               | una **página**                        |
| `src/features/`            | Las funciones grandes, una carpeta cada una           | **cómo se comporta** algo             |
| `src/state/`               | Lo que se recuerda, y quién abre el micro             | **datos compartidos** entre pantallas |
| `src/ui/`                  | Veinticuatro piezas: botones, campos, avisos, paneles | una **pieza reutilizable**            |
| `src/core/`                | Teoría musical, planes, mástil. **TypeScript puro**   | una **regla o un cálculo**            |
| `src/audio/`, `src/media/` | Micrófono, análisis, metrónomo, grabar                | algo que **suena o graba**            |
| `src/server/`              | Cuentas, base de datos, llamadas al modelo            | algo del **servidor**                 |

## La cadena: de una dirección a su código

Siempre son los mismos saltos, y siempre en el mismo orden. Con el afinador:

| Salto          | Fichero                       | Qué hay dentro                   |
| -------------- | ----------------------------- | -------------------------------- |
| 1. La ruta     | `app/(marco)/afinar/page.tsx` | qué pantalla va aquí y su título |
| 2. La pantalla | `app/screens/TuneScreen.tsx`  | el marco y qué apartados tiene   |
| 3. La función  | `features/tuner/`             | el comportamiento de verdad      |
| 4. El motor    | `audio/autocorrelation.ts`    | cómo se detecta el tono          |
| 5. El dominio  | `core/instrument/tunings.ts`  | las ocho afinaciones             |

Y se puede leer al revés. Si tocas `core/instrument/tunings.ts`, sabes que lo que
cambias sale en el afinador y en el mástil, porque son los únicos que lo abren.

Las catorce rutas son la portada, `src/app/page.tsx`, y todos los
`src/app/(marco)/*/page.tsx`. El paréntesis no sale en la dirección: es un grupo
de rutas, y su `layout.tsx` monta el marco común —la barra, el micro— **una vez
para todas**, así que cambiar de pantalla no lo desmonta. La portada va fuera
porque pinta su propia sala, sin barra.

```
/            /afinar        /componer     /profesor
/aprender    /aprender/[unidad]           /aprender/repaso
/planes      /planes/[plan]  /registro    /cuenta      /olvidada
/privacidad  /aviso-legal
```

Si una pantalla revienta al pintarse, lo que se ve sale de `app/Averia.tsx`, por
una de tres fronteras: `(marco)/error.tsx` deja la barra puesta, `app/error.tsx`
coge lo de fuera del marco y `app/global-error.tsx` lo que rompa el layout raíz.

## Cuatro ejemplos de verdad

**«Quiero cambiar el texto de un botón de componer.»** Es pantalla: `features/arrange/`.
Casi todo lo de `/componer` vive ahí, y el fichero grande es `ArrangeCanvas.tsx`.

**«Quiero cambiar qué acordes propone.»** Es una regla, no una pantalla:
`core/music/suggestions.ts` y `styles.ts`. La pantalla solo pinta lo que estos
deciden, así que cambiando aquí cambia en los dos sitios donde se ofrece.

**«Quiero cambiar cuánto dura la cuenta atrás al grabar.»** Es tiempo musical, así
que está en el dominio: `core/music/tempo.ts`. Quien la hace sonar es
`state/cuenta-atras.ts`, pero el número no vive ahí.

**«Quiero cambiar lo que se le manda al modelo.»** Eso es servidor:
`app/api/versiones/route.ts` para las salidas, y el texto del prompt en
`features/versions/prompt.ts` y `server/prompts.ts`.

## Tres atajos que valen más que todo lo anterior

**La tabla «busco X → está en Y»**, al final de este documento, y su resumen en
[`CLAUDE.md`](../CLAUDE.md). Es más rápida que cualquier búsqueda y es lo primero que
hay que mirar.

**Los tests están pegados al código.** `Staff.tsx` tiene su `Staff.test.tsx` al
lado, en la misma carpeta. Así que si encuentras el fichero ya tienes su test, y
muchas veces **el test se lee mejor que el código**: dice por qué se hizo así y qué
fallo evita.

**Los nombres nuevos van en español.** Sirve para distinguir de un vistazo lo del
proyecto de lo que trae la plataforma: `cuenta-atras.ts` o `CorregirAcorde.tsx` son
nuestros; `useCallback` o `SessionRecorder`, no.

## Dos ficheros que no son código

- [`src/capas.test.ts`](../src/capas.test.ts) es lo que **vigila el diagrama de
  arriba**: si importas `@server/` desde un componente, ese test falla.
- `src/features/direcciones.test.tsx` comprueba que los enlaces entre pantallas
  llevan a alguna parte.

## Si vienes de Angular

El cambio de cabeza es este: allí la plantilla va en un `.html` y su clase en un
`.ts` al lado. **Aquí las dos cosas están en el mismo `.tsx`** —la `x` es por el
marcado que lleva dentro— y por eso no hay carpeta de plantillas: no existen como
ficheros aparte.

Lo demás que se comporta distinto a lo que esperarías —que no hay inyección de
dependencias, que el estado va en Zustand y no en un servicio con
`BehaviorSubject`, y que `useEffect` no es `ngOnInit`— está explicado en
[ARCHITECTURE.md](./ARCHITECTURE.md#notas-para-quien-viene-de-angular).

## La tabla completa: busco X, está en Y

La versión corta, con lo que más se busca, está en [`CLAUDE.md`](../CLAUDE.md).

| Busco...                                                        | Está en                                                                                        |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Teoría musical: escalas, acordes, grados, tonalidad             | `src/core/music/`                                                                              |
| Funciones armónicas y sustitución (T/S/D)                       | `core/music/harmonic-function.ts`                                                              |
| La teoría que se le da al profesor, y cómo se comprueba         | `core/music/glossary.ts` (adr/0076)                                                            |
| El examen del profesor contra el modelo de casa                 | `scripts/examen-del-profesor.ts`                                                               |
| Qué acorde proponer y en qué orden                              | `core/music/suggestions.ts` + `styles.ts`                                                      |
| Con qué se rearmoniza, y cómo se comprueba                      | `core/music/reharmonization.ts` (`MOVES`, trece), `partir.ts` (ii–V, por pulsos)               |
| Las formas que se reconocen y el reposo frigio de la andaluza   | `core/music/formas.ts` (adr/0099)                                                              |
| Los doce estilos y cómo se agrupan en el selector               | `core/music/styles.ts` (`STYLE_GROUPS`, adr/0098)                                              |
| Por dónde puede tirar lo que tocas, y qué lo valida             | `core/music/paths.ts`, `progressions.ts` (`saltosDeSalidas`)                                   |
| Lo que tocas, convertido en compases                            | `core/music/capture.ts`                                                                        |
| La armadura, y qué nota va en cada línea                        | `core/music/circle-of-fifths.ts`                                                               |
| El punteo: alturas, figuras y cómo se escribe cada nota         | `core/music/melody.ts`                                                                         |
| El temario: cursos y unidades                                   | `core/music/curriculum.ts` (adr/0096)                                                          |
| De qué va cada unidad y qué entra, fuera del temario por peso   | `core/music/presentaciones.ts`, `resumenes.ts`                                                 |
| Las preguntas de teoría, por asignatura                         | `core/music/lecciones/` (`lenguaje`, `armonia`, `comun`); `lessons.ts`                         |
| Escribir cada nota con su letra, y nombrar intervalos           | `core/music/spelling.ts`                                                                       |
| El dictado de intervalos y las demás clases de oído             | `core/music/ear.ts` (`EarKind`, adr/0044)                                                      |
| Presentación → teoría → prueba, y «Ir directo a las preguntas»  | `learn/UnidadPorMomentos.tsx`, `PresentacionDeUnidad.tsx`                                      |
| Qué posiciones de una lección sobreviven en la cola de repaso   | `core/music/posiciones.ts` (`parseProgress`)                                                   |
| Detección de tono (autocorrelación)                             | `src/audio/autocorrelation.ts`                                                                 |
| Detección de acordes en vivo (croma + plantillas)               | `audio/chroma.ts`, `audio/chord-engine.ts`                                                     |
| Volver a escuchar lo grabado, con calma                         | `audio/offline-chords.ts`, `audio/fft.ts`                                                      |
| Abrir y cerrar el `AudioContext`, en un solo sitio              | `audio/audio-context.ts`                                                                       |
| Mástil, afinaciones, formas de acorde                           | `src/core/instrument/`                                                                         |
| Estado de sesión y persistencia                                 | `src/state/` (IndexedDB)                                                                       |
| Lo que se recuerda de una vez para otra                         | `state/workspace.ts` (tono, estilo, escala)                                                    |
| Quién abre el micro, y por qué es uno solo                      | `state/use-listening.ts`                                                                       |
| Cómo se presta ese micro a quien graba                          | `audio/stream-source.ts` (`StreamSource`)                                                      |
| La cuenta atrás antes de apuntar, y dónde cae el compás 1       | `state/cuenta-atras.ts`                                                                        |
| El volumen del clic, y si hay una toma sonando                  | `state/claqueta.ts`                                                                            |
| El clic: ruido filtrado, y con qué se filtra                    | `audio/metronome.ts`, `audio/biquad.ts`                                                        |
| El acorde del bloque que tienes elegido                         | `state/acorde-elegido.ts`                                                                      |
| Las teclas del banco de componer                                | `state/atajos-del-banco.ts` (`ATAJOS`)                                                         |
| Lo que el copiloto propone y nadie ha aceptado                  | `state/propuesta.ts`, `arrange/BloqueFantasma`                                                 |
| Oír una progresión desde un componente                          | `state/use-progression-player.ts`                                                              |
| Un estado que se mira y al que uno se apunta                    | `core/estado-observable.ts` (`Emisor`)                                                         |
| Grabar el sonido y descargarlo                                  | `src/media/` + `arrange/TocarParaEscribir` («Solo grabar»)                                     |
| Llevarte la canción a un secuenciador                           | `core/music/midi.ts`, `media/descargar.ts`                                                     |
| Rutas de servidor de la IA                                      | `app/api/teacher`, `/versiones`                                                                |
| El cuerpo común de las dos rutas, y sus puertas                 | `server/ai-route.ts`, `server/ai-gate.ts`                                                      |
| La llamada al modelo, y el único sitio con el SDK               | `server/ask-model.ts`                                                                          |
| Quién contesta —API, modelo de casa o dominio—                  | `server/ai-model.ts`, `local-model.ts`                                                         |
| Por dónde entra texto libre, y qué lo acota                     | `learn/teacher-contract.ts`, `versions/contract.ts`                                            |
| Una canción guardada, y qué papel hace cada parte               | `core/music/song.ts` (`ROLES`), `server/songs-repo.ts`                                         |
| Un acorde cualquiera, convertido en bloque                      | `core/music/capture.ts` (`comoBloque`)                                                         |
| El montaje por bloques, y lo que dura cada acorde               | `core/music/arrangement.ts` + `state/`                                                         |
| El lienzo: arrastrar bloques, estirarlos, escucharlos           | `features/arrange/`                                                                            |
| La cola de acordes que hay que preguntar, y su panel            | `arrangement.ts` (`bloquesEnDuda`) + `arrange/CorregirAcorde`                                  |
| Componer tocando: el micro escribe lo que suena                 | `arrange/TocarParaEscribir` + `state/use-tocar-y-apuntar`                                      |
| Lo tocado convertido en una parte, para los dos sitios          | `state/apuntar-lo-tocado.ts`                                                                   |
| Qué se estaba tocando en una toma, y qué motor la lee           | `core/music/capture.ts` (`PapelDeLaToma`)                                                      |
| Ensayar lo escrito y puntuarlo                                  | `core/music/ensayo.ts` + `state/use-ensayo.ts`                                                 |
| El reparto del banco: áreas, divisores, espacios                | `state/banco.ts`, `ui/Area`, `ui/Divisor`                                                      |
| El pentagrama, y la clave de sol dibujada                       | `arrange/Staff.tsx` + `arrange/clef.ts`                                                        |
| Guardar y abrir tus canciones                                   | `features/songs/`, `src/app/api/canciones`                                                     |
| Salidas de lo que tocas, y su verificación                      | `features/versions/` (se llamará `salidas/`)                                                   |
| Planes, permisos y si una unidad la abre el plan                | `src/core/billing/` (`plans.ts`, `access.ts`)                                                  |
| Cuántas preguntas del cupo gasta cada petición                  | `core/billing/cost.ts` (`unidadesDe`, adr/0067)                                                |
| Meta diaria, racha, medallas, y lo que suma componer            | `core/music/progress.ts` (`practiceCompose`)                                                   |
| Que lo compuesto llegue al avance sin saltarse capas            | `state/hechos-de-componer.ts`, `learn/use-ganancia-al-componer`                                |
| La cola de repaso de lo fallado                                 | `core/music/review.ts`                                                                         |
| Por qué una pregunta sale o vuelve a la cola                    | `core/music/review.ts` (`mergeReview` manda)                                                   |
| Cuentas, contraseñas, base de datos y cupos                     | `src/server/`                                                                                  |
| El tope de intentos al entrar, y por qué son dos claves         | `server/auth.ts`, `core/auth-errors.ts`                                                        |
| El marco de una pantalla, su ancho y lo que va al lado          | `src/ui/Screen.tsx` (`Screen`, `aside`, `WorkHeader`)                                          |
| La diana de cada tonalidad en la rueda                          | `features/wheel/WheelOfFifths.tsx` (`DIANA`, adr/0074)                                         |
| Lo que se ve cuando todavía no hay nada                         | `src/ui/Vacio.tsx`, `ui/EmpezarPorTonalidad`                                                   |
| Un formulario, y el error que se anuncia                        | `src/ui/Formulario.tsx`, `src/ui/Aviso.tsx`                                                    |
| La tonalidad plegada en una línea, con su rueda                 | `features/wheel/BarraDeTonalidad.tsx`                                                          |
| Leer lo que llega de fuera, y el error que contestó             | `core/parse.ts`, `state/api-error.ts`                                                          |
| Tokens de diseño y las dos paletas                              | `src/ui/tokens.ts` (+ espejo en `globals.css`; `border-strong` para controles)                 |
| Las tres letras, y desde dónde se sirven                        | `app/fuentes.ts`, `app/_fuentes/`                                                              |
| El piloto, el hueco y la ventana del profesor                   | `.piloto`, `.hueco`, `.ventana-pixel` en `app/globals.css`                                     |
| El marco común, montado una vez para las pantallas de trabajo   | `app/(marco)/layout.tsx` (las páginas viven en `src/app/(marco)/`)                             |
| Qué se ve cuando una pantalla revienta o no existe              | `app/Averia.tsx`; `error.tsx`, `(marco)/error.tsx`, `global-error.tsx`                         |
| La marca del prompt, y cómo se borra en cualquier disfraz       | `core/marca.ts`                                                                                |
| El reparto de opciones de una pregunta, estable por unidad      | `core/music/baraja.ts`                                                                         |
| Traer a la vista lo enfocado en una tira que se desplaza        | `ui/use-traer-a-la-vista.ts`                                                                   |
| Cerrar un `popover` cuando el foco se va                        | `ui/cerrar-al-salir-el-foco.ts`                                                                |
| Listar los micrófonos sin abrir ninguno                         | `audio/entradas-de-audio.ts`                                                                   |
| Qué trae cada plan, con las palabras de las tarjetas            | `features/account/lo-que-va-con-plan.ts`                                                       |
| Quién revisa un cambio y quién pone al día la documentación     | `.claude/agents/` (`revisor`, `documentalista`)                                                |
| El rótulo de un apartado y un enlace dentro de una frase        | `.rotulo` y `.enlace` en `app/globals.css`                                                     |
| Qué micro se usa, y el mando para elegirlo                      | `state/microfono.ts`, `workspace/ElegirMicro` (adr/0092)                                       |
| El recorrido de la primera visita y dónde se recuerda           | `features/tour/`, `state/recorrido.ts` (adr/0094)                                              |
| Cambiar de escala sin salir del mástil                          | `fretboard/EscalaDelMastil.tsx` (adr/0093)                                                     |
| El bucle de intentos al modelo y el respaldo si falla           | `server/ai-intentos.ts` (adr/0088)                                                             |
| Las salidas que el dominio construye y el modelo elige          | `core/music/paths.ts` (`salidasPosibles`), `features/versions/menu.ts` (adr/0089)              |
| Qué encaja de lo que se propone, y por qué (los once criterios) | `core/music/encaje.ts` (adr/0097)                                                              |
| Lo que la petición sabe de tu canción además de los grados      | `core/music/contexto-de-salidas.ts`, `versions/menu.ts` (`contextoDe`)                         |
| Poner una salida en la canción, cambiando solo su parte         | `features/versions/aplicar-salida.ts`                                                          |
| Por qué no hay salidas para una canción                         | `core/music/paths.ts` (`porQueNoHaySalidas`)                                                   |
| Medir las salidas: dominio y modelo de verdad                   | `core/music/corpus-*.ts`, `pnpm examen:salidas`                                                |
| Cuánto pesa de verdad el prompt de las salidas                  | `app/api/versiones/presupuesto.test.ts`                                                        |
| Que lo que dice una salida sea verdad, sitio por sitio          | `core/music/lo-que-dice.ts` (adr/0101)                                                         |
| El profesor, y de dónde salen sus píxeles                       | `ui/Mascota.tsx`; los dibuja `arte/mascota/build.py`                                           |
| El icono de la pestaña y el de la pantalla de inicio            | `app/icon.svg`, `favicon.ico`, `apple-icon.png`; los saca `arte/mascota/iconos.py`             |
| La escena de la portada, y de dónde salen sus capas             | `app/EscenaPortada.tsx`; la dibuja `arte/portada/build.py`                                     |
| Medir el motor de acordes con grabaciones                       | `scripts/medir-tomas.ts`, `core/music/medir-tomas.ts`, `pnpm medir:tomas` (`docs/MEDIR.md`)    |
| Leer un WAV                                                     | `core/wav.ts`                                                                                  |
| Qué acepta cada modelo y cuánto cuesta                          | `core/billing/cost.ts` (`MODEL_PRICES`), `server/ask-model.ts` (`opcionesDelModelo`, adr/0103) |
| Ingreso neto, IVA y pago anual                                  | `core/billing/cost.ts` (`netoDeUnCobroMicros`, adr/0106)                                       |
| La pasarela y los precios por país                              | `core/billing/` y `server/` (adr/0105)                                                         |
| Contar el uso y la retención, sin seguir a nadie                | `core/analytics.ts`, `server/metricas.ts`, `app/api/metricas`, `state/metricas.ts` (adr/0110)  |
| Titular, privacidad y aviso legal                               | `server/titular.ts`, `app/(marco)/privacidad`, `aviso-legal` (adr/0111)                        |
| La edad para crear cuenta                                       | `server/users.ts` (`createUser`), `account/AccessForm` (adr/0111)                              |
| El recorrido, por tramos y pantallas                            | `features/tour/` (`tramos.ts`), `state/recorrido.ts` (adr/0108)                                |
| Qué sale del espectro: el croma y el bajo                       | `audio/chroma.ts` (`leerEspectro`, adr/0107)                                                   |
| La escala de fábrica de una tonalidad, y leerla                 | `state/workspace.ts` (`escalaDeLaTonalidad`, `selectEscala`, adr/0109)                         |
| Contra quién y a qué coste se examina la IA                     | `scripts/contra-la-api.ts` (`--api`, adr/0112)                                                 |
| Techo de gasto de la IA, y cómo se cierra                       | `server/ai-gasto.ts` (adr/0114)                                                                |
| Plazo de gracia de un plan impagado                             | `core/billing/plans.ts` (`planEnVigor`)                                                        |
| La marca, su clave y el tope en el peor alfabeto                | `core/marca.ts` (adr/0115)                                                                     |
| Enlaces y cebos en lo que escribe el modelo                     | `core/prosa-del-modelo.ts`                                                                     |
| Fundir el avance que sube a la cuenta                           | `server/progress-repo.ts` (`fusionarAvance`, adr/0116)                                         |
| Tope de lo que escribe una cuenta                               | `server/tope-por-cuenta.ts`                                                                    |
| Lo que se hace al arrancar el servidor                          | `src/instrumentation.ts`                                                                       |
| Tope de largo de la contraseña                                  | `server/password.ts` (`MAX_PASSWORD_LENGTH`)                                                   |
| El rol con el que entra la aplicación a la base                 | `scripts/rol-de-la-aplicacion.mjs` (adr/0117)                                                  |
| TLS hacia la base de datos                                      | `server/db/client.ts` (`tlsPara`, adr/0117)                                                    |
