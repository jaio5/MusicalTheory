# Roadmap

Estado a 1 de agosto de 2026. Las doce fases están implementadas;
lo que queda anotado abajo es deuda y afinado con instrumento real.

## Fase 0 — Esqueleto y dominio · hecha

- [x] Configuración: `package.json`, `tsconfig.json` con paths absolutos,
      Tailwind, ESLint, Prettier, Vitest, `.env.example`, `.gitignore`.
- [x] `core/music/notes.ts`: frecuencia, MIDI, clase de altura, nombre y cents.
- [x] `core/music/scales.ts`: nueve escalas.
- [x] `core/music/chords.ts`: tríadas diatónicas con cifrado y grado romano.
- [x] `core/music/keys.ts`: detección de tonalidad con perfiles de Krumhansl,
      tres candidatas con puntuación e histograma que decae.
- [x] `core/music/progressions.ts`: caminos entre grados con criterio de rock y
      catálogo de progresiones.
- [x] Tests del dominio.
- [x] Interfaces declaradas sin implementar: `AudioInput`, `PitchEngine`,
      `CameraInput`, `SessionRecorder`.
- [x] Tokens de diseño en `ui/tokens.ts`.
- [x] Documentación y dos ADR.
- [ ] `reference/prototype.jsx`: el prototipo no estaba disponible al arrancar.

## Fase 1 — Motor de tono y afinador · hecha

- [x] `detectPitch`: autocorrelación normalizada con interpolación parabólica,
      probada contra tonos sintéticos de las seis cuerdas al aire con menos de
      un cent de error.
- [x] `WebAudioInput`: `getUserMedia` con `echoCancellation`,
      `noiseSuppression` y `autoGainControl` desactivados, y los errores del
      navegador traducidos a frases que dicen qué ha pasado y qué hacer.
- [x] `AutocorrelationPitchEngine`: bucle a 20 análisis por segundo, con margen
      de silencio para que el hueco entre dos púas no apague la nota.
- [x] Store de sesión en `state/`, sin conocer la capa de audio.
- [x] Afinador: nota grande, cents, aguja, cuerda más cercana y aviso cuando la
      señal no llega limpia.
- [x] Estado «no se oye nada» explícito, en vez de congelar la última nota.
- [x] Umbrales de enganche y de seguimiento separados, tras probar con guitarra
      real: con un solo umbral la nota se perdía a los pocos instantes.
- [ ] Pendiente de más rodaje: los valores actuales salen de una sola prueba y
      de señales sintéticas.

El análisis se quedó en el hilo principal en vez de ir a un `AudioWorklet`;
el porqué está en [adr/0003](./adr/0003-analisis-en-el-hilo-principal.md).

## Fase 2 — Rueda de quintas y mástil · hecha

- [x] `core/instrument/guitar.ts`: la afinación y los trastes suben a core,
      porque los usan el afinador y el mástil y un feature no importa de otro.
- [x] `core/music/circle-of-fifths.ts`: orden de la rueda, relativas, ángulos y
      el giro por el camino corto.
- [x] El store acumula lo tocado en el histograma y recalcula la tonalidad dos
      veces por segundo, no veinte.
- [x] Rueda de quintas que gira con GSAP hasta poner arriba la tonalidad, con
      `prefers-reduced-motion` respetado desde `ui/motion.ts`.
- [x] Las tres candidatas con su puntuación, y la posibilidad de fijar una
      tonalidad a mano o volver a la detección.
- [x] Mástil de quince trastes con la escala elegida, tónicas destacadas y la
      nota que suena encendida.
- [ ] Pendiente de prueba tocando: cuánto tarda la detección en asentarse y si
      la vida media de veinte segundos es la buena.

Las etiquetas de la rueda giran con ella, como en el aparato de cartón: la que
queda arriba se lee derecha y las demás quedan inclinadas.

## Fase 3 — Modo aprender · hecha

- [x] `features/learn/exercise.ts`: la escala subiendo y bajando como máquina de
      estados pura, con el instante por parámetro. Un ejercicio entero se prueba
      sin esperar ni un milisegundo real.
- [x] Validación por detección: la nota cuenta cuando se sostiene 350 ms
      afinada; rozarla no basta y soltarla reinicia el contador.
- [x] `audio/reference-tone.ts`: nota de referencia con oscilador triangular y
      envolvente, para comparar de oído.
