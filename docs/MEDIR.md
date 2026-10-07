# Medir con lo que no tiene un agente

Dos medidas que **solo puede hacer quien tiene la guitarra y la clave**, y de las
que cuelga casi todo el [ROADMAP](./ROADMAP.md): si el motor acierta con guitarras
de verdad, y si el modelo de pago aporta algo a las salidas y al profesor. Las dos
caben en una tarde. Lo que decide si la aplicación sirve a alguien más está en
[VALIDAR.md](./VALIDAR.md).

## 1. El motor de acordes, con guitarras de verdad

Lo medido hasta hoy sale de una guitarra sintética y de un solo rodaje con una
guitarra (23 de septiembre de 2026). La sintética no sirve para calibrar: tiene
justo los armónicos que se le pusieron.

### Qué hace falta

- **5 guitarras, pidiéndolas prestadas**, cuanto más distintas mejor: clásica de
  nailon, acústica de acero, eléctrica en limpio, una barata y una buena.
- **3 micros**: el del **portátil**, el del **móvil** y una **interfaz** con micro
  (o la eléctrica por línea).
- Cada guitarra afinada antes, con `/afinar`.

### Qué se graba

Por cada guitarra y cada micro, **trece tomas**:

- **C, G, D, Am, Em y F** abiertos, cada uno **rasgueado** y **arpegiado** (cuerda a
  cuerda, del grave al agudo: lo que a veces se llama puntear el acorde).
- **Una progresión**: `C G Am F` rasgueada, dos compases por acorde.

5 × 3 × 13 = **195 tomas**, unos 35 minutos de audio. Cada acorde sale en 30 o 45
tomas, y el script no da veredicto con menos de 15.

### Cómo se graba

- **8 a 10 segundos por toma**, con **un segundo de silencio al principio**: el
  motor mide el ruido de la sala en los silencios de la propia grabación.
- **Rasgueo**: un golpe hacia abajo por pulso a unos 80 bpm, dos compases, y dejar
  sonar. **Arpegio**: el acorde cuerda a cuerda, dejándolo sonar, dos veces.
- **Distancia**: el portátil y el móvil, sobre la mesa a 50 cm–1 m, como se usaría
  de verdad; la interfaz, el micro a 20–30 cm del traste 12.
- Nada más sonando: ni metrónomo por altavoz ni música de fondo.
- **Lo más fiel es grabar con la propia aplicación**: «Solo grabar» en componer
  descarga un webm o m4a con el mismo micrófono y el procesado apagado
  (`echoCancellation`, `noiseSuppression` y `autoGainControl` en falso). Una
  grabadora del móvil sirve, pero suele comprimir y limpiar, y eso ya es otro micro.

### Dónde se dejan

**Fuera del repositorio**, por ejemplo en `~/tomas-de-guitarra/`. Si se dejan
dentro, en `tomas/`, que está en `.gitignore` igual que cualquier `.wav`, `.m4a` o
`.webm`. **El audio no sale del equipo**: ni a la IA, ni a un commit.

Cada fichero se llama `guitarra_micro_acordes[_forma][_lo-que-sea]`:

```
ana-clasica_portatil_Am_rasgueo.wav
ana-clasica_movil_C-G-Am-F_rasgueo.m4a
yamaha_interfaz_F_arpegio_2.wav
```

Los acordes de una progresión van con guiones; la forma es `rasgueo` o `arpegio`;
lo que vaya detrás no se mira. **Lo que no cabe en un nombre** —una tonalidad, una
inversión, un fichero que ya se llamaba de otra manera— va en un `etiquetas.csv` en
la carpeta, que manda sobre el nombre:

```
fichero;guitarra;micro;acordes;forma;tonalidad
grabacion-031.m4a;ana-clasica;movil;C G Am F;rasgueo;C
```

Con coma o punto y coma; los acordes separados por espacios; `#` empieza un
comentario.

### Cómo se mide

```bash
pnpm medir:tomas ~/tomas-de-guitarra            # la tabla
pnpm medir:tomas ~/tomas-de-guitarra --detalle  # y toma a toma, lo tocado frente a lo escrito
```

Lee WAV directamente; m4a, webm, ogg o mp3 los convierte con **ffmpeg** (`sudo apt
install ffmpeg`), y si no está, lista qué se ha quedado sin medir. Necesita el
Node 24 de `nvm`: con el `/usr/bin/node` de WSL, un 22, falla con «Unknown file
extension .ts», igual que los exámenes.

