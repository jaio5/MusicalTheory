# Roadmap

Estado a 25 de agosto de 2026. Las catorce primeras fases están implementadas; lo
que queda anotado en cada una es deuda y afinado con instrumento real. Debajo de
ellas están las seis que vienen, con el destino ya elegido: publicarla de verdad.

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
- [x] **Probado con Postgres de verdad** (1 de agosto de 2026), con el de
      `compose.yml`: tablas, registro, entrada, cambio de plan, fusión del avance y
      contador de IA. Estuvo escrito sin ejecutar desde esta fase; lo único que salió
      al ejecutarlo fue una falta de concordancia en un mensaje, no una consulta mal.
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

## Fase 13 — Docker: la aplicación entera en un comando · hecha

- [x] `compose.yml` con Postgres, un contenedor de migraciones que corre una vez y el
      servidor, que espera a que las migraciones terminen bien.
- [x] Etapa `migraciones` en el `Dockerfile`, que hereda de la de construcción porque
      necesita justo lo contrario que el servidor: drizzle-kit, el esquema en
      TypeScript y `drizzle/`. No entra en la imagen final.
- [x] `pnpm docker:up`, que comprueba que el `docker` del `PATH` no es el `.exe` de
      Windows —la trampa de WSL, que en este proyecto ya mordió con `npx` y con
      `mvnw`— y escribe el `.env` que falte con un `AUTH_SECRET` recién generado.
- [x] `APP_PORT` para mover el puerto del anfitrión: el 3000 es el puerto por defecto
      de medio mundo, y chocar con otro contenedor da un error que habla de
      «endpoint» y no de quién lo ocupa.
- [x] Con esto se ejecutó por fin todo lo que dependía de la base de datos. Lo único
      que apareció fue «Las ideas de la IA **entra** en el plan Medio»: el verbo
      estaba fijo en singular y la mitad de los sujetos son plurales. Corregido, con
      su test.
- [ ] Sin probar: la respuesta del modelo con una clave de verdad puesta, y el
      arranque de este compose en una máquina que no sea esta.
- [ ] `elemental-1` como punto de partida se guarda como «ninguno». No abre nada
      distinto —es el primer curso, así que da igual para el candado—, pero el
      desplegable no recuerda que lo elegiste. Se arregla guardando la elección
      aparte del índice que abre camino.

## Fase 14 — Que parezca una aplicación y no nueve pantallas · hecha

Nueve pantallas escritas en once fases, cada una en su semana: cinco anchos, cuatro
rellenos, tres sin título ninguno y dos con dos. Ninguna estaba mal por separado, y
justo por eso no se arreglaba nunca.

- [x] **`ui/Screen`, y todas dentro.** Título siempre `h1` y uno solo, una línea que
      dice para qué sirve la pantalla, la acción principal arriba a la derecha, la
      vuelta atrás encima del título y **un solo sitio que hace scroll** —había
      pantallas con tres—.
- [x] Tres anchos con nombre —lectura, normal, ancha— en vez de un número por
      pantalla.
- [x] **`WorkHeader`** para las tres de taller —componer, afinar y el camino—, que
      tienen el alto medido y no pueden entrar en el marco entero, pero sí deben
      decir dónde estás.
- [x] `Marco`, que estaba copiado en la unidad y en el repaso y ya se había separado
      en el ancho y en el hueco del título, pasa a ser el marco común.
- [x] **44 px de alto en todo lo que se pulsa.** Había botones de 26. Esta
      aplicación se usa con la guitarra puesta, así que el número no es de guía de
      estilo: es el ancho de un dedo que no apunta.
- [x] **Diez iconos dibujados** (`ui/icons.tsx`) en lugar de emoji. Los emoji no se
      tiñen, y por eso el estado activo de la navegación y los dos candados del
      camino —uno se abre estudiando, el otro pagando— se veían igual.
- [x] Dos guardianes que **leen los ficheros** (`app/screens/coherencia.test.ts`):
      ninguna pantalla se escribe su contenedor de página ni su `h1`, y no vuelven
      los emoji. La coherencia solo se ve en conjunto, así que se prueba en conjunto.
