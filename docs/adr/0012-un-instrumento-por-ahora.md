# ADR 0012 — Un instrumento por ahora, y el mapa de lo que costaría el segundo

Fecha: 2026-08-25 · Estado: aceptada

## Contexto

Que esto valga algún día para más instrumentos —que se aprendan a tocar y que
ayude a componer con ellos— está pensado desde el principio. La pregunta de esta
fase no era si se hace, sino **si hay que preparar algo ahora**.

La respuesta pedía medir en vez de suponer, así que se ha medido: cuántos
ficheros de `src/` conocen de verdad la guitarra, entendiendo por eso usar
`GuitarString`, `fretMidi`, `STANDARD_TUNING` o `TUNINGS`.

**Son seis:**

| Fichero                            | Qué sabe                                |
| ---------------------------------- | --------------------------------------- |
| `core/instrument/guitar.ts`        | Cuerdas, trastes y qué nota da cada uno |
| `core/instrument/tunings.ts`       | Las ocho afinaciones                    |
| `core/instrument/voicings.ts`      | Buscar formas de un acorde en el mástil |
| `features/fretboard/Fretboard.tsx` | Dibujar el mástil                       |
| `features/tuner/Tuner.tsx`         | El afinador                             |
| `features/tuner/TuningPicker.tsx`  | Elegir afinación                        |

Y nada más. El resto —la teoría musical entera, el camino de aprender, la
detección de tono y de acordes, las tres rutas de IA, las versiones, los planes,
las cuentas, las canciones— **ya es agnóstico del instrumento**. No por
previsión, sino porque la regla de capas obligó a que `core/music` no supiera de
mástiles ([adr/0001](./0001-capas-y-dominio-puro.md)).

Eso cambia la pregunta. No hay una abstracción que construir: hay seis ficheros
que sustituir, y ya están juntos.

## Decisión

**No se construye un descriptor de instrumento todavía, y no se toca el resto.**
Un `Instrument` del que colgaran afinaciones, mástil y formas sería una
abstracción escrita con un solo caso a la vista, y este proyecto ya sabe cómo
acaba eso: encajando mal con los dos.

Lo único que se ha tocado es **una línea que mentía**. `GuitarString.number`
estaba declarado como `1 | 2 | 3 | 4 | 5 | 6`, y ese tipo decía que aquí solo
caben seis cuerdas. Era falso: `fretboardPositions`, `nearestString` y el buscador
de formas recorren la afinación que se les pase y funcionan igual con cuatro
cuerdas o con siete. Lo único que hacía el tipo estrecho era cerrar una puerta que
el algoritmo tenía abierta. Ahora es `number`, y la numeración de las cuerdas sale
de cuántas hay en vez de una lista escrita a mano: con seis da 6-5-4-3-2-1, y con
cuatro daría 4-3-2-1, que es lo que quiere un bajo. Hay un test que lo fija.

Los textos siguen diciendo «guitarra» donde lo dicen, y eso también es una
decisión: hoy la aplicación es de guitarra, y escribir «tu instrumento» sería más
vago y menos cierto.

## Consecuencias

- Añadir el segundo instrumento sigue costando lo mismo que costaría hoy, y ahora
  se sabe cuánto: seis ficheros y la elección de instrumento en `state/workspace`,
  al lado de la afinación, que ya se guarda.
- El primer instrumento que se añada será el que decida la forma del descriptor,
  que es como debe ser. Un bajo pide casi lo mismo con cuatro cuerdas; un piano
  pide otro dibujo entero y ningún concepto de afinación, y es el que de verdad
  diría si `Instrument` es una interfaz o son dos.
- Mientras tanto, nada que mantener: no hay código muerto esperando a un segundo
  caso.

## Alternativas descartadas

**Escribir el descriptor `Instrument` ahora**, con la guitarra como única
implementación. Es lo que decía el plan de esta fase antes de medir. Se descarta
porque la medición cambió el problema: con seis ficheros acoplados y el resto ya
agnóstico, el descriptor no desbloquea nada que no esté desbloqueado, y sí añade
una interfaz que habría que cambiar en cuanto llegue el primer instrumento que no
tenga trastes.

**Generalizar `core/instrument` a «instrumento de cuerda con trastes»**. Cubriría
bajo, ukelele, banjo y mandolina casi gratis. Se descarta por ahora porque los
cuatro son el mismo caso —cambia el número de cuerdas y poco más— y ese caso ya
está cubierto desde que el número de cuerdas dejó de estar en el tipo. La
generalización que hace falta es la que aguante un piano, y esa no se puede
diseñar sin el piano delante.

**Empezar por el piano**, que es el segundo instrumento más pedido. Se descarta
para esta fase, no para siempre: obliga a un dibujo nuevo, a otra detección —un
piano es polifónico de verdad y el croma se queda corto— y a repensar los
ejercicios de tocar. Es una fase entera, no una semilla.