Pasa cada toma por **el mismo motor en diferido que la aplicación**
(`audio/offline-chords.ts`) y cuenta con `core/music/medir-tomas.ts`. Mide lo que
escribe el análisis **antes de repartirlo en pulsos**: un acorde de 200 ms que
`captureProgression` tiraría aquí cuenta como colado. La tabla sale por acorde,
por guitarra, por micro, por forma y en total:

| Columna          | Qué cuenta                                                              |
| ---------------- | ----------------------------------------------------------------------- |
| `acierto`        | De lo tocado, lo escrito **tal cual**: misma fundamental y mismas notas |
| `con ?`          | Lo escrito con duda, la de la aplicación (`confianzaDe` bajo `DUDOSO`)  |
| `? bien puesta`  | Con duda y mal escrito: la duda sirvió                                  |
| `? de más`       | Con duda y bien escrito: sobraba                                        |
| `seguro y falso` | Sin duda y mal escrito, o colado sin tocarse. **Es el fallo caro**      |
| `fallos con ?`   | De lo mal escrito, cuánto llevaba la duda                               |
| `se leyó como`   | Qué se escribió en su lugar, de más a menos veces                       |

Lo tocado y lo escrito se emparejan **por orden** (distancia de edición), no por
tiempo: así no hay que apuntar cuándo cae cada acorde. Un `Cmaj7` donde iba un `C`
es un fallo: es lo que la aplicación escribiría en el lienzo.

### Qué decide

**Cada uno de C, G, D, Am, Em y F pasa con acierto ≥ 85 % y, de lo que falla,
≥ 85 % con «?»**. El script lo dice al final, acorde por acorde. Es el umbral del
estudio, y se lee en una frase: acierta casi siempre, y cuando falla casi siempre
avisa.

- **Pasa**: el motor sirve para escribir lo que se toca. Lo siguiente es quitar el
  selector de rítmica o punteo (ROADMAP §1).
- **No pasa, pero los fallos llevan «?»**: el motor es honesto y poco certero. Se
  trabaja el acierto —el modelo de armónicos— con estas tomas como banco.
- **No pasa y hay `seguro y falso`**: lo urgente es la duda, antes que el acierto.
  Afirmar algo falso es peor que no saberlo
  ([adr/0043](./adr/0043-dos-maneras-de-equivocarse.md)).

Mira también las filas por micro y por guitarra: si un solo micro hunde la cifra,
el problema es de entrada, no de oído.

**Guarda las tomas.** Son el primer banco de guitarra de verdad del proyecto, y **se
gastan como los corpus**: después de ajustar el motor con ellas, la cifra que dan ya
no es de generalización. Separa antes una guitarra entera para la medida final y
no la mires al ajustar.

Lo que no es medida: el script se probó con 120 tomas sintéticas de Karplus-Strong
(tres guitarras, tres micros simulados, WAV de 16 y 24 bits, estéreo, m4a y webm)
para comprobar que lee, empareja y cuenta. Esas cifras no dicen nada del motor.

## 2. La IA contra el modelo de pago

Hoy todo lo medido de la IA es contra `qwen3:8b`. Lo que no se sabe es si un
modelo grande aporta algo más que el menú del dominio.

### Cambiar de modelo y pasarlo contra la API

Los dos exámenes se niegan a llamar a la API **salvo que se pida con `--api`**:
tener la clave puesta no basta, que es como se paga por descuido. Sin `--api` se
paran y dicen cuánto costaría.

| Variable            | Qué hace                                                 |
| ------------------- | -------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Con ella contesta la API, **y gana** a `OLLAMA_URL`      |
| `ANTHROPIC_MODEL`   | Qué modelo de la API; sin ella, el de `DEFAULT_AI_MODEL` |
| `OLLAMA_URL`        | El modelo de casa, si no hay clave                       |
| `OLLAMA_MODEL`      | Qué modelo de casa; sin ella, `qwen3:8b`                 |

```bash
# Con la clave en el .env:
pnpm examen:profesor --api --json profesor-api.json
pnpm examen:salidas  --api --json salidas-api.json
# Otro modelo sin tocar el .env:
ANTHROPIC_MODEL=claude-opus-5 pnpm examen:salidas --api
```

`--env-file` no pisa una variable que ya venga del entorno, así que la de delante
del comando gana.

### Lo que cuesta una pasada

