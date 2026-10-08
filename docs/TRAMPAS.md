# Trampas: lo que solo se descubre tropezando

Aquí está lo que `CLAUDE.md` solo nombra en una línea: **cada trampa con su porqué,
lo que costó y dónde se explica del todo**. Se lee cuando vas a tocar esa zona, no
de corrido. Si tropiezas con una que no está, añádela aquí y, si de verdad cuesta
media hora, con una línea en `CLAUDE.md`.

## Arrancar y Docker

**Las cuentas piden base de datos, y la da Docker:** `pnpm docker:up` levanta todo,
`pnpm docker:db` solo Postgres para usarlo con `pnpm dev`, `pnpm docker:ia` añade
un Ollama sin clave ni factura y `pnpm docker:ia-sola` levanta ese Ollama **sin la
aplicación**. Es un solo `compose.yml` con la IA en un perfil
([adr/0047](adr/0047-la-ia-es-un-perfil-no-un-fichero.md)), así que
`docker compose up` no la toca y `docker compose --profile ia up` la trae.
**`docker compose down` a secas no para un perfil**: deja Ollama corriendo, y por
eso `docker:down` lleva `--profile '*'`. Escribe el `.env` que falte; si el 3000 está
ocupado, `APP_PORT`. **Para verlo funcionando**, el skill
`.claude/skills/arrancar/`: navegador de verdad, micrófono falso y las trampas de
hacerlo.

`pnpm dev` levanta en http://localhost:3000, y ninguno de los seis comandos de
`CLAUDE.md` necesita base de datos ni claves. Si tocas `src/server/db/schema.ts`:
`pnpm db:generate` escribe la migración y `pnpm db:migrate` la aplica; no se aplican
solas al arrancar.

## Lo que muerde en el código

- **Después de tocar cualquier `.md`, `pnpm format`**, o `format:check` falla. Es
  el fallo más tonto y el más repetido del repositorio.
- **Un ejemplo de clase escrito en un comentario es una clase de verdad**, y una
  mal formada tumba la hoja entera con todos los tests en verde
  (`docs/ESTILO.md`). Lo caza `pnpm build`: si tocas estilos, pásalo.
- **Una barra que se abre encima de algo que crece flota, no empuja**:
  `ui/Disclosure` con `flotante`, vigilado por `screens/coherencia`. **La excepción
  es lo que se abre desde una fila que se desplaza** —la barra de componer en un
  teléfono—, que es un `popover` del navegador: el panel de un `Disclosure` se
  ancla dentro de la fila y ella lo recorta. Solo vale ahí, más la hoja del mástil
  bajo `lg` ([adr/0102](adr/0102-lo-que-se-lee-a-un-metro-se-ve-y-lo-que-se-pulsa-se-sujeta.md)),
  y el mismo test lo cierra ([adr/0065](adr/0065-lo-que-se-abre-desde-una-fila-que-se-desplaza-es-un-popover.md)).
- **La navegación cambia de sitio en `md` (768), y hay tres sitios que lo saben**:
  `AppShell` —arriba o abajo—, el tope del panel flotante de `ui/Disclosure`, que
  descuenta la barra de abajo mientras exista, y el corte de 500 px de alto, donde
  el `<main>` se desplaza y la barra se pliega a iconos. Si uno se mueve, los otros
  también: separados, la rueda se sale por abajo y nadie lo ve. **Y el tope del
  panel tiene además escalones en `sm` y `lg`**, porque la fila de mandos de
  componer va en dos filas entre 640 y 1023: si esa fila cambia, el tope también
  ([adr/0102](adr/0102-lo-que-se-lee-a-un-metro-se-ve-y-lo-que-se-pulsa-se-sujeta.md)).
  **El corte de la barra lo vigila un test** —son las variantes `barra-arriba` y
  `ventana-baja`, y `screens/coherencia.test.ts` prohíbe el literal
  ([adr/0122](adr/0122-lo-que-se-lee-va-al-cuerpo.md))—; **los escalones de `sm` y `lg` no**, y los caza la sonda del skill `arrancar` a los dos lados de 640 y de 768
  ([adr/0084](adr/0084-lo-que-trabaja-no-se-apaga-y-el-foco-se-mueve-a-mano.md)).
- **`docker compose up -d` no reconstruye la imagen**: arranca la que ya había, y
  enseña la aplicación de la última vez que se construyó. Pasó con la portada: la
  imagen era de dos días antes y seguía saliendo el vídeo borrado. Después de
  cambiar código, `docker compose up -d --build app`; `pnpm docker:up` ya lo lleva.
