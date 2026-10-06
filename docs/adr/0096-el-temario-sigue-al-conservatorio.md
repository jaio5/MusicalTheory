# ADR 0096 — El temario sigue al conservatorio, y cada unidad se presenta

Fecha: 2026-10-04 · Estado: aceptada

## Contexto

`/aprender` tenía los diez cursos con los nombres del conservatorio —Elemental de
cuatro, Profesional de seis— pero no su contenido. El Elemental empezaba por los
grados, que es empezar por el tejado: no se puede contar «el quinto grado» sin
saber qué es una escala, ni medir una tercera sin saber qué es un semitono. Y no
estaba nada de lo que se estudia en Lenguaje Musical: notas, claves, figuras,
compás, intervalos, armaduras, escalas menores. Del Profesional faltaba lo que
llena Armonía: inversiones, enlace de voces, la séptima de dominante, dominantes
secundarias, modulación, napolitana y sextas aumentadas.

Además **seis unidades repetían la lección de otra** —los tres «repaso», «el
sustituto tritonal», «escribirlas sin confundirlas» y «la mayor, otra vez», que
volvía a pedir la escala mayor de 1º—: prometían algo nuevo y daban lo mismo. Y se entraba a la teoría sin
saber hacia dónde iba.

Quien usa la aplicación lo pidió así: teoría real, ordenada como se estudia en el
conservatorio, con una introducción breve por unidad para saber qué va a entrar y
después ponerlo a prueba.

## Decisión

- **El Elemental sigue a Lenguaje Musical y el Profesional a Armonía**, en ese
  orden (`core/music/curriculum.ts`). Las lecciones nuevas viven por asignatura en
  `core/music/lecciones/` —`lenguaje.ts`, `armonia.ts`—, con lo común en
  `comun.ts`; las diez que había siguen en `lessons.ts`.
- **Cada unidad lleva su `presentacion`**: un `resumen` y la lista de
  `contenidos`. La pantalla la enseña antes que nada, y en las de teoría separa la
  explicación de la prueba. **Los `contenidos` hacen de contrato**: lo que se
  promete es lo que se explica y lo que se pregunta. **No vive dentro de
  `COURSES`** sino aparte, por id de unidad: los contenidos en
  `core/music/presentaciones.ts` y el resumen en `resumenes.ts`. El temario lo
  lee todo el que lee el avance —la cuenta, el repaso, componer al sumar—, y con
  la presentación dentro les llegaba un texto que no pintan; el camino solo
  enseña el resumen, y por eso va en su fichero
  ([adr/0045](0045-un-barril-por-pantalla-no.md)).
- **Ninguna lección la usan dos unidades.** Cinco de las repetidas se quitan
  —`e1-repaso`, `p1-escala`, `p1-repaso`, `p4-tritono`, `p6-repaso`—; repasar ya
  lo hace `/aprender/repaso`, con lo que de verdad se falló. La sexta,
  `p2-cifrado`, se queda con lección propia: la séptima de dominante y su cifrado,
  que es lo que su título prometía.
- **Los ids de unidad no se renombran** aunque cambien de curso: son la llave con
  la que el avance guarda lo hecho. `e1-grados` vive ahora en 4º de Elemental.
- **Las escalas que no son de conservatorio se quedan** —pentatónicas, blues—,
  porque esto es para tocar, y van donde ya se tiene la teoría que las explica.
- La terminología es la del conservatorio español: cadencia perfecta y no
  auténtica, semicadencia, grados tonales y modales, cifrado 6, 6/4, 6/5, +6, +4.

## Consecuencias

- Quien ya había hecho unidades conserva lo hecho de las que siguen. Lo de las
  cinco retiradas se descarta al cargar, y sus preguntas salen de la cola de
  repaso.
- La cola de repaso guarda cada fallo por la **posición** de la pregunta en su
  lección. Las preguntas nuevas van al final y lo que estaba mal se corrigió en su
  sitio, pero **algunas posiciones preguntan ahora otra cosa** del mismo tema: la
  tercera de las especies de tríada (la cuatríada del V, que es de 3º de
  Profesional, pasa a ser qué grados dan tríadas mayores), la segunda del
  intercambio modal (la dominante secundaria, que tiene ahora lección propia, pasa
  a ser el iv menor), la segunda y la tercera de pentatónicas y blues, la tercera
  de las cadencias (la del rock pasa a ser la semicadencia) y todas las de
  `p2-cifrado`. Un fallo guardado ahí vuelve al repaso como una pregunta vecina.
  Se aceptó: conservar una pregunta equivocada para no mover la cola era peor, y
  lo que apunta más allá de la última pregunta lo suelta el servidor
  (`core/music/posiciones.ts`).
- El temario pasa de 34 unidades a 41, y con él el XP total y el peso de cada
  curso en el camino.
- **Ninguna unidad cambia de grado**, así que lo que el plan gratis abría lo sigue
  abriendo. La teoría de pentatónicas y blues, `e4-escalas`, estuvo a punto de
  irse a 5º de Profesional y se quedó al final del Elemental: allí ya se han
  tocado las tres escalas que explica, y en el Profesional habría quedado de pago
  y tres cursos después de ellas.
- Lo que el texto no puede enseñar —leer una nota en el pentagrama dibujado,
  escuchar un ritmo— se pregunta con palabras. Pintar el pentagrama en la unidad
  sería el siguiente paso.

## Alternativas descartadas

- **Dejar los cursos como estaban y añadir lo que falta al final.** El orden es
  la mitad del valor del conservatorio: cada curso usa solo lo explicado antes.
- **Un tercer grado «para guitarristas»** con las pentatónicas y el blues. Partía
  el camino en dos y duplicaba lo que ya explica la escala mayor.
- **Renombrar los ids para que digan su curso.** Más legible en el código, y
  borraba el avance de quien ya había pasado esas unidades.
- **Escribir la presentación dentro de cada lección**, junto a sus preguntas. Las
  unidades de oído y de tocar no tienen lección y también la necesitan.
