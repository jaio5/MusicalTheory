# ADR 0085 — La baraja es por unidad, y las formas de acorde se eligen por nombre

Fecha: 2026-10-02 · Estado: aceptada · Se apoya en
[ADR 0044](./0044-un-ejercicio-de-oido-se-contesta-de-oido.md), que hizo que un
ejercicio de oído se conteste de oído

## Contexto

Dos fallos de aprender que salieron de contestar de verdad:

- **La buena caía siempre en el mismo sitio.** Las unidades de oído escriben las
  opciones con la buena delante y nadie las repartía: se aprobaba una unidad entera
  pulsando la primera sin escuchar nada. Y la baraja que ya había, en `lessons.ts`,
  solo la usaban las lecciones de teoría. Cuando se compartió, apareció otro: con dos
  opciones por pregunta y tres por unidad, una baraja honrada deja la buena delante en
  las tres una de cada ocho veces, y como no hay azar esa vez es siempre la misma: la
  unidad de modos salía «la primera, la primera, la primera» en todas las tonalidades.
- **Las formas de acorde que se enseñaban no se podían tocar o eran la misma dos
  veces.** F salía como `103211`, con la cejilla en el primer traste y la quinta al
  aire debajo, que la cejilla pisaría; D `xx0232` se marcaba «con cejilla» cuando se
  coge con tres dedos; y de las cuatro mejores formas de un acorde, varias eran la
  misma con cuerdas quitadas.

## Decisión

**La baraja vive en `core/music/baraja.ts`, y es por unidad y determinista.** La
semilla sale del enunciado y de las opciones en el orden en que se escribieron, y
**con la unidad y la tonalidad como sal** (`kind|tónica|modo`, en `ear.ts`) cuando el
texto no basta —las de oído dicen «Sí» y «No» en las veinticuatro—. Es un xorshift de 32 bits con
Fisher-Yates. **`repartidasEnLaUnidad` además impide que la buena caiga en el mismo
sitio en todas**: si pasa, la última pregunta gira sus opciones un puesto. Sigue
siendo determinista. Las lecciones de teoría reparten exactamente como antes de
mudarse.

**Las formas de acorde** (`core/instrument/voicings.ts`):

- **La cejilla, solo cuando hace falta** —más cuerdas pisadas que dedos— **y solo si se
  puede tocar**: no puede tener debajo una cuerda al aire ni una muda. Lo que no cabe
  en cuatro dedos así, no se ofrece. F sale `133211`, no `103211`.
- **La mano tumbada se penaliza**: dos dedos en el traste más bajo con cuerdas al aire
  entre ellos restan si están lejos —F `10321x` o Bm `x20402` se pueden escribir, y casi
  nadie las coge—.
- **Una forma por nombre**, no por traste: en el mismo traste caben dos manos, Bm sin
  cejilla `x2443x` y con ella `x24432`.

**El foco al contestar va a «Siguiente»**, y al pasar de pregunta, a la primera
opción de la nueva; **el globo del profesor se cierra con Escape y al salir el foco**,
como un panel que tapa.

## Consecuencias

La misma pregunta sale siempre igual en la misma tonalidad y distinta en otra, así
que repintar —al contestar, al cambiar de tonalidad— no mueve un botón de debajo del
dedo. Pulsar la primera ya no aprueba una unidad de oído.

Cambiar el texto de una opción cambia su sitio: la semilla incluye el texto. Los
tests de la unidad de modos fijan que no sea siempre la primera.

## Alternativas descartadas

**`Math.random()`.** Las opciones cambiarían de sitio en cada repintado, y bastaría
con que React volviera a pintar la pregunta para que el botón se moviera debajo del
dedo.

**Barajar cada pregunta sin sal.** Las de oído tienen el mismo texto en todas las
tonalidades y saldrían repartidas igual en las veinticuatro.

**Alternar la buena a mano**, escribiendo en cada pregunta dónde va. Las opciones de
teoría se generan en la tonalidad de quien pregunta, y un reparto escrito a mano
tendría que valer para las veinticuatro.

**Una forma por posición.** Las cuatro mejores resultaban la misma forma con cuerdas
quitadas.