- **Descargado no es cargado.** Tras cada `up`, la primera pregunta al profesor tenía
  que subir el modelo a la gráfica, 87 s o más, y la aplicación cortaba a los 120
  con «no hemos podido contactar con el modelo». Lo carga `ia-calentar` en
  `compose.yml` al levantar, sin que la aplicación lo espere
  ([adr/0075](adr/0075-el-modelo-se-carga-al-levantar.md)).
- **Qué hace falta para que `docker compose up -d` traiga la IA: dos líneas en el
  `.env`.** `COMPOSE_PROFILES=ia` enciende el perfil y `OLLAMA_URL_DOCKER=http://ollama:11434`
  le dice a la aplicación dónde está. Van juntas y no sirve una sin la otra. Con
  ellas puestas no hace falta el script ni acordarse de nada, **porque `ollama` es un
  nombre fijo de la red de compose**: no depende de ninguna IP
  ([adr/0055](adr/0055-la-ia-se-enciende-desde-el-env.md)).
- **Y un Ollama del equipo, en cambio, solo lo encuentra el script.** Su dirección es
  la IP de `eth0`, **cambia al reiniciar**, y en `compose.yml` no hay ninguna fija que
  valga —`host.docker.internal` apunta a Windows, no a WSL, y la puerta del puente
  tampoco llega—. Ése es el camino de `pnpm docker:up`
  ([adr/0050](adr/0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md)).
- **Los dos Ollama chocan en el 11434.** Con uno nativo corriendo, el contenedor no
  puede publicar ahí y `up` falla con «port is already allocated». Se mueve con
  `OLLAMA_PORT` —aquí el 11435—, y solo afecta a mirarlo desde fuera: dentro de
  compose la aplicación le habla por el nombre y por el 11434 de la red interna. Es
  el mismo choque que el 5432 de Postgres.
- **Al grabar se cuentan dos compases y la claqueta sigue sonando**, y lo que se
  apunta empieza **un pulso después del último clic**: ahí cae el compás uno, y
  equivocarse desplaza la canción entera un pulso (`state/cuenta-atras.ts`). **Suena
  porque el clic es un golpe de ruido agudo y no un tono**: no tiene periodo y cae
  fuera de lo que miran los motores. Cambiarle el timbre rompe la toma
  ([adr/0072](adr/0072-la-claqueta-suena-toda-la-toma.md), que sustituye al
  [0053](adr/0053-la-claqueta-cuenta-y-se-calla.md)).
- **El micrófono es uno, y lo sujeta `state/use-listening.ts`**, no el componente:
  quien monte otro botón de escuchar **no guarda la entrada**. **Sigue abierto al
  navegar**, porque el marco vive en `app/(marco)/layout.tsx` y no se desmonta, y sus
  motores se descargan al pulsar, no al cargar: quien importe `@audio/web-audio-input`
  o un motor desde un componente los devuelve a todas las pantallas
  ([adr/0079](adr/0079-el-marco-se-monta-una-vez-y-el-micro-sobrevive-a-navegar.md)).
- **Grabar sin escribir es un papel de la toma, no otra pantalla.** Había una
  pastilla «Grabar» en la fila de abajo que hacía lo mismo menos transcribir, con
  **su propio micrófono** —dos `getUserMedia` sobre el mismo aparato son dos
  permisos y dos pilotos—. Ahora es `solo-grabar`, el tercer papel: no escribe, no
  cuenta compases y no pide tonalidad
  ([adr/0056](adr/0056-grabar-es-un-papel-de-la-toma.md)). **Lo que no se
  conservó**: la pantalla de componer pide tonalidad antes que nada, así que para
  llegar a «Solo grabar» hay que elegir una aunque no se use.
- **Una toma dice lo que es, y sin eso los dos motores compiten.** El croma y el de
  tono corren a la vez sobre la misma entrada, así que apuntar leía de los dos y un
  punteo entraba con acordes inventados encima. Se elige rítmica o punteo antes de
  tocar y solo se apunta lo de ese papel
  ([adr/0048](adr/0048-una-toma-dice-lo-que-es.md)). **Quien añada otra entrada
  que apunte tiene que decirlo también**, o se queda con el de por defecto sin
  enterarse.
- **Dieciséis colores, los de la sala de la portada, y ninguno más**: un tono de
  Tailwind o un color entre corchetes lo caza `coherencia.test.ts`. Lo puesto lleva
  su `.piloto` y el latón relleno es solo para la acción. Y **una clase de
  `@layer components` no admite `hover:`**: lo que se pida con variante va en
  `@utility` ([adr/0070](adr/0070-la-sala-encendida.md)).
