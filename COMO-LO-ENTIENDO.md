# Cómo entiendo esta aplicación

**Documento de trabajo, no documentación del proyecto.** No está en la tabla de
`docs/` de `CLAUDE.md` a propósito: existe para que lo taches. Cuando esté
corregido, lo que valga se muda a `docs/` y esto se borra.

Cada afirmación va marcada, y la marca es lo importante:

- **[C]** comprobado leyendo el código. Si está mal, el código está mal o lo he
  leído mal.
- **[S]** supuesto. Creo que es así pero no lo he verificado, o no se puede
  verificar leyendo: es una intención, no un hecho.
- **[?]** no lo sé y afecta a decisiones. Son las preguntas que más me frenan.

Lo que más necesito corregido son las **[S]** sobre cómo se usa esto. El código
me dice lo que hace; no me dice si es lo que querías.

---

## 1. Qué creo que es esto

**[C]** Una aplicación web de una sola persona, sin backend obligatorio: sin
`DATABASE_URL` ni `AUTH_SECRET` funciona entera y anónima, con el avance en
IndexedDB del navegador.

**[S]** Y creo que el orden de importancia de sus tres patas es este:

1. **Componer** es el corazón. Es donde quieres que se pase el tiempo.
2. **Aprender** es el andamio: teoría por unidades para poder componer mejor.
3. **Afinar** es una herramienta de servicio que está ahí porque el motor de tono
   ya existía.

**[?]** No sé si ese orden es el tuyo. Me lo he montado de que las quejas de esta
sesión han sido todas de componer y de las salidas, nunca de aprender. Si
aprender es realmente la pata principal —una aplicación de estudio con un lienzo
al lado— muchas de mis prioridades están al revés.

---

## 2. `/componer` — el banco de trabajo

### Cómo creo que funciona

**[C]** Es un banco de áreas que se pliegan y se arrastran, con **tres espacios
de trabajo** que son tres maneras de escribir la misma canción. Cada espacio
recuerda su propio reparto, y el de fábrica dice qué importa en cada uno:

| Espacio    | Qué viene plegado de fábrica | Lo que eso dice                                    |
| ---------- | ---------------------------- | -------------------------------------------------- |
| `tocando`  | derecha y camino             | solo la tonalidad y el botón de grabar             |
| `escribir` | izquierda y camino           | manda la canción, y al lado cómo se toca el acorde |
| `ensayar`  | izquierda, derecha y camino  | no se decide nada, se toca lo que hay              |

**[C]** El área de abajo empieza cerrada en los tres.

**[C]** Se entra por `tocando`.

### Cómo creo que la usas

**[S]** El recorrido que tengo en la cabeza es:

1. Eliges tonalidad en la rueda.
2. Vas a `tocando`, **dices si la toma es rítmica o punteo**, grabas un trozo con
   la guitarra y lo traes al lienzo.
3. Pasas a `escribir` para arreglar lo que el micro entendió mal, arrastrar
   bloques y ver la partitura.
4. `ensayar` para tocarlo contra el metrónomo cuando ya hay algo.
5. Las salidas, para que la IA te diga por dónde seguir.

**[?]** **Creo que este recorrido es donde más me equivoco.** Tres dudas
concretas:

- **¿Grabas de verdad con la guitarra, o escribes a mano y grabar es la excepción?**
  Yo he asumido que grabar es la puerta de entrada porque es el espacio de fábrica.
  Si en la práctica escribes a mano y el micro es un juguete, mis arreglos de esta
  semana han ido al sitio equivocado.
- **¿Una canción se monta en una sesión o en muchas?** Si es en muchas, que el
  lienzo no se guarde solo es un fallo grave y no «un detalle anotado en el
  ROADMAP».
- **¿Usas los tres espacios o vives en uno?** Si vives en `escribir`, los repartos
  de fábrica de los otros dos no importan nada.

### Lo que sé que está flojo

**[C]** No hay silencios, ni ligaduras, ni tresillos, ni segunda voz, y los
compases no se cierran: nada comprueba que lo de dentro sume. Un compás con hueco
se ve igual que uno lleno.

**[C]** La rejilla llega a la semicorchea desde anteayer; antes era la corchea y
apilaba las notas de cualquier punteo normal.

**[S]** Y creo que el orden para arreglarlo es silencios → ligaduras → segunda
voz → tresillos → clave de fa → MusicXML, porque los dos primeros son lo que se
ve y no piden tocar el modelo.

**[?]** ¿O lo que te falta de verdad es **exportar** —MusicXML, para abrirlo en
MuseScore— y lo demás te da igual porque lo arreglarías allí?

