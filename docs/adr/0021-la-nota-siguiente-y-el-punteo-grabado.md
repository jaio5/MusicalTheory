# ADR 0021 — Qué nota puede seguir, y el punteo que se toca

Fecha: 2026-09-07 · Estado: aceptada · Amplía: [ADR 0019](./0019-punteos-y-partitura.md)

## Contexto

Componer aquí se apoyaba en una lista: qué acorde puede venir después, con su
porqué en una línea. Eso es lo que permite encadenar una progresión sin saber
teoría, y lleva funcionando desde `suggestions.ts`.

**La otra mitad no tenía nada.** Escribir un punteo era colocar notas a ojo sobre
un pentagrama, sin una sola pista de cuál cabe en el hueco siguiente. Quien no
sabe música puede montar el acompañamiento entero y se queda parado en la primera
nota.

Y había una asimetría parecida al grabar: los acordes que tocas caían en el
lienzo, y las notas sueltas no —aunque el motor de tono las viniera midiendo
desde que se abre el micro y guardándolas en el historial de la sesión—.

## Decisión

**`nextNotes` dice qué nota puede ir después**, y ordena por tres cosas en este
orden, que es como se piensa una melodía y no como se clasifica una escala:

1. **Qué acorde suena debajo.** Una nota del acorde cae de pie: suena bien la
   toques cuando la toques. Las demás de la escala funcionan de paso y piden
   seguir andando. Por eso hace falta `chordAt`, que dice qué acorde hay en cada
   pulso: sin él la propuesta sería la misma en toda la canción.
2. **De dónde vienes.** Después de una nota, lo más fácil de cantar —y lo que más
   suena a melodía y no a ejercicio— es la de al lado. Un salto grande se ofrece
   detrás.
3. **Si está en la escala.** Lo de fuera va al final y **se ofrece**: una nota
   cromática entre dos de la escala es medio idioma del blues, y esconderla sería
   mentir sobre lo que se puede tocar.

Va **siempre a la vista**, en una fila de píldoras bajo los acordes, con el mismo
código de tres colores que ya usan los bloques y la letra al lado. En fila y no
en lista como los acordes porque son siete: con el porqué de cada una debajo
ocuparían la columna entera y dejarían los acordes fuera de pantalla.

**Y `captureMelody` pasa lo punteado a la partitura.** Es el hermano de
`captureProgression`, con la misma forma: pulsos, figuras escribibles, y lo que no
cabe contado en vez de recortado.

**Las notas iguales seguidas se funden.** El historial de la sesión reapunta la
misma altura cada cuarto de segundo mientras suena —para lo que se hizo, adivinar
la tonalidad, bastaba—, y al transcribir eso parte cada negra en trozos: un punteo
de seis notas salía como quince, y así se vio grabando uno de verdad. Con ello se
acepta una pérdida que conviene decir: **dos notas iguales repetidas se escriben
como una sola larga**. Este motor mide altura, no ataques, así que no las
distingue; entre una redonda donde había dos negras o quince notas donde había
seis, lo primero se parece más a lo que sonó. Es hermana de la limitación del
croma con las inversiones: se asume y se dice.

## Consecuencias

Se puede componer entero sin saber teoría: los acordes se encadenan de la lista y
las notas también. Y lo que tocas llega a la partitura sin pasar por escribirlo.

`PlayedNote` gana `clarity`, que se calculaba en cada análisis y se quedaba en el
estado sin llegar a nada. Todavía **no se usa** para marcar notas dudosas como se
hace con los acordes: el dato ya está y la marca es lo siguiente.

`nextNotes` no compone: no sabe de frases, ni de tensión a lo largo de ocho
compases, ni de dónde respira una melodía. Dice qué cabe en el hueco siguiente,
que es una pregunta mucho más pequeña y la única que se puede contestar sin
inventarse nada.

## Alternativas descartadas

**Ofrecer solo las notas de la escala**, que es lo más seguro para quien no sabe:
así no habría manera de escribir algo que desafine. Se descarta por lo mismo que
en [ADR 0019](./0019-punteos-y-partitura.md) se decidió guardar semitonos y no
grados de escala: cierra el cromatismo. Lo que se buscaba con ello se consigue
igual con el orden —lo de fuera va al final y dicho— sin cerrarle la puerta a
nadie.

**Ordenar solo por la escala, sin mirar el acorde.** Es mucho más simple: una
escala son siete notas y ya está. Se descarta porque entonces la lista es idéntica
en toda la canción, y lo que hace que una nota suene bien o mal en un sitio
concreto es justo el acorde que hay debajo. Sin eso, el refuerzo diría lo mismo
sobre un I que sobre un V, que es como no decir nada.

**Un motor de ataques para distinguir dos negras iguales de una blanca.** Es lo
que haría falta para transcribir de verdad, y es otra cosa: detección de onsets
sobre la envolvente, con sus umbrales y su rodaje. Se descarta por tamaño, y
porque lo que hay ahora ya sirve para lo que esta pantalla hace —dejar apuntado lo
que se te ha ocurrido para poder moverlo—. Queda escrito como lo que hay que hacer
si algún día la transcripción tiene que ser fiel.

**Sugerir con el modelo de IA.** Daría propuestas más musicales que una regla de
tres criterios. Se descarta por dos razones y la segunda decide: cuesta cupo cada
vez que se escribe una nota, y **tiene que estar siempre a la vista** —una lista
que aparece cuando el modelo contesta no es un refuerzo, es una consulta—. El
dominio contesta en microsegundos y sin conexión.
