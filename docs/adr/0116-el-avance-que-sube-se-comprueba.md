# ADR 0116 — El avance que sube se comprueba, se funde en una transacción y tiene tope

Fecha: 2026-10-07 · Estado: aceptada

## Contexto

Una auditoría de seguridad atacó `PUT /api/progreso` y las canciones con una cuenta de
verdad y Postgres delante (PGlite), y encontró cuatro cosas:

1. **Dos subidas a la vez perdían una.** La ruta leía lo guardado, lo fundía con lo que
   llegaba y escribía, en tres pasos sueltos. Dos aparatos que suben a la vez —una
   unidad cada uno— leían lo mismo, y el segundo en escribir borraba al primero: se
   guardaba `['e1-claves']` donde tenía que haber dos.
2. **Un avance inventado se guardaba y no se podía arreglar.** Se subió
   `streak: 1e308`, `xpToday: 1e308`, `lastDay: '9999-99-99'` y las quince medallas sin
   ninguna unidad hecha, y se guardó tal cual: `isDay` miraba solo la forma. Peor, la
   fusión se queda con el último día **mayor**, así que esa fecha ganaba a todas las de
   verdad para siempre; tras subir un avance real, seguía `9999-99-99`.
3. **Escribir no tenía tope por cuenta.** Cada `PUT` del avance y cada `POST`/`PUT` de
   una canción es una escritura de hasta 128 KB, y la instancia tiene **una** conexión a
   Postgres (`db/client.ts`).
4. **El Grado Profesional viaja en el JavaScript del cliente.** `UnitScreen` es de
   cliente y genera las lecciones en el navegador; se pidió medir si alguien sin plan
   las descarga.

Lo que no se podía hacer es arreglarlo a costa de quien usa dos aparatos de buena fe: la
fusión existe para que nadie pierda nada de lo que estudió en otro sitio.

## Decisión

### 1. Fundir es una transacción con la fila bloqueada

`fusionarAvance` (`server/progress-repo.ts`) hace, dentro de `transaction`:

1. `insert … on conflict do nothing` de una fila vacía, para que **la primera vez**
   también haya algo que bloquear —si no, dos inserciones a la vez se vuelven a pisar—.
2. `select … for update` de la fila: el segundo espera a que el primero escriba.
3. Funde con `mergeProgress` y escribe.

Si algo falla dentro, Postgres deshace todo y lo guardado sigue igual, que era la regla
de siempre: sin poder leer lo que había no se escribe encima. La ruta contesta un único
502 `no-guardado`.

### 2. Lo que sube se lee con el día del servidor

`parseProgress(raw, posiciones?, hoy?)`. Con `hoy` —el día UTC del servidor, que pasa
`hoyEnElServidor()`—:

- **Ninguna fecha posterior a mañana**: ni `lastDay`, ni el `seenOn` de la cola de
  repaso, ni el instante del punto de partida (`startCourseAt`, que también gana la
  fusión por ser «el más reciente»). Mañana y no hoy porque en UTC+14 ya lo es.
- **Una racha no pasa de los días que lleva existiendo la aplicación**: desde
  `PRIMER_DIA` (`2026-07-28`, el primer commit) hasta mañana.
- Sin último día, ni racha ni mejor racha ni XP del día.

Sin `hoy`, lo de siempre: el navegador no tiene un reloj del que fiarse y lo suyo es
suyo; lo recorta el servidor al subirlo. Lo que se aplica siempre, con o sin día:

- `isDay` pide **un día que exista**, no solo la forma: `9999-99-99` y `2026-02-30` no
  lo son.
- El XP del día no pasa de `MAX_XP_DEL_DIA`: el temario entero, el tope de componer y
  cincuenta repasos. `completeUnit`, `practiceReview` y `practiceCompose` respetan el
  mismo techo, así que el dominio nunca produce lo que luego recortaría.
- **Medallas**: las que lo hecho demuestra —primera unidad, escalas, curso, los dos
  grados, siete días por la mejor racha— se **calculan** y llegan solas. De las que
  vienen guardadas se quedan **las posibles**: todas piden un día practicado; las de
  unidades y cursos, alguna unidad hecha; «sin un fallo», una que no sea de tocar; la
  de siete días, una mejor racha de siete.

Lo guardado pasa por el mismo `parseProgress` con `hoy` al leerse
(`loadAccountProgress` y la transacción), así que **lo envenenado antes de esto se
repara en la siguiente subida** sin migración.

### 3. Tope por cuenta al escribir

