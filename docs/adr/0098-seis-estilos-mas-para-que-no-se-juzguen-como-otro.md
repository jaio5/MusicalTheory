# ADR 0098 — Seis estilos más, para que un funk no se juzgue como un blues

Fecha: 2026-10-05 · Estado: aceptada · Amplía el
[ADR 0097](./0097-las-salidas-se-juzgan-por-lo-que-encajan.md) y se apoya en el
[ADR 0015](./0015-un-solo-canal-de-texto-libre.md)

## Contexto

El 0097 dejó escrito lo que fallaba: los idiomas fuera de los seis estilos
—cine, country, reggae, funk— y los que no tenían estilo, como el bolero o el
flamenco. Las salidas de una canción así se juzgaban con **el estilo más cercano**:
un funk como blues, un bolero como jazz, una andaluza como nada. El juez no se
equivocaba por torpeza, sino porque lo que hace que cada uno sea él no estaba en
ninguna tabla: el `I7` que no se mueve, el `II7` del country, el vaivén del reggae,
el V mayor que es reposo y no tensión.

## Decisión

**Doce estilos, no seis.** Se suman `funk`, `country`, `reggae`, `bolero`,
`flamenco` y `cine` a `StyleId` y a `STYLES` (`core/music/styles.ts`), cada uno con
su resumen, sus escalas, sus consejos y el peso de cada familia de acordes.

- **El selector los agrupa** en `STYLE_GROUPS` por lo que se toca, no por género:
  «De riff» (rock, metal, blues, funk), «De canción» (pop, folk, country, reggae) y
  «De armonía» (jazz, bolero, flamenco, cine) —la que vive del color: secundarias,
  préstamos, el modo—. Cada estilo está en un grupo y solo en uno; lo vigila su
  test.
- **El estilo ya viaja**: la barra manda un `StyleId` enumerado y el contrato lo
  valida, así que no entra texto nuevo por la ruta. A la IA solo llega el nombre.
- **Los giros de cada uno viven donde se juzgan y donde se construyen**
  (`core/music/encaje.ts` y `paths.ts`), con la misma vara para los dos. Algunos
  ejemplos: el funk y el blues comparten el idioma de dominantes (`deDominantes`);
  el reggae admite el ir y venir del IV a la I; el country usa **una** secundaria
  suelta, el `II7` delante del V, y no la cadena; el jazz y el bolero son los
  `FUNCIONALES`, que viven de que la dominante llegue; el flamenco reposa en su V
  ([ADR 0099](./0099-formas-y-movimientos-nuevos.md)).
- **El country no tiene préstamo de casa**, ni siquiera el bVII. El arreglista lo
  tachó en los dos menús de country que se examinaban como folk, y el estilo propio
  va más lejos que el folk.

## Consecuencias

- Lo que antes se juzgaba «con el criterio de uno de los seis» tiene ahora el suyo.
  **Cuánto mejora no está medido contra gente nueva**: los corpus que hay se han
  usado para ajustar (ADR 0097), y el quinto, el que mediría esto, se está pasando
  ahora.
- Un estilo más es una entrada en `STYLES`, un sitio en `STYLE_GROUPS` y, si su
  idioma es distinto, un giro en el juez y en el generador. Quien añada un estilo
  tiene que mirar los tres, o se juzga con el criterio del más cercano sin que
  falle nada.
- El nombre del estilo ocupa lo mismo en el prompt que los otros: no sube el
  presupuesto ([ADR 0100](./0100-hacer-sitio-en-el-prompt-sin-subir-el-presupuesto.md)).

## Alternativas descartadas

**Seguir con seis estilos y «el más cercano».** Es lo que hacía fallar esos
idiomas: el funk pedía `I7` y el juez, con la cabeza de blues, lo premiaba por otra
razón; el bolero perdía sus dominantes encadenadas al juzgarse como un jazz sin
`ii–V`.

**Un estilo «libre» por texto.** Dejar que quien compone escriba «flamenco» o
«bolero» abría un segundo canal de texto libre hacia el modelo, y el
[ADR 0015](./0015-un-solo-canal-de-texto-libre.md) dejó uno solo. Además el dominio
no sabría qué hacer con un nombre que no conoce: lo que no está en `STYLES` no se
juzga.

**Dar préstamos al country.** El arreglista los tachó: un bVII o un iv de paso
sonaba a folk o a rock en un country, y hacía que el menú pareciera de otra música.
Sin préstamos propios, el country vive de su `I – IV – V` y del `II7`.
