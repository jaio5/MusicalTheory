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

- **Medir con cinco guitarras y tres micros: el script está, faltan las tomas.**
  `pnpm medir:tomas` pasa una carpeta de grabaciones por el motor en diferido y da
  acierto, dudas y «seguro y falso» por acorde, guitarra y micro; el protocolo y el
  umbral —85 % en C, G, D, Am, Em y F, y los fallos con «?»— están en
  [MEDIR.md](./MEDIR.md). Es lo que pide casi todo lo de abajo.
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
  tocar con una guitarra de verdad**: el acierto de los acordes está medido solo
  con guitarras sintéticas; los retrasos de 40 y 520 ms están calibrados con una guitarra sintética; la latencia
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
- **El modelo de armónicos está cambiado, y medido solo con guitarra sintética**
  ([adr/0107](./adr/0107-los-armonicos-se-miden-en-su-serie.md)). Cada armónico se
  mide en su propia serie y no en una tabla, se mira hasta el duodécimo y el bajo
  desempata `Am7` contra `C6`: con dos guitarras de Karplus-Strong distintas y un
  conjunto ciego, la tríada pasa del 60–75 % al 90–99 %, y el La y el Si menor, de
  casi nunca a casi siempre. **Lo que falta es medirlo con una guitarra de verdad**,
  que tiene otros armónicos que ninguna de las dos. Y una nota sola sigue sin
  separarse de un acorde: ahora sale como su quinta (`C5`), a veces sin «?».
- **Los umbrales del motor de tono** se ajustaron tras una sola tarde de pruebas.
  Hay medidor para afinarlos con datos, y eso sigue sin hacerse.
- **Las inversiones se leen como el acorde en estado fundamental.** El croma
  olvida la octava a propósito ([adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md)),
  así que C/E y C son el mismo vector. **El bajo ya se detecta aparte**
  ([adr/0107](./adr/0107-los-armonicos-se-miden-en-su-serie.md)), pero solo
  desempata: escribir `C/E` pide que un bloque sepa guardar su bajo, y eso toca el
  lienzo, la partitura, el reproductor y lo que se guarda.
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

- **Pasar el examen del profesor contra la API.** `pnpm examen:profesor` son 88
  preguntas por el mismo camino que la ruta, y ya sabe llamar a la API con `--api`;
  falta hacerlo, con la clave puesta ([MEDIR.md](./MEDIR.md)). Con `qwen3:8b` y el glosario
  delante salen 26 de 28 ([adr/0076](./adr/0076-el-profesor-se-apoya-en-un-glosario-comprobado.md)):
  el ii–V–I contesta sin acordes y dice que el bajo sube, y los siete modos, sin
  nombrar ninguno. El validador solo mira las cadencias y la relativa, así que
  errores pequeños fuera de ellas —«la menor natural tiene la séptima justa»—
  siguen llegando a la pantalla.
- **`pnpm docker:ia` está escrito y sin levantar.** El adaptador sí se probó
  contra un Ollama de verdad; el camino de compose, nunca, porque en este equipo
  Docker Desktop no tiene encendida la integración con WSL.
- **Retocar y continuar ya dan salidas válidas, y encajan con lo que llevas.** El
  dominio las construye y un juez las ordena
  ([adr/0089](./adr/0089-las-salidas-las-construye-el-dominio-y-el-modelo-elige.md),
  [adr/0097](./adr/0097-las-salidas-se-juzgan-por-lo-que-encajan.md)). Con
  `qwen3:8b`: contesta 72/72, 216/216 porqués verdaderos, 508/513 sin directrices.
  Lo que falta saber, contra la API, es si un modelo grande aporta algo más que el
  menú. **Y lo que sigue fallando:**
  - **`pnpm banco:ia` es redundante con `pnpm examen:salidas`**, que mide lo mismo
    contra el modelo de verdad y con más casos. Cuando se pase contra la API,
    conviene quedarse con uno.
  - **Un sexto corpus para volver a medir**, escrito a ciegas por un músico ajeno: el
    andamio vacío está en `docs/corpus-sexto/` y el procedimiento en
    [MEDIR.md](./MEDIR.md). Los cinco se han usado para arreglar
    causas (hoy pasan 71/72, 93/96, 98/98, 53/54 y 27/50 _después_ de arreglar), así
    que ya no miden. La última cifra honesta es la del quinto antes de tocar nada:
    22 de 50 menús enteros con el examen estricto
    ([adr/0097](./adr/0097-las-salidas-se-juzgan-por-lo-que-encajan.md)). Lo que
    falta en el quinto son casi todo gustos del arreglista: el V/V sin preparar arriba
    del menú, el iii en un pop con suspendidos, un menú de dos compases que estira.
  - **El estribillo (MC02, de `corpus-final`)**: un pop `I V vi IV` con punteo y
    papel de estribillo, donde el arreglista espera que la primera salida siga y
    cierre en la tónica. Es el único menú de `corpus-final` que no pasa (53 de 54).
  - **«La 1 primero» sin directrices**: baja de 72/72 a 66/72 desde que el prompt de
    sistema no dice que el menú va de más a menos encaje
    ([adr/0100](./adr/0100-hacer-sitio-en-el-prompt-sin-subir-el-presupuesto.md)).
    Devolver la frase lo arreglaba y perdía lo ganado con las directrices.
  - **¿Contestar desde el dominio, sin llamar al modelo, las salidas sin
    directrices?** Sin ellas el modelo solo explica las tres mejores y el respaldo ya
    las construye (`lasTresMejores`). Lo propone la auditoría de prompts; es decisión
    abierta, no hecha.
  - **Medir contra la API**, y no solo con `qwen3:8b`.
