# Lo que falta

**Ordenado por lo que impide usarla a diario**, no por lo que falta para
publicar. Hoy esto corre en un equipo y lo usa una persona; lo comercial está
recogido aparte, en [PARA-PUBLICAR.md](./PARA-PUBLICAR.md), y no se mezcla con
esto para no confundir lo que estorba hoy con lo que hará falta algún día.

Lo que ya se hizo, en [HISTORIA.md](./HISTORIA.md). El porqué de cada decisión,
en [adr/](./adr/).

## 1. Que acierte con la guitarra delante

Es lo primero porque todo lo demás cuelga de aquí: si lo que se oye está mal, las
lecciones corrigen mal y las salidas se construyen sobre una semilla falsa.

- **Rodaje de verdad, con guitarra y sala.** Los umbrales del motor de tono se
  ajustaron tras una sola tarde de pruebas. Hay medidor para afinarlos con datos,
  y no se ha hecho.
- **El análisis de la grabación, probado con audio real.** Está medido contra
  señal sintética y contra tests; con una guitarra de verdad, ninguna vez.
- **Las inversiones se leen como el acorde en estado fundamental.** El croma
  olvida la octava a propósito ([adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md)),
  así que C/E y C son el mismo vector, y analizar después no lo arregla. Hace
  falta otra cosa —bajo detectado aparte— o asumirlo y decirlo.
- **Sin medir en un aparato de gama media.** Los números salen de un Ryzen de
  sobremesa. Un teléfono anda entre cinco y diez veces por detrás. El análisis de
  dos minutos tarda 1,1 s aquí: allí serían diez.

## 2. Que lo que propone la IA valga la pena

El corazón de la aplicación, y lo único que no se puede comprobar con un test.

- **Medir las salidas contra la API, no contra un modelo local.** Con un 8B
  local, `continuar` pasa 4 de 4 con `gemma4` y 0 de 4 con `qwen3`; `retocar` no
  lo pasa ninguno. Si lo que propone un modelo bueno sirve para componer, eso no
  lo puede decir un modelo pequeño.
- **`pnpm docker:ia` está escrito y sin levantar.** El adaptador sí se probó
  contra un Ollama de verdad; el camino de compose, nunca, porque en este equipo
  Docker Desktop no tiene encendida la integración con WSL.
- **`rearmonizar` es la salida que peor se le da a todos los modelos**: devuelven
  la canción tal cual. Era el 100 % de la función antes de
  [adr/0016](./adr/0016-salidas-en-vez-de-versiones.md) y ahora es un quinto.
- **Cambiar de tonalidad sería el sexto camino.** `circle-of-fifths.ts` ya sabría
  comprobar que la vecina es vecina y que el pivote existe en las dos. Descartado
  por ahora, no para siempre.

## 3. Que el lienzo llegue hasta donde se compone de verdad

El montaje por bloques está —arrastrar, estirar, escuchar y traer lo grabado
([adr/0018](./adr/0018-el-lienzo-de-montar.md))— y le faltan dos cosas para ser
la manera normal de componer aquí.

- **Guardar desde el lienzo.** El punteo y de dónde salió cada acorde ya caben en
  una canción ([adr/0020](./adr/0020-lo-que-se-oyo-y-lo-que-se-supo.md)), pero la
  pestaña de Canciones sigue guardando el camino de la otra cara y no el montaje.
  Es lo que falta para que el lienzo sobreviva a cerrar la pestaña.
- **Nada usa todavía la procedencia.** Se guarda de dónde salió cada acorde, y ni
  la IA ni las lecciones lo leen aún: un `vi` oído con dudas y otro escrito a mano
  siguen valiendo lo mismo cuando se pide una salida.
- **La partitura no tiene ligaduras ni silencios escritos.** Tampoco tresillos ni
  dos voces. No es que falte dibujarlos: es que el modelo no los tiene, y una nota
  que cruza la barra de compás se dibuja donde empieza y ya.
- **Que la IA ordene las partes.** Sería el sexto camino de `paths.ts`,
  `estructura`: el modelo recibe las partes que hay y devuelve un orden con
  nombres, y el dominio comprueba que solo ha reordenado y repetido lo que había,
  sin inventar acordes. El validador es más fácil que los cinco que ya hay.
- **El lienzo no se guarda solo.** Se guarda como canción desde la pestaña de
  Canciones, y ahí la duración de los bloques se convierte en compases repetidos.
  Es a propósito y está razonado, pero significa que reabrir una canción da los
  bloques desagrupados.
- **En la partitura no se reordenan los acordes.** Se ponen —pulsando,
  arrastrando hasta el compás o escribiendo—, se quitan y se estiran; para mover
  uno que ya está puesto hay que pasar a la vista de bloques.

## 4. Que aprender y componer sean lo mismo

Las dos mitades del corazón funcionan por separado y todavía no se hablan.

- **Las lecciones no explican lo que propone la IA.** Cuando una salida declara
  un préstamo modal, la unidad que lo enseña está a dos pantallas y hay que
  buscarla. Enlazarlas es lo que convierte dos productos en uno.
- **Lo que compones no cuenta como avance.** El XP, la racha y las medallas solo
  se ganan haciendo unidades; componer una canción entera con ayuda no suma nada.

## 5. Que no estorbe

- **Renombrar `versiones` a `salidas` por dentro.** La ruta, la carpeta y la
  capacidad del plan siguen con el nombre viejo, que ya no es el que se ve en
  pantalla. Cuarenta ficheros, mecánico
  —[adr/0016](./adr/0016-salidas-en-vez-de-versiones.md)—.
- **El camino con base de datos pide Docker.** Las tres rutas de IA exigen cuenta,
  así que probar la IA de punta a punta pide levantar Postgres. Se hizo una vez
  con un Postgres embebido y funcionó, pero no está montado como opción.
- **Trastes igual de anchos.** En una guitarra se estrechan hacia el puente. Se
  queda así a propósito: el diagrama se lee mejor.

## Lo que se decidió no hacer

No es deuda, son decisiones, y están aquí para no volver a proponerlas:

- **No sube audio ni vídeo**, y no lo hará sin un ADR
  ([adr/0017](./adr/0017-escuchar-la-grabacion-entera.md) lo vuelve a confirmar al
  analizar la grabación en local).
- **No hay vidas ni corazones.** Fallar no bloquea: se explica y se sigue.
- **No se examina a nadie** para colocarle de nivel
  ([adr/0007](./adr/0007-elegir-por-donde-empezar.md)).
- **Un instrumento por ahora**, con el mapa del segundo escrito
  ([adr/0012](./adr/0012-un-instrumento-por-ahora.md)).
- **Un solo canal de texto libre**, y el profesor solo contesta de música
  ([adr/0015](./adr/0015-un-solo-canal-de-texto-libre.md)).
