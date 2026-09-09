# ADR 0026 — El blanco hielo, y una portada que respira

Fecha: 2026-09-08 · Estado: aceptada

## Contexto

El tema claro se hizo como «el negro pero al revés»: blanco puro de fondo, tres
grises cálidos y el latón bajado hasta `#9A5B08` para que un texto de acento
llegue a 4,5:1. Cumplía la regla de contraste y no se veía mal. Lo que tenía era
tres problemas que solo se ven puestos uno al lado del otro.

**Las superficies iban al revés que en el tema oscuro.** Con el blanco puro
abajo, lo único que puede hacer una caja para verse es oscurecerse: `surface`
`#FAF9F7` y `surfaceRaised` `#F3F1ED`, cada escalón un poco más sucio que el
anterior. O sea que **cuanto más importante era una caja, más gris se veía**,
justo al contrario que en oscuro, donde subir es acercarse a la luz. La misma
clase —`.superficie-alta`— significaba «esto destaca» en un tema y «esto se apaga»
en el otro.

**Los grises cálidos sobre blanco puro no leen a limpio, leen a papel viejo.** El
comentario que los justificaba decía que un gris azulado sobre blanco deja la
pantalla con aire de hospital, y es cierto: pero lo que enfría es **el par**
blanco clínico más gris azul, no el gris solo.

**La portada era ocho franjas separadas por ocho líneas de un píxel**, con el
vídeo a sangre detrás del titular y dos velos encima para poder leerlo. Sobre
blanco, un velo blanco sobre un fotograma oscuro no da contraste: da niebla gris.
Y `max-w-[min(90rem,92vw)]` son mil cuatrocientos cuarenta píxeles, así que en un
monitor ancho los párrafos cruzaban la pantalla entera.

## Decisión

**El fondo del tema claro es blanco hielo, y las superficies suben hacia el
blanco.** `#F1F4F8` de fondo, `#F8FAFC` de superficie y `#FFFFFF` para lo que se
eleva. Elevarse pasa a ser lo mismo en los dos temas: acercarse a la luz. Los
grises se enfrían con el fondo —texto `#141A20`, suave `#5A646E`— y las sombras
dejan de ser pardas para ser frías y anchas, que es lo que no ensucia el hielo.

**El acento no se toca.** El latón sigue en `#9A5B08` y `#7C4A0C`, y el tema
oscuro entero se queda como estaba: es la identidad del proyecto. Sobre un fondo
frío, un ámbar cálido es lo único que tiene temperatura en la pantalla, y por eso
se ve sin subir de tamaño ni de saturación.

**El resplandor de la sala pasa a ser un token por tema.** Estaba escrito como
latón al 5 %, que sobre el hielo es una mancha amarilla en la esquina. Ahora es
`--resplandor`: ámbar en oscuro y blanco en claro, y en los dos **aclara** la
esquina de arriba a la izquierda, porque una luz aclara. Un degradado que la
oscurece es un viñeteo, que dice lo contrario.

Y estaba escrito en el `body`, donde **no llegaba a ningún píxel**: tanto
`AppShell` como la portada abren con un `bg-background` opaco que lo tapa entero.
Se descubrió midiendo la captura, no leyendo el CSS. Ahora vive en `.fondo-sala`,
que es la clase que pinta el fondo de verdad, y los dos sitios la piden.

**La portada se separa por color de fondo, no por líneas**, alternando hielo y
blanco, y el reparto lo manda lo que lleva dentro: una sección con panel va sobre
el hielo, porque `.superficie` sobre la franja blanca no se eleva. Queda **una**
línea, la del afinador, que es la única sección que hereda el color de la de
arriba. El ancho baja a 78 rem, el vídeo sale de detrás del titular y se mete en
su marco a la derecha —con póster, porque una caja vacía en mitad de la portada es
peor que un vídeo que no arranca— y el titular baja de 7 rem a 5,25.

**El movimiento de la portada son tres animaciones y ninguna con JavaScript.** La
entrada escalonada del encabezado es una animación normal; el revelado al bajar y
la barra que se posa al primer scroll van con `animation-timeline`, que es lo que
las hace posibles sin un `IntersectionObserver`.

## Consecuencias

Otra vez la ventaja que se compró escribiendo los tokens dos veces: el cambio de
paleta fueron seis valores en `ui/tokens.ts` y sus seis espejos en `globals.css`,
con `ui/tokens.test.ts` comprobando delante que no se separan y que los seis
colores de texto siguen pasando 4,5:1 sobre los tres fondos nuevos. Ningún
componente de la aplicación se enteró.

