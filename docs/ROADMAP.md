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

- **Rodaje con guitarra: hecho una vez, el 23 de septiembre de 2026, y lo que
  salió está aquí.** El afinador, bien: afina las seis cuerdas y recupera una
  desafinada media vuelta. Los acordes, no: con C, F, G y Am sueltos **se inventa
  alguno**; rasgueando, falla; una inversión —C/E—, falla; una cuerda que roza, la
  escribía **como si estuviera seguro**; y un punteo de dos notas iguales seguidas
  **se apunta como acordes**. El análisis en diferido arrastra lo mismo.
- **La claqueta: hecha, y suena toda la toma.** Se cuentan dos compases, el clic
  sigue durante la toma y lo apuntado empieza donde cae el compás uno
  ([adr/0072](./adr/0072-la-claqueta-suena-toda-la-toma.md), que sustituye en parte
  al [0053](./adr/0053-la-claqueta-cuenta-y-se-calla.md)). **Lo que queda es
  tocar con una guitarra de verdad**: el La menor abierto se lee Esus4 o C6; los
  retrasos de 40 y 520 ms están calibrados con una guitarra sintética; la latencia
  de entrada del micro no se descuenta; y no hay tresillos ni ligaduras
  (`LeadNote`, `Staff` y el reproductor no los tienen).
- **«Traer punteo» del lienzo sigue leyendo el historial de 24 entradas**
  (`state/session-store.ts`): un punteo largo se queda en sus últimas notas. La
  toma ya no depende de él, pero esa vía sí.
- **`VersionsPanel` mezcla instantes relativos a la grabación con un `endedAt` de
  `performance.now`.**
- **Preguntar lo dudoso sin tener que ir a buscarlo: hecho.** La corrección estaba
  puesta y solo aparecía para el bloque que tuvieras elegido, así que había que dar
  con los dudosos pulsándolos uno a uno. Ahora la pregunta sale sola, **una y con la
  cuenta de las que quedan** —ni todas, que llenaría la columna, ni ninguna—. Es el
  paso 1 de los tres que hacen falta para quitar el selector.
- **Y hay que quitar el selector de rítmica o punteo: tiene que transcribirse
  solo.** Decidido el 26 de septiembre de 2026 por quien la usa, y **revierte
  [adr/0048](./adr/0048-una-toma-dice-lo-que-es.md)**. La medida de aquel sigue en
  pie —tras el descuento de armónicos, una nota sola y su acorde mayor tienen casi
  la misma forma— pero cambia el objetivo: no hay que acertar siempre, hay que
  transcribir solo **y dejar corregir**. Tres pasos, en este orden: que corregir
  cueste un gesto —cambiar un acorde por una nota y al revés, en la partitura—;
  después contar cuántas notas suenan a la vez, que es lo único que separa un
  punteo de un rasgueo y pide las grabaciones de calibración de abajo; y el
  selector se cae solo cuando eso acierte. **Quitarlo antes devuelve los acordes
  inventados encima del punteo**, que es el fallo que 0048 cerró.
- **Y una clase entera de falso positivo se ha ido sin tocar el motor**: un punteo
  ya no entra con acordes inventados encima, porque una toma dice si es rítmica o
  punteo y solo se apunta lo de ese papel
  ([adr/0048](./adr/0048-una-toma-dice-lo-que-es.md)). No era que el croma fallara:
  era que se le preguntaba por algo que no era, y los dos motores competían por la
  misma señal. **Lo que sigue pendiente es acertar qué acorde es**, y eso sí pide
  las grabaciones.
- **De eso, lo que ya está arreglado es la honestidad, no el acierto**
  ([adr/0043](./adr/0043-dos-maneras-de-equivocarse.md)): la confianza mira las dos
  maneras de equivocarse —el empate y el mal parecido— en vez de solo la primera, y
  lo analizado en diferido lleva por fin su duda en vez de llegar como certeza.
  Ahora un acorde mal tocado sale con «?» en vez de afirmarse.