- [x] Avance con barra, aviso al terminar y reinicio al cambiar de escala.
- [ ] Pendiente de prueba tocando: si 350 ms es cómodo o se hace lento.

La nota se valida por clase de altura, no por octava: la misma nota cae en
varias cuerdas y exigir una octava concreta sería pelearse con el mástil.

## Fase 4 — Modo componer · hecha

- [x] Los siete acordes diatónicos de la tonalidad, con su cifrado y su grado.
- [x] Caminos desde el acorde actual, ordenados por frecuencia de uso y con el
      porqué de cada uno. Se encadenan: pulsar una sugerencia la convierte en el
      acorde actual.
- [x] Catálogo de progresiones resuelto a acordes de la tonalidad.
- [x] Historial de notas tocadas, con la misma nota contando otra vez solo si
      vuelve a sonar tras una pausa.
- [x] El acorde actual se detecta: croma con descuento de armónicos y coseno
      contra plantillas, en un motor aparte del de tono. El porqué y sus límites,
      en [adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md).
- [ ] Pendiente de prueba tocando: si las cuatro décimas que tarda en salir el
      acorde se notan al encadenar, y cuánto estorba que las inversiones se lean
      como el acorde en estado fundamental.

Si la escala elegida en el mástil es pentatónica o de blues, los acordes se
arman con la mayor o la menor natural: sobre cinco notas no se pueden apilar
terceras.

## Fase 5 — Ideas de IA · hecha

- [x] Route handler `/api/ideas`, único sitio que importa el SDK y lee la clave.
- [x] Validación de entrada: lo que no está en el esquema se ignora, y la
      petición al modelo se reconstruye desde los campos que pasan.
- [x] Salida estructurada con esquema JSON, más validación contra el dominio:
      los grados tienen que existir en ese modo.
- [x] Los cifrados que devuelve el modelo **no se creen**: se recalculan desde
      los grados, que es la única forma de que no aparezca un acorde imposible.
- [x] Un reintento y errores en español que dicen qué hacer.
- [ ] Pendiente de probar con clave de verdad: el contrato está probado, la
      llamada al modelo no.
- [ ] Sin límite de frecuencia todavía: `rate_limited` está en el contrato pero
      nadie lo emite.

## Fase 6 — Grabación con cámara · hecha

- [x] `BrowserCameraInput`: el permiso de cámara se pide solo al darle a grabar,
      y su error se traduce a una frase que dice qué hacer.
- [x] `CanvasSessionRecorder`: vídeo oculto → canvas → `captureStream` →
      `MediaRecorder`, con negociación de formato y troceado cada segundo.
- [x] Overlay con nota, cents, tonalidad y acorde, colocado en proporción al
      lienzo y con un velo debajo para que se lea sobre ropa clara.
- [x] Descarga local con nombre fechado, liberando la URL del objeto.
- [ ] Pendiente de grabar de verdad: solo están probadas las partes puras
      —formato, nombre y overlay—, porque jsdom no tiene `MediaRecorder`.

Sigue sin haber ni una línea de código de subida, y no la habrá sin un ADR.

## Fase 7 — Persistencia local de sesiones · hecha

- [x] `SessionStorage` como interfaz, con dos implementaciones: IndexedDB en el
      navegador y en memoria para los tests y el renderizado en servidor.
- [x] Se guardan tonalidad, escala y nombres de notas. Ni audio ni vídeo.
- [x] Retención de veinte sesiones, con la regla probada aparte de la base.
- [x] Retomar una sesión devuelve su tonalidad y su escala.
- [ ] No se restaura sola al abrir: hay que pulsar «Retomar». Automático sería
      cómodo, pero también sorprendente.

IndexedDB y no localStorage porque localStorage es síncrono, y escribir cientos
de notas ahí bloquearía el hilo que está analizando el audio.

## Fase 8 — Cuentas y planes · hecha

- [x] Capa `src/server/`, que solo abre `app/`, vigilada por ESLint en los dos
      sentidos: un import de `@server/` desde un componente se llevaría la cadena
      de conexión al navegador.
- [x] Cuentas con Auth.js: correo y contraseña, sesión en cookie firmada y sin
      tabla de sesiones. El plan **no** viaja en la cookie, para que quien acaba de
      pagar no siga viendo candados.
- [x] Contraseñas con `scrypt` de la biblioteca estándar de Node: sin dependencias
      que se compilen al instalar. Comparación en tiempo constante, y cifrado
      también cuando el correo no existe, para que no se pueda averiguar quién
      tiene cuenta midiendo lo que tarda.