- [x] **`color-scheme: dark` en la raíz.** Es la línea que arregla de golpe todo lo
      que dibuja el navegador y no nosotros: la lista que se abre de un `<select>`
      —el rectángulo blanco del selector de afinación—, la barra de scroll por
      defecto y el cursor de los campos. Sin ella, la mitad del sistema pinta en
      claro sobre una aplicación negra.
- [x] **Barra de scroll propia**, fina y de latón apagado que se aviva al pasarle
      por encima. Escrita de las dos formas —`scrollbar-*` para Firefox y el
      pseudoelemento para Chromium y WebKit— porque no hay una sola.
- [x] **La flecha del desplegable es nuestra** (`appearance: none` y un SVG en
      línea). El botón que dibujaba el sistema era lo único de la pantalla que no
      parecía de esta aplicación.
- [x] Los botones **se hunden al pulsarlos** y llevan un filo de luz arriba: es lo
      que hace que el latón parezca metal y no un rectángulo de color, y lo que
      confirma la pulsación a quien está mirando el mástil y no el botón.
- [x] **El camino, como un camino.** Cada curso es una tarjeta con su anillo de
      avance —cuánto te queda de este tramo antes de meterte en él—, los nodos van
      unidos por un sendero que se enciende por donde has pasado y queda de puntos
      por donde no, el nodo de «aquí» tiene halo y cartel, lo hecho es verde y
      macizo y lo cerrado se hunde en el fondo.
- [x] `ProgressRing` sube a `ui/`: lo usan la meta diaria y cada curso, y dos
      copias de un anillo acaban girando en sentidos distintos.
- [x] **El ancho se usa entero.** Aprender era una columna de 576 px centrada: en
      un portátil, media pantalla era fondo vacío y había que desplazarse para ver
      lo que ya cabía. Ahora son dos columnas —a la izquierda lo que se consulta,
      la meta y por dónde empiezas; a la derecha el camino, que es lo que se
      recorre—. Los tres anchos del marco suben un escalón y el afinador estira sus
      seis cuerdas.
- [x] **El camino se queda en uno y vertical.** Llegó a partirse en dos columnas
      para llenar el ancho y dejó de ser un camino: dos rutas paralelas no se
      recorren, se comparan. El ancho se llena centrando la cinta y dejándola
      respirar a los lados, con el zigzag un poco más abierto.
- [x] El único que se queda estrecho es el de **texto seguido**, y no por ahorrar
      sitio: un renglón de doscientos caracteres obliga a buscar dónde empezaba el
      siguiente. Lo que llena el ancho ahí es lo que va al lado, no el párrafo.
- [x] **Un solo tipo de cada desplegable.** Había tres `<select>` escritos a mano
      —la entrada del micro, el compás del metrónomo y la tonalidad de la rueda—
      con tres rellenos y tres bordes distintos, y tres `<details>` sin una sola
      flecha entre los tres. Ahora son `ui/Field` y `ui/Disclosure`, con la misma
      flecha, el mismo alto de dedo y el mismo giro al abrir. Dos guardianes más en
      `coherencia.test.ts` para que no vuelvan a escribirse sueltos.
- [x] **Ajustados a su sitio.** El ancho de un `Field` se pide en vez de heredarse:
      en la barra del metrónomo, un desplegable de un dígito ocupando doce rem se
      comía los botones de al lado. La fila del metrónomo queda toda a la misma
      altura, y la tonalidad de una unidad ya no lleva el relleno dos veces.
- [x] **Una regla de forma para todo:** los paneles son rectos y **lo que se pulsa
      va redondeado**. Media interfaz eran rectángulos duros y la otra media no, y
      eso es lo que hacía que dos controles iguales no parecieran de la misma
      aplicación.
- [x] **El profesor tiene muñeco**, y está en la esquina de abajo de las tres
      pantallas de aprender. Hace dos cosas según quién dé el paso: lo pulsas tú y
      se abre **con el formulario de preguntar dentro** —preguntar ya no cuesta
      salirse de la unidad—, o se abre él solo cuando fallas, que es cuando uno
      piensa «¿y por qué?». Cerrado no dice nada: un ayudante que habla sin motivo
      se aprende a cerrar sin leerlo.
