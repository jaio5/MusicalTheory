# ADR 0099 — Formas y movimientos nuevos: periodos, AABA, el ii–V partido y el reposo frigio

Fecha: 2026-10-05 · Estado: aceptada · Amplía el
[ADR 0097](./0097-las-salidas-se-juzgan-por-lo-que-encajan.md) ·
ampliada por el [ADR 0101](./0101-lo-que-dice-una-salida-es-verdad-sitio-por-sitio.md),
que añade un decimotercer movimiento, `vaiven`

## Contexto

Tras el 0097 quedaban cuatro cosas apuntadas en el ROADMAP que un arreglista echa de
menos en cuanto prueba las salidas: **completar las formas** (el blues a medias ya se
completaba; un periodo o una AABA, no), **poner una subdominante delante del V**, el
**cambio rápido** de un blues al retocar, y el **ii–V de dos compases**. Y con el
flamenco como estilo ([ADR 0098](./0098-seis-estilos-mas-para-que-no-se-juzguen-como-otro.md))
aparecía un problema de fondo: una andaluza `i VII VI V` **acaba en el V**, y el
juez la castigaba por no volver a la tónica.

## Decisión

**Las formas se reconocen en un solo sitio, el ii–V se parte en otro, y el reposo
frigio es una regla que comparten el juez, el generador y la comprobación.**

- **Formas** (`core/music/formas.ts`): el periodo —antecedente abierto, consecuente
  que cierra con su misma cabeza— y la AABA, de cuatro o de ocho compases por
  sección. Dos secciones son la misma si **empiezan igual**; el final puede cambiar.
  Lo que falta se completa (`formasDe`): el consecuente, la sección que contrasta
  tras dos que empiezan igual, y la vuelta a la primera. Es la misma idea que
  `formaDeBlues`: una sola vara para quien construye y para quien juzga.
- **El ii–V partido** (`core/music/partir.ts`): un V, o una secundaria, de cuatro
  pulsos o más se parte en su ii y él. **Cambia cuántos acordes hay**, así que
  tiene su propia comprobación (`esPartirEnIiV`) y todo lo que empareja tus compases
  con los propuestos lo hace **por pulsos** (`gruposPorPulsos`): `pathProblem`
  (el juez, en `encaje.ts`, también), `versionDe` y `aplicar-salida.ts`. Emparejar
  por posición desalineaba lo de detrás del partido, y el V siguiente pasaba a
  «cambiar» el compás de al lado.
- **Cuatro movimientos nuevos**, hasta **doce** en `MOVES`: `predominante`
  («Predominante delante»: una subdominante antes de la dominante, tónica –
  subdominante – dominante), `cambio-rapido` (el IV en el compás 2 de un blues y su
  vuelta, único cambio que admite el esquema), `frigio` («Semitono frigio»: el
  acorde mayor medio tono por encima de un centro, sin séptima) e `ii-v` («Partir la
  dominante»).
- **El reposo frigio** (`andaluzaFrigia`, `centroFrigio`, `reposoFrigio`): una
  andaluza reposa en su V, y el flamenco, en menor, siempre que se llega por el VI o
  desde el iv. **`seguir` puede acabar en ese V** sin volver a la tónica cuando
  `andaluzaFrigia` reconoce la forma, y la comprobación de `seguir` no exige la
  tónica si se acaba ahí. Sin estilo y sin la bajada entera, `VI V` sigue siendo la
  semicadencia que pide seguir.

## Consecuencias

- **Acabar en el V ya no es un fallo en una andaluza.** Pero la regla es estrecha a
  propósito: fuera de lo reconocido, una canción que no vuelve a casa se sigue
  castigando.
- El ii–V partido es **el único movimiento que cambia el número de acordes**. Quien
  añada algo que lo haga tiene que emparejar por pulsos, o lo de detrás se desalinea
  sin que falle nada a la vista.
- **Medido con `corpus-final`** (5 de octubre, después de arreglar por sus causas):
  con los estilos y estas formas, **53 de 54 menús enteros y 783 de 784 casos**;
  entraron el cambio rápido de los dos blues y la subdominante del vals, y queda el
  estribillo. Sigue siendo una medida tras arreglar, no la de generalización.
- Los movimientos salen de `MOVES` (trece con `vaiven`, ADR 0101); el prompt los nombra desde ahí
  (`nombreDelCambio`), así que un movimiento nuevo es una entrada y su frase.
- Las formas leen **grados**, no notas: un periodo se reconoce por su armonía, y el
  punteo que lo haría de manual no siempre está.

## Alternativas descartadas

**Meter el ii–V en `applyMove`.** Allí todo cambia un grado por otro y los pulsos se
quedan donde estaban; `pathProblem` empareja uno a uno. Partir cambia uno por dos, y
meterlo ahí obligaba a que todo `applyMove` hablara de pulsos para un solo caso.

**El reposo frigio solo como contraste.** Ofrecerlo únicamente como cambio de color
obligaba a «resolver» lo flamenco: el menú de una andaluza terminaba siempre en la
tónica, que es justo lo que ese idioma no hace.

**Completar formas sin que las reconozca el juez.** Quien construye ofrecería un
consecuente que el juez castigaría por repetir la cabeza del antecedente: dos varas
para la misma forma.
