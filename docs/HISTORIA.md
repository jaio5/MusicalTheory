# Historia: cómo se llegó hasta aquí

Veinte fases, de un `package.json` vacío a una aplicación que escucha, enseña y
compone. **Aquí solo está lo que se hizo y en qué orden**; lo que falta está en
[ROADMAP.md](./ROADMAP.md) y el porqué de cada decisión, en [adr/](./adr/).

Esto existe porque el orden importó: casi todas las fases salieron de un fallo o
de una limitación de la anterior, y esa cadena explica el proyecto mejor que
cualquier descripción.

| Fase   | Qué trajo                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------- |
| **0**  | Esqueleto y dominio puro: Next, TypeScript con alias, Vitest, y `core/` sin navegador.          |
| **1**  | Detección de tono propia por autocorrelación, y el afinador.                                    |
| **2**  | Rueda de quintas y mástil. La afinación y los trastes suben a `core/instrument`.                |
| **3**  | Modo aprender: el ejercicio como máquina de estados pura, con el instante por parámetro.        |
| **4**  | Modo componer: los siete grados, los caminos entre ellos y el porqué de cada uno.               |
| **5**  | Ideas de IA. Nace `app/api/ideas` y la regla de que el SDK vive en un solo fichero.             |
| **6**  | Grabación con cámara, con el vídeo compuesto en un canvas y descargado en local.                |
| **7**  | Persistencia local de sesiones sobre IndexedDB, con la interfaz por delante.                    |
| **8**  | Cuentas y planes. Nace `src/server/`, que solo abre `app/` y ESLint vigila en los dos sentidos. |
| **9**  | Aprender como una aplicación de idiomas: XP, racha, medallas y desbloqueo lineal.               |
| **10** | Una pantalla por cosa, y elegir por dónde empezar. Aparecen los tres planes de pago.            |
| **11** | Que los cupos cuadren con el dinero: dejan de escribirse a mano y se calculan del precio.       |
| **12** | El avatar, el registro y los ajustes de la cuenta.                                              |
| **13** | Docker: Postgres, migraciones y aplicación en un comando.                                       |
| **14** | Que parezca una aplicación y no nueve pantallas: un solo marco, dos temas, tokens.              |
| **15** | Rodaje con guitarra real. Salió el fallo del micro mudo, que ningún test podía ver.             |
| **16** | Canciones en tu cuenta: el modelo de datos con sus secciones y sus topes.                       |
| **17** | Versiones de tu canción, verificadas contra el dominio movimiento a movimiento.                 |
| **18** | Cobrar de verdad: escrita como puerto y **sin ejecutar nunca**.                                 |
| **19** | Lo que exige publicar: borrar la cuenta, echar sesiones, correo como puerto, vale de un uso.    |
| **20** | Semilla multiinstrumento: se decide **no** construirla todavía, y por qué.                      |

Después de la veinte, en un solo día (26 de agosto de 2026):

