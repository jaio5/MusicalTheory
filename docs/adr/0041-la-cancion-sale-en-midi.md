# ADR 0041 — La canción sale de aquí, y sale en MIDI

Fecha: 2026-09-22 · Estado: aceptada

## Contexto

Hasta ahora **lo único descargable de esta aplicación era el audio**: la toma de
la grabadora y la de «tocando». El montaje —los acordes, sus duraciones, las
vueltas y el punteo— vivía en `IndexedDB` o en la base de datos de tu cuenta y no
salía por ningún sitio.

Eso no es un hueco cualquiera en una aplicación de componer. **Se compone para
llevárselo**: a un secuenciador donde ponerle batería, a un papel que imprimir, a
alguien a quien mandárselo. Un cuaderno del que no se arrancan hojas sirve para
practicar y no para trabajar, y quien componga algo que le guste se lo va a
querer llevar el mismo día.

Y estaba todo hecho menos el último paso: `soundOf` ya entrega todo lo que suena
—acordes y punteo contra el mismo reloj, con las vueltas ya desenrolladas— con su
sitio en pulsos y sus números MIDI.

## Decisión

**Se exporta a MIDI, en formato 0, desde el mismo sitio donde se escucha.**

- **MIDI y no MusicXML** como primer formato. MIDI lo abre cualquier cosa que
  haga música —todos los secuenciadores, todos los editores— y es lo que hace
  falta para seguir trabajando la canción. MusicXML lo abren los editores de
  partitura y casi nada más, y esta aplicación escribe cifrados y punteo, no
  ligaduras, silencios ni dos voces: exportarlo sería prometer una partitura que
  no se tiene ([ROADMAP](../ROADMAP.md)).
- **Formato 0 y no 1.** El 1 pondría el acompañamiento y el punteo en pistas
  separadas, y eso obliga a recorrer el montaje por un camino propio. `soundOf`
  ya entrega las dos cosas mezcladas contra el mismo reloj —que es justo lo que
  hace que suenen juntas—, así que el 0 se escribe de lo que ya existe. Con un
  camino solo, **lo que se descarga no puede dejar de coincidir con lo que
  suena**.
- **El botón va al lado de «Escuchar la canción»**, porque las dos hacen lo mismo
  con la canción entera: una para oírla y otra para llevársela. No en
  «Canciones», que pide cuenta: llevarte lo tuyo no se cobra.
- **En `core/`**, porque escribir bytes es TypeScript puro. Lo que sí necesita
  navegador —pedir la descarga— se queda en `media/`.

## Lo que se comprobó

No basta con que pasen los tests: un fichero MIDI que ningún programa abra falla
en silencio. Se escribió un `C–F–G–Am` de verdad y se leyó **con un lector
distinto, escrito aparte y en otro lenguaje**, que devolvió lo que tenía que
devolver: formato 0, una pista, 480 por negra, 100 bpm, 4/4 y cuatro acordes de
cuatro pulsos con sus tres notas cada uno.

## Alternativas descartadas

**Exportar también a MusicXML o a PDF.** Cuando la partitura tenga silencios,
ligaduras y tresillos. Hoy sería exportar menos de lo que se ve en pantalla.

**Un `.txt` con los cifrados.** Es de una línea y no lo he hecho: lo que la gente
pega en un chat se copia de la pantalla, y lo que hace falta de verdad para
seguir trabajando es el MIDI. Si alguien lo pide, cuesta poco.

**Meterlo en «Salidas».** Ese panel es lo que devuelve el modelo, cuesta cupo y
pide plan. Una descarga de lo tuyo no es una salida de la IA.

## Lo que hay que saber si se toca

- **Los apagados van antes que los encendidos en el mismo instante.** Dos bloques
  seguidos con la misma nota comparten el tick de la frontera: encendiendo
  primero, el apagado del primero mata al segundo y se pierde un acorde. Hay un
  test que lo vigila.
- Un pulso de la aplicación es una negra, que es lo que dice la rejilla del
  punteo (`GRID = 0.5`).
- Si aparece un segundo camino para exportar, este ADR deja de ser verdad: la
  promesa es que lo que se descarga sale de `soundOf`, igual que lo que suena.