- [x] Tres tablas en Postgres con Drizzle y migraciones en el repositorio:
      `users`, `progress` y `ai_usage`.
- [x] Tres planes en el dominio (`core/billing`), con permisos por verbo y cupo
      diario. La pantalla y la ruta preguntan a la **misma** función.
- [x] Candado en las dos rutas de IA: `402` con el plan que hace falta y `429` con
      el cupo gastado, los dos con el precio en la frase.
- [x] Cupo que sube y comprueba su tope en la misma sentencia, para que dos
      peticiones a la vez no gasten las dos la última.
- [x] Avance sincronizado con **la fusión en el servidor**: subir es idempotente y
      dos aparatos abiertos a la vez no se pisan.
- [x] Puerto de facturación con un cobrador que no cobra, y que lo declara para que
      la pantalla pueda avisarlo.
- [x] Pantalla `/cuenta`: entrar, registrarse, los tres planes con lo que da cada
      uno, y qué se guarda de ti.
- [ ] **Sin probar con Postgres de verdad.** En la máquina donde se escribió no
      había ni base de datos ni Docker disponible. Lo que falle ahí serán las
      consultas: la política de planes, la fusión y el cifrado tienen tests.
- [ ] Sin cobro de verdad. Es lo siguiente, y es añadir una implementación del
      puerto, no rediseñar nada.

El porqué de las dos decisiones grandes está en
[adr/0005](./adr/0005-cuentas-y-avance-en-servidor.md) —cuentas propias y quién
fusiona el avance— y [adr/0006](./adr/0006-planes-y-puerto-de-facturacion.md)
—planes en el dominio y cobro como puerto—. Lo que da cada plan y qué se guarda de
quien entra, en [CUENTAS-Y-PLANES.md](./CUENTAS-Y-PLANES.md).

## Fase 9 — Aprender como una aplicación de idiomas · hecha

El dominio ya era medio Duolingo desde la fase 3: XP, racha con su aritmética de
días, medallas y desbloqueo lineal. Lo que faltaba era la piel, y una parte del
dominio.

- [x] **Camino con nodos** en vez de lista. La lista pesaba igual en todas sus
      filas, así que no había un «aquí estoy», y con nueve de cada diez unidades
      cerradas lo que se veía era un muro de candados. Ahora el que toca es más
      grande y lleva su cartel, y lo cerrado se atenúa hasta quedar de fondo.
- [x] **Cuatro estados y no dos**: hecha, abierta, cerrada por temario y cerrada
      por plan. Los dos candados no se abren igual —uno estudiando y otro
      pagando—, y con el mismo icono quien va por el cuarto curso cree que le falta
      estudiar.
- [x] **Meta diaria** con su anillo, y la racha en grande al lado. Un número que
      sube durante diez cursos no da la sensación de haber hecho algo hoy; una meta
      que se llena, se cierra y mañana está vacía, sí.
- [x] **Pantalla de después**: cuánto has ganado, cómo va la racha, si has cerrado
      la meta y qué medallas son nuevas. Antes terminar una unidad devolvía a la
      lista sin decir nada.
- [x] **Repaso de lo fallado.** Lo que se falla se apunta por su **posición** en la
      lección, no por su texto, así que se vuelve a generar en la tonalidad de hoy:
      el repaso pregunta lo mismo con otros acordes, que es lo que distingue haber
      entendido el V grado de haberse aprendido que la respuesta era Sol.
- [x] Unidades **agrietadas**: superadas pero con preguntas esperando repaso. Una
      unidad hecha deja de ser una casilla cerrada para siempre.
- [x] Dos medallas nuevas —cerrar la meta del día y dejar la cola de repaso
      vacía— y XP de repaso que **cuenta para la meta y no para el temario**: si
      contase para el temario, repasar mucho el Elemental diría que llevas medio
      Profesional hecho.
- [ ] Pendiente de rodaje: si la meta de 40 XP es la buena, y si dos pasos de
      repaso —hoy y mañana— bastan para que algo se quede.

**Sin vidas ni corazones**, a propósito y en contra del modelo que imita: fallar no
bloquea, se dice por qué era la otra y se sigue. Lo que se pierde al fallar es la
medalla de no fallar y que la pregunta vuelva, no el avance, porque una unidad que
hay que repetir desde el principio se abandona.