---

## 3. Grabar con el micro — lo que entra

### Cómo funciona

**[C]** Hay **dos motores y no uno**, corriendo a la vez sobre la misma señal:

- **El croma** (`audio/chroma.ts` + `chord-engine.ts`) reconoce acordes
  rasgueados. Olvida la octava, así que duda con las inversiones.
- **La autocorrelación** (`audio/autocorrelation.ts`) lee **una** nota a la vez.
  Es el mismo motor del afinador y es el fiable.

**[C]** Antes apuntaban los dos a la vez, así que un punteo entraba con acordes
inventados encima. Ahora **la toma declara qué es** —rítmica o punteo— y solo
corre el motor que toca.

**[C]** Y hay un límite que no se arregla afinando umbrales: después del descuento
de armónicos, **una nota sola tiene casi la misma forma que su acorde mayor**. Un
Do pulsado y un Do rasgueado no se distinguen.

### Cómo creo que lo usas

**[S]** Grabas por tomas: primero la rítmica entera, después el punteo. Es un
gesto más a cambio de que entre lo que tocaste.

**[?]** **¿Con qué grabas?** Esto cambia todo lo demás. Si es el micro del
portátil con la guitarra acústica delante, el croma va a fallar más de lo que
dicen mis medidas, que están hechas con WAV sintéticos. Si es una eléctrica por
interfaz, es otra historia.

**[?]** **¿Cuánto grabas de una vez?** Cuatro compases o una canción entera. Lo he
supuesto corto y puede que esté mal.

**[S]** Y creo que lo que más te molestaría de aquí es **que no se puedan corregir
las notas después** cómodamente: el reconocimiento va a fallar siempre, así que lo
que importa es lo rápido que se arregla a mano.

**[?]** ¿Es eso, o preferirías que fallara menos aunque corregir siguiera siendo
igual de incómodo?

---

## 4. Las salidas — la IA que te dice por dónde seguir

### Cómo funciona

**[C]** Le mandas **símbolos, nunca audio**: la tonalidad, los grados con sus
pulsos, qué parte es —idea, estrofa, estribillo— y desde ayer **a qué quieres que
suene**, con tus palabras.

**[C]** Devuelve hasta tres salidas, cada una declarando **cuál de los cinco
caminos** ha tomado: `seguir`, `contraste`, `rearmonizar`, `estirar`,
`otro-final`. Y el dominio **no se cree nada**: recalcula los acordes, comprueba
que los saltos estén en el grafo y descarta la que no cuadre.

**[C]** Hoy contesta un `qwen3:8b` que corre en tu equipo, a temperatura 0. O sea
que **la misma pregunta da siempre la misma respuesta**: reintentar no sirve.

**[C]** La causa de rechazo más común no es la música, es
**`un salto que el dominio no conoce`**: se inventa saltos con el grafo delante.

### Cómo creo que la usas

**[S]** Cuando te has quedado atascado con cuatro compases y quieres tres
opciones para elegir, no cuando quieres que te escriba la canción.

**[?]** **¿Es eso, o esperas que te la escriba?** Tu descripción de las salidas
—«varias partituras con varias combinaciones posibles», «que suenen a canción
completa»— suena a lo segundo, y ahí un modelo de 8B local no llega. Con clave de
Anthropic sí. Esto decide si merece la pena seguir puliendo el prompt local o si
lo que hay que hacer es dar por supuesto que las salidas buenas se pagan.

**[?]** **¿Quieres que la conversación tenga memoria?** Hoy es un campo y un
botón: preguntas y contesta. Con memoria puedes decir «eso pero más oscuro» sin
repetirlo todo, y cuesta guardar el hilo y gastar cupo en cada vuelta.

---

## 5. `/aprender` — el camino

### Cómo funciona

**[C]** Dos grados —Elemental y Profesional—, diez cursos y treinta y cuatro
unidades: **quince de teoría, diez de tocar y nueve de oído**.

| Tipo     | Cuántas | Qué te pide                         | Cómo se supera                  |
| -------- | ------- | ----------------------------------- | ------------------------------- |
| `theory` | 15      | preguntas                           | contestarlas; fallar no bloquea |
| `ear`    | 9       | oír y reconocer                     | lo mismo, pero suena antes      |
| `play`   | 10      | **tocar la escala con la guitarra** | subirla y bajarla entera        |

**[C]** En las de tocar, cada paso cuenta cuando la nota aguanta **350 ms** dentro
de **25 cents**. Los pasos que te costaron —dos intentos o más— **vuelven en el
repaso**.