| Qué                                                                                          |
| -------------------------------------------------------------------------------------------- |
| Un modelo de casa —Ollama— para poder preguntarle a la IA sin clave y sin factura.           |
| El esquema de las ideas deja de pedir de menos: de 0 de 4 peticiones válidas a 36 de 36.     |
| Un solo canal de texto libre, y el profesor declara si le preguntan de música.               |
| El sonido se guarda y al parar se vuelve a escuchar entero, con ventana cuatro veces mayor.  |
| Las versiones pasan a ser **salidas**: canciones distintas con sus partes, no retoques.      |
| Repaso de toda la aplicación: código muerto fuera, tres fallos reales arreglados.            |
| Componer gana una segunda cara: la canción por bloques que se arrastran y suenan.            |
| El punteo, en rejilla o en partitura, y los acordes se escriben o se arrastran.              |
| Lo que se oye llega con su duda, se dice qué no se supo leer y se puede corregir.            |
| Qué nota puede seguir, siempre a la vista, y el punteo que tocas cae en la partitura.        |
| Aprender gana unidades de oído: suena un acorde en tu tonalidad y dices qué era.             |
| Remate: el lienzo se guarda, los acordes se reordenan escritos y el bVII deja de ser A#.     |
| La interfaz se lee: fuera la monoespaciada de todo lo que no es un dato, y la rueda de pie.  |
| Grabarse pasa a ser solo sonido, que se oye ahí mismo; se va la cámara y su capa entera.     |
| El micrófono pasa a ser uno de verdad, y la tonalidad se recuerda de una vez para otra.      |
| La pregunta se ve como lo que hay que hacer, y cada botón que trabaja lo dice.               |
| La rueda se recorre con las flechas, y abrirla en un móvil deja de vaciar la pantalla.       |
| La aplicación deja de prometer que detecta la tonalidad rasgueando: pide notas sueltas.      |
| La clave de sol se dibuja de su trazo y por fin se reconoce; la armadura deja de pisarla.    |
| Se usa la profundidad que ya estaba escrita: la partitura es hoja y las columnas se separan. |
| Lo que estaba escrito tres y cinco veces pasa a estarlo una: rutas, oyentes y avisos.        |
| Componer suma a la racha y a la meta, y una parte dice si es estrofa, estribillo o idea.     |
| El grabado se mide en espacios de pentagrama, y la clave deja de parecer una clave de fa.    |
| Componer pasa a ser un banco de areas que se pliegan, con su reparto por espacio de trabajo. |
| Se compone tocando: el micro escribe acordes y punteo, y la toma de audio se queda al lado.  |
| Ensayar lo escrito cuenta compases, racha y cual se atraganta, sin castigar por fallar.      |

## Los fallos que enseñaron algo

De todo lo de arriba, lo que conviene no olvidar son los tropiezos, porque casi
ninguno se veía leyendo el código:

- **El micro se quedaba mudo** y había que pararlo y arrancarlo otra vez. Solo
  apareció con una guitarra delante, en la fase 15.
- **Los cupos de IA perdían dinero**: cuarenta al día son mil doscientas al mes, y
  nadie lo había multiplicado. De ahí salió `core/billing/cost.ts` (fase 11).
- **El ROADMAP llegó a afirmar que el reconocimiento de acordes era imposible**
  cuando llevaba dos commits funcionando. De ahí la regla de actualizar el
  documento que describía lo que cambias.
- **La clave de sol costó tres intentos, y los dos primeros fueron por mirar en
  vez de medir.** Esta misma tabla decía desde su fase que «por fin se reconoce», y
  no se reconocía. El primer intento ensanchó el gancho a ojo; el segundo culpó a
  la regla de relleno —una teoría que se cayó sola al superponer el trazo sobre el
  dibujo—; el tercero salió en cuanto se contaron las proporciones contra las de
  una clave de imprenta: la tenía **espejada**, con la masa a la izquierda cuando
  va a la derecha. Y los dos errores de diseño que quedaban los cazó `clef.test.ts`,
  no la vista. Dibujar una letra es un oficio con números, no un ajuste fino.
- **El esquema de las ideas no exigía lo que el validador daba por hecho**, así
  que el modelo devolvía respuestas impecables que se barrían enteras y la ruta
  contestaba 502 con el cupo ya gastado.
- **Medir el ruido con un percentil no vale si no hay silencio**: el umbral subía
  por encima de la propia guitarra y detectaba cero acordes en ocho segundos.
- **Un reloj de tres minutos leía la grabadora equivocada** y cortaba por la mitad
  una grabación posterior.
- **La monoespaciada se extendió sin que nadie lo decidiera**, de las notas y los
  cents a la navegación, los botones y diecinueve rótulos en versalitas: cerca de
  cien sitios, y la aplicación entera con pinta de terminal. Nadie lo vio porque
  cada sitio, por separado, parecía razonable.
- **La rueda de quintas giraba las letras con el disco**, «como el aparato de
  verdad», y once de las doce tonalidades quedaban tumbadas o boca abajo. Era el
  control con el que empieza todo lo demás.