- **Un paso del recorrido apunta a un `data-tour`**, y renombrarlo o quitarlo lo
  deja señalando el aire sin que falle nada a la vista: al tocar una pieza de
  pantalla, busca su nombre en `features/tour/pasos.ts`
  ([adr/0094](adr/0094-el-recorrido-de-la-primera-visita.md)). Y los scripts
  de `arrancar` lo marcan como visto: tapa la pantalla.
- **Un corpus que se usa para ajustar deja de medir.** El de las salidas subió de
  68 % a 98,6 % y uno independiente dio 48 %; hoy **los cinco se han usado**, y la
  próxima medida honesta necesita un corpus nuevo. Los arreglos van a la causa, no
  al caso
  ([adr/0097](adr/0097-las-salidas-se-juzgan-por-lo-que-encajan.md)).
- **El id del micrófono cambia entre páginas** con el permiso «solo esta vez», y
  por eso se guarda también el nombre: guardar solo el id pierde la elección al
  recargar. Se pide `exact`, no `ideal`
  ([adr/0092](adr/0092-el-microfono-se-elige-una-vez-y-en-todo-momento.md)).
- **La monoespaciada es solo para lo que se alinea en columna** —notas, cents, XP,
  un correo—; lo demás en la sans, y el rótulo de un apartado es `.rotulo`
  ([adr/0024](adr/0024-la-interfaz-se-lee-primero.md)). **Ningún test lo
  vigila.**
- **El mástil se estira a lo ancho del hueco, y el hueco solo pone el techo**
  ([adr/0046](adr/0046-el-mastil-solo-ocupa-lo-que-dibuja.md)): con el alto
  fijo reservaba hasta 206 px de bandas vacías en una ventana alta. Mide su caja y
  reparte los trastes por ella, entre dos topes: con proporción fija salía un cuadrado en
  medio y sin tope una tira ([adr/0040](adr/0040-ni-cuadrado-ni-tira.md)). De paso
  se descubrió que **el suelo del arreglo era mentira**: decía 160 px y necesita
  220 por debajo de 1280 —contando los 44 de la tira de un área plegada, que va
  debajo—. **Con el área de abajo abierta** la cuenta es nav 61 + cabecera 57 +
  bandeja 61 + cabecera del área 44 + tira 44 + suelo 224 (176 desde `xl`), y de ahí
  salen los topes `100dvh-31rem` y `28rem` del mástil
  ([adr/0102](adr/0102-lo-que-se-lee-a-un-metro-se-ve-y-lo-que-se-pulsa-se-sujeta.md)).
  Lo mide `auditar-componer.mjs` del skill `arrancar`.
- **El grabado se mide en espacios de pentagrama**, y las invariantes de la clave
  las fija `arrange/clef.test.ts`
  ([adr/0029](adr/0029-la-partitura-se-dibuja-aqui.md)).
- **Un bloque guarda un grado y una especie** —una séptima, o una de las seis
  simples: `quinta`, `sus2`, `sus4`, `dim`, `aug`, `menor`—, y quien lo traduce a
  acorde es `blockChord`, no `resolveDegree`: con el grado a secas, un `C5` se
  enseña, se ensaya y se dibuja como un `C`
  ([adr/0035](adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)). **Cuando la
  calidad no encuentra grado, lo pone la fundamental y la especie dice lo que
  es**, y el orden importa: la tríada se busca primero o todos los menores
  arrastrarían especie ([adr/0042](adr/0042-la-especie-dice-lo-que-el-grado-no-sabe.md)).
- **Un montaje son grados, y los grados no se llaman igual en mayor que en menor**:
  `state/montaje-en-su-modo.ts` lo traduce en cuanto cambia la tonalidad, y sin eso
  componer se cae entera ([adr/0030](adr/0030-cambiar-de-modo-traduce-la-cancion.md)).
- **Lo que se escapa a los tests es lo que no pasa por `ui/` y lo que vive en un
  SVG** —44 px, 12 px, 3:1—: ahí se mide con la sonda de `arrancar`. **Y con el
  dedo lo que se arrastra se sujeta 300 ms antes**; un `touch-action: none` de más
  deja la tira sin desplazarse.
- **En el móvil hay tiras que no caben y se arrastran**, y sin pista parecen
  rotas: la última pastilla sale partida contra el borde. La clase `hay-mas-al-lado`
  de `globals.css`, hasta `lg`, lo dice **solo cuando de verdad queda algo**, sin medir nada —dos
  capas de fondo que viajan con el contenido tapan a otras dos pegadas al marco—. La
  bandeja de abajo de componer ya no es una de ellas: en un teléfono se pliega a
  «Más».