## Fase 10 — Una pantalla por cosa, y empezar donde quieras · hecha

- [x] **Tres planes de pago** —Básico 4,99 €, Medio 9,99 €, Pro 19,99 €— cada uno con
      algo que el anterior no tiene: el temario entero, las ideas de la IA, y un
      profesor que sabe por dónde vas. El gratis sigue siendo lo que tiene quien no
      paga, y no se vende como una cuarta columna.
- [x] `planOf` traduce los nombres viejos: `estudiante` → Básico, `conservatorio` →
      Pro. Un renombrado no puede degradar en silencio a quien había pagado.
- [x] **`/planes` y una ventana de pago por plan** (`/planes/basico`, `/medio`,
      `/pro`), con el resumen, el precio, lo que se abre **que no tuvieras ya**, y el
      hueco para entrar sin salir de la pantalla. `/planes/gratis` da 404: el plan
      gratis no es una compra.
- [x] Sin campos de tarjeta, y dicho en su sitio: mientras el cobrador no cobre,
      unos campos que no llevan a ninguna pasarela serían un decorado que se parece
      demasiado a un cobro de verdad.
- [x] **Aprender es solo el camino.** La unidad, el repaso y el profesor se han ido a
      sus propias direcciones: `/aprender/[unidad]`, `/aprender/repaso`, `/profesor`.
- [x] **Se elige por dónde empezar.** Un desplegable con los diez cursos: lo anterior
      al punto de partida queda abierto, de ahí en adelante sigue siendo una detrás de
      otra, y saltar no da por hechas las unidades que se salta.
- [x] Navegación con iconos abajo en pantalla estrecha, donde llega el pulgar, y
      arriba en pantalla grande.
- [ ] Pendiente de rodaje: si el desplegable es la forma buena de elegir el nivel, o
      si hace falta que la primera vez lo pregunte a pantalla completa.

El comentario de `progress.ts` que defendía el desbloqueo lineal decía lo contrario de
lo que hace ahora el código, así que se ha reescrito. Las alternativas —abrirlo todo,
una prueba de nivel, dar por hechas las unidades saltadas— están en
[adr/0007](./adr/0007-elegir-por-donde-empezar.md).

## Fase 11 — Que los cupos cuadren con el dinero · hecha

Los cupos de IA salieron escritos a mano y **perdían dinero**: cuarenta peticiones al
día son mil doscientas al mes, y con Opus 5 eso eran entre veintiséis y sesenta euros
de coste para un plan de 4,99 €. Nadie los había multiplicado.

- [x] `core/billing/cost.ts`: los precios reales de los tres modelos, el peor caso de
      tokens de cada petición y los cupos como una **división** —presupuesto del plan
      entre coste del peor caso—. Ya no hay ningún cupo escrito a mano.
- [x] Un test que comprueba que **ningún plan de pago pierde dinero** aunque se gaste
      el cupo entero, con los tres modelos y con uno desconocido.
- [x] El `max_tokens` de las dos rutas sale del mismo sitio que el cálculo: el peor
      caso que supone la aritmética es el tope que impone el servidor.
- [x] **Pensar apagado** en las dos rutas. En Opus 5 viene encendido por defecto y se
      cobra como salida: multiplicaba el coste de cada pregunta y podía gastarse el
      tope pensando para devolver una respuesta truncada.
- [x] Dos topes: el del mes protege el dinero y el del día evita fundirse el mes en una
      tarde. Se comprueban **en la misma sentencia**, y por eso la tabla pasó a tener
      una fila por cuenta y mes con el día dentro.
- [x] **La IA pide cuenta.** El contador anónimo por dirección IP se ha borrado, no
      arreglado: no era un límite por cliente, era un rótulo.
- [x] `server/prompts.ts` con los dos prompts y los dos esquemas juntos, y un test que
      mide sus caracteres: si crecen hasta comerse la holgura del presupuesto de
      tokens, falla. Es lo que evita que el modelo de coste mienta en silencio.
- [ ] El peor caso de entrada sigue siendo una estimación por longitud, no una medida
      con `count_tokens`. Confirmarlo con clave de verdad es lo que falta.

Lo que sale con el modelo por defecto: Básico 147 peticiones al mes, Medio 181, Pro 363,
y quince de regalo sin pagar. Con Haiku 4.5 se multiplican por cinco, y el cálculo ya lo
hace solo. El porqué y las alternativas, en
[adr/0008](./adr/0008-los-cupos-salen-del-precio.md).