- [x] **El muñeco se agarra y se mueve.** Al soltarlo se pega al lado más cercano
      —solo izquierda o derecha— y se queda a la altura donde lo dejaste. Los dos
      lados y no donde caiga, porque suelto en mitad de la pantalla acaba tapando
      lo que estabas leyendo; la altura sí, porque es lo que cambia según lo que
      estorbe en cada pantalla. El sitio lo guarda `state/tutor-spot` y sobrevive
      al cambio de pantalla —cada una monta su propio muñeco— y a cerrar el
      navegador.
- [x] **Ventana de usuario y registro con cara.** `/cuenta` empieza por una ficha
      —avatar grande, nombre, correo y plan— y un resumen de lo que llevas: XP,
      racha, unidades y medallas. Entrar ahí es casi siempre mirar, y solo de vez
      en cuando cambiar algo, así que los formularios van después. El registro pasa
      a dos columnas —el formulario en su tarjeta a la izquierda, las tres razones
      con icono a la derecha— con el muñeco asomando por encima: es la única
      pantalla donde un desconocido se para a decidir.
- [x] La mascota sube a `ui/`: la usan el profesor de las unidades y la bienvenida
      del registro, que no se conocen entre sí, y dibujarla dos veces acabaría con
      dos muñecos distintos.
- [x] **Repaso visual entero.** Tres superficies con nombre —normal, alta y viva—
      que traen fondo, borde, radio, filo de luz y sombra: lo que hace que se note
      qué está encima de qué, que es lo que separa un tema oscuro moderno de uno
      plano. El radio del chasis sube de 8 a 12 px, el fondo deja de ser un plano
      liso —un resplandor de latón al 4 %, fijo, como la luz de una sala—, los
      títulos de pantalla pasan a la serif de la portada, los rótulos de apartado
      llevan su marca de latón y la pantalla activa de la navegación se rellena en
      vez de teñir un borde de un píxel.
- [x] **Dos temas, y el negro sigue siendo el de casa.** El claro —blanco, tres
      grises cálidos y un oro corregido a `#A16207` para que el acento llegue a
      4,5:1 sobre blanco— se elige a un clic, para quien estudie de día.
      Conmutador en la barra y un guion en el `<head>` que aplica el tema antes de
      pintar: sin él, quien elige claro se come un cuarto de segundo de pantalla
      negra en cada carga. No cuelga de `prefers-color-scheme`: la identidad no la
      decide el ajuste del móvil. El porqué y las alternativas —incluida la de
      seguir al sistema, que llegué a escribir y se descartó—, en
      [adr/0010](./adr/0010-tema-claro-por-defecto.md).
- [x] **Componer, en el móvil.** Lo que se sacrifica está decidido y escrito: la
      barra de grabar no sale por debajo de tableta —grabarse pide trípode y
      pantalla, y con el teléfono se viene a mirar acordes—, la rueda de quintas se
      pliega en un desplegable que dice en qué tonalidad estás, y del metrónomo se
      quedan la marcha, los bpm y los dos botones, sin «marcar» ni compás. A la
      vista queda lo que se mira mientras tocas: el acorde, sus formas y a dónde
      ir. Cinco tests vigilan qué se esconde y qué no.
- [x] El hueco vacío bajo el mástil y el solape al elegir un acorde eran **el mismo
      fallo**: las filas apiladas se estiraban para repartirse el alto, así que lo
      que crecía se montaba encima de lo siguiente y lo que menguaba dejaba hueco.
      `auto-rows-min` en el móvil —y las columnas estirándose solo a partir de
      `lg`— resuelve los dos.
- [ ] El tema claro **no lo ha visto nadie con la guitarra en la mano**: los
      contrastes cumplen en el papel, pero eso no es haberlo usado.
- [ ] Pendiente de rodaje: si la franja de `WorkHeader` en componer estorba al
      mástil en pantallas de portátil bajas, y si el sendero se lee igual de bien en
      una columna estrecha de móvil.