`server/tope-por-cuenta.ts` (`frenoPorCuenta`) usa el `limitRequest` de siempre —con
Postgres si lo hay, en memoria si no— con la clave `para:cuenta:userId`: **por cuenta y
no por dirección**, porque quien escribe es la cuenta y sin `TRUSTED_PROXY_HOPS` todas
las direcciones comparten contador. Avance: 60 por minuto. Canciones: 30 por minuto
entre crear y escribir encima. Leer y borrar no llevan tope. Un avance frenado no se
pierde: el navegador se queda con el suyo y la siguiente subida lo arrastra.

### 4. El Grado Profesional en el cliente se acepta, y se escribe

**Medido** sobre el build del 7 de octubre: el texto de `p2-inversiones` («¿Cómo se
cifra un acorde en segunda inversión?») está en un trozo estático de 111 KB que el
manifiesto de cliente de `/aprender/[unidad]` y de `/aprender/repaso` pide para todo el
mundo, con plan o sin él. Y aunque no lo pidiera: **un trozo de `/_next/static` lo
descarga cualquiera que sepa su nombre**, así que trocearlo para que solo se pida con
plan no lo protegería.

Se acepta. Lo que el plan vende del Profesional es **el camino**: que se abra en orden,
que cuente, que se repase lo fallado y que se pueda preguntar al profesor sobre ello; no
el texto de unas preguntas de armonía que están en cualquier manual de conservatorio. Lo
que de verdad cuesta dinero —la IA— ya se cobra en el servidor, con cuenta y cupo.

## Descartadas

- **Versión optimista con reintento** en vez de `for update`. Hace falta una columna de
  versión, una migración y un bucle que, con dos aparatos insistiendo, puede no
  terminar. El bloqueo es una sentencia y espera lo justo.
- **Un `pg_advisory_xact_lock` por cuenta.** Funciona igual, pero es un candado que no
  se ve en el esquema y que cualquier otra escritura de la fila puede saltarse; el
  bloqueo de la fila no.
- **Rechazar con un 400 el avance que no cuadre.** El navegador de alguien con una fecha
  mal guardada dejaría de sincronizar para siempre sin saber por qué. Limpiar y seguir
  es lo que ya hacía `parseProgress` con las unidades inventadas.
- **Dar por inventadas las medallas que hoy no se pueden demostrar.** El temario se
  reescribe (adr/0096) y una unidad retirada deja a medias un curso que se cerró de
  verdad; las de componer, ensayar y repasar no dejan rastro. Borrarlas quitaría las
  reales de todo el mundo en la siguiente subida, y una medalla no abre nada.
- **Que el dominio lea el reloj.** Rompe que una racha de cuarenta días se pruebe sin
  esperar cuarenta días. El día entra por parámetro, como todo lo demás.
- **Tope por dirección**, como la IA. Sin proxy de confianza es un contador para todos,
  y con él una cuenta con varias direcciones lo multiplica.
- **Servir las lecciones del Profesional desde el servidor solo con plan.** Es la única
  forma de que no se puedan leer sin pagar, y cuesta: una ruta con sesión y plan, estados
  de carga y de error en la unidad y en el repaso —que regenera preguntas de cualquier
  unidad—, generar por tonalidad en el servidor, y deshacer que `/aprender/[unidad]` se
  prerenderice. Sin base de datos, además, nadie tiene plan. Todo eso por proteger
  teoría pública. Si algún día el Profesional trae algo propio que valga la pena
  proteger —explicaciones escritas aquí, audio—, se vuelve a decidir.
- **Trocear el Profesional con `import()` para que solo lo pida quien tiene plan.** Ahorra
  bytes a quien no lo usa, pero no lo protege: el trozo es público. Si se hace, será por
  peso (adr/0045, adr/0058), no por esto.

## Consecuencias

- Dos aparatos que suben a la vez no pierden nada, y lo prueba
  `app/api/progreso/route.con-base.test.ts` lanzando los `PUT` a la vez contra PGlite:
  sin la transacción, falla.
- Un avance inventado ya no se guarda, y uno guardado envenenado se arregla al subir el
  siguiente. Lo que se sigue pudiendo mandar desde la consola es **su avance**: marcar
  todo el temario como hecho, con sus medallas de grado. Eso no cambió y no tiene por
  qué.
- Quien estudió con el temario de antes conserva sus medallas; quien tenía
  `racha-siete` sin una mejor racha de siete guardada —solo pudo pasar antes de que
  existiera `bestStreak`— la pierde.
- `saveAccountProgress` sigue existiendo para sembrar avances en los tests; la ruta ya
  no la usa.
- El texto del Grado Profesional se puede leer sin plan descargando el JavaScript, y
  queda dicho aquí y en `docs/CUENTAS-Y-PLANES.md`.