- **`TOKEN_BUDGETS.versiones.output` está en 900 y bastan unos 300.** Bajarlo sube
  los cupos de Medio: decisión de precio, no de código.
- **El presupuesto del profesor está lleno: 696 de 700 tokens.** No cabe otra frase
  en el prompt sin subirlo, y subirlo baja los cupos.
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

- **El lienzo ya se guarda solo en el navegador: hecho.** Estaba anotado como lo
  primero de esta sección desde el 26 de septiembre de 2026 —una canción se monta
  en **muchas** sesiones, y sin plan un F5 la borraba entera—. Ahora el lienzo que
  hay se guarda en la IndexedDB `caos-ordenado`, con su versión, al cabo de 300 ms
  del último cambio y nunca a mitad de un arrastre, y vuelve al abrir
  (`guardarElLienzo` en `state/arrangement-store.ts`). Es local y no sube nada.
  **Lo que no hace**: no guarda el deshacer, que es de la sesión; no es una
  canción con nombre —es un solo lienzo, el último—, así que tener varias sigue
  pidiendo guardarlas desde Canciones; y lo de otro navegador u otro aparato no
  lo ve, que para eso está la cuenta.
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

- **Una entrada para tocar, sin banco.** Hubo una pantalla sencilla y se quitó
  ([adr/0095](./adr/0095-se-quita-componer-sencillo.md)): lo que abruma de
  `/componer` lo atienden entrar por `Escribir` con solo la canción abierta y el
  recorrido por pantallas
  ([adr/0108](./adr/0108-el-recorrido-sale-por-pantallas.md),
  [adr/0109](./adr/0109-lo-que-se-da-por-hecho-al-empezar.md)). Si vuelve, que sea
  el espacio `Tocando` más claro y no una segunda pantalla.

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
  en los seis estilos de entonces, desde que un bloque sabe que no lleva tercera
  ([adr/0035](./adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).

  Lo que queda del camino es lo que no es ni tríada ni quinta —un `Fsus2` cambia
  la tercera por la segunda—, que hoy no se propone en ningún estilo. Cuando
  aparezca, el ADR 0035 se amplía con la medida delante
  ([adr/0032](./adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).

- **El parpadeo del primer fotograma en un teléfono: el del banco, hecho.**
  El servidor sigue contestando que sí hay banco, pero su árbol lleva las clases que
  esconden lo de escritorio en un teléfono, y el CLS de componer a 390 pasa de 0,116
  a 0 ([adr/0083](./adr/0083-componer-pinta-lo-de-escritorio-y-las-clases-lo-esconden.md)).
  **Lo que queda de lo que se anotó aquí**: el servidor no puede saber la tonalidad
  —vive en el navegador—, y que el primer fotograma diga «sin elegir» y enseñe la
  rueda abierta hasta cargar el estado **no se ha vuelto a medir** después de este
  cambio. Si sigue ahí, lo que lo resolvería es pintar el marco y esperar al estado,
  y eso es una decisión con alternativas: va con su ADR.

## 5. Que aprender y componer sean lo mismo

- **Faltan unidades de tocar acordes y de oído sobre escalas, y están bloqueadas.**
  El temario tiene 41 unidades —22 de teoría, 9 de tocar y 10 de oído— y sigue
  ordenado como el conservatorio
  ([adr/0096](./adr/0096-el-temario-sigue-al-conservatorio.md)). Los cursos de
  Armonía de 2º a 5º del Profesional no tienen unidad de tocar:
  - Tocar acordes valida con el croma, y el croma falla hoy con una guitarra de
    verdad. **Esto se desbloquea arreglando el motor**, que es lo primero de esta
    misma lista.
  - El oído sobre escalas pide hacer sonar una melodía, y un ejercicio de oído
    sabe hacer sonar acordes y, desde el dictado de intervalos, dos notas. Una
    escala entera es otra máquina.
- **No hay nada de ritmo, de lectura ni de acordes en el mástil**, y la aplicación
  los da por sabidos: componer ofrece siete figuras y un compás de 1 a 6, «Ensayar»
  te **puntúa** contra el metrónomo, la vista por defecto del arreglo es una
  partitura con clave y armadura, y el panel de acordes enseña seis posiciones con
  su cejilla. Las nueve unidades de tocar son **escalas, todas**: se terminan los
  diez cursos sin que nadie te haya pedido tocar un Do y pasar a un Sol a tiempo.
  El ritmo y la lectura se explican con palabras y se preguntan con palabras.
- **Las diez unidades de oído no se han probado con oídos ajenos**
  ([adr/0022](./adr/0022-aprender-de-oido.md)). Los ejercicios suenan con
  osciladores, no con una guitarra, y no se sabe si distinguir un `IVmaj7` de un
  `V7` con ese timbre es más fácil o más difícil que con el instrumento de verdad.
  **Y una de ellas no se podía hacer**: la de cuatríadas sonaba dos veces la misma
  tríada y preguntaba por una nota que nunca llegaba a oírse. Arreglado, con la
  regla que lo habría cazado el primer día
  ([adr/0044](./adr/0044-un-ejercicio-de-oido-se-contesta-de-oido.md)).
- **El repaso de lo fallado enseña las preguntas de oído sin sonido**
  ([adr/0022](./adr/0022-aprender-de-oido.md)), y con el dictado de intervalos
  se nota más: la pregunta pide oír dos notas y en el repaso no suenan. Y leer
  una nota en un pentagrama **dibujado dentro de la unidad** sería el siguiente
  paso: hoy la lectura se pregunta con palabras.
- **Una cola de repaso vieja guardada en el navegador, sin sesión, enseña
  posiciones muertas** de lecciones que cambiaron
  (`core/music/posiciones.ts`). El servidor las suelta al guardar, así que quien
  tiene plan las ve hasta volver a entrar con su cuenta.
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
- **Nada vigila que los tres cortes de la navegación se muevan juntos**: `AppShell`
  en `md`, el tope del panel flotante de `ui/Disclosure` y el corte de 500 px de alto.
  Lo caza la sonda del skill `arrancar`, que no corre sola
  ([adr/0084](./adr/0084-lo-que-trabaja-no-se-apaga-y-el-foco-se-mueve-a-mano.md)).
- **El lienzo guardado no está atado a la cuenta.** Es por navegador: quien comparta
  uno ve la canción del otro. Está en
  [PARA-PUBLICAR.md](./PARA-PUBLICAR.md) porque pesa al publicar, no antes
  ([adr/0081](./adr/0081-el-lienzo-se-guarda-solo-en-el-navegador.md)).
- **Medir la inyección del profesor contra la API.** Con `qwen3:8b` resisten dos de
  ocho disfraces, y contra el modelo de pago no se ha pasado: son los mismos ocho
  casos de [adr/0015](./adr/0015-un-solo-canal-de-texto-libre.md), «Corrección».
- **Lo que dejó la tanda de interfaz**
  ([adr/0102](./adr/0102-lo-que-se-lee-a-un-metro-se-ve-y-lo-que-se-pulsa-se-sujeta.md)):
  - **El muñeco del profesor a 390 sigue tapando el final de una línea**: no cabe a
    48 px por el píxel entero de la mascota.
  - **Con las cinco áreas abiertas a 1024×600 el Arreglo se queda en 96 px**: el
    mástil tiene suelo de 14 rem para que sus notas no bajen de 12 px, y lo que
    cede es el Arreglo, que de todos modos solo enseñaba su barra. Hace falta una
    ventana de más de 700 px de alto para tener los dos holgados.
  - **La columna de tonalidad bajo la bandeja a 1024×600** pide una pista vertical
    de que se desplaza.
  - **Esconder «Componer» del `WorkHeader` por debajo de `sm`.**
  - **Safari/iOS sin probar el toque**: todo se sintetizó en Chromium. Y con cuenta
    y micro, sin medir.
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