El porqué y las alternativas —incluida la de adoptar el sistema de diseño que
propone la skill de UI/UX, que habría cambiado la identidad entera— están en
[adr/0009](./adr/0009-un-solo-marco-de-pantalla.md).

## Lo que viene: de catorce fases hechas a una aplicación publicada

Las catorce de arriba están construidas. Lo que sigue son seis fases pensadas el
25 de agosto de 2026, con el destino ya decidido: **publicarla de verdad**, con
gente que paga. Ese destino es el que ordena lo de abajo, y el que hace aparecer
una fase entera —la 19— que no existiría si esto se quedara en un proyecto propio.

Tres decisiones tomadas antes de escribir el plan, porque cambiaban el plan entero:

- **A la IA solo viajan símbolos**, también cuando grabas un trozo para pedir
  versiones. La regla 4 de la arquitectura se sostiene sin ADR y sin
  almacenamiento. Lo que se pierde —ritmo exacto, inversiones, melodía— es real y
  se escribe como límite conocido, igual que se hizo en
  [adr/0004](./adr/0004-reconocimiento-de-acordes-por-croma.md).
- **Una versión es una rearmonización**: los mismos compases con otros acordes.
  Se eligió frente al arreglo con estructura porque el dominio puede
  **verificarla**, y fiarse del modelo es justo lo que este proyecto no hace.
- **Las canciones se guardan en la cuenta**, atadas al permiso `sincronizar` que
  ya tienen Básico y superiores. Sin cuenta se sigue guardando en el navegador.

### Fase 15 — Rodaje con guitarra y clave reales · pendiente

Lo más barato y lo que más cambia la aplicación. Las catorce fases de arriba
terminan todas con la misma frase, y esta fase es esa frase.

- [ ] Los cuatro umbrales de detección, con el medidor de nivel que ya existe.
- [ ] Los 350 ms del ejercicio y las cuatro décimas que tarda en salir el acorde:
      si se hacen lentos, y cuánto estorban al encadenar.
- [ ] Una clave de verdad en `/api/ideas` y `/api/teacher`. El contrato está
      probado; la llamada al modelo no lo ha estado nunca.
- [ ] El peor caso de tokens con `count_tokens` en lugar de estimarlo por
      longitud, que es lo que hoy sostiene todo el modelo de coste.
- [ ] Medir en un móvil de gama media: los 16,2 ms de
      [adr/0003](./adr/0003-analisis-en-el-hilo-principal.md) salen de un Ryzen de
      sobremesa, y suponer el resto es aritmética, no medición.
- [ ] El tema claro, de día y con la guitarra puesta. Los contrastes cumplen en el
      papel y eso no es haberlo usado.
- [ ] Si la meta de 40 XP es la buena y si dos pasos de repaso bastan.

Publicar catorce fases que no se han probado con una guitarra delante es publicar
a ciegas: los umbrales son el corazón de tres de las cuatro pantallas y están
puestos a ojo.

### Fase 16 — Canciones en tu cuenta · hecha

El modelo de datos que la fase 17 necesita para guardar lo que devuelva.

- [x] `core/music/song.ts`, dominio puro: el tipo, sus cuatro topes con nombre y
      `parseSong`, que interpreta igual lo que llega del navegador y lo que se lee
      de Postgres. Devuelve **nulo** y no una canción vacía cuando no queda nada
      aprovechable, que es la diferencia con `parseProgress`: un avance sin nada es
      el de alguien que empieza, y una canción sin un acorde no es una canción.
- [x] **Se guardan grados, no cifrados.** Es la misma lección de `/api/ideas` y del
      repaso: un `Sol` solo significa algo en su tonalidad y un `V` significa lo
      mismo en las doce. Por eso `transposeSong` es una línea, y por eso al abrir
      una canción el porqué de cada acorde vuelve a salir del dominio en vez de
      salir de lo que se guardó hace un mes.