- **Dos botones de escuchar, dos micrófonos.** En `/afinar` hay dos sitios que
  abren el micro y el estado de sesión es uno; cada uno guardaba su entrada en
  sus propias referencias. Al arrancar desde el afinador, el de la barra se
  pintaba encendido y al pulsarlo llamaba a _su_ parada, que no tenía nada
  abierto: la pantalla decía «sin escuchar» y **el micrófono seguía abierto**. Se
  vio contando pistas vivas en un Chromium de verdad, no leyendo el código.
- **La tonalidad no se recordaba**, y era lo único que no. La aplicación se
  acordaba de que te gusta el rock y se olvidaba de en qué estabas tocando, así
  que las cinco pantallas volvían a pedirla en cada recarga.
- **Abrir la rueda en un teléfono vaciaba componer.** La barra de tonalidad es
  `shrink-0` y abierta medía 613 px de 800: a lo que crece —el acorde, la lista,
  la canción— le tocaban **cero**, y no había forma de desplazarse hasta ello.
  Elegías el tono y la pantalla parecía romperse. Se vio midiendo el reparto de
  alto en un navegador de verdad; ningún test que lea texto lo habría visto.
- **La rueda pedía veinticuatro turnos del tabulador** y llevaba `role="img"` con
  veinticuatro botones dentro, que es decirle a un lector de pantalla que ahí no
  hay nada que tocar.
- **«Toca unos compases y la detectamos sola» era verdad solo a veces.** Lo decían
  seis pantallas. La tonalidad sale de un histograma de alturas que llena el motor
  de tono, y ese es monofónico: rasgueando acordes no entra ni una nota y no se
  detecta nunca; con la escala tarda cuatro segundos. Se vio tocándole a la
  aplicación dos ficheros por el micrófono falso, no leyendo el código.
- **La clave de sol no parecía una clave de sol**, dos intentos seguidos. Estaba
  escrita curva a curva como silueta, y de ahí salió una espiral con un palo: le
  faltaban los **dos cruces con el mástil**, que son lo que la hace reconocible, y
  escribiendo el contorno a mano hay que llevar la cuenta de los dos lados de cada
  cruce. Se arregló cambiando de idea: se declara la línea que recorre la pluma y
  cuánto pesa en cada punto —que es como se piensa una letra— y el contorno sale
  de desplazarla a los dos lados.
- **Y la armadura se escribía encima de la clave.** El hueco anterior al primer
  compás era un número fijo calculado para Do mayor, que no tiene alteraciones; en
  Fa sostenido son seis sostenidos y se metían en la clave y en el primer compás.
- **Centrar el afinador con `justify-center` le quitó el scroll.** Es la trampa
  clásica de flexbox: cuando el contenido no cabe se sale por los dos lados y no
  hay forma de bajar hasta lo que sobra. Se arregló el mismo día que se introdujo,
  y solo porque una sonda midió qué elementos no alcanzaba ningún ancestro.
- **Un botón que suma dos no puede vivir sobre un dominio que acota.** Los
  compases de una parte se alargaban de dos en dos, y `setBars` no deja bajar de
  lo que hay escrito: pegado a ese suelo, el «−» movía **uno** en vez de dos, y
  desde el suelo mismo no movía nada. El número saltaba distinto según lo que
  hubiera dentro, que es la peor clase de fallo porque parece capricho. De uno en
  uno no puede pasar: el tope solo corta cuando de verdad no queda sitio, y
  entonces el botón ya está apagado. De paso, el número se escribe —de cuatro a
  dieciséis eran doce pulsaciones— y lo tecleado se valida **al salir** y no a
  cada tecla, o borrar el campo para poner «10» lo dejaba en el mínimo al primer
  dígito y el segundo ya no entraba.
