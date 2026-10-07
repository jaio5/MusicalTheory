# ADR 0109 — Lo que se da por hecho al empezar

Fecha: 2026-10-07 · Estado: aceptada · Ajusta: [ADR 0031](./0031-componer-es-un-banco-de-trabajo.md) y [ADR 0034](./0034-tres-maneras-de-escribir-la-misma-cancion.md)

## Contexto

El mismo estudio de los primeros cinco minutos que llevó al
[ADR 0108](./0108-el-recorrido-sale-por-pantallas.md) encontró tres valores de
partida que estorbaban a quien empieza:

1. **La primera unidad, «Las notas y sus alteraciones», pedía tonalidad antes de
   empezar.** La barra se abría sola con una rueda de veinticuatro y la unidad
   quedaba inerte detrás: a quien viene a aprender qué es una nota se le preguntaba
   por algo que todavía no conoce. Todas las lecciones generan sus preguntas con la
   tonalidad —se comprobó: ninguna sale igual en las veinticuatro—, pero en las
   primeras es el ejemplo, no el tema.
2. **La escala por defecto era la pentatónica menor**, para todo el mundo y en
   cualquier tonalidad: en Do mayor el mástil enseñaba Mib y Sib a quien aprendía
   las notas de Do. Estaba anotado en el ROADMAP como decisión pendiente.
3. **Componer se abría en `Tocando`** y, al pasar a `Escribir`, con el área del
   acorde abierta, cuyo primer texto era «¿Y si lo tocas tú?». Las dos llevan al
   reconocedor de acordes, que con una guitarra de verdad duda —el La menor al aire
   sale como otro acorde (`docs/ROADMAP.md` §1)—. La primera canción de alguien
   empezaba por un acorde que no había tocado.

## Decisión

- **Aprender va en Do mayor mientras no elijas otra** (`TONALIDAD_DE_PARTIDA`,
  `selectTonalidadParaAprender` en `state/session-store.ts`). Vale para la teoría,
  el oído y las escalas de tocar. **No se fija**: componer sigue pidiendo la de tu
  canción. La barra de la unidad nace plegada y dice «C mayor, de partida»
  (`BarraDeTonalidad` con `dePartida`). Se van los estados vacíos que la pedían
  (`SinTonalidad`) y los cuatro botones de la presentación.
- **La escala sigue a la tonalidad mientras nadie elija otra**: la mayor en mayor
  y la menor natural en menor (`escalaDeLaTonalidad`, `selectEscala`). Se guarda
  **nula**, no la que sale ahora, para que siga a la tonalidad la próxima vez.
  **Lo guardado se respeta**, aunque sea la pentatónica de fábrica de antes: no se
  sabe si la eligió alguien.
- **Componer se abre en `Escribir`, con solo la canción abierta**
  (`DEFAULT_BANCO`, `REPARTOS_DE_FABRICA.escribir`). Lo primero que se lee es
  «Empieza eligiendo la tonalidad» o «La canción está en blanco: pulsa un acorde de
  “Para empezar”». El acorde, la rueda y «A dónde ir», plegados a su tira. Quien
  tenga un reparto guardado lo conserva.
- **La portada dice lo que funciona**: el afinador, la teoría y escribir con ayuda;
  reconocer acordes es una ayuda que duda y lo dice. Sin cifras nuevas.

## Consecuencias

- Quien tenía la pentatónica guardada sin haberla elegido la sigue viendo. Es el
  precio de no decidir por nadie.
- Las unidades de un principiante salen en Do mayor, que es la de los libros. Quien
  quiera las mismas preguntas con otros acordes abre la barra.
- `Tocando` queda a un clic, y el recorrido lo presenta como ayuda que duda.
- El repaso sigue pidiendo tonalidad: va con plan y no es de los primeros minutos.

## Alternativas descartadas

- **Marcar qué lecciones no usan la tonalidad y no pedirla solo en esas.** Se midió
  y no hay ninguna: todas escriben sus ejemplos con ella. La marca sería una lista a
  mano que miente en cuanto alguien cambia una lección.
- **Do mayor solo en el Grado Elemental, y pedirla en el Profesional.** Dos reglas
  para lo mismo, y en el Profesional pedirla tampoco enseña nada: la barra está ahí
  para quien quiera cambiarla.
- **Fijar Do mayor de verdad al abrir una unidad.** Componer la daría por elegida y
  dejaría de preguntar por la tonalidad de la canción.
- **Cambiar el valor de fábrica de la escala a la mayor**, a secas. En La menor
  enseñaría la escala de Do empezando en La, que son las mismas notas pero no la
  escala de la tonalidad; y al cambiar de modo habría que volver a elegirla.
- **Reescribir la escala guardada si era la pentatónica.** No se sabe quién la
  eligió y quién la heredó, y quitársela a quien la eligió es peor que dejársela a
  quien no.
- **Seguir entrando por `Tocando`, con un aviso de que duda.** Avisar no arregla que
  lo primero que se escribe lo decida el reconocedor.