El script imprime el **techo** antes de empezar: las peticiones por el peor caso
de tokens de cada una (`requestCostMicros`, el mismo cálculo que los cupos), con el
reintento y la reserva para pensar de los modelos que no lo apagan. Lo normal es
bastante menos: las salidas gastan unos 300 tokens de salida de los 900 de tope y
casi nunca reintentan. Con la tabla de `core/billing/cost.ts` del 7 de octubre de
2026:

| Modelo              | `examen:profesor` (88) | `examen:salidas` (80) |
| ------------------- | ---------------------- | --------------------- |
| `claude-haiku-4-5`  | 0,48 $                 | 0,94 $                |
| `claude-sonnet-5-5` | 0,95 $                 | 1,89 $                |
| `claude-opus-5`     | 2,38 $                 | 4,72 $                |
| `claude-fable-5`    | 13,76 $                | 17,63 $               |

Si los precios cambian, la cifra que vale es la que imprime el script. `--tonos`
multiplica: cinco tonalidades son cinco pasadas. **Sin probar todavía**: ninguna
pasada contra la API se ha hecho; el camino es el de la ruta, con su SDK.

### Un sexto corpus, a ciegas

Los cinco corpus de salidas **se han usado para ajustar y ya no miden**
([adr/0097](./adr/0097-las-salidas-se-juzgan-por-lo-que-encajan.md)). Para la
medida contra la API hace falta uno nuevo, **escrito por un músico ajeno que no
haya visto la aplicación ni los corpus**: uno escrito por quien ajusta mide lo que
ya sabe arreglar. El andamio está en `docs/corpus-sexto/` y está vacío a propósito.

1. **El músico escribe `casos.csv`**: unas 50 canciones a medias, mitad mayor y
   mitad menor, mitad para continuar y mitad para retocar, repartidas por estilos.
   Columnas, separadas por `;`:

   | Columna             | Qué va                                                                                                     |
   | ------------------- | ---------------------------------------------------------------------------------------------------------- |
   | `id`                | `S01`, `S02`…                                                                                              |
   | `modo`              | `mayor` o `menor`                                                                                          |
   | `peticion`          | `continuar` o `retocar`                                                                                    |
   | `toma`              | Los compases en grados, `grado:pulsos@especie`, con `?` lo dudoso: `I V vi:2 IV:2@sus4`                    |
   | `pulsos_por_compas` | Vacío es 4                                                                                                 |
   | `papel`             | `estrofa`, `pre`, `estribillo`, `puente`, `final`… o vacío                                                 |
   | `estilo`            | `pop`, `rock`, `blues`, `jazz`, `folk`, `flamenco`, `bolero`, `cine`… o vacío                              |
   | `punteo`            | Opcional: semitonos sobre la tónica por compás, `F` los fuertes, compases separados por una barra vertical |
   | `propondria`        | De tres a cuatro propuestas suyas, en grados, separadas por una barra vertical                             |
   | `nunca`             | Lo que no debería salir nunca, en palabras                                                                 |
   | `comentario`        | Lo que quiera                                                                                              |

   Si prefiere acordes a grados, que escriba en Do mayor o La menor y se traducen.

2. **Se congela con un commit antes de pasar nada.** Esa es la prueba de que se
   escribió a ciegas.
3. Se traduce a `core/music/corpus-sexto.ts` con los predicados de los otros, como
   el quinto, diciendo caso por caso lo que no se pudo traducir. `examen:salidas`
   hoy solo lee `CORPUS`: quien lo traduzca le añade un `--corpus sexto`. **La cifra
   honesta es la primera pasada**, antes de tocar nada.
4. **El músico puntúa a ciegas `juicio.csv`**. Quien pasa el examen rellena una fila
   por salida que vería quien compone —las del modelo y las del respaldo del
   dominio, **barajadas y sin decir de dónde viene cada una**—, con `opcion` como
   letra (`A`, `B`, `C`…), `acordes` y `porque` tal cual salen en pantalla. La
   clave de qué letra es de quién se guarda aparte y no se le enseña. El músico
   rellena solo `juicio` —`bien`, `aceptable` o `mal`— y `comentario`.

Lo que se lee al final: la nota del examen contra el corpus nuevo, y **si el
músico prefiere lo del modelo a lo del dominio solo**. Si no lo prefiere, el modelo
no se paga (ROADMAP §2, «¿contestar desde el dominio?»).
