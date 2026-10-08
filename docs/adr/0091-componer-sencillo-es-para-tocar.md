# ADR 0091 — Componer sencillo es para tocar

> **Sustituido por [ADR 0095](./0095-se-quita-componer-sencillo.md):** la versión sencilla ya no existe.

Fecha: 2026-10-03 · Estado: sustituida por [ADR 0095](./0095-se-quita-componer-sencillo.md) · Sustituye en parte a
[ADR 0087](./0087-componer-sencillo-es-una-pagina-de-prueba.md), que seguía el orden
de un editor de fichas · Ampliado en lo del primer acorde por
[ADR 0072](./0072-la-claqueta-suena-toda-la-toma.md)

## Contexto

La página del [ADR 0087](./0087-componer-sencillo-es-una-pagina-de-prueba.md) tenía
pocos mandos, pero seguía siendo **un editor de fichas**: se pulsaban acordes para
escribir la canción y tocar era la séptima cosa de la página. A 390 px, con la
tonalidad puesta, el botón «Tocar» caía en el píxel 993 de una pantalla de 844,
**debajo del pliegue** y por debajo de seis tarjetas de acordes.

Lo que se pidió fue otra cosa: **«elegir la tonalidad, tocar, que sepa lo que estás
tocando, que te proponga acordes»**. Con la guitarra en las manos y la pantalla a un
metro.

## Decisión

**La página se rehace como una pantalla para tocar**: en cada estado hay una sola
cosa principal que hacer, y es siempre el mismo botón grande, en el mismo sitio
(`screens/ComposeSimpleScreen.tsx`, piezas en `screens/componer-sencillo/`).

- **Cinco estados y un solo botón fijo**, de 88 px y todo el ancho: sin tonalidad
  (se elige), listo (**Tocar**), contando (**Dejarlo**), tocando (**Parar**) y
  parado con canción (**Seguir tocando**). Cambia lo que dice, no dónde está.
- **Un escenario** encima del botón, la caja hundida donde sale lo que la aplicación
  oye: **el acorde en grande, con su nombre de guitarrista** («El cinco: tensión,
  pide volver al uno», `palabras.ts`), el nivel con «Te oigo» y la tira de lo tocado
  en una fila fija.
- **Las propuestas viven dentro del escenario durante la toma**, para que el acorde
  y por dónde seguir se vean a la vez a 390×844 y a 390×667. Son cuatro casillas de
  alto fijo.
- **Las propuestas no suenan durante la toma**: lo que saliera por el altavoz lo
  apuntaría el micro. Fuera de la toma suenan el último acorde y el propuesto.
- **La tonalidad fijada manda y la detección no se aplica sola.** La activa cambia
  cada medio segundo; si mandara, un cambio de modo traduciría la canción
  ([ADR 0030](./0030-cambiar-de-modo-traduce-la-cancion.md)) sin que nadie lo
  pidiera. «Cambiar» abre la elección **sin quitar la fijada**.
- **La tonalidad se detecta también rasgueando**, con el croma y Krumhansl
  (`componer-sencillo/por-los-acordes.ts`): hacen falta tres acordes distintos
  (`ACORDES_PARA_DECIDIR`) y se cuenta la tríada oída, no las cuatro notas que
  ponen los armónicos. La pantalla completa sigue con el histograma de notas
  sueltas.
- **En menor, el cinco es el mayor**: el `E` de La menor y no el `Em`
  (`propuestas.ts`), que es el de la cadencia andaluza que trae cualquier
  cancionero.
- **La cuenta llega a «¡Ahora!»** y no se queda en el uno: dice cuándo empezar.
- **En directo se lee con `gradoOido`** (`core/music/capture.ts`), la misma lectura
  que hace la toma al escribir. Con `comoBloque` un G7 o un Cmaj7 del croma se
  enseñaban con su séptima y la toma escribía G o C; ahora **lo que se ve es lo
  que se escribe**.
- **Con canción y sin tonalidad fijada no se ofrece buscar tocando**: la detección
  podría contradecir la canción que ya hay.
- **La pastilla del micro no se enseña aquí** —el escenario ya lo dice en grande— y
  **guarda su sitio en todas las pantallas**, para que la barra no se mueva al
  pasar de una a otra.

Medido con la sonda y los WAV de los informes: **2 toques hasta tocar** (antes, 3 y
tocar bajo el pliegue), **2 mandos mientras se toca**, **CLS de la
toma 0,0001** y `axe` sin avisos en los cuatro estados, a 390×844, 390×667 y 1280×800,
en claro y en oscuro.

## Consecuencias

- **Ya no se escribe a mano ni se cambia un acorde de la canción**: eso es la
  completa. Se rehace tocando otra vez o con «Deshacer». Se quitan las fichas
  elegibles, «Más acordes», las salidas de la IA y el texto de cabecera.
- **Las propuestas son siempre cuatro**, no el abanico de 0087.
- La detección por los acordes **no está medida con una guitarra de verdad**, sino
  con WAV sintéticos: una escala, un rasgueo de Am y C G Am F.
- La toma arranca con `conElQueSuena`, así que el acorde de la cuenta no se pierde
  ([ADR 0072](./0072-la-claqueta-suena-toda-la-toma.md)).
- **Para ser la entrada por defecto le falta**: formas del acorde o mástil, tempo y
  compás, guardar con nombre, y ver el estilo y el punteo. Está en el
  [ROADMAP](../ROADMAP.md).

## Alternativas descartadas

**Seguir con el editor de fichas y subir «Tocar».** Deja a tocar como una acción más
entre muchas: el problema no era el orden sino que la página trataba de escribir
acordes pulsándolos.

**Un asistente con pasos.** Convierte la pantalla en un camino con principio y fin,
y es lo que ya se descartó en 0087. Aquí no hay pasos: hay cinco estados y el botón
no se mueve.

**Las propuestas debajo del botón, fuera del escenario.** A 390×667 no cabían a la
vez que el acorde: o se veía lo que suena o por dónde seguir.

**Que las propuestas suenen durante la toma.** Salen por el altavoz, el micro las
oye y las apunta como si se hubieran tocado.

**Aplicar la tonalidad detectada en cuanto sale.** Cambiaría de modo por debajo y
traduciría la canción sin que nadie lo pidiera.

**Esperar a notas sueltas para detectar la tonalidad.** Es lo que pide la completa y
es lo que no hace quien llega con una guitarra a rasguear: rasgueando no sale
nada.

**Leer el acorde en directo con `comoBloque`.** Enseña una séptima que la toma no
escribe.

**El cinco menor en La menor (`Em`).** No es el que trae un cancionero de guitarra
en menor; sí lo es el `E`.

**Dejar la pastilla del micro y la barra como estaban.** La pastilla repetía lo que
el escenario ya dice en grande, y su aparición movía la barra.