- **El muñeco del profesor flota encima de la columna que se desplaza**, y lo
  último de ella queda debajo: quien lo monte reserva `HUECO_DEL_TUTOR`
  (`learn/Tutor.tsx`) al pie de esa columna.
- **«Se ve» no es `top >= 0`**, y por eso `traerLaCancionALaVista` pregunta quién hay
  en el borde de la canción: encima flotan la tonalidad y las tiras de área, así que
  la parte puede estar en el píxel 116 y estar tapada. Se reserva hueco con
  `scroll-margin-top`, sacado del alto de lo que tapa y no de un número a mano.
- **La barra de tonalidad flota y se abre sola cuando no hay tonalidad**, así que
  **lo que pongas debajo no se ve**: un aviso que dijera «elígela en la rueda de
  aquí arriba» quedaba detrás de la rueda que lo tapaba. Ha mordido en componer
  estrecho; en la unidad ya no, porque aprender no pide tonalidad
  ([adr/0109](adr/0109-lo-que-se-da-por-hecho-al-empezar.md)). Lo que cabe ahí abajo es
  `ui/EmpezarPorTonalidad`, y flotar
  no se toca: está peleado dos veces y lo vigila `screens/coherencia`.
- **Entrar tiene tope de intentos, y va antes de comprobar la contraseña**, con tres
  claves: comprobar primero gastaría el `scrypt` que el tope viene a proteger
  ([adr/0054](adr/0054-entrar-tiene-tope-de-intentos.md), que el
  [0078](adr/0078-los-topes-se-cuentan-con-la-direccion-que-vio-nuestro-proxy.md)
  sustituye en parte).
  **Y la dirección sale de `TRUSTED_PROXY_HOPS`**: sin ella no se cree ninguna
  cabecera y todos comparten un contador; detrás de un proxy hay que ponerla.
- **Las burbujas de validación del navegador salen en su idioma**, no en el de la
  aplicación. Por eso `ui/Formulario` va con `noValidate` y lo que falta se dice
  con `ui/Aviso`. Un `<form>` escrito a mano vuelve a traerlas. `Aviso` monta su
  región viva **vacía y antes** del mensaje: nacer con el texto dentro no se lee.
- **Las pestañas se avisan por `BroadcastChannel`**: lo que una guarda lo pone y lo dice
  la otra, con deshacer, sin guardarlo ni contarlo otra vez; y lo que llega igual a lo
  que hay se ignora, o dos pestañas se lo devolverían para siempre
  ([adr/0118](adr/0118-la-cancion-vive-en-este-navegador-y-se-dice.md)).
- **Todo montaje que llega de fuera pasa por `leerMontaje`**: la copia `.caos.json`,
  lo guardado en IndexedDB, lo que trae otra pestaña y la canción de la cuenta. Ahí se
  descarta la nota que empieza en `MAX_PART_BEATS` (512 pulsos) o más —con un `start` de 1e12 el pentagrama pedía un billón de compases y la canción quedaba rota para
  siempre—, se renombran los identificadores repetidos con `~2`, `~3`…, y se recortan
  nombres (al de una sección, 30) e identificadores (64). Una entrada nueva que se
  salte `leerMontaje` vuelve a abrir todo eso. Abrir una copia se deshace en un paso,
  con la tonalidad y el tempo de antes (`abrirCopia`).
- **Lo que mide reloj va en `*.reloj.test.ts`**, un proyecto de Vitest aparte que corre
  después y un fichero cada vez, sin cobertura: un tope de tiempo metido en un test
  normal falla según lo cargada que esté la máquina
  ([adr/0121](adr/0121-la-base-de-los-tests-se-migra-una-vez-y-el-reloj-corre-aparte.md)).
- **El texto corrido no lleva `text-sm`** ni un tamaño entre corchetes; los 14 px son de
  los mandos y los pone su componente. Lo vigila `screens/coherencia.test.ts`
  ([adr/0122](adr/0122-lo-que-se-lee-va-al-cuerpo.md)).
- **La sonda de medidas no ve los solapes entre hermanos**, y **sin base de datos el
  botón de la cuenta no se pinta**, que es justo el que desborda la barra a 390:
  mide con cuentas y mira la barra a ojo ([adr/0090](adr/0090-los-cifrados-salen-de-una-tabla-por-especie.md)).