- **Y la barra que se abre encima de algo que crece no debía repartir, sino
  flotar.** Arreglado el reparto, la rueda de quintas salía **cortada por una
  recta** —lo que toca no es «hay más abajo», es «esto está roto»—. Sacándola del
  flujo no hay nada que repartir: la rueda sale redonda y el lienzo pasa de 328 px
  a 576. Es lo que ya hacía el cajón de herramientas de esa misma pantalla, que se
  abre hacia arriba; esta se abre hacia abajo.
- **Un tope en `vh` es una medida que caduca.** El `max-h-[38dvh]` que impedía
  que la rueda abierta se comiera componer se midió a ojo en un teléfono, y dejó
  de valer en cuanto la cabecera creció al ganar el conmutador de caras: 153 px
  de cabecera más 288 de barra más 61 de herramientas en 514 de pantalla dejaban
  **doce píxeles** para componer, con los 2.230 tests en verde. El número no
  estaba mal elegido, estaba condenado: dependía de lo que midieran sus vecinos.
  Lo reparte flexbox, que sí lo sabe.
- **Y el scroll no se puede poner en el hijo de un `<details>`.** El navegador
  mete `::details-content` por medio, así que el hijo con `min-h-0` no se entera
  de que su abuelo se ha encogido: el `<details>` se quedaba en 158 px y lo de
  dentro seguía midiendo 468 y saliéndose. Se probaron cuatro CSS distintos en la
  página de verdad antes de dar con el que funciona, que es poner el scroll en el
  propio `<details>`.
- **Medir una pantalla pide distinguir lo que no se está dibujando.** La sonda
  que recorre las pantallas daba veintitrés falsos positivos en 1920: eran los
  contenidos de un `<details>` **cerrado**, porque Chrome sigue devolviendo sus
  tamaños aunque no los pinte. Lo resuelve `checkVisibility`. Un medidor sin
  calibrar es peor que ninguno, así que ahora se comprueba devolviendo el fallo:
  con él detecta trece problemas, sin él cero.
- **Extraer una pieza compartida deja dos rastros que ningún test ve.** Al sacar
  el reproductor de progresiones a un hook, los tres sitios que lo usaban se
  quedaron con `useEffect` y `useRef` importados y sin usar, y con dos listas de
  dependencias incompletas: lo dijo ESLint, no la batería de tests. Y al meter el
  import del nuevo módulo con un script, cayó **dentro** de un `import` de varias
  líneas y rompió el fichero. Un `assert` de lo que se sustituye no basta: hay que
  mirar dónde acaba lo que se añade.
- **Un arreglo escrito y sin enchufar tumbaba una pantalla entera.** Cambiar a una
  tonalidad menor con bloques puestos lanzaba `RangeError` —los dos modos no
  nombran los mismos grados— y React tiraba el árbol encima de media hora de
  trabajo. La acción que lo arreglaba llevaba tiempo escrita, probada, y con un
  comentario que decía «lo llama el cambio de rueda»: no lo llamaba nadie.
- **Tres fallos de maquetación que ningún test veía y una captura sí.** La columna
  del acorde se salía de la pantalla porque un hijo de `flex` tiene
  `min-width: auto` y el centro se plantaba en lo que medía su barra; el mástil
  salía del tamaño de un sello porque las variables del reparto colgaban de una
  fila de la que el área de abajo era **hermana**, no hija; y en un teléfono la
  canción quedaba en una rendija con el inspector del acorde llevándose media
  pantalla. Los cinco comandos pasaban en los tres casos.
- **Centrar en una caja que recorta saca lo que no cabe por los dos lados.** Está
  escrito en el repositorio desde hace tiempo y se volvió a caer en ello dos veces
  seguidas, en tocar y en ensayar: `justify-center` dentro de un `overflow-hidden`
  deja el botón fuera de alcance en cuanto la ventana es baja.
- **Preguntarle a lo que todavía no existe.** El ensayo miraba su propio guion
  —que no se construye hasta empezar— para saber si había algo que ensayar, y
  decía «no hay nada» con la canción escrita delante. Había que preguntarle al
  montaje.
