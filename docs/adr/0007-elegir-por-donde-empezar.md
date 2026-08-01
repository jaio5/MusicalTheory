# ADR 0007 — Elegir por dónde empezar, y una pantalla por cosa

Fecha: 2026-07-30 · Estado: aceptada · Revisa: la parte de desbloqueo lineal de [ADR 0001](./0001-capas-y-dominio-puro.md)

## Contexto

El temario se desbloqueaba en línea recta: la primera unidad abierta, y cada
siguiente al terminar la anterior. Estaba escrito y defendido en
`core/music/progress.ts`, con este argumento, que sigue siendo verdad:

> El desbloqueo es lineal a propósito. Se puede discutir —hay gente que ya sabe
> teoría y querría saltar—, pero la escalera se sostiene sobre que cada curso usa
> solo lo explicado antes: dejar entrar a las sustituciones sin haber visto las
> funciones no es libertad, es un curso que no se entiende.

El comentario se adelantaba a la objeción y decidía contra ella. La objeción ha
vuelto, y esta vez con quien usa la aplicación de por medio: **quien lleva diez años
tocando y viene a por las sustituciones se encuentra once unidades de peaje**, y lo
que hace con once unidades de peaje no es hacerlas, es cerrar la pestaña.

Al mismo tiempo, la pantalla de aprender había crecido a tres columnas —el temario,
la unidad y el profesor— y eso la había convertido en un panel de control: se veía
todo y no se estaba en nada. Las dos cosas se arreglan en el mismo sitio y por eso
van en el mismo documento.

## Decisión

**Un punto de partida que se elige.** `Progress` gana un campo, `startCourse`, y el
desbloqueo pasa a tener dos reglas:

1. Tu punto de partida y **todo lo que va antes** está abierto.
2. De tu punto de partida **en adelante**, una detrás de otra, como siempre.

Lo anterior queda abierto porque quien empieza en el Profesional tiene que poder
bajar a mirar los grados el día que se pierda, y cerrárselo sería castigarle por
haberse puesto una meta alta. Hacia adelante la escalera sigue intacta, así que el
argumento del comentario original se conserva donde valía: nadie entra en las
sustituciones sin pasar por las funciones **si ha elegido empezar antes**. Si elige
empezar ahí, es su decisión y la aplicación no es quien para discutírsela.

Lo que **no** hace es dar por hechas las unidades que se salta: quedan abiertas, sin
XP y sin marcar. Y `nextUnit` mira desde donde te pusiste, no desde el principio:
mandar a «qué es un grado» a quien acaba de elegir el Profesional sería deshacer su
decisión en el primer clic.

**Y una pantalla por cosa.** Aprender es solo el camino. Cada unidad tiene su
dirección (`/aprender/una-unidad`), el repaso la suya (`/aprender/repaso`) y el
profesor se va a `/profesor`. La navegación se dobla abajo en pantalla estrecha,
donde llega el pulgar.

## Alternativas descartadas

**Abrirlo todo desde el principio.** Es la lectura literal de «empezar por donde
quieras» y tira el temario: sin ningún orden, el camino es una lista de treinta
unidades sueltas y desaparece la única cosa que hacía que apeteciera seguir, que es
saber cuál es la siguiente. El punto de partida da la libertad que se pedía y
conserva el «y ahora esta».

**Una prueba de nivel que decida por ti.** Cinco preguntas y la aplicación te coloca.
Suena mejor de lo que es: para acertar el sitio haría falta una prueba larga, y una
prueba larga antes de tocar una nota es otro peaje, más caro que el que se quería
quitar. Además decide algo que quien pregunta ya sabe: si has venido a por las
sustituciones, no hace falta examinarte para saber dónde ponerte.

**Dar por hechas las unidades anteriores al saltar.** Es cómodo —el marcador se
pone al día solo— y es mentira: pondría XP, medallas y porcentajes de once unidades
que nadie ha hecho, y a partir de ahí el marcador ya no dice nada de nadie.

**Que el punto de partida sea solo un filtro de la vista.** Enseñar el camino desde
ahí sin cambiar el desbloqueo. No resuelve nada: la primera unidad que se pulsa sigue
saliendo cerrada, y el filtro se convierte en una forma de esconder el peaje en vez
de quitarlo.

**Dejar la pantalla de aprender de tres columnas y solo añadir el selector.** Habría
sido la mitad del trabajo. Se descarta por lo que se ve al usarla: con la unidad en
una columna estrecha, el profesor al lado tirando de la atención y el temario a la
izquierda, ninguna de las tres cosas se hace del todo. Y el profesor, que sirve
igual componiendo, solo estaba disponible estudiando.

## Consecuencias

- El comentario de `progress.ts` que defendía el desbloqueo lineal **ya no dice lo
  que hace el código**, así que se ha reescrito. Era exactamente el fallo que este
  repositorio se toma en serio: documentación que miente.
- `nextUnit` y `nextAllowedUnit` dependen ahora del punto de partida. Los dos siguen
  cayendo hacia atrás cuando por delante no queda nada, para que lo que se saltó no
  quede inalcanzable.
- El punto de partida se guarda, se sincroniza y se fusiona. Al fusionar gana el más
  adelantado, con el precio de que retroceder hay que hacerlo en los dos aparatos.
- Solo se pueden elegir cursos que el plan incluya. Ofrecer un punto de partida que
  se cierra en la cara al elegirlo sería peor que no ofrecerlo.
- Hay siete direcciones nuevas y ninguna pantalla de tres columnas. El botón de atrás
  del navegador significa lo que parece en toda la aplicación.