- **Mientras suena el micro, un objeto nuevo repinta la pantalla entera.** La
  lectura cambia veinte veces por segundo y la tonalidad detectada dos: se
  selecciona el dato suelto (`s.reading?.midi`), y `selectActiveKey` devuelve una
  de 24 tonalidades fijas. Y en el lienzo, **una flecha nueva hacia `PartRow`
  anula su `memo`**, y lo caza `ArrangeCanvas.pintados.test.tsx`, que cuenta con
  `<Profiler>` los pintados de cada fila
  ([adr/0059](adr/0059-memo-a-mano-y-no-el-compilador.md), [0119](adr/0119-la-partitura-llena-su-hueco-y-el-lienzo-se-parte.md)).

## Modelos, planes y dinero

- **Un modelo nuevo va a `MODEL_PRICES` antes de ponerlo en `ANTHROPIC_MODEL`**, con
  su `pensamiento` y su `esfuerzo` (`core/billing/cost.ts`, y `opcionesDelModelo` en
  `server/ask-model.ts`). Si no está, el cálculo supone el peor caso y los cupos
  salen más pequeños de lo que podrían, o la API contesta 400 porque el modelo no
  admite lo que se le manda: Opus 5.5 y Fable no dejan apagar el pensamiento y los
  demás sí ([adr/0103](adr/0103-los-modelos-vigentes-y-el-de-por-defecto.md)).
- **`planOf` traduce los nombres viejos**: `estudiante` a Básico y `conservatorio` y
  `pro` a Medio. Pro se fundió en Medio y quien lo tuviera no pierde nada
  ([adr/0104](adr/0104-el-plan-pro-se-replantea.md)); sin la traducción caería al
  plan gratis y se le cerraría la puerta.
- **Las variables de Stripe van juntas**: la clave, el secreto del webhook y los
  cuatro precios —Básico y Medio, al mes y al año—. Si falta una, `billing()`
  devuelve el cobrador que no cobra, y media pasarela sería una ventana de pago que
  promete cobrar y no puede. `STRIPE_PRICE_PRO` ya no se lee
  ([adr/0105](adr/0105-la-pasarela-y-los-precios-por-pais.md)).
- **El margen se cuenta sobre el ingreso neto**, sin IVA y con el pago anual
  repartido en meses (`netoDeUnCobroMicros`,
  [adr/0106](adr/0106-el-margen-se-cuenta-sin-iva-y-con-pago-anual.md)): con el
  precio con IVA los cupos prometían el doble de lo que se podía pagar.

## Gasto, topes y lo que escribe quien no es de fiar

Cada una cuesta media hora de mirar el sitio equivocado. Las decisiones están en
[adr/0113](adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md),
[adr/0114](adr/0114-el-gasto-de-la-ia-tiene-techo-y-la-cuenta-se-cierra-en-orden.md),
[adr/0115](adr/0115-la-marca-no-se-adivina-y-lo-libre-se-acota-en-el-peor-alfabeto.md),
[adr/0116](adr/0116-el-avance-que-sube-se-comprueba.md) y
[adr/0117](adr/0117-lo-que-se-levanta-escucha-solo-en-el-equipo.md).

### El dinero de la IA

- **El techo `IA_TOPE_*_USD` cierra la IA también a quien paga** si el mensual se
  queda corto para la gente que tienes: un `503` con `model_unavailable` que dice que
  no es su cupo. Ajústalo al tamaño de la base de usuarios, y **pon además el límite
  de gasto en la consola de Anthropic**: el techo no lo sustituye, es del dueño de la
  clave. Un valor que no se entiende no apaga el tope, se queda el de serie.
- **El SDK va con `maxRetries: 0` y no hay que volver a ponérselo**: los reintentos
  son del bucle de la ruta (`MAX_MODEL_ATTEMPTS`). Con uno más por debajo, una
  petición eran hasta cuatro llamadas y el coste suponía dos.
- **Una ruta nueva que llame al modelo pasa por `responderConModelo`**
  (`server/ai-route.ts`), o no reserva en el techo ni lo asienta, y gasta sin que
  nada lo cuente.
- **El tope por minuto de la IA es por cuenta**; el de dirección solo existe con
  `TRUSTED_PROXY_HOPS`. Sin ella no se cree ninguna cabecera y todos comparten una
  dirección: se queda como está, que es lo seguro, y lo dice un aviso al arrancar.
  **`TRUSTED_PROXY_HOPS=0` no es lo mismo que vacío**: dice «sin proxy, lo sé» y
  calla el aviso. El Docker de casa **no lo trae puesto**: sin proxy delante, ponlo
  tú en el `.env`.
