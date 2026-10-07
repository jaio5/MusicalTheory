# ADR 0038 — Doce trastes que se vean, en vez de quince que no

Fecha: 2026-09-22 · Estado: aceptada · Corrige: [ADR 0037](./0037-el-mastil-pide-su-alto.md)

## Contexto

El [ADR 0037](./0037-el-mastil-pide-su-alto.md) hizo que el mástil pidiera el
alto que llena su ancho, y con eso pasó de pintarse a 650 píxeles a llenar los
1416 que tenía. **Y seguía viéndose pequeño**, dicho por quien lo usa y medido
después: con quince trastes repartidos en una tira cuatro veces más ancha que
alta, cada traste salía a 94 píxeles y las cuerdas quedaban a 49 unas de otras.

El problema ya no era el hueco —estaba lleno— sino la forma del dibujo. Un
mástil de quince trastes es una tira, y una tira llena sigue siendo una tira.

Los quince venían de cubrir las cinco posiciones de la pentatónica.

## Decisión

**Doce trastes.** `DEFAULT_FRET_COUNT` pasa de quince a doce, y los puntos de
referencia pierden el del quince, que caería fuera del mástil.

En el mismo hueco, medido a 1440 × 900:

|                          | Quince trastes      | Doce trastes |
| ------------------------ | ------------------- | ------------ |
| Ancho de cada traste     | 94 px               | **107 px**   |
| Separación entre cuerdas | 49 px               | **54 px**    |
| A 1920 × 1080            | 63 px entre cuerdas | **78 px**    |

Nada se recorta: la sonda de medidas da cero en todos los tamaños de escritorio,
con la canción escrita y con la canción en blanco.

## Lo que se pierde, y por qué se acepta

**La quinta posición de la pentatónica**, que vive entre el doce y el quince. Es
exactamente lo que justificaba los quince.

Se acepta porque las cuatro primeras son las que se usan aprendiendo, la caja del
rock es la primera, y **la quinta es la misma que la primera una octava más
arriba**: quien llega a necesitarla ya sabe que está ahí. Se prefiere ver bien
cuatro que adivinar cinco.

## Alternativas descartadas

**Separar más las cuerdas sin quitar trastes.** Hace el dibujo más alto para el
mismo ancho, así que pide más altura de ventana, y en un portátil el tope del
ADR 0037 se la quita: se vería mejor solo donde ya se veía bien.

**Que el número de trastes cambie con el tamaño de la ventana.** El mástil
dejaría de ser el mismo dibujo según dónde se mire, y lo que se aprende en una
pantalla no se reconocería en otra. Un diagrama de guitarra se memoriza por su
forma.

**Dejarlo en quince y subir el tope del alto.** Es empujar el arreglo por debajo
de lo que necesita para no cortarse, que es justo lo que el ADR 0037 acababa de
arreglar.

**Poder elegirlo.** Un ajuste más para algo que tiene una respuesta buena. Si
alguna vez hacen falta los quince, el número ya es una constante del dominio y
`fretboardPositions` sigue aceptando cuántos se le pidan.