## Fase 12 — El avatar, el registro y los ajustes de tu cuenta · hecha

La cuenta funcionaba entera desde la fase 8, pero se llegaba a ella por un rótulo con
el correo recortado que en el móvil se comía el sitio de la navegación, y una vez
dentro no se podía cambiar nada.

- [x] **Avatar redondo** arriba a la derecha, con la inicial de cómo te llamas. Sin
      cuenta es un enlace a `/registro`, y con cuenta un desplegable: un menú cuya
      única opción es «entrar» es un clic de más para llegar al mismo sitio.
- [x] **`/registro`**, pantalla propia. Quien llega no viene a mirar nada, viene a
      rellenar tres campos, y al lado se cuenta qué le da la cuenta —incluido que sin
      ella la aplicación funciona entera menos la IA—. Con la sesión abierta no se
      pinta el formulario: crear una segunda cuenta sin querer es perder el avance de
      la primera.
- [x] **`/cuenta` son cuatro secciones con ancla** —perfil, suscripción, contraseña y
      privacidad—, que son las cuatro entradas del desplegable. Anclas y no cuatro
      pantallas: se miran de una en una y muy de tarde en tarde.
- [x] **Cambiar el nombre y la contraseña**, con `PATCH /api/cuenta` y su propio
      límite de intentos. La contraseña se pide aunque ya haya sesión: una cookie viva
      en un ordenador prestado no puede bastar para quedarse con la cuenta.
- [x] El nombre sube hasta el navegador dentro de la cuenta, que es de donde salen el
      saludo y la letra del círculo. Antes se guardaba al registrarse y no se enseñaba
      en ningún sitio.
- [x] Entrar refresca la cuenta **y** vuelve a pintar desde el servidor. Sin lo
      primero el candado de al lado seguía cerrado un instante; sin lo segundo el
      avatar de arriba seguía siendo el de nadie.
- [ ] **Sin «he olvidado mi contraseña» y sin cambiar de correo.** Las dos piden
      escribir a un buzón para confirmarlo, y aquí no hay envío de correo. Está dicho
      en la pantalla, no escondido.
- [ ] Cambiar la contraseña no echa a las demás sesiones: la cookie va firmada con el
      secreto del servidor, no con la contraseña. Hacerlo pide una versión de sesión en
      la fila de la cuenta y comprobarla al leer la cookie.
- [x] Probado contra Postgres de verdad, como el resto de la fase 8: el nombre se
      guarda recortado, la contraseña actual equivocada devuelve 403 y **no guarda
      tampoco el nombre** que venía en la misma petición, y con la contraseña vieja
      ya no se entra.

## El camino

El panel que hace que esto se juegue: eliges tonalidad, te propone por dónde
empezar, y al elegir un acorde te enseña **cuatro formas de hacerlo** sobre el
mástil y **a dónde puedes ir** desde él. Encadenando se construye la progresión,
y se puede volver atrás a cualquier punto.

## La portada

`/` explica qué es esto y cómo funciona, y trae el afinador de verdad para
probarlo sin entrar: es el mismo componente que hay dentro, no una imitación.
La rueda también es la de verdad, y la tonalidad que pulses ahí ya está puesta
al entrar.

El resto no se demuestra en la portada: se cuenta y se enlaza. Meter aquí la
pantalla de componer sería enseñar una foto de la aplicación en vez de la
aplicación.

El encabezado ocupa una pantalla justa —ni más, para que se vea que hay algo
debajo, ni menos— con el vídeo a la vista. El velo va de lado y no plano: por la
izquierda oscurece lo justo para leer el titular y por la derecha deja la imagen
entera. Con un velo plano encima, o no se lee el titular o no se ve el vídeo.

Las letras crecen con el ancho de la pantalla. Un tamaño fijo se queda pequeño
en un monitor grande y se desborda en uno pequeño; con `clamp` lo resuelve el
navegador solo, y los tamaños viven en los tokens como cualquier otro valor de
diseño. La medida de lectura va en caracteres —`42ch`, `68ch`— y no en píxeles,
que es lo que hace que al crecer la letra la línea siga midiendo lo mismo en
palabras.

El texto sale del diseño que hay en `reference/landing`, adaptado a lo que la
aplicación hace de verdad hoy.

## Las tres pantallas

