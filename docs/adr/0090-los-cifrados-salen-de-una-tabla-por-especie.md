# ADR 0090 — Los cifrados salen de una tabla por especie, y la grafía de la tríada

Fecha: 2026-10-03 · Estado: aceptada · Amplía:
[ADR 0035](./0035-un-bloque-sabe-que-no-lleva-tercera.md) y
[ADR 0042](./0042-la-especie-dice-lo-que-el-grado-no-sabe.md)

## Contexto

Tres fallos de cifrado, medidos recorriendo todas las tonalidades:

1. **`seventhNotes` salía de `CHORD_SHAPES`**, que no tiene `mMaj7` ni `maj7#5`, y
   caía a `[0, 4, 7]`. Por eso `C6` y `Cadd9` se guardaban como `CmMaj7` (**456
   casos**).
2. **Sostenido donde iba bemol**: **143 de 4.212** cifrados, como `A#7` en Do.
3. **La barra de componer a 390 px** se solapaba: la pastilla del micro pisaba la
   marca (**41 de 112** medidas con solape).

## Decisión

- **`seventhNotes` sale de `SEVENTHS`**, un `Record` por especie en
  `core/music/chords.ts`: el compilador no deja que falte una. Lo que no es séptima
  entra como su tríada.
- **`grafiaDeLaFundamental` lee la alteración de la tríada del grado**, no una regla
  «grado b → bemol». Lo usa también `sonidoDe` en `ear.ts`. Resultado: **0 de
  4.212**.
- **La pastilla del micro le quita sitio primero a la marca y luego a su rótulo**
  (`MicButton`). Solapes **41 → 0**.

## Consecuencias

- Un acorde con sexta o novena añadida deja de volver como menor con séptima mayor.
- **La sonda `sonda-de-medidas` no ve los solapes entre hermanos**: este se
  encontró mirando, no midiendo. Está en `CLAUDE.md`.

## Alternativas descartadas

**Añadir `mMaj7` y `maj7#5` a `CHORD_SHAPES`.** Tapa los dos casos y deja la tabla
que puede quedarse corta, con otra caída a `[0, 4, 7]` esperando.

**Devolver nulo** para lo que no es séptima: obliga a todos los llamadores a
tratar un caso que antes funcionaba.

**Una especie «sexta».** Una más que `blockChord` tiene que traducir, para algo que
es una tríada con una nota añadida.

**Copiar la regla «grado b → bemol».** Falla en los grados que no llevan b y en
tonalidades con sostenidos.

**La pastilla del micro en dos líneas**: sube la barra de 44 px a más.

**Recortar con `overflow`.** Esconde el solape; no lo quita.