- [x] `degreesFromPath` cuenta **cuántos acordes se quedan fuera** al guardar. Un
      dominante secundario se escribe con barra y no es un grado del catálogo, así
      que no cabe todavía; perderlo callando haría que la canción abierta mañana
      fuese más corta sin explicación.
- [x] Tabla `songs` con Drizzle, migración en el repositorio y su índice por cuenta
      y fecha. **Una fila por canción** y no un documento por cuenta como el avance,
      porque una canción se abre, se renombra y se borra de una en una: con todas
      dentro de un documento, renombrar una sería reescribir las cincuenta.
- [x] `GET/POST/PUT/DELETE /api/canciones`, con el candado preguntando a `can()`
      como todo lo demás. **Cada consulta filtra por la cuenta**, incluidas las que
      ya reciben el identificador de la canción, y el dueño se comprueba en la misma
      sentencia que escribe: comprobar y luego escribir deja una rendija.
- [x] Un permiso nuevo, `canciones`, y no `sincronizar` reaprovechado. Coinciden hoy
      en los mismos planes, pero significan cosas distintas, y separarlos mañana
      sería una migración en vez de una línea.
- [x] Panel en la franja de componer, con la lista, guardar, abrir y borrar. Abrir
      deja la tonalidad fijada y el camino puesto, listo para seguir tocando.
- [x] Las veinte sesiones locales de `session-storage.ts` se quedan como están: son
      otra cosa —lo que tocaste— y no lo que decidiste guardar. Por eso el botón de
      Canciones va antes que el de Sesiones: se confunden, y lo que se busca a
      menudo va primero.
- [ ] **Sin probar contra Postgres**, como el resto de las cuentas. Lo probado es lo
      puro: el dominio de la canción y el panel con el servidor fingido.
- [ ] Sin renombrar una canción ya guardada ni reordenar secciones: hoy se guarda una
      sección por canción, que es lo que hay en el camino de componer.

Una canción es una progresión con secciones, **no un archivo**: aquí no entra ni
audio ni MIDI.

### Fase 17 — Versiones de tu canción · hecha

Grabas un trozo, la aplicación lo escucha con lo que ya sabe hacer, y la IA devuelve
rearmonizaciones de esos mismos compases. Es la parte que más se puede equivocar, así
que casi todo el trabajo es de dominio y no de modelo. El porqué y las alternativas
—incluida subir el audio, que se escribió y se descartó— están en
[adr/0011](./adr/0011-versiones-verificadas-contra-el-dominio.md).

- [x] **Captura simbólica** en `core/music/capture.ts`, pura y con el instante por
      parámetro. Colapsa dos veces y las dos hacen falta: lo que el motor repite
      mientras la mano no se mueve, y el cambio de postura que suena a dos acordes y
      es el mismo grado. Descarta el acorde que se roza al cambiar —medio pulso— y
      cuenta lo que no cabe en la tonalidad en vez de colarlo.
- [x] **El vocabulario** en `core/music/reharmonization.ts`: cinco movimientos que el
      código sabe nombrar y verificar. **Ninguno es una tabla escrita a mano**: cada
      uno le pregunta al catálogo de grados cuántos semitonos y qué especie, lo
      transforma y busca qué ha salido, así que un grado nuevo entra solo en los cinco
      y la tabla no puede contradecir al catálogo.
- [x] `isMove` es lo que sostiene la fase. Un modelo devuelve acordes razonables casi
      siempre; lo que no devuelve de forma fiable es una explicación cierta de por qué
      son esos. Aquí se aplica el movimiento que dice haber hecho y se compara.
- [x] **El contrato** en `features/versions/contract.ts`. Una versión se cae entera si
      declara un movimiento falso, si dice no haber tocado un compás que sí cambió, si
      cambia la forma de la canción o si no cambia nada —eso es la canción—. Los
      cifrados y los pulsos salen de aquí, no de lo que diga el modelo.
- [x] El catálogo que se le ofrece al modelo **se genera desde `MOVES`**: un
      movimiento ofrecido que el validador no supiera comprobar haría caer todas las
      versiones que lo usaran sin que nadie entendiese por qué.