Cada una está hecha para una cosa y trae lo que hace falta para esa cosa. No hay
que montarse nada: se elige arriba y ya está.

**Aprender.** El camino y nada más: diez cursos en dos grados, en nodos, con la unidad
que toca destacada y la meta del día arriba. Se elige por qué curso entrar, así que
quien ya sabe teoría no tiene once unidades de peaje. Cada unidad se abre en su propia
pantalla, y el repaso también.

**Profesor.** Su pantalla, con la tonalidad a la vista porque es lo que cambia la
respuesta. Antes era una columna estrecha dentro de aprender, y ahí no se podía ni
escribir a gusto ni preguntar mientras componías, que es cuando salen la mitad de las
dudas.

**Componer.** Arriba, el metrónomo: se pone en marcha y se olvida uno de él,
como el botón de grabar. El tempo se escribe, se ajusta de dos en dos o se marca
con el dedo, que es como se saca de verdad el de una canción que suena en la
cabeza. El pulso no lo lleva un temporizador de JavaScript —el hilo se atasca
con cualquier cosa y el clic llega tarde— sino el reloj del audio, que es
independiente.

Debajo, la rueda para elegir tonalidad, el acorde en el que estás con
todas sus formas a lo largo del mástil, y a dónde puedes ir, con el buscador que
propone mientras escribes. Cada acorde lleva un punto: verde si es seguro, ámbar
si trae una nota de fuera y rojo si trae más. Mástil, ideas y sesiones se abren en una franja
a lo ancho de toda la parte de abajo: el mástil son seis cuerdas y quince
trastes, y en una columna estrecha no se lee. La franja crece con lo que haya
dentro hasta un tope, así que las sesiones no dejan medio hueco vacío debajo.

El mástil no hace scroll nunca: se lleva un alto fijo y el dibujo se encoge
hasta caber, con sitio de sobra para salir a todo lo ancho —1354 píxeles en una
pantalla de 1440—. Un mástil que hay que arrastrar para ver el traste doce no sirve
con la guitarra en las manos, y perder la mitad de la pantalla mientras está
abierto es un precio que se paga solo mientras se mira.

Aquí está grabarte tocando: al darle al botón la cámara se pone detrás de todo y
la interfaz se queda en contorno y letra, así que te ves mientras sigues leyendo
los acordes. El vídeo no sale del equipo.

**Afinar.** La afinación que elijas —estándar, drop D, medio tono abajo, un tono
abajo, drop C, DADGAD, open G y open D— y nada más. Quien viene a afinar viene a
eso.

Las notas de cada afinación están comprobadas contra fuentes y fijadas en el
test, con las fuentes escritas al lado. No es celo de más: un error aquí no se
ve —una afinación mal escrita suena razonable— y acaba en una guitarra mal
afinada con el afinador diciendo que está bien. Cada una se escribe además como
se escribe de verdad: la bajada de medio tono es Eb Ab Db Gb Bb Eb, no
D# G# C# F# A# D#, que suena igual y no lo reconoce nadie.

Las notas se escriben en cifrado anglosajón —C, D, E— en toda la aplicación.

## Que se lea con la guitarra puesta

Se toca a un metro de la pantalla, no a cuarenta centímetros, y con las dos
manos ocupadas. De ahí tres reglas:

- Nada de letra por debajo de doce píxeles. Lo que no se lee de un vistazo no
  está.
- Los diagramas y la rueda, grandes: son dibujos que hay que interpretar, no
  iconos.
- El porqué de cada acorde cabe en dos líneas y no se corta a mitad de palabra.
  Un texto cortado con puntos suspensivos obliga a acercarse, y acercarse
  significa dejar de tocar.
- Lo que significa un color va al lado del color. El punto verde, el ámbar y el
  rojo llevan su leyenda encima de la lista, no en una ayuda aparte.
- Cada columna tiene un tema: la izquierda es lo que decides —tonalidad, estilo,
  escala, herramientas—, el centro es el acorde y la derecha a dónde vas.

Grabando, la cámara lleva un velo por encima. Sin él hay que pelear el contraste
letra a letra contra lo que sea que tengas detrás —una ventana, una pared
blanca— y nunca sale bien; con él se te sigue viendo y se lee todo.

## Deuda técnica

### Pagada

- ~~**Escritura con bemoles.**~~ Cada tonalidad decide su escritura según su
  posición en la rueda. F mayor escribe Sib.
