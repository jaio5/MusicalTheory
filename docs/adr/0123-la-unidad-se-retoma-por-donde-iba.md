# ADR 0123 — La unidad se retoma por donde iba

Fecha: 2026-10-08 · Estado: aceptada · Revisa: el atajo «Ir directo a las preguntas» para la unidad empezada · Se apoya en: [ADR 0096](./0096-el-temario-sigue-al-conservatorio.md), que guarda las preguntas por su posición

## Contexto

Recargar a mitad de una unidad la montaba de cero: la presentación y la pregunta 1.
Quien iba por la séptima de diez volvía a contestar seis. Había un remedio a medias:
si la unidad se había empezado en la pestaña, la presentación ofrecía «Ir directo a
las preguntas», que llevaba **a la pregunta 1**, y en las de oído ni eso, porque no
tienen teoría que saltarse. Lo que se guardaba era un «1» por unidad en
`sessionStorage`.

## Decisión

**Se guarda por dónde se iba, en números, y al volver se sigue ahí**
(`features/learn/sitio-en-la-unidad.ts`):

- **Tres números por unidad**: el momento por su posición (0 presentación, 1
  teoría, 2 prueba), la pregunta por su posición y si ya se falló alguna (0 o 1).
  Ni el texto de la pregunta ni lo contestado: las preguntas se escriben en la
  tonalidad que haya puesta, así que se guarda la **posición**, como la cola de
  repaso. Cambiar de tonalidad y recargar sigue en la misma pregunta, escrita con
  otros acordes; si la de ahora tiene menos, se empieza por la primera.
- **En `sessionStorage`**, la de la pestaña. Se olvida al terminar la unidad
  (`UnitScreen`) y con la pestaña.
- **Se lee después de hidratar** (`useSyncExternalStore`, que en el servidor
  contesta «nada») y se aplica **una vez, al llegar**: lo que se apunta al avanzar
  también cambia lo guardado, y sin esa marca se volvería a aplicar encima.
- **Retomar no mueve el foco.** El foco al título del momento es para quien acaba
  de pulsar; quien recarga no ha pulsado nada.
- Lo fallado antes de recargar cuenta: la unidad ya no sale sin fallos, y no se
  vuelve a apuntar en la cola.
- El atajo queda **solo para la unidad ya superada**, que se empieza de nuevo y
  puede querer saltarse la teoría.

## Consecuencias

- La pregunta a medio contestar —contestada y sin pulsar «Siguiente»— vuelve en
  blanco: lo contestado no se guarda. Fallarla otra vez no la apunta dos veces en
  la cola, que ya la tiene por su posición.
- La unidad de tocar retoma el momento, no la nota por la que iba.
- En navegación privada estricta, sin almacenamiento, se empieza por el principio
  como antes, y nada se rompe.

## Alternativas descartadas

- **Guardarlo en el avance** (`Progress`), que ya va a la cuenta. Es por dónde iba
  uno hace un rato en esta pestaña, no algo ganado; subirlo era meter en la fusión
  del servidor ([ADR 0116](./0116-el-avance-que-sube-se-comprueba.md)) un campo
  que cambia a cada pregunta.
- **`localStorage`.** Duraría días: quien vuelve a la semana siguiente encontraría
  la unidad en la pregunta siete sin recordar las seis anteriores, y una unidad se
  hace de una sentada.
- **Guardar lo contestado**, para volver con la corrección delante. Es texto que
  depende de la tonalidad, y la regla es que de una pregunta se guarda su posición.
- **Seguir ofreciendo el atajo desde la presentación**, pero a la pregunta guardada.
  Es una pantalla y una pulsación más para llegar a donde ya se estaba.