- **Lo que falta es el acierto, y pasa por el modelo de armónicos.**
  `discountHarmonics` rebaja la quinta y la tercera de _cualquier_ acorde, porque
  en un Do real el Sol sí es el tercer armónico del Do: después del descuento, un
  Do rasgueado y un Do pulsado a solas tienen casi la misma forma, y de ahí sale
  que un punteo se lea como acordes. Lo que los distinguiría es si esos picos son
  más fuertes de lo que el modelo predice, y el descuento actual lo aplana. **Pide
  grabaciones de guitarra de verdad**: con la guitarra sintética de los tests no se
  puede calibrar, porque tiene justo los armónicos que se le pusieron.
- **Los umbrales del motor de tono** se ajustaron tras una sola tarde de pruebas.
  Hay medidor para afinarlos con datos, y eso sigue sin hacerse.
- **Las inversiones se leen como el acorde en estado fundamental.** El croma
  olvida la octava a propósito ([adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md)),
  así que C/E y C son el mismo vector, y analizar después no lo arregla. Hace
  falta otra cosa —bajo detectado aparte— o asumirlo y decirlo.
- **El reconocimiento en vivo sí aguanta una CPU lenta, y está medido.** Con el
  micrófono falso tocando un `C-F-G-Am` y la CPU frenada ×1, ×4, ×6, ×10 y ×20,
  escribe los cuatro acordes en los cinco casos —`gama-media.mjs` del skill
  `arrancar`, 22 de septiembre de 2026—. **Lo que no dice esa cifra**: el micro
  falso da señal limpia, así que mide si el motor llega a tiempo y no si acierta
  con una guitarra en una habitación.
- **Sigue sin medirse el análisis de la grabación entera en un aparato de gama
  media.** Es otra cosa, va en un worker, y los números salen de un Ryzen de
  sobremesa: el de dos minutos tarda 1,1 s aquí y allí serían diez.

## 2. Que lo que propone la IA valga la pena

El corazón de la aplicación, y lo único que no se puede comprobar con un test.

- **Medir las salidas contra la API, no contra un modelo local.** El banco ya
  está hecho —`pnpm banco:ia`, y deja su informe en `banco-de-ia.txt`—: usa el
  mismo prompt, el mismo esquema y el mismo validador que la ruta, así que mide
  lo que hay en producción y no una copia. **Falta pasarlo contra la API**: hoy
  el `ANTHROPIC_API_KEY` del `.env` está vacío, así que contesta el Ollama de
  casa.

  La línea base medida con `qwen3:8b`, 22 de septiembre de 2026: **5 de 12
  salidas pasan el contrato**, una de ellas devolviendo la canción tal cual.
  Por camino: `seguir` 2, `contraste` 2, `estirar` 1, y **`rearmonizar` y
  `otro-final` ni aparecen**. Con esto no se sabe si la función sirve o si el
  modelo es pequeño, que es exactamente para lo que hace falta la API.

- **`pnpm docker:ia` está escrito y sin levantar.** El adaptador sí se probó
  contra un Ollama de verdad; el camino de compose, nunca, porque en este equipo
  Docker Desktop no tiene encendida la integración con WSL.
- **`rearmonizar` es la salida que peor se le da a todos los modelos**: devuelven
  la canción tal cual. Era el 100 % de la función antes de
  [adr/0016](./adr/0016-salidas-en-vez-de-versiones.md) y ahora es un quinto.
- **Los bloques fantasma no tienen quien los llene.** `state/propuesta.ts` y su
  tira siguen funcionando, pero quien proponía era el panel de ideas, retirado. Si
  el copiloto en línea vuelve, tiene que volver con otra fuente: una salida
  aceptada a fantasma, o una propuesta del dominio sin modelo.
- **Cambiar de tonalidad sería el sexto camino.** `circle-of-fifths.ts` ya sabría
  comprobar que la vecina es vecina y que el pivote existe en las dos. Descartado
  por ahora, no para siempre.

## 3. Que el lienzo llegue hasta donde se compone de verdad