- ~~**Cuatríadas y tensiones.**~~ Hay cuatríadas con sus siete especies, y el
  modo componer las enciende con una casilla. Quedan las tensiones por encima de
  la séptima, que es otra cosa y no la pide nadie todavía.
- ~~**Tokens duplicados.**~~ Siguen escritos dos veces —Tailwind v4 quiere sus
  variables en CSS— pero ahora un test lee `globals.css` y falla si se separan.
- ~~**Sin medidor de nivel.**~~ El afinador enseña cuánta señal entra, en
  decibelios y con los dos umbrales marcados encima.
- ~~**La rueda no se puede pulsar.**~~ Cada tonalidad es un `<button>` de
  verdad: entra en el tabulador, responde a Intro y el lector de pantalla la
  anuncia con su nombre completo.
- ~~**Sin selector de dispositivo.**~~ Con el permiso ya concedido aparece la
  lista de entradas y se puede cambiar sin recargar.
- ~~**Sin límite de frecuencia en la API.**~~ Diez peticiones por minuto y
  dirección, con `Retry-After`.
- ~~**Análisis en el hilo principal, sin medir.**~~ Medido: 16,2 ms por segundo
  con los dos motores en marcha, un 1,6 % del hilo, y la peor ráfaga en un 5 %
  de un fotograma. El 97 % es la autocorrelación; el motor de acordes cuesta
  treinta veces menos. Se queda en el hilo principal y el Web Worker se
  descarta por ahora, con los números en
  [adr/0003](./adr/0003-analisis-en-el-hilo-principal.md) y un test que vigila
  la regresión.
- ~~**Reconocimiento de acordes.**~~ Era el límite del método, no de la
  implementación: la autocorrelación devuelve un periodo y un acorde tiene
  varios. Se resuelve con un segundo motor que no usa autocorrelación sino
  croma, con el ADR que pedía: [adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md).

### Viva

- **Las inversiones se leen como el acorde en estado fundamental.** El croma
  olvida la octava a propósito, así que C/E y C son el mismo vector. Es el
  límite que sustituye al anterior, y sale documentado en
  [adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md).
- **Umbrales con poco rodaje.** Los cuatro se ajustaron tras una prueba. Ahora
  al menos hay medidor para afinarlos con datos en vez de a ojo.
- **Sin medir en un aparato de gama media.** Los números de arriba salen de un
  Ryzen de sobremesa. Un teléfono anda entre cinco y diez veces por detrás, que
  seguiría cabiendo, pero eso es aritmética y no medición.
- **Trastes igual de anchos.** En una guitarra se estrechan hacia el puente. Se
  queda así a propósito: el diagrama se lee mejor.
- **El contador de frecuencia es por instancia.** En memoria. Si esto se
  despliega en varias, cada una llevará su cuenta. El cupo diario de las cuentas
  sí es compartido: vive en Postgres.
- **El cobro no cobra.** Cualquiera con una cuenta puede darse el plan Pro.
- **Los cupos suponen los tokens de entrada, no los miden.** La estimación sale de la
  longitud de los prompts, con holgura de sobra y un test que la vigila, pero
  confirmarla con `count_tokens` pide clave y red.
- **El plan gratis pierde dinero a propósito**: quince peticiones al mes por cuenta,
  unos veinte céntimos con el modelo más caro. Es captación, está en una constante con
  nombre, y con muchas cuentas gratis hay que mirarlo. Es una decisión, no un olvido
  —[adr/0006](./adr/0006-planes-y-puerto-de-facturacion.md)—, pero es lo primero
  que hay que cerrar antes de publicar esto en serio.
- **Nada de las cuentas está probado contra Postgres.** Solo lo puro: planes,
  permisos, fusión de avances, cola de repaso y cifrado de contraseñas.
- **El repaso solo alcanza a las preguntas de teoría.** Las unidades de tocar no
  tienen preguntas que fallar, así que una escala que sale regular no se apunta en
  ninguna parte.
- **Sin restaurar la sesión al abrir.** Hay que pulsar «Retomar». Automático
  sería cómodo y también sorprendente.
- **Sin probar con instrumento y clave reales.** Lo que no puede comprobar un
  test: cómo se siente el afinador, si la tonalidad se asienta rápido, si el
  ejercicio se hace lento, si la grabación sale bien y si el modelo devuelve
  ideas que valgan. Ahora también: si la meta diaria de 40 XP es la buena y si dos
  pasos de repaso bastan.