- **Si cambia `textoLibre`, `cost.test.ts` falla a propósito**: el peor caso del
  texto libre entra en la cuenta de cada petición, y hay que cuadrar
  `TOKENS_POR_CARACTER_LIBRE` (`core/billing/cost.ts`). Cambia los cupos y las tablas
  de `README.md`, `AI.md`, `CUENTAS-Y-PLANES.md` y `PARA-PUBLICAR.md`. Con Sonnet 5.5
  hoy son 96 preguntas al mes en Básico y 193 en Medio.
- **`past_due` conserva el plan solo el plazo de gracia** (`planEnVigor`,
  `core/billing/plans.ts`, siete días, `DIAS_DE_GRACIA`): quien lee `plan` a pelo se
  salta el plazo y conserva el plan sin fecha.

### Lo que escribe quien no es de fiar

- **La marca del prompt no se escribe a mano**: va con clave por petición, con
  `preguntaEntreMarcas` y `directricesEntreMarcas`. **Y un tope de texto libre se
  cuenta con `tokensEnElPeorCaso`, no con `.length`**: 240 caracteres yi son hasta 587
  tokens y el cupo los pagaba como 75.
- **Una regex sobre texto de quien escribe se recorta antes, y una tira con
  cuantificador se ancla a su principio.** `sinMarca` buscaba desde cada almohadilla
  y la tira se recorría entera cada vez: 47 s con el servidor parado, con 128 KB y sin
  cuenta, porque el cuerpo se lee antes de mirar la sesión.
- **El profesor está a 1 token de su presupuesto de prompt**: añadirle texto al
  prompt de sistema lo pasa, y el peor caso del cupo deja de ser verdad
  (`server/prompts.test.ts`).
- **`proxyClientMaxBodySize` trunca, no rechaza**, y debe igualar `MAX_CUERPO`
  (`server/request-body.ts`): si se separan, el tope de un lado no vale lo que el del
  otro. Cubre también la entrada de Auth.js, que no pasa por `readJsonBody`.
- **Una clave de tope no lleva nada de fuera en claro**: el correo va como
  `huellaDeCorreo`, y `limitRequest` cambia por su huella cualquier clave de más de
  200 caracteres. Con el correo entero, la fila no cabía en el índice y el tope caía
  a un contador por proceso. **Una IPv6 cuenta por su /64**, no por dirección.
- **La retención de las métricas está escrita dos veces**, en `core/analytics.ts` y
  en la SQL de `server/metricas.ts`, y las ata un test: si cambias una, cambia la otra.
- **El avance se funde en una transacción** con la fila bloqueada
  (`fusionarAvance`, `server/progress-repo.ts`), **y se lee con el día del servidor**
  (`parseProgress(raw, posiciones, hoy)`): sin él, una fecha de 9999 gana la fusión
  para siempre. Quien guarde otro dato por cuenta pasa por `server/tope-por-cuenta.ts`.
- **Contraseña: `MAX_PASSWORD_LENGTH` (1024)** vale al crear, cambiar y restablecer,
  y `contrasena-corta` quiere decir «fuera de medida» por los dos lados.

### Docker, la base y las imágenes

- **`pnpm docker:db` pasa por `scripts/docker-arriba.sh`**, y compose exige las
  contraseñas (`POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD`): `docker compose up` a
  pelo sin `.env` se niega. El script las saca al azar y completa un `.env` de antes.
- **Todo escucha en `127.0.0.1`.** Para ver el Docker de casa desde el móvil,
  `APP_ESCUCHA_EN=0.0.0.0` en el `.env`; Postgres y Ollama tienen su propia variable
  y no hay motivo para abrirlos.
- **La aplicación de compose entra como `caos_app`**, que solo toca filas; el
  superusuario es solo para migrar. Lo crea `scripts/rol-de-la-aplicacion.mjs` en
  cada arranque; migrar con la URL de la aplicación no es su trabajo.
- **`pnpm build` copia `.env` a `.next/standalone/`**: arrancar esa salida lee el
  `.env` de ahí y no el de la raíz; si cambias el de la raíz, construye otra vez.
- **`sslmode=require` se endurece a `verify-full`** (`tlsPara`, `server/db/client.ts`)
  porque el de postgres.js cifra sin comprobar el certificado. **Una IP privada sin
  TLS necesita `sslmode=disable`** dicho a propósito; solo lo local va sin TLS solo.
- **Las imágenes van con digest y las acciones del CI con su commit**; las sube
  Dependabot. No pongas `:latest` ni una etiqueta móvil.

## Aprender y el recorrido

