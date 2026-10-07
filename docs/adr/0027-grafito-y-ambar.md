# ADR 0027 — Grafito y ámbar: se jubila el amplificador

Fecha: 2026-09-08 · Estado: aceptada

**Este ADR deroga la parte estética de
[0024](0024-la-interfaz-se-lee-primero.md)**, que decidió expresamente no tocar la
paleta; reescribe el punto de partida de [0010](0010-tema-claro-por-defecto.md); y
deja sin efecto una frase de [0026](0026-el-blanco-hielo.md), la de que «el tema
oscuro entero se queda como estaba». Los tres siguen siendo historia válida: lo que
decidieron entonces era correcto con lo que se sabía entonces, y por eso no se
reescriben.

## Contexto

La identidad estaba escrita desde la fase 0: **un amplificador de válvulas visto
de noche**. Chasis de latón, tapizado oxblood, resplandor verde sobre negro
cálido. De ahí salen los nombres de los tokens —`brass`, `oxblood`, `tube`— y de
ahí sale la mascota.

[0024](0024-la-interfaz-se-lee-primero.md) se planteó cambiar la paleta y lo
descartó, con razón: **el problema de entonces no era el color, era la letra y la
jerarquía**. Media aplicación en monoespaciada de once píxeles no se arregla
pintándola de otro color, y cambiarla habría tapado el diagnóstico con un cambio
vistoso. Aquello se arregló, y con ello se agotó lo que se podía ganar sin tocar
la paleta.

Lo que queda visto hoy, con la letra ya en su sitio, es que **el negro cálido
trabaja en contra**. Un pardo a esa luminancia —`#100D0B`, `#1A1613`, `#26201A`—
no se lee como negro: se lee como marrón viejo. Y contra un fondo marrón, un
acento de latón está a un paso de distancia: la aplicación entera caía dentro del
mismo cuarto de la rueda de color, así que el acento no destacaba por color sino
solo por claridad, que es la mitad del trabajo que tiene que hacer un acento.

## Decisión

**El tema oscuro pasa a grafito frío con un ámbar de acento.**

| Token           | Antes     | Ahora     |
| --------------- | --------- | --------- |
| `background`    | `#100D0B` | `#0B0D11` |
| `surface`       | `#1A1613` | `#131720` |
| `surfaceRaised` | `#26201A` | `#1C222D` |
| `border`        | `#3A322A` | `#2A313D` |
| `text`          | `#F3ECE0` | `#F0F3F8` |
| `textMuted`     | `#B3A695` | `#98A3B3` |
| `brass`         | `#C08A3E` | `#D99A45` |
| `brassBright`   | `#E8B765` | `#F0BE6E` |
| `brassDim`      | `#6E5830` | `#4A3A22` |
| `oxblood`       | `#6B1F24` | `#4A1E24` |
| `oxbloodBright` | `#E8878A` | `#FF9494` |
| `tube`          | `#5C8A5A` | `#2F6B4E` |
| `tubeBright`    | `#86BC82` | `#7FD4A3` |

El fondo se enfría y el acento se queda cálido: **es lo único que tiene
temperatura en toda la pantalla**, y eso es exactamente lo que lo hace visible sin
subirle la saturación. El verde sube a menta y el rojo a coral porque sobre
grafito los apagados de antes se hundían. El peor contraste de texto de la paleta
entera es 6,25:1, muy por encima del 4,5:1 que exige el proyecto.

**El tema claro no se toca**, y no hace falta: el ámbar de día —`#9A5B08`— es el
mismo tono que el de noche, bajado hasta donde llega a 4,5:1 sobre el hielo. Los
dos temas pasan a ser la misma paleta con la luz encendida y apagada.

**La forma sube con el color.** Los cuatro radios pasan de 3/6/12/20 a 4/8/14/22,
porque la esquina tiene que crecer con lo que envuelve; y las sombras del tema
oscuro dejan de ser cortas y duras —`0 4px 16px`— para ser largas y suaves
—`0 16px 40px -16px`—, que sobre grafito es lo que hace flotar una tarjeta.

**Los nombres de los tokens se quedan.** `brass`, `oxblood` y `tube` vienen de un
aparato que ya no está, pero lo que nombran no es un color sino un papel: el
acento, lo que va mal y lo que va bien. Renombrarlos serían trescientas
sustituciones en toda la aplicación para no ganar nada, y el riesgo de que la
mitad se quede a medias. Está dicho en la cabecera de `tokens.ts`, que es donde va
a mirar quien se lo pregunte.

**Y la mascota se queda siendo una válvula**
([0025](0025-la-mascota-es-una-valvula.md)). No la sostenía la paleta: la sostiene
que una válvula es lo único que se enciende al escuchar, que es lo que hace ese
muñeco. Está dibujada con tokens, así que se repinta sola.

## Consecuencias

