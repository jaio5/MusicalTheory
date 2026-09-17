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

- **Que la marca de «oído» sirva de algo medible.** Los compases que leyó el micro
  y nadie confirmó viajan al modelo marcados, y el prompt le dice que no se fíe de
  ellos. **No está medido**: no se sabe si cambia lo que devuelve, y no se sabrá
  hasta que las salidas se midan contra la API, que es lo primero de esta lista.
- **Las lecciones siguen sin leer la procedencia.** Un `vi` que leyó el micro y
  otro escrito a mano valen lo mismo cuando el profesor o una unidad hablan de tu
  canción.
- **Dos notas iguales seguidas se transcriben como una sola larga.** El motor mide
  altura y no ataques, así que no las distingue. Hace falta detección de onsets
  para que la transcripción sea fiel.
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
- **En la partitura no se mueven acordes de una parte a otra.** Dentro de una
  parte se reordenan arrastrando el cifrado; para llevárselo al estribillo hay que
  pasar a la vista de bloques, que es donde se ven las dos partes a la vez.

## 4. Que componer sea un banco de trabajo, y no dos caras

En marcha. Lo decidido está en [adr/0031](./adr/0031-componer-es-un-banco-de-trabajo.md),
[adr/0032](./adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md) y
[adr/0033](./adr/0033-el-copiloto-propone-y-no-escribe.md); esto es lo que queda
por hacer, en el orden en que se hace.

- ~~**Repeticiones por parte en el dominio.**~~ Hecho: `|: :|` con vueltas,
  contadas por `arrangementBeats`, y repetir es sonido y no papel.
- **Componer tocando, en un solo gesto.** Está construido entero y no se
  encuentra: `captureProgression`, `captureMelody` y `partFromCapture` ya
  convierten lo que suena en una parte con sus acordes y su punteo, pero detrás
  de un botón del lienzo llamado «apuntar» y en dos pasos. Sube a la barra de
  arriba como espacio de trabajo, se pulsa una vez y de paso **se graba el
  sonido** ([adr/0034](./adr/0034-tres-maneras-de-escribir-la-misma-cancion.md)).
- **Un micrófono compartido entre analizar y grabar.** Hoy son dos
  `getUserMedia`: `audio/` abre el suyo para el tono y el croma, y `media/` el
  suyo para los bytes. Funciona y no empeora nada, pero lo correcto es que las
  dos capas compartan un `MediaStream`. Es fontanería y tiene su propio paso.
- **La puntuación del ensayo, en `core/`.** Dado el arreglo y lo que oyó el
  croma: acertados sobre el total, racha más larga y el compás peor. Puro, se
  prueba sin React y sin audio.
- **El armazón de áreas.** Cabeceras finas, divisores de Pointer Events con tope
  mínimo y doble clic al preset, espacios de trabajo y la disposición guardada en
  `state/workspace.ts`. Al terminar esto no se ha perdido ninguna función: el
  contenido de hoy entra dentro tal cual.
- **Fundir `path` con el arreglo.** Es el paso ancho: `path` lo leen siete
  sitios. Pasa a ser el cursor de escritura y deja de ser la canción.
- **El copiloto en línea.** Bloques fantasma al final del arreglo, `Tab` acepta y
  `Esc` descarta, el cupo restante en la barra de arriba y los cinco estados de
  error con su sitio.
- **El modo ensayar.** El metrónomo arranca, el compás actual se enciende, el
  croma valida y al final salen los números. Sin castigo: fallar ilumina el
  compás y sigue, que es la regla que ya tiene aprender.
- **El móvil no es un banco de trabajo.** Por debajo de 1024 px, una columna y
  pestañas abajo. Áreas que se arrastran con el dedo es lo que hace tedioso un
  editor.

Y dos cosas que este trabajo **no** hace, escritas aquí para no volver a
proponerlas: no hay pistas, ni automatización, ni MIDI, ni exportación de audio
—esto es un cuaderno de progresiones que se toca con una guitarra de verdad—, y
el copiloto no escribe solo en tu canción.

## 5. Que aprender y componer sean lo mismo

- **Las seis unidades de oído no se han probado con oídos ajenos**
  ([adr/0022](./adr/0022-aprender-de-oido.md)). Los ejercicios suenan con
  osciladores, no con una guitarra, y no se sabe si distinguir un `IVmaj7` de un
  `V7` con ese timbre es más fácil o más difícil que con el instrumento de verdad.
- **No se puede practicar el oído sin avanzar en el camino.** Una pantalla de
  entrenamiento suelto se descartó para no duplicar la meta diaria y la racha; si
  se hace, lo que tiene que compartir con el camino es exactamente esa racha.

Las dos mitades del corazón funcionan por separado y todavía no se hablan.

- **Las lecciones no explican lo que propone la IA.** Cuando una salida declara
  un préstamo modal, la unidad que lo enseña está a dos pantallas y hay que
  buscarla. Enlazarlas es lo que convierte dos productos en uno.
- **Componer ya cuenta, y lo que devuelve el modelo con el papel puesto no está
  medido.** Cuatro hechos suman a la meta del día y mantienen la racha
  ([adr/0028](./adr/0028-componer-tambien-cuenta.md)), y una parte dice ahora si
  es estrofa, estribillo o solo una idea, que es lo que viaja al prompt. Que la
  frase llega, lo dice un test; que cambie lo que contesta, no lo sabe nadie
  hasta medir contra la API, que es lo primero de esta lista.
- **El papel de una parte no lo lee nada más que la IA.** Ni las lecciones, ni la
  partitura, ni las salidas ya recibidas. Un estribillo y una estrofa se dibujan
  igual y se tratan igual en todo lo demás.

## 6. Que no estorbe

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

- **No sube audio**, y no lo hará sin un ADR
  ([adr/0017](./adr/0017-escuchar-la-grabacion-entera.md) lo vuelve a confirmar al
  analizar la grabación en local).
- **No hay vidas ni corazones.** Fallar no bloquea: se explica y se sigue.
- **No se examina a nadie** para colocarle de nivel
  ([adr/0007](./adr/0007-elegir-por-donde-empezar.md)).
- **Un instrumento por ahora**, con el mapa del segundo escrito
  ([adr/0012](./adr/0012-un-instrumento-por-ahora.md)).
- **Un solo canal de texto libre**, y el profesor solo contesta de música
  ([adr/0015](./adr/0015-un-solo-canal-de-texto-libre.md)).