El montaje por bloques está —arrastrar, estirar, escuchar y traer lo grabado
([adr/0018](./adr/0018-el-lienzo-de-montar.md))— y le faltan dos cosas para ser
la manera normal de componer aquí.

- **El lienzo no se guarda solo, y eso es lo primero de esta sección.** Hay que
  guardarlo como canción desde la pestaña de Canciones, y si no te acuerdas se
  pierde. Estaba anotado como un detalle razonado y **sube a urgente el 26 de
  septiembre de 2026**, porque quien la usa ha dicho que una canción se monta en
  **muchas** sesiones y no en una: con sesiones largas esto no es una molestia, es
  perder trabajo.
- **Y reabrir ya no desagrupa los bloques: hecho.** Un grado sigue siendo un
  compás, que es lo que leen la ruta de salidas y la de canciones, pero la
  agrupación se guarda aparte en `compasesPorBloque`. Aquí ponía que arreglarlo
  pedía tocar el esquema de la base de datos, y **era falso**: la canción vive en
  una columna `jsonb`, así que un campo opcional más no pide ninguna migración,
  igual que no la pidieron `sources` ni `especies`. Las canciones de antes no lo
  traen y siguen abriendo un bloque por compás.

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
- **Exportar a MusicXML o a PDF.** El MIDI ya sale
  ([adr/0041](./adr/0041-la-cancion-sale-en-midi.md)); lo otro, cuando la
  partitura tenga silencios, ligaduras y tresillos, que es lo de arriba.
- **En la partitura no se mueven acordes de una parte a otra.** Dentro de una
  parte se reordenan arrastrando el cifrado; para llevárselo al estribillo hay que
  pasar a la vista de bloques, que es donde se ven las dos partes a la vez.

## 4. Que componer sea un banco de trabajo, y no dos caras

Hecho lo gordo. `/componer` es una pantalla de áreas que se pliegan y se
arrastran, con tres espacios de trabajo que son **tres maneras de escribir la
misma canción** —tocando, por bloques y partitura, y ensayando—, cada uno con su
reparto de fábrica. El porqué está en
[adr/0031](./adr/0031-componer-es-un-banco-de-trabajo.md),
[adr/0032](./adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md),
[adr/0033](./adr/0033-el-copiloto-propone-y-no-escribe.md) y
[adr/0034](./adr/0034-tres-maneras-de-escribir-la-misma-cancion.md).

Lo que queda, en el orden en que se hace:

- **Fundir `path` con el arreglo, lo que le queda.** Ya no se ven dos listas de
  lo mismo —«a dónde ir» viene plegada y, abierta, **escribe en la canción**: lo
  que tiene grado entra como bloque con su séptima y lo que no lo tiene lleva al
  camino, diciéndolo antes de pulsar—. Lo que oye el micro también entra en la
  canción, y la columna del acorde, el mástil, las salidas y «añadir parte» siguen
  a la canción y no al camino. Y lo que la aplicación propone **se puede escribir
  entero**: medido, de los catorce acordes de la lista no quedaba fuera ninguno
  en los seis estilos, desde que un bloque sabe que no lleva tercera
  ([adr/0035](./adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).

  Lo que queda del camino es lo que no es ni tríada ni quinta —un `Fsus2` cambia
  la tercera por la segunda—, que hoy no se propone en ningún estilo. Cuando
  aparezca, el ADR 0035 se amplía con la medida delante
  ([adr/0032](./adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).

- **El parpadeo del primer fotograma en un teléfono.** `useHayBanco` contesta que
  sí hay banco en el servidor, así que en estrecho se pinta el reparto ancho y al
  hidratar cambia a pestañas. El tema lo resolvió con un guion en el `<head>`;
  aquí no vale, porque no es un atributo sino otro árbol.

  **Medido antes de ponerse:** las pestañas tardan unos 300 ms en aparecer en un
  portátil, pero eso es lo de menos. El servidor **no puede saber la tonalidad**
  —vive en el navegador—, así que el primer fotograma dice «sin elegir» y enseña
  la rueda abierta pase lo que pase, y al cargar el estado cambia media pantalla.
  Arreglar solo el banco deja el parpadeo grande igual. Lo que resolvería los dos
  es pintar el marco y esperar al estado, y eso es una decisión con alternativas:
  va con su ADR.

## 5. Que aprender y componer sean lo mismo

- **Tres cursos siguen cojos, y los tres por el mismo motivo.** El temario está en
  34 unidades —15 de teoría, 10 de tocar, 9 de oído— y los cursos a los que les
  falta un tipo bajaron de seis a tres
  ([adr/0044](./adr/0044-un-ejercicio-de-oido-se-contesta-de-oido.md)). Los que
  quedan **no están sin escribir: están bloqueados**.
  - `profesional-2` (Cuatríadas) y `profesional-4` (Sustituciones) pedirían una
    unidad de **tocar acordes**. Una unidad de tocar valida una escala con el motor
    de tono, que es monofónico; validar acordes es el croma, y el croma falla hoy
    con una guitarra de verdad. **Esto se desbloquea arreglando el motor**, que es
    lo primero de esta misma lista.
  - `elemental-4` (Qué escala tocar) pediría oído sobre escalas, y un ejercicio de
    oído aquí es una progresión de acordes: no sabe hacer sonar una melodía. Eso
    es otra máquina.
- **No hay nada de ritmo, de lectura ni de acordes en el mástil**, y la aplicación
  los da por sabidos: componer ofrece siete figuras y un compás de 1 a 6, «Ensayar»
  te **puntúa** contra el metrónomo, la vista por defecto del arreglo es una
  partitura con clave y armadura, y el panel de acordes enseña seis posiciones con
  su cejilla. Las diez unidades de tocar son **escalas, todas**: se terminan los
  diez cursos sin que nadie te haya pedido tocar un Do y pasar a un Sol a tiempo.
  Falta también el intervalo, que es el ladrillo de debajo, y meterlo cambia lo que
  `ear.ts` decidió por escrito —aquí se pregunta por acordes, no por notas
  sueltas—, así que pide su ADR.
- **Las siete unidades de oído no se han probado con oídos ajenos**
  ([adr/0022](./adr/0022-aprender-de-oido.md)). Los ejercicios suenan con
  osciladores, no con una guitarra, y no se sabe si distinguir un `IVmaj7` de un
  `V7` con ese timbre es más fácil o más difícil que con el instrumento de verdad.
  **Y una de ellas no se podía hacer**: la de cuatríadas sonaba dos veces la misma
  tríada y preguntaba por una nota que nunca llegaba a oírse. Arreglado, con la
  regla que lo habría cazado el primer día
  ([adr/0044](./adr/0044-un-ejercicio-de-oido-se-contesta-de-oido.md)).
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
- **El camino con base de datos pide Docker.** Las rutas de IA exigen cuenta,
  así que probar la IA de punta a punta pide levantar Postgres. Se hizo una vez
  con un Postgres embebido y funcionó, pero no está montado como opción.
- **Trastes igual de anchos.** En una guitarra se estrechan hacia el puente. Se
  queda así a propósito: el diagrama se lee mejor.

- **Las dianas de la rueda, fuera de la portada.** Valen 44 px o más en la
  portada ([adr/0074](./adr/0074-la-diana-de-la-rueda-sale-de-una-cuenta.md)); en
  el panel de componer del teléfono y en la columna de escritorio salen en 41 px, y
  a 320 de ventana no se puede pasar de 38.
- **Sin plan, el repaso no apunta lo fallado**, y el texto ya lo dice. Falta que
  decida el usuario si debería apuntarse.
- **`lectura` entre 768 y 1023** deja el `aside` en unos 200 px
  ([adr/0073](./adr/0073-las-pantallas-llenan-el-ancho.md)), y `WorkHeader` sigue con
  16 px de margen frente al `px-margen` del cuerpo.
- **Regenerar la escena y la mascota con la paleta del
  [adr/0070](./adr/0070-la-sala-encendida.md)**: `arte/portada/build.py` y
  `arte/mascota/build.py`.

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