**El orden de las secciones de la portada deja de ser libre.** Dos seguidas del
mismo color se funden en una sola franja, y una sección con panel puesta sobre la
franja blanca deja el panel dibujado solo por su borde. No lo vigila ningún test:
se ve mirando la página, y por eso está escrito en el comentario de `page.tsx`.

**La regla de movimiento reducido creció dos líneas, y hacían falta.** Anulaba la
duración pero no el retardo ni la línea de tiempo, y las dos cosas dejaban
contenido invisible a quien ha pedido calma: un trozo con 240 ms de retardo se
queda transparente ese cuarto de segundo, y una animación atada al scroll no la
mueve una duración de 0,01 ms, así que se queda en el primer fotograma —
transparente— para siempre. Ahora `animation-delay: 0s` y `animation-timeline:
auto` la devuelven al reloj, y con `both` se planta en el último fotograma.

Y de ahí sale lo que hace viable no usar JavaScript: **una animación de scroll no
soportada degrada sola**. Sin `animation-timeline`, la duración es `auto`, que
computa a cero, y con `both` el elemento se queda en el último fotograma. O sea,
lo de siempre: todo visible y la barra opaca. No hace falta un `@supports`.

Aparecieron 56 kB nuevos en `public/hero.jpg` y un `--radius-xl` de 20 px en los
tokens.

Se arregló de paso un `id` duplicado: la sección del afinador y el `Panel` del
propio afinador se llamaban los dos `afinador`, que es HTML inválido y dejaba el
salto del enlace a lo que decidiera el navegador. La sección pasa a `#probar`.

## Alternativas descartadas

**Enfriar solo el fondo y dejar las superficies como estaban**, bajando hacia el
gris. Es media línea de cambio. Se descarta porque deja en pie lo que más
molestaba: la misma clase significando cosas opuestas en cada tema, y una caja
elevada que se ve más sucia que el fondo sobre el que flota.

**Blanco puro de fondo y hielo para las superficies**, o sea el hielo como color
de las cajas. Se descarta porque el blanco hielo no se vería: lo que se pidió es
que **la pantalla** sea hielo, y con el hielo solo dentro de las cajas la
impresión general sigue siendo blanco de folio.

**Enfriar también el latón**, llevándolo hacia un ámbar más pálido o un dorado
frío para que peine con los grises. Se descarta a propósito. El acento es lo único
cálido que queda, y es exactamente eso lo que lo hace visible: si todo se enfría,
la paleta se queda sin sitio donde mirar y la aplicación deja de parecerse a sí
misma en el tema oscuro. Es el mismo motivo por el que
[0024](0024-la-interfaz-se-lee-primero.md) no cambió la paleta entera.

**Enfriar el rojo y el verde** con el resto. Se descarta porque son semánticos y
ya pasan sus contrastes en los dos temas: retocarlos es mover cuatro colores para
que nadie note la diferencia, con el riesgo de romper un mínimo por el camino.

**Un `IntersectionObserver` para el revelado**, que es como se hace normalmente.
Se descarta por lo que trae detrás: es un componente de cliente, y para que algo
aparezca tiene que **pintarse invisible primero**. Un navegador sin JavaScript, o
con él a medio cargar, deja media portada en blanco; y quitarle el estado inicial
para evitarlo obliga a un `useLayoutEffect` con su rodeo para no avisar en el
servidor. Con `animation-timeline` no hay estado inicial que arreglar: donde no
está soportado, no hay animación y ya está.

**Un `@supports (animation-timeline: view())`** alrededor de las dos reglas de
scroll, para escribir la degradación a mano. Se descarta por innecesario: la
degradación ya es correcta sin él, y un `@supports` de más es una rama que hay que
mantener y que nadie va a probar.

**Quitar el vídeo de la portada**, que es lo más minimalista que hay. Se descarta
porque es lo único que enseña de qué va esto antes de leer una palabra, y contenido
en su marco pasa a ser la única cosa oscura de la pantalla: sobre el hielo, se
lleva la mirada él solo, que es más de lo que hacía a sangre y con dos velos
encima.

**Cambiar la serif de los titulares** por una sans apretada, que es lo que lleva
hoy una portada «modernista». Se descarta: Georgia es la letra de los títulos de
**toda** la aplicación, no solo de la portada, así que eso no es un cambio de
portada sino de identidad. Lo que sí se hace es apretarla —`tracking-[-0.02em]`—,
que a tamaño grande es la mitad de lo que se buscaba y no cuesta nada.
