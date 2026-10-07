# ADR 0080 — Cambiar de modo recuerda lo que era cada bloque

Fecha: 2026-10-02 · Estado: aceptada · Corrige en parte a
[ADR 0030](./0030-cambiar-de-modo-traduce-la-cancion.md), que prometía que casi nada
se perdía y que el deshacer seguía ahí

## Contexto

El [ADR 0030](./0030-cambiar-de-modo-traduce-la-cancion.md) decidió traducir cada
grado por su función y se apoyó en tres frases: «sobreviven todos menos tres», «el
deshacer sigue ahí» y «una operación que no pierde nada». La auditoría de componer
las probó una a una y **ninguna era del todo cierta**:

- **Ir y volver no devolvía la canción.** El `vi` pasa a `VI` en menor y vuelve como
  `bVI`; el `IV`, como `iv`. C G Am F en mayor volvía a mayor como C G Ab Fm. La tabla
  no puede ser reversible: el mayor tiene dieciséis grados y el menor once, así que
  varios de mayor caen en el mismo de menor.
- **Las dominantes secundarias se caían de más.** Quedaban fuera las de `vi` y `iii`,
  que sí tienen contraparte —la del `VI` es el `III`—, y el E7 que lleva a Am
  desaparecía al pasar a menor sin que nadie lo dijera.
- **Traducir gastaba un paso del deshacer, y eso lo atascaba.** Deshacer devolvía los
  grados del modo viejo, la vigilancia los volvía a traducir y apilaba otra vez:
  cada pulsación dejaba la pila como estaba.

## Decisión

**Cada bloque traducido se lleva lo que era** (`Block.delOtroModo`: el modo, el grado
y las alternativas de antes), y al volver al modo de antes se le devuelve tal cual. El
recuerdo solo vale si traducirlo da exactamente lo que hay —la prueba de que nadie ha
tocado el bloque—; si se corrigió en el otro modo, se olvida, porque volver a lo de
antes desharía la corrección. Lo que se escribe en el modo nuevo no trae recuerdo y se
traduce por la tabla. Al leer un montaje guardado, el recuerdo se valida como el resto del bloque, y uno
roto se ignora (`leerRecuerdo`).

**Las dominantes secundarias se traducen por su función**: la `V/vi` pasa a `III` y la
`V/iii` a `VII`, la dominante del grado traducido. **Solo la `V/ii` no tiene dónde
caer**, porque en menor el segundo grado es disminuido y a un disminuido no se le
prepara con su dominante. Esa se quita, **y se avisa**: el almacén guarda
`quitadosAlCambiarDeModo`, con los bloques tal como eran, para poder decirlo y
`olvidarQuitados` lo descarta. Un bloque elegido que se quita deja de estar elegido.

**Traducir no gasta deshacer: sustituye el montaje actual** sin tocar `past`. El
cambio de quien compone fue pulsar la rueda, y se deshace volviendo a pulsarla. Lo de
antes de cambiar de modo se deshace igual: sale en el modo viejo y la vigilancia lo
traduce al vuelo, también sin apilar.

## Consecuencias

**Lo que decía el 0030 es ahora cierto salvo en la `V/ii`**: ir y volver deja la
canción como estaba, y lo único que se pierde se dice. Los dos modos siguen teniendo
tablas distintas, y a solas `degreeInMode` sigue sin ser reversible: lo sostiene el
bloque.

El bloque lleva un campo más, que el lector de montajes sabe leer. Las alternativas
de un bloque oído se traducen igual, y la que no exista en el otro modo se cae de la
lista, pero queda en el recuerdo.

Un `iv` de menor se queda `iv` al pasar a mayor, como ya hacía el `vi` con el `VI`:
suena el mismo acorde, que es el trato de esta traducción, y el cuarto menor prestado
sigue pudiéndose escribir ([ADR 0036](./0036-el-cuarto-menor-prestado.md)).

## Alternativas descartadas

**Traducir también `past`**, para que deshacer entienda del modo. Haría que el
deshacer de un montaje en Do mayor, con la tonalidad ya en La menor, saliera en un
modo que no es el de ahora, y toda la pila tendría que traducirse cada vez.

**Guardar en el almacén el montaje de antes de cambiar de modo**, y volver a él al
volver el modo. Se descarta porque lo escrito mientras tanto se perdería, y porque
es un segundo montaje que mantener al lado del primero; el recuerdo en el bloque
viaja con el bloque, se escriba donde se escriba.

**Apartar la `V/ii` dentro de la parte**, escondida hasta que vuelva el mayor. Un
bloque que no se ve ni se oye pero cuenta en la duración es peor que uno que se quita
y se dice.

**Cambiar la tabla de vuelta**, para que `VI` volviera a `vi`. Rompe el cuarto menor
prestado ([ADR 0036](./0036-el-cuarto-menor-prestado.md)), que depende de que lo que
ya vale en el modo de destino se quede como está.

**Traducir la `V/ii` a un acorde parecido.** Es inventar un acorde que nadie ha
pedido: aquí el dominio devuelve nulo y quien llama decide.
