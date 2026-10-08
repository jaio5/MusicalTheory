# ADR 0118 — La canción vive en este navegador, y se dice

Fecha: 2026-10-08 · Estado: aceptada · Ajusta: [ADR 0032](./0032-la-progresion-y-el-montaje-son-lo-mismo.md) en lo que se ve escribiendo

## Contexto

Una auditoría de experiencia de uso de componer encontró tres cosas que
contaban mal dónde está la canción y con qué se escribe:

1. **Guardar parecía de pago.** El lienzo se guarda solo en este navegador desde
   que existe `IndexedDbLienzo` (`state/session-storage.ts`), y nada lo decía: el
   panel Canciones abría con «Guardar tus canciones entra en el plan Básico». Quien
   no paga entendía que lo escrito se perdería.
2. **Dos pestañas se pisaban la canción.** El lienzo guardado es uno; cada
   pestaña guardaba el suyo encima del de la otra sin avisar, y lo último que se
   tocaba en una borraba lo hecho en la otra.
3. **Escribiendo había dos campos para buscar un acorde por su nombre**: «Escribe
   un acorde» en «Qué poner ahora», del lienzo, y «Buscar un acorde» en «A dónde
   ir», cada uno con su lista debajo.

## Decisión

**Canciones dice primero que la tuya ya está guardada**, en este navegador, y
ofrece llevársela: **MIDI** para un secuenciador y **una copia** (`.caos.json`,
`core/music/copia-de-la-cancion.ts`) que se vuelve a abrir aquí con todo —partes,
grados, punteo, tonalidad, tempo—. Abrir una copia entra con deshacer. El plan va
después y dicho como lo que es: guardarla **también** en la cuenta, con nombre, y
abrirla desde otro aparato (`features/songs/EnEsteNavegador.tsx`).

**Lo que una pestaña guarda se cuenta a las demás por un `BroadcastChannel`**, y
la que lo recibe **lo pone y lo dice**: entra con deshacer, en el modo de su
tonalidad, y con un aviso que ofrece «Volver a la de aquí»
(`guardarElLienzo` en `state/arrangement-store.ts`, `LoDeOtraPestana` en
`app/screens/componer/avisos.tsx`). Lo recibido **no se guarda ni se cuenta otra
vez**, y lo que llega igual a lo que hay se ignora: si no, dos pestañas se lo
devolverían para siempre. A mitad de un arrastre no entra; al soltar, lo de esta
pestaña se guarda, se cuenta y manda.

**Escribiendo queda un solo buscador, el del lienzo.** Escribe donde está la
canción y la convierte en grados. «A dónde ir» conserva el suyo en Tocando y
Ensayar, donde el lienzo no está (`buscador` de `NextChords`).

## Consecuencias

La pestaña que no se está mirando se pone al día sola: al volver a ella se ve la
canción de la otra, con el aviso y su deshacer. **La tonalidad no viaja**: cada
pestaña conserva la suya y lo recibido se traduce a su modo, porque cambiar la
tonalidad de una pestaña desde otra movería la rueda de alguien que no la ha
tocado.

Si las dos pestañas escriben a la vez —una dentro de los 300 ms de espera de la
otra—, gana la última que guarda. Con una persona y un ratón no pasa; con dos
personas en el mismo navegador sí, y no se arregla aquí. Mientras dura un gesto
—arrastrar un bloque— no se programa ningún guardado: la espera empieza al soltar
(`avisarAlCerrarElGesto`), y si la página se cierra a medias se escribe lo pendiente.

El canal y la limpieza del guardado cuelgan de `globalThis`, como la conexión de
`server/db/client.ts`: sin eso, cada recarga en caliente de `next dev` dejaba otro
canal abierto con su oyente.

`BroadcastChannel` se usa sin comprobar si existe: lo traen todos los navegadores
desde 2022 y la aplicación ya pide `popover`, que es de 2024.

La copia es de esta aplicación: otro programa no la abre. Para llevar la canción
fuera está el MIDI, que pierde los grados y las partes.

## Alternativas descartadas

**Escuchar el evento `storage`.** Es lo primero que se pensó y no sirve: solo
avisa de cambios en `localStorage`, y el lienzo vive en IndexedDB por no bloquear
el hilo del audio al escribir.

**Avisar sin poner lo de la otra pestaña** («Esta canción ha cambiado en otra
pestaña: recarga»). Deja a la pestaña de detrás con una canción vieja que, al
tocarla, vuelve a pisar la buena: el aviso no impide el fallo, lo cuenta.

**Bloquear la segunda pestaña** («Componer ya está abierto en otra pestaña»).
Es lo más seguro y lo más hostil: quien abre dos pestañas casi siempre quiere
mirar algo en la otra, no escribir dos canciones.

**Sincronizar también la tonalidad.** Haría de las dos pestañas una sola, pero la
rueda cambiaría sola delante de quien está en la otra; traducir lo que llega al
modo de cada una basta para que la canción se lea bien en las dos.

**Exportar solo MIDI.** Ya existía en el lienzo y no vuelve: un MIDI abierto aquí
serían notas sin grados ni partes. Sin la copia, «descárgala» no era una manera
de guardar.

**Quitar el buscador de «A dónde ir» en todas partes**, o quitar el del lienzo.
El del lienzo es el que escribe donde está la canción; el de «A dónde ir» es el
único que deja probar un acorde que no es grado de la tonalidad, y en Tocando y
Ensayar es el único que hay.