- **Los cortes de la navegación se llaman `barra-arriba` y `ventana-baja`**: son
  variantes de `globals.css`, no `md:` ni un `max-height` a mano, y
  `screens/coherencia.test.ts` prohíbe el literal en los tres sitios que los usan
  ([adr/0122](adr/0122-lo-que-se-lee-va-al-cuerpo.md)). Una variante propia se escribe
  después de `lg`, así que donde convive con él va acotada (`barra-arriba:max-lg:`).
- **Un `loading.tsx` en `(marco)` convierte los 404 en 200** con `noindex`: dentro de
  su espera, el `notFound()` ya no sale como 404. Por eso no hay; la precarga de la
  barra se hace con `prefetch` al ir a pulsar (`EnlaceDePantalla`,
  [adr/0120](adr/0120-la-primera-visita-no-se-mueve-y-cada-pantalla-trae-lo-suyo.md)).
- **La unidad se retoma por donde iba**, en `sessionStorage` y con tres números
  (`learn/sitio-en-la-unidad.ts`); se aplica una vez, al llegar, y retomar no mueve el
  foco ([adr/0123](adr/0123-la-unidad-se-retoma-por-donde-iba.md)).

- **Aprender no pide tonalidad**: parte de Do mayor (`selectTonalidadParaAprender`),
  y **la escala se lee con `selectEscala`, nunca con `scaleId` a pelo**, porque
  la de fábrica depende de la tonalidad y de la pantalla
  ([adr/0109](adr/0109-lo-que-se-da-por-hecho-al-empezar.md)). `/componer` entra por
  `Escribir` con solo la canción abierta.
- **El recorrido son cinco pasos en cuatro tramos**, uno por pantalla
  (`features/tour/tramos.ts`), y no bloquea. `tour/pasos.test.ts` exige que cada
  `data-tour` de la interfaz lo busque algún paso: quitar uno sin quitar su paso, o
  al revés, rompe el test
  ([adr/0108](adr/0108-el-recorrido-sale-por-pantallas.md)).

## Medir, contar y publicar

- **Un acorde con las mismas notas lo desempata el bajo, y solo entonces**:
  `Am7` y `C6` son las mismas cuatro notas y antes ganaba el que salía primero en
  el bucle. Una inversión sigue siendo su acorde (`C/E` se lee Do). **El margen se
  mide contra el primer candidato que se escribiría distinto**, no contra el
  segundo de la lista: `C` contra `Cmaj7` no es una duda. Y **el acierto solo está
  medido con guitarra sintética**
  ([adr/0107](adr/0107-los-armonicos-se-miden-en-su-serie.md), `docs/MEDIR.md`).
- **Los exámenes de la IA solo van a la API con `--api`**, e imprimen antes el
  techo de lo que pueden costar; sin el argumento se paran. Los scripts de `.ts`
  piden el **Node 24 de `nvm`**: con el de WSL, un 22, fallan con «Unknown file
  extension .ts» ([adr/0112](adr/0112-los-examenes-de-la-ia-van-contra-la-api-solo-con-api.md)).
- **Sin cuenta, solo cuenta la vuelta quien dice que sí**: guardar un identificador en
  el aparato pide permiso aunque no sea una cookie (LSSI-CE 22.2), y `Do Not Track`
  o `Sec-GPC` no cuentan nada. **Cambiar `AUTH_SECRET` reinicia la retención**,
  porque los seudónimos son un HMAC con él, y **borrar la cuenta llama a
  `olvidarCuenta`**: quien añada un dato por persona tiene que borrarlo ahí
  ([adr/0110](adr/0110-contar-sin-seguir.md)).
- **Sin las cinco `TITULAR_*` no se abre al público**: `/privacidad` y `/aviso-legal`
  lo dicen con el nombre de la variable. No llevan `NEXT_PUBLIC_`, que se hornea al
  construir ([adr/0111](adr/0111-la-edad-se-declara-y-el-titular-se-configura.md)).
  Y `createUser` exige la declaración de ser mayor de 14 antes de mirar el correo.

## Las capas, el peso y los ciclos

**Un barril de pantallas se lleva todas al paquete de todas.** `app/screens/index.ts`
hacía que `/afinar` descargara el lienzo de componer: las ocho rutas pesaban los
mismos 288 KB, con los seis comandos en verde —ni los tests ni las capas miran lo
que viaja por el cable—. Cada página importa su pantalla **del módulo**, y
`package.json` declara `sideEffects: ["*.css"]` para que un índice de `core/` no
arrastre lo que nadie usa ([adr/0045](adr/0045-un-barril-por-pantalla-no.md)).
Lo mide `peso-de-las-rutas.mjs` del skill `arrancar`. **`/componer` descarga por
partes**: se entra por Escribir, así que **el lienzo va en el paquete de entrada y
Tocando y el ensayo van en diferido** (`app/screens/componer/diferidos.tsx`); lo que va
con `lazy` se importa de su módulo y no del índice, que lo traería de golpe
([adr/0058](adr/0058-componer-se-descarga-por-partes.md), con su nota del 8 de octubre).