- [x] `POST /api/versiones` con las tres puertas de siempre —frecuencia, cuenta y
      cupo—, pensar apagado y un reintento. Es la petición más cara que hay.
- [x] **Un tercer peor caso en `cost.ts`**, y el cupo de Pro baja de 363 a 271 al mes.
      No es un efecto secundario: el cupo es el presupuesto entre la petición más cara,
      y desde ahora la más cara es esta. `worstFeature` no lleva ninguna excepción.
- [x] Permiso `versiones` en **Pro**, y su guardián de tamaño del prompt en
      `prompts.test.ts`, como los otros dos.
- [x] Panel en la franja de componer, al lado de Ideas porque las dos gastan cupo. Lo
      que cambia se destaca y lo que se queda se apaga, cada compás dice de dónde
      viene, y «ponerla en el camino» la deja tocable con los acordes resueltos por el
      dominio.
- [x] **`bII` en el catálogo de mayor**, que faltaba: sin él la sustitución tritonal
      solo existía en menor.
- [x] Al añadirlo salió un fallo de escritura que ya estaba: en Do mayor `bIII` se
      escribía «D#» y `bVII` «A#». Un grado que se llama «b» algo se escribe con
      bemol, y **había un test que fijaba lo equivocado**.
- [ ] **Sin probar con clave de verdad.** El contrato y el validador están probados
      con respuestas fabricadas; que el modelo devuelva versiones que pasen la
      verificación a menudo, no.
- [x] **Grabar un trozo, conectado.** El botón apunta los acordes que se oyen con su
      instante, y al parar salen los grados con sus pulsos de verdad. Lo grabado manda
      sobre el camino, y se puede olvidar para volver a él. Antes de gastar cupo, el
      panel dice de dónde va a salir la progresión y cuál es: pulsar un botón que
      cuesta dinero sin saber sobre qué es lo que hace que no se pulse.
- [x] **El tempo sube al store.** Vivía dentro del metrónomo con estado local, así que
      la captura no podía medir nada: un feature no importa de otro. De paso deja de
      perderse al cambiar de pantalla.
- [ ] **No se pueden oír.** Comparar tres versiones leyéndolas cuesta, y es lo primero
      que hay que mirar después.

### Fase 18 — Cobrar de verdad · escrita, sin ejecutar

Es la puerta de publicar, y fue mecánica:
[adr/0006](./adr/0006-planes-y-puerto-de-facturacion.md) dejó el cobro como puerto, así
que se ha añadido una implementación y no se ha rediseñado nada. Las rutas y las
pantallas no han cambiado una línea por esto.

- [x] `StripeBilling` implementando `server/billing/port.ts`, **sin el SDK de
      Stripe**: son dos llamadas HTTP y un HMAC. Misma razón que `scrypt` en vez de
      bcrypt y que la detección de tono propia
      ([adr/0002](./adr/0002-deteccion-de-tono-propia.md)).
- [x] `billing()` mira si están las cinco variables, igual que `db()` mira
      `DATABASE_URL`. Si falta cualquiera devuelve el cobrador que no cobra, así que un
      clon recién bajado funciona entero sin configurar una pasarela.
- [x] **La verificación de la firma del webhook**, probada a fondo: firma buena, cuerpo
      cambiado, secreto distinto, caducada, marca de tiempo en el futuro, secreto
      rotado, firma no hexadecimal y sin secreto configurado. Es lo único que separa
      cambiar el plan de quien ha pagado de cambiárselo a cualquiera que sepa la
      dirección.
- [x] El cuerpo se lee como **texto crudo**: la firma se calcula sobre los bytes que
      mandó Stripe, y volver a serializar el JSON la rompe. Es el fallo clásico.
- [x] Webhook idempotente sin registro de eventos: lo único que hace es poner un plan,
      y ponerlo dos veces deja lo mismo. Los eventos que no interesan se aceptan y se
      ignoran, porque contestar error los pondría en cola de reintentos para siempre.
- [x] **El aviso de que no se cobra cuelga de `billing().charges`**, no de una
      constante. Estaba escrito fijo, y con la pasarela puesta habría seguido diciendo
      que no se cobra mientras se cobraba: la peor de las dos mentiras posibles.
