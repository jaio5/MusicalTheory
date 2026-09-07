# ADR 0022 — Aprender de oído: el método sí, el juego no

Fecha: 2026-09-07 · Estado: aceptada · Referencia externa: [pizzicatune.com](https://pizzicatune.com)

## Contexto

El camino de aprender tenía dos maneras de preguntar. `theory` se contesta
leyendo —«¿cuál es el V grado de Sol?»— y `play` se contesta con la guitarra.
**Las dos dan por hecho que ya sabes cómo suena lo que estás estudiando.**

Y eso no era un hueco cualquiera en esta aplicación. Aquí el motor de croma dice
lo que oye, con su duda y sus alternativas
([adr/0020](./0020-lo-que-se-oyo-y-lo-que-se-supo.md)); si el usuario no sabe si
un `Am` suena a `Am`, no puede corregirlo cuando se equivoca. **La otra mitad de
escuchar es saber escuchar.**

Había además una unidad que lo decía sin querer: `e2-repaso` se llamaba
«Distinguirlas de oído» y se contestaba leyendo. Prometía una cosa y hacía otra.

Se tomó como referencia [pizzicatune.com](https://pizzicatune.com), un entrenador
auditivo cuya idea central cabe en su propio titular: **«Escuchá una nota.
Reconocela en todos lados»** —sonido, nombre, pentagrama y posición en el
instrumento—.

## Decisión

**Un tercer tipo de unidad, `ear`, dentro del camino de siempre.** No una
pantalla de entrenamiento aparte: este proyecto ya tiene meta diaria, racha y
medallas, y un entrenador con su propia racha competiría con la que hay.

**Se pregunta por acordes, grados y cadencias, no por notas sueltas.** Es la
diferencia con la referencia, y sale de lo que esta aplicación hace: aquí no se
compone con notas sueltas, se compone con lo que hace cada acorde dentro de una
tonalidad. Los tres tipos suben y cada uno se apoya en el anterior:

- `quality` —alegre o triste— es lo primero que oye cualquiera sin haber
  estudiado nada, y ancla el resto.
- `degree` **hace sonar la tónica antes, y lo dice en pantalla**: un acorde suelto
  no tiene grado, lo tiene dentro de una tonalidad, y sin esa referencia la
  pregunta no tiene respuesta.
- `cadence` es lo último porque no se oye un acorde sino qué pasa **entre dos**.

**Suena en tu tonalidad.** Los ejercicios se guardan en grados, como todo lo
demás aquí, así que quien practica en Mi bemol oye sus acordes y el porqué habla
de ellos.

**El botón no se gasta, y no suena solo al entrar.** Se puede repetir antes y
—sobre todo— después de contestar: un entrenamiento auditivo que deja oír una
sola vez mide la memoria, no el oído, y volver a oírlo con la respuesta delante es
donde se aprende. Que no suene al entrar es porque sonar sin que nadie lo pida es
meter ruido en una pantalla en la que se acaba de entrar.

**Vale veinticinco XP**, entre los veinte de leer y los treinta y cinco de tocar:
reconocer cuesta más que entender y menos que encontrarlo en el mástil.

## Consecuencias

`e2-repaso` deja de mentir: ahora suena. Y la medalla «Sin un fallo» la dan
también las de oído, así que su texto cambia.

Lo fallado de oído vuelve al repaso **como pregunta escrita**, no volviendo a
sonar. Es a propósito: si dijiste que era un IV y era un V, lo que hay que
refrescar no es el sonido —eso se entrena en la unidad— sino qué hace cada uno.

Hay tres unidades de oído en diez cursos. Es un principio, no un temario: falta
reconocer especies de séptima, modos y préstamos, que son justo la teoría del
Grado Profesional.

## Alternativas descartadas

**Copiar el modelo de juego de la referencia: energía, intentos diarios y
ranking.** Es lo que la hace pegajosa, y es lo que este proyecto decidió no tener.
Las vidas están descartadas desde el principio —«fallar no bloquea: se explica y
se sigue»— y un ranking necesita gente contra la que competir, cuando aquí el
avance es de una persona en su navegador. Copiarlo habría sido traer el envoltorio
sin lo que lo sostiene.

**Preguntar por notas sueltas**, que es literalmente lo que hace la referencia y
lo que enseña cualquier entrenador auditivo. Se descarta porque no es lo que esta
aplicación necesita: lo que hay que reconocer aquí es qué acorde suena y qué hace,
que es lo que el motor de croma escribe en tu canción y lo que tienes que poder
corregir. Reconocer notas sueltas ya se entrena, y tocándolas, en las unidades de
`play`.

**Una pantalla de entrenamiento aparte**, con su desafío diario. Daría sitio para
practicar sin avanzar en el camino, que es una necesidad real. Se descarta **de
momento** porque duplicaría la meta diaria y la racha, que ya existen y son la
manera que tiene este proyecto de decir «vuelve mañana». Si algún día hace falta,
lo que tiene que compartir con el camino es exactamente esa racha.

**Responder tocando el acorde con la guitarra** en vez de eligiendo. Sería mejor
que la referencia, que hace marcar sobre una foto, y el motor de croma ya sabría
validarlo. Se descarta por lo que costaría equivocarse: el croma **no distingue
inversiones** ([adr/0004](./0004-reconocimiento-de-acordes-por-croma.md)), así que
un acorde bien tocado en otra posición se daría por malo. Elegir entre opciones no
tiene ese problema. Queda como lo primero que reconsiderar si el reconocimiento
mejora.