**[C]** El repaso tiene **dos pasos y fuera**: hoy y mañana, y la pregunta sale de
la cola. A propósito, para que se pueda vaciar.

**[C]** La meta diaria son **40 XP**, hay racha y hay medallas. Y componer suma:
lo lleva `state/hechos-de-componer.ts`.

**[C]** No hay vidas, no hay examen de nivel, y eliges por dónde empezar.

### Cómo creo que lo usas

**[S]** Poco. Creo que aprender lo montaste porque la aplicación lo necesitaba
para ser lo que dice ser, pero que tú ya sabes la teoría que enseña.

**[?]** Si eso es verdad, **el avance, la racha y las medallas son para otra
persona que todavía no existe**, y eso cambia cuánto merece la pena pulirlos. Si
es mentira y las usas, entonces el repaso de dos pasos es una decisión que hay que
mirar con más cariño.

**[S]** Y creo que las unidades de tocar son la parte más valiosa de aprender,
porque son las únicas que usan la guitarra. Las de teoría son un cuestionario.

---

## 6. `/afinar`

**[C]** Ocho afinaciones —Estándar, Drop D, medio tono abajo, un tono abajo, Drop
C, DADGAD, Open G, Open D—. Busca la cuerda más cercana sola y enseña los cents y
los Hz.

**[C]** Es monofónico y lo dice: «toca una cuerda al aire y deja que suene».

**[S]** Creo que esta parte funciona bien y no necesita nada. Fue de lo poco que
pasó las pruebas con guitarra a la primera.

**[?]** ¿La usas de verdad o afinas con otra cosa?

---

## 7. `/profesor`

**[C]** Escribes una pregunta de teoría —240 caracteres— y contesta un modelo,
que puede devolver un ejemplo en grados. **El ejemplo se valida** contra el
dominio; su prosa, no, pero va acotada.

**[C]** Entra en el plan gratis, con quince preguntas al mes.

**[S]** Creo que es la función que menos usas y la que más usaría alguien que
empieza.

---

## 8. Cuentas y planes

**[C]** Cuatro planes, y lo que separa cada escalón:

| Plan   | Qué añade                                                   |
| ------ | ----------------------------------------------------------- |
| gratis | el profesor, y la guitarra entera                           |
| básico | Grado Profesional, repaso, canciones guardadas, sincronizar |
| medio  | **ideas** de la IA                                          |
| pro    | **salidas**                                                 |

**[C]** Sin cuenta funciona todo menos la IA y guardar en la nube. Con cuenta sube
el avance: identificadores, números y fechas. **Audio, nunca.**

**[C]** No cobra todavía y no pide tarjeta.

**[S]** Y creo que los planes están donde están porque lo que cuesta dinero es el
modelo: ideas y salidas son las dos cosas que se pagan por petición, así que son
las que separan los escalones de arriba.

**[?]** **¿Y el reparto te parece bien tal cual está?** Que las salidas —lo que
más te importa de la aplicación— estén solo en el plan más caro significa que la
función que más pules es la que menos gente va a ver.

---

## 9. Las tres o cuatro cosas que más me preocupa haber entendido mal

Si solo corriges cuatro líneas de todo esto, que sean estas:

1. **[?] Que grabar con el micro es la puerta de entrada a componer.** Todo mi
   trabajo de esta semana lo da por hecho.
2. **[?] Que las salidas son «tres opciones para elegir» y no «escríbeme la
   canción».** Decide si el modelo local sirve o si hay que asumir que esto se
   paga.
3. **[?] Que aprender es el andamio y componer el corazón.** Si es al revés, mis
   prioridades están invertidas.
4. **[?] Que lo que quieres de la partitura es leerla aquí** y no exportarla a
   MuseScore. Si es exportar, el orden de trabajo cambia entero.

---

## 10. Lo que creo que no debería hacer, y quiero confirmarlo

**[C]** Estas son reglas escritas en el proyecto, y las he respetado:

- **No subir audio.** Ni para mejorar el reconocimiento, ni para que la IA
  «escuche» la canción. Solo símbolos.
- **No añadir vidas ni bloqueos** por fallar.
- **No examinar a nadie** para colocarle de nivel.
- **No cobrar** todavía.

**[?]** La primera es la que más me ha frenado. Cuando pediste «darle un input de
sonido a las salidas», lo implementé como «el micro lo convierte en símbolos aquí
y viajan los símbolos». **¿Era eso lo que querías, o querías subir el audio de
verdad?** Si es lo segundo hace falta un ADR y cambia la promesa de privacidad de
la aplicación, así que no lo he hecho por mi cuenta.