- [x] El plan lo cambia el webhook y no la vuelta del pago: volver de Stripe significa
      que el navegador ha vuelto, no que el dinero haya entrado.
- [x] **La aritmética del plan gratis, escrita y con su test.** Mil cuentas gratis son
      unos doscientos dólares al mes con el modelo caro. No se ha bajado el número
      porque cuánto regalar es una decisión de negocio, no una corrección: lo que
      faltaba era poder tomarla sin multiplicar nada, y ahora la tabla está en
      `cost.ts`. Un test vigila además que al plan gratis no se le cuele algo más caro
      que el profesor.
- [ ] **Nada de esto se ha ejecutado contra Stripe.** La firma, el mapeo de precios y
      las respuestas del webhook están probados con datos fabricados; que la API
      conteste lo que se espera, no. Es lo primero que hay que hacer con una clave de
      pruebas, y hasta entonces esta fase no está cerrada.
- [ ] Sin portal de cliente: cambiar de tarjeta o ver facturas se hace desde Stripe.
- [ ] Sin IVA ni facturación. Vender a consumidores en la UE lo pide, y no es código:
      es una decisión y una configuración de la pasarela.

### Fase 19 — Lo que exige publicar y hoy no existe · pendiente

Esta fase aparece por el destino, no por el código. Lo de arriba no es opcional.

- [ ] **Borrar la cuenta.** No hay ni una ruta que lo haga. Con usuarios reales en
      Europa es obligación legal, no funcionalidad.
- [ ] **Enviar correo**, con su ADR. Hoy no hay, y por eso no hay «he olvidado mi
      contraseña» ni cambio de dirección. Sin gente pagando era una decisión
      defendible y está dicha en la pantalla; con alguien que paga 19,99 € y
      olvida la contraseña, es perder la cuenta y el dinero.
- [ ] **Límite de frecuencia compartido.** Hoy vive en memoria y es por instancia:
      con dos servidores el límite se dobla solo. El cupo diario sí está en
      Postgres y ese aguanta.
- [ ] **Cambiar la contraseña echa a las demás sesiones**, con una versión de
      sesión en la fila de la cuenta que se comprueba al leer la cookie.
- [ ] Copias de seguridad de Postgres, política de privacidad y condiciones, y
      elegir camino en [DESPLIEGUE.md](./DESPLIEGUE.md).

### Fase 20 — Semilla multiinstrumento · pendiente

Que esto valga para más instrumentos está pensado desde el principio, y por eso
mismo no se construye todavía.

- [ ] Un descriptor `Instrument` en `core/instrument/` del que cuelguen
      afinaciones, formas y mástil.
- [ ] Quitar «guitarra» de los textos donde no toca.
- [ ] Su ADR, con la alternativa descartada: generalizar ahora.

**Sin construir el segundo instrumento.** Abstraer antes de tener dos casos
reales es cómo se acaba con una abstracción que no encaja con ninguno de los dos.

### El orden, y cuándo cambiarlo

`16 → 17 → 18` supone que quieres vender las versiones. Si lo que quieres es
publicar antes y cobrar por lo que ya funciona —que es bastante—, las fases 18 y
19 se adelantan a la 16 y se publica sin versiones. La 15 no se mueve de la
primera posición en ninguno de los dos órdenes.

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

- ~~**La respuesta buena era siempre la de la izquierda.**~~ Las opciones se
  escriben con la correcta delante —así se leen las cien de `lessons.ts`— y salían
  en ese mismo orden: se aprobaba el temario pulsando el primer botón sin leer la
  pregunta. Ahora `lessonNotes` las reparte al salir, con un barajado **sin azar
  de verdad**: la semilla sale del texto de la pregunta y de sus opciones, así que
  la misma pregunta sale siempre igual —con `Math.random()` el botón se movería
  debajo del dedo en cada repintado— y en otra tonalidad cae de otra forma. Sobre
  248 ejercicios el reparto queda en 27 / 28 / 26 / 19 %.
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
