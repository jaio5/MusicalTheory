# ADR 0081 — El lienzo se guarda solo, en el navegador

Fecha: 2026-10-02 · Estado: aceptada · Amplía [ADR 0018](./0018-el-lienzo-de-montar.md),
que dejó el lienzo en memoria

## Contexto

El lienzo de componer vivía en memoria, y guardarlo era un botón —«guardar como
canción»— que había que acordarse de pulsar, y que sin plan ni siquiera existe: las
canciones de la cuenta van con el plan Básico. Quien monta una canción **en muchas
sesiones**, que es como se monta, la perdía entera con un F5 o con el navegador
cerrándose solo. El ROADMAP lo tenía como lo primero de la sección desde el 26 de
septiembre de 2026.

Guardarlo no es tan simple como suscribirse y escribir. Arrastrar un bloque cambia el
montaje en cada hueco por el que pasa, la lectura es asíncrona y llega cuando alguien
puede haber escrito ya, y escribir en mitad de una toma no puede bloquear el hilo que
analiza el audio.

## Decisión

**El lienzo que hay se guarda en IndexedDB**, en la misma base que las sesiones
(`caos-ordenado`, que pasa a la versión 2 con el almacén `lienzo`; subirla no borra
nada). **Es uno solo**, sin nombre, con una clave fija y un número de versión dentro, y
**la lectura es tolerante**: lo que no es de esta versión o no se entiende se ignora,
y basura en la clave no puede dejar `/componer` sin abrir.

- **Primero se lee y después se guarda.** Al revés, el lienzo vacío con el que nace
  el almacén se escribiría encima de lo guardado antes de leerlo.
- **Lo leído solo entra si el lienzo está vacío**, y **sin deshacer detrás**. Si
  alguien ya escribió un acorde o abrió una canción mientras se leía, lo suyo manda y
  se guarda.
- **Se escribe 300 ms después del último cambio** (`RETRASO_DEL_GUARDADO`), y **nunca
  en mitad de un gesto**: si la espera se cumple con un arrastre abierto, se vuelve a
  esperar. Las escrituras van en fila y cada una lee el montaje del momento.
- **Se vuelca en `pagehide`**, sin esperar, para que recargar justo después de escribir
  no pierda el último acorde.
- **No se guarda el deshacer**: es de la sesión.
- Si el navegador no deja escribir —modo privado, cuota llena—, se pierde el guardado
  y no la sesión.

Lo arranca el almacén del montaje al crearse, solo en el navegador, igual que la
vigilancia del modo ([ADR 0079](./0079-el-marco-se-monta-una-vez-y-el-micro-sobrevive-a-navegar.md)).

## Consecuencias

Recargar ya no borra el lienzo. **Es por navegador y no por persona**: no pasa por
ninguna cuenta ni por el servidor, así que quien comparta navegador ve la canción del
otro, y quien cambie de navegador o de aparato no ve la suya. Para eso están las
canciones de la cuenta, y para eso va a [PARA-PUBLICAR.md](../PARA-PUBLICAR.md) antes
de que haya un equipo compartido. Cumple la regla del audio: son grados, pulsos y
notas, y no salen del navegador.

No es una canción con nombre: tener varias sigue pidiendo guardarlas desde Canciones,
y abrir una de ellas sustituye el lienzo.

## Alternativas descartadas

**`localStorage`.** Es síncrono, y escribir en mitad de una toma bloquearía el hilo que
analiza el audio; es la misma razón por la que las sesiones no están ahí.

**Guardar en cada cambio.** Un arrastre son decenas de escrituras para quedarse con la
última.

**Guardarlo como una canción de la cuenta.** Pide plan y red, y mete en la lista de
canciones un borrador que cambia cada pocos segundos.

**Una base aparte.** Dos bases son dos migraciones y dos permisos; la versión 2 de la
que ya había añade un almacén sin tocar los otros.
