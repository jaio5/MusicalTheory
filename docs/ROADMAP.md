# Roadmap

Estado a 28 de julio de 2026. Las siete fases están implementadas;
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
- [ ] Pendiente: el acorde actual se marca a mano. No se detecta, y no se puede
      con un analizador monofónico.

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

## El camino

El panel que hace que esto se juegue: eliges tonalidad, te propone por dónde
empezar, y al elegir un acorde te enseña **cuatro formas de hacerlo** sobre el
mástil y **a dónde puedes ir** desde él. Encadenando se construye la progresión,
y se puede volver atrás a cualquier punto.

## Las tres pantallas

Cada una está hecha para una cosa y trae lo que hace falta para esa cosa. No hay
que montarse nada: se elige arriba y ya está.

**Aprender.** Cinco lecciones de teoría —los grados, las especies, la rueda, los
prestados y las escalas— generadas en la tonalidad en la que estés, cada una con
sus preguntas. Al contestar dice por qué, se acierte o no. Al lado, el profesor:
le preguntas lo que quieras y responde con los acordes que tienes delante. Debajo,
la escala para tocarla de verdad, validada por el micro.

**Componer.** La rueda para elegir tonalidad, el acorde en el que estás con
todas sus formas a lo largo del mástil, y a dónde puedes ir, con el buscador que
propone mientras escribes. Cada acorde lleva un punto: verde si es seguro, ámbar
si trae una nota de fuera y rojo si trae más. Mástil, ideas y sesiones se abren
debajo cuando hacen falta.

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

### Viva

- **Reconocimiento de acordes.** No es deuda, es el límite del método: la
  autocorrelación devuelve un periodo, no varios. Un acorde rasgueado no se
  puede identificar así, y por eso el acorde actual se marca a mano. Cambiarlo
  significa cambiar de algoritmo, y eso es un ADR nuevo.
- **Umbrales con poco rodaje.** Los cuatro se ajustaron tras una prueba. Ahora
  al menos hay medidor para afinarlos con datos en vez de a ojo.
- **Análisis en el hilo principal.** Sigue pendiente de medir antes de mover
  nada, como dice [adr/0003](./adr/0003-analisis-en-el-hilo-principal.md). La
  salida prevista es un Web Worker.
- **Trastes igual de anchos.** En una guitarra se estrechan hacia el puente. Se
  queda así a propósito: el diagrama se lee mejor.
- **El contador de frecuencia es por instancia.** En memoria. Si esto se
  despliega en varias, cada una llevará su cuenta.
- **Sin restaurar la sesión al abrir.** Hay que pulsar «Retomar». Automático
  sería cómodo y también sorprendente.
- **Sin probar con instrumento y clave reales.** Lo que no puede comprobar un
  test: cómo se siente el afinador, si la tonalidad se asienta rápido, si el
  ejercicio se hace lento, si la grabación sale bien y si el modelo devuelve
  ideas que valgan.