**Un test se dio la vuelta y otro nació.** `ui/tokens.test.ts` afirmaba «el fondo
es negro cálido: más rojo que azul», que era la identidad escrita en un test;
ahora afirma lo contrario, para que recalentar el fondo falle en la construcción
y no dentro de tres semanas mirando una captura. Y se añade el guardián que le
faltaba a [0026](0026-el-blanco-hielo.md): **las superficies suben hacia la luz en
los dos temas**, que es una regla de una línea que hasta hoy solo vivía escrita, y
que el tema claro incumplía entero.

**El que sí sobrevive es «el verde no es ácido».** Nació como «el verde es de
válvula» y podría haberse ido con el amplificador, pero la regla que hay debajo no
dependía de aquello: un verde con el canal disparado, al lado de un acento cálido,
es lo que separa una paleta de un semáforo. Se le cambió el nombre y el comentario,
no el listón.

**Ningún componente se enteró de nada.** Trece valores en `ui/tokens.ts` y sus
trece espejos en `globals.css`, con el test del espejo delante. Es la tercera vez
que se cobra la duplicación que se pagó al escribir los tokens dos veces.

**Casi ninguno.** El repaso destapó dos cosas que el espejo de tokens no puede
ver, y las dos por el mismo motivo: **un número dentro de una cadena no es un
token**. El cajón de acordes de componer llevaba
`shadow-[0_-16px_32px_rgba(0,0,0,0.5)]` escrito a mano —que sobre el tema hielo es
un borrón negro— y seis sitios usaban `rounded` a secas, que es el radio por
defecto de Tailwind y no se mueve cuando se mueve la escala. Se arreglan con un
token nuevo, `--sombra-alta-arriba`, y con `rounded-sm`; y sobre todo con **dos
guardianes en `coherencia.test.ts`**, porque lo que no vigila un test vuelve.

Y una trampa nueva para la lista: **Tailwind escanea los comentarios**. El ejemplo
de clase que se escribió en el comentario de uno de esos dos guardianes se generó
como utilidad de verdad, produjo `--tw-shadow: var(--...)`, y la hoja de estilos
entera dejó de compilar: las nueve pantallas devolvieron 500 **con los 2.174 tests
en verde**. Solo se vio pidiendo la página, que es justo lo que este proyecto ya
tenía escrito que hay que hacer después de tocar estilos.

Quedan tres comentarios de código que hablaban del amplificador en presente
—`tokens.ts`, `state/theme.ts` y `ui/Mascota.tsx`— y se han pasado a pasado. Los
ADR 0010, 0024 y 0025 **no** se tocan: un ADR es lo que se decidió entonces, y
reescribirlos sería borrar por qué se llega hasta aquí.

## Alternativas descartadas

Se midieron cuatro paletas completas contra las reglas del proyecto antes de
elegir. Las cuatro pasaban el 4,5:1 de texto y el 3:1 de lo que se dibuja sobre
los tres fondos; lo que las separaba era cuánta identidad se llevaban.

**Índigo nocturno** —fondo `#0A0A0F`, acento violeta `#8E7DF8`—. Es el lenguaje de
la herramienta creativa de hoy y el cambio más rotundo de los cuatro. Se descarta
porque deja el nombre `brass` mintiendo en trescientos sitios sin ninguna lectura
que lo salve, y porque el violeta no dice nada sobre tocar la guitarra: es el color
por defecto de «esto es una aplicación moderna», que es justo lo que
[0024](0024-la-interfaz-se-lee-primero.md) llamó tapar el diagnóstico con un cambio
vistoso.

**Azul acero** —fondo `#0A0E14`, acento cian `#4EA8E8`—. La estética de producto más
reconocible que hay, y por eso mismo la más anónima. Se descarta además porque el
cian es frío: con el fondo también frío, la pantalla se queda entera en la misma
mitad de la rueda y vuelve el problema de partida, esta vez del otro lado.

**Negro cálido renovado** —conservar la calidez y modernizar solo escalones, texto
y acento—. Es la única que no rompía ningún test de identidad, y se descarta por
eso mismo: arregla el síntoma sin tocar la causa. El marrón seguiría comiéndole el
sitio al ámbar.

**Cambiar también la serif de los titulares** por una sans apretada, que es el lever
más fuerte que queda. Se descarta en esta pasada porque Georgia es la letra de los
títulos de **las nueve pantallas**, no de la portada: eso no es un cambio de
estética, es otro cambio de identidad y merece su propio ADR y su propio repaso.

**Renombrar los tokens** —`accent`, `danger`, `success`— ahora que ya no significan
un aparato. Es lo correcto en abstracto. Se descarta por el momento: son
trescientas sustituciones en ficheros que no se están tocando, con dos tests que
leen el código por nombre de clase (`text-tube`, `bg-oxblood`) y que habría que
reescribir a la vez. El coste es real y la ganancia es de lectura.