Tres más de capas, de la misma familia: **`@core/music` hace `export *` de
`salidas`**, cuyo índice nombra cada export a mano, así que un nombre nuevo que deba
verse desde arriba se añade ahí ([adr/0124](adr/0124-el-motor-de-salidas-se-parte-por-oficio.md));
**`ui/` solo tiene tres piezas conectadas** (`EmpezarPorTonalidad`, `CupoDeIA`,
`ThemeToggle`) y cualquier otra que importe un valor de `@state`, `@audio` o `@media` no
pasa el lint; y **la cuenta la lee el layout de `(marco)`**, no el raíz, para que
las precargas de la barra no consulten la base por enlace.

Cuatro trampas, cada una explicada donde vive: **`song.ts` solo importa tipos de
`arrangement.ts`** —el ciclo revienta en el navegador y ningún test lo ve—;
**`no-restricted-imports` no se acumula entre bloques de ESLint**, gana el último;
**el layout raíz lleva `dynamic = 'force-dynamic'`**, que `app/(marco)/` hereda; y **`planOf` traduce los
nombres viejos de los planes**.

## Lo que no hace, con su porqué

`CLAUDE.md` lo lista en una línea cada cosa para no proponerlo. Aquí, por qué.

- **No sube audio**, y no lo hará sin un ADR. Con cuenta sí sube el avance:
  identificadores, números y fechas.
- **No graba vídeo**: lo hizo y se quitó entero
  ([adr/0023](adr/0023-grabar-solo-el-sonido.md)).
- **No cobra todavía**, a propósito y con su ADR, ni pide una tarjeta. Los planes de
  pago son dos, Básico y Medio, con pago anual
  ([adr/0104](adr/0104-el-plan-pro-se-replantea.md)).
- **No tiene vidas ni corazones**: fallar no bloquea, se explica y se sigue.
- **No esconde el texto del Grado Profesional**: `UnitScreen` es de cliente y genera
  las lecciones en el navegador, así que viaja en el JavaScript. Lo que se cobra es
  el camino y la IA, no el secreto de las preguntas
  ([adr/0116](adr/0116-el-avance-que-sube-se-comprueba.md)).
- **No examina a nadie** para colocarle de nivel
  ([adr/0007](adr/0007-elegir-por-donde-empezar.md)).
- **No exige cuentas.** Sin `DATABASE_URL` y `AUTH_SECRET` todo el mundo es anónimo,
  con plan gratis y el avance en su navegador.
- **No crea cuentas a menores de 14**: se declara con un «sí» o un «no» y lo
  comprueba también el servidor
  ([adr/0111](adr/0111-la-edad-se-declara-y-el-titular-se-configura.md)).
- **No usa analítica de terceros ni cookies de seguimiento**: cuenta con tablas
  propias, sin dirección IP, y lo que se guarda en el aparato pide permiso
  ([adr/0110](adr/0110-contar-sin-seguir.md)).
- **No manda correos sin configurarlo**, y la pantalla lo dice.
- **No detecta la tonalidad rasgueando**: el motor de tono es monofónico, así que la
  interfaz pide «unas notas sueltas» (`docs/AUDIO-PITCH.md`). Hubo una pantalla
  sencilla que la sacaba de los acordes y se quitó
  ([adr/0095](adr/0095-se-quita-componer-sencillo.md)).
- **No acierta siempre con los acordes**, y con una guitarra delante falla más de lo
  que decía: el croma olvida la octava —duda con las inversiones— y **una nota sola
  sale como su quinta (`C5`)**, así que un punteo se lee como acordes. Lo que sí
  hace es **decir cuándo duda**, y la duda son **dos cosas**: el empate con el
  candidato que se escribiría distinto y lo poco que se parece
  ([adr/0020](adr/0020-lo-que-se-oyo-y-lo-que-se-supo.md),
  [adr/0043](adr/0043-dos-maneras-de-equivocarse.md),
  [adr/0107](adr/0107-los-armonicos-se-miden-en-su-serie.md)). **El acierto solo
  está medido con guitarra sintética**; con una guitarra de verdad está sin medir
  (`docs/MEDIR.md`). Lo medido tocando está en `docs/ROADMAP.md`; el porqué, en
  `docs/AUDIO-PITCH.md`.
