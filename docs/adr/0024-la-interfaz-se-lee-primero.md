# ADR 0024 — La interfaz se lee primero, y el aparato viene después

Fecha: 2026-09-08 · Estado: aceptada

## Contexto

La identidad de este proyecto está escrita desde la fase 0: **un amplificador de
válvulas visto de noche**. Chasis de latón, tapizado oxblood, resplandor verde
sobre negro cálido. Es buena, y no está en discusión.

Lo que sí lo estaba es cómo se había traducido a la pantalla. Puesta delante de
alguien que no la conoce, la aplicación tenía cuatro problemas y ninguno era de
paleta:

**La monoespaciada se había comido la interfaz.** Empezó donde tenía que estar
—notas, cents, hercios, cifrados— y acabó en la navegación, en las pastillas, en
los botones, en los enlaces de vuelta y en cerca de cien sitios más. Los rótulos
de apartado iban además en versalitas con separación —`font-mono text-xs
tracking-widest uppercase`, copiado a mano en diecinueve ficheros—. El resultado
no parecía un amplificador: parecía un panel de administración de hace diez años.

**La rueda de quintas no se podía leer.** Las doce etiquetas giraban con el disco,
cada una rotada su propio ángulo, «igual que en el aparato de verdad». En cartón
eso funciona porque el aparato se coge y se tuerce; en una pantalla que no se
puede girar, once de las doce tonalidades quedaban tumbadas o boca abajo a trece
píxeles. Y esto es **el control con el que empieza todo lo demás**: sin tonalidad
no hay acordes, ni escala, ni preguntas, ni canción.

**Los estados vacíos eran una frase gris flotando.** Componer, sin tonalidad, era
una línea —«Elige una tonalidad en la rueda y empezamos»— centrada en setecientos
píxeles de negro, repetida en tres paneles distintos, junto a una rueda que no
parecía pulsable. Pedir sin ofrecer dónde.

**No se veía qué estaba encima de qué.** Fondo, tarjeta y panel elevado estaban a
menos de un doce por ciento de luminancia entre sí; el latón, en `#B08D4F`, no
parecía metal encendido sino cartón.

## Decisión

**La monoespaciada es para lo que se alinea en columna, y nada más.** Notas,
cifrados, cents, hercios, compases, XP, un correo: lo que se compara dígito a
dígito o lo que crece y encoge sin descolocar lo de al lado. La interfaz —
navegación, botones, pastillas, rótulos, enlaces— va en la sans. Los rótulos de
apartado son una sola clase, `.rotulo`, en sans de 12 px con peso.

**La rueda gira; las letras se quedan de pie.** El anillo lleva la rotación que
toca y dentro de cada etiqueta hay un grupo que gira lo mismo del revés, con la
misma curva y la misma duración. El movimiento sigue viéndose —la rueda pasa por
delante y la tonalidad acaba arriba— y lo que no se mueve es la letra. Además cada
tonalidad tiene su casilla redonda, con radios que las separan: se ve que hay doce
sitios donde pulsar antes de pulsarlos.

**Un estado vacío se pinta con `ui/Vacio`**, que pide dibujo, título y **acción**.
En componer, la acción es de verdad: cuatro tonalidades de salida a un toque —las
que caen en acordes al aire— para quien todavía no sabe cuál elegir.

**Se abre el escalón entre las superficies y se sube el latón.** `#100D0B` /
`#1A1613` / `#26201A` para los tres fondos, `#C08A3E` y `#E8B765` para el acento.
Todos los colores con los que se escribe siguen pasando el 4,5:1 sobre los tres
fondos en los dos temas, que es lo que vigila `ui/tokens.test.ts`.

## Consecuencias

Ningún componente sabe qué tema hay puesto, así que el cambio de paleta fue mover
trece valores en dos sitios —`ui/tokens.ts` y `globals.css`— con el test que
vigila el espejo delante. Esa es exactamente la ventaja que se compró al escribir
los tokens dos veces.

El contragiro de la rueda usa `transformOrigin` por elemento y no `svgOrigin`:
`svgOrigin` es una coordenada única del lienzo, y con ella las doce etiquetas
girarían alrededor del centro de la rueda, que es justo lo que se quiere deshacer.

Queda un hueco que este ADR no cierra: **la regla de la monoespaciada no tiene
guardián**. `coherencia.test.ts` vigila el alto de dedo, los emoji y los colores
que son relleno, pero «esto es un dato y aquello no» no se decide leyendo una
clase. De momento vive escrita en `docs/ESTILO.md`.

## Alternativas descartadas

**Cambiar la paleta entera por una moderna.** La base de diseño consultada
proponía morado de estudio con verde de onda sobre azul oscuro, que es lo que
lleva media herramienta creativa de hoy. Se descarta sin dudar: el amplificador es
la identidad del proyecto desde la primera línea que se escribió, y el problema no
era el color, era la letra y la jerarquía. Cambiar la paleta habría tapado el
diagnóstico con un cambio vistoso.

**Dejar la monoespaciada y arreglar solo los tamaños**, subiendo de 12 a 14 px. Es
la mitad del arreglo y la que menos toca: la monoespaciada grande sigue ocupando
un veinte por ciento más de ancho por la misma frase, y en una barra con seis
controles eso son controles que no caben. Y no arregla lo que de verdad chirriaba,
que eran las versalitas.

**Quitar el giro de la rueda** y limitarse a resaltar la tonalidad activa. Sería
más simple que el contragiro. Se descarta porque el giro es información: pone
arriba, bajo la marca fija, la tonalidad que suena, y así se ve de un vistazo qué
ha detectado el motor sin buscar entre doce casillas cuál está encendida.

**Etiquetas siempre de pie sin girar el anillo**, que es lo mismo sin animación.
Se descarta por la misma razón, y porque el giro es además lo que enseña que las
doce están en un orden que significa algo.

**Una biblioteca de componentes** —shadcn o similar— en vez de seguir puliendo los
seis primitivos propios. Se descarta porque el problema no era falta de
componentes: `Button`, `Chip`, `Field`, `Disclosure`, `TextField` y `Panel` ya
existían y ya estaban vigilados por tests que leen los ficheros. Traer una
biblioteca habría cambiado la identidad por defecto y dejado que la coherencia la
mantuviera otro.
