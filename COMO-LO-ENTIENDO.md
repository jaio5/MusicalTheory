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
- **[D]** **decidido por ti**, en la primera ronda de correcciones. Manda sobre
  cualquier **[C]**: si el código dice otra cosa, el código está pendiente de
  cambiar, y debajo pongo qué hace falta para ello.

Lo que más necesito corregido son las **[S]** sobre cómo se usa esto. El código
me dice lo que hace; no me dice si es lo que querías.

---

## 0. El test, contestado

Contestado el 26 de septiembre de 2026. **Esta tabla es la referencia**: manda
sobre cualquier cosa que yo suponga más abajo.

| #   | Pregunta                              | Tu respuesta                                                                   |
| --- | ------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Qué esperas de las salidas            | **Tres opciones para elegir**                                                  |
| 2   | Qué manda, componer o aprender        | **Componer es el corazón**                                                     |
| 3   | Con qué grabas                        | **Pensado para todos**: acústica por móvil u ordenador, eléctrica por interfaz |
| 4   | Cuánto grabas de una vez              | **Cuatro u ocho compases**                                                     |
| 5   | Claqueta al grabar                    | **Obligatoria**                                                                |
| 6   | El «input de sonido» de las salidas   | **Subir el audio de verdad**                                                   |
| 7   | Cómo corregir la transcripción        | **Lo dudoso me lo pregunta; el resto lo toco yo**                              |
| 8   | Cómo se guarda el lienzo              | **Solo, con nombre automático, en la cuenta**                                  |
| 9   | Qué pasa sin cuenta                   | **No se guarda nada**: la sesión, y descargar lo hecho                         |
| 10  | El audio subido                       | **Se guarda hasta que tú lo borres**                                           |
| 11  | Segunda guitarra y capas              | **Sí, pero más adelante**                                                      |
| 12  | El chat de salidas                    | **Memoria corta, de la misma sesión**                                          |
| 13  | Sin cuenta: ¿también se va el avance? | **No**: solo la canción. El avance se queda                                    |
| 14  | Dónde vive el audio subido            | **En el servidor, con la cuenta**                                              |
| 15  | En qué plan entra subir audio         | **En todos los que tengan IA**                                                 |
| 16  | Por dónde empiezo                     | **La claqueta al grabar**                                                      |
| 17  | La claqueta y la fuga por el micro    | **Solo en la cuenta atrás; al grabar, callada**                                |
| 18  | De dónde sale el tempo                | **Del ajuste de bpm que ya hay**                                               |
| 19  | Compases de cuenta atrás              | **Dos**                                                                        |
| 20  | El correo sin verificar               | **Verificar antes de la IA y de subir audio**                                  |

### Lo que cada una desbloquea o cambia

**1. Tres opciones.** El `qwen3:8b` de tu equipo llega de sobra, así que seguir
puliendo el prompt local tiene sentido y no hace falta dar por supuesto que las
salidas se pagan. Y encaja con lo que ya hay: hasta tres salidas por tanda.

**2. Componer manda.** Confirma mi orden. El avance, la racha y las medallas son
secundarios; lo que se pule primero es el taller.

**3. Pensado para todos.** No es una respuesta, es un requisito, y cambia cómo hay
que calibrar: **el caso contra el que hay que medir es el peor** —micro de móvil o
de portátil con una acústica delante—, no el bueno. Y da una regla que se puede
decir en pantalla: **para eléctrica, por interfaz**. Eso permite exigir señal
limpia ahí en vez de intentar arreglar una eléctrica por ampli captada con el micro
del portátil, que es el caso donde el croma se pierde y el afinador también.

**4. Cuatro u ocho compases.** Es el caso bueno para el reconocimiento y quita de
la mesa lo de partir una toma larga en partes.

**5. Claqueta obligatoria.** Es la respuesta más rentable de las ocho: el
metrónomo ya está escrito (`features/metronome/`) y hoy **no suena al grabar**, así
que la transcripción convierte lo que toques con el `bpm` de los ajustes y si tocas
a otro tempo todo cae mal. Con claqueta, la rejilla pasa a ser de fiar, y de ahí
cuelgan las figuras, los compases y los silencios.

**6. Subir el audio.** Es la que hay que hablar, y está en el apartado 10.

**7. Lo dudoso me lo pregunta.** Aprovecha lo que ya existe y nadie usa: el motor
**ya sabe cuándo duda**, con dos medidas distintas —el empate con el segundo
candidato y lo poco que se parece— y con sus candidatos alternativos
([adr/0043](docs/adr/0043-dos-maneras-de-equivocarse.md)). Hoy eso solo pinta un
aviso; con tu respuesta pasa a ser una cola de preguntas: «esto sonó a Do o a La
menor, ¿cuál era?».

**8 y 9. Guardado en la cuenta, y sin cuenta no se guarda nada.** La cuenta existe
porque hay planes de pago: da la IA —profesor, ideas, salidas— y da guardar. Sin
cuenta funcionan **aprender, componer sin IA y afinar**, se puede descargar lo
hecho, y al cerrar el navegador se pierde: vale para la sesión.

**Y esto contradice lo que hace hoy.** Hoy, sin cuenta, el avance **sí** sobrevive
a cerrar el navegador: vive en IndexedDB, y hay una función entera
—`use-progress.ts` con `mergeProgress`— que existe para que estudiar sin cuenta y
registrarse después **no pierda nada**. `CLAUDE.md` lo vende como una virtud: «todo
el mundo es anónimo, con plan gratis y el avance en su navegador».

Así que hay que decidir si tu respuesta alcanza también al avance de aprender o
solo a la canción. Lo pregunto en la tanda siguiente, porque quitar la persistencia
anónima tira esa fusión y cambia lo que promete la portada.

**10. El audio se guarda hasta que lo borres.** Es la opción más pesada de las tres
y hay que decirlo: pide sitio donde guardarlo, borrado a petición, borrado al
cerrar la cuenta, un tope por cuenta y contarlo en la política de privacidad. Y
añade algo que hoy no existe en ninguna parte del proyecto: **grabaciones tuyas en
reposo, en un servidor.** La revisión de seguridad de ayer no cubre eso porque no
había nada parecido.

**11. Las capas, más adelante.** Primero que la transcripción de una voz sea de
fiar —claqueta, corregir lo dudoso, silencios— y las capas cuando eso esté. Encaja
con el orden de la partitura que ya confirmaste: la segunda voz iba tercera.

**12. Memoria corta en el chat.** El punto medio y el más barato: recuerda mientras
no cierres y no se guarda en ningún sitio. Permite «eso pero más oscuro» sin tener
que guardar conversaciones ni decidir cuánto duran.

**13. La contradicción se resuelve por lo estrecho: solo la canción.** El avance de
aprender sigue como está —vive en el navegador y se fusiona al registrarte—, así que
no hay que tirar `mergeProgress` ni cambiar lo que promete la portada. Lo que no
sobrevive sin cuenta es la canción.

**14 y 15. El audio vive en el servidor, con la cuenta, y entra en todos los planes
que tengan IA.** Aquí tengo que cruzar dos cosas y decírtelo, porque juntas pesan
más que separadas:

- El plan **gratis ya tiene IA** —el profesor, con quince peticiones al mes—, así
  que «todos los que tengan IA» incluye el gratis.
- Y **registrarse no exige verificar el correo**, que es lo que anoté ayer en
  `docs/PARA-PUBLICAR.md` al revisar la seguridad.

Las dos juntas significan que **una dirección inventada puede dejar audio guardado
en tu servidor**. Antes eso costaba quince llamadas al modelo; ahora cuesta
almacenamiento que no se borra hasta que alguien lo borre, de una cuenta que no
tiene detrás a nadie comprobable. No digo que la decisión esté mal: digo que
**subir audio sube de golpe lo que cuesta no verificar el correo**, y que eso hay
que resolverlo antes de que exista la función y no después.

**17, 18 y 19. La claqueta: dos compases de cuenta atrás, con el bpm que ya hay, y
callada mientras grabas.** Resuelve la fuga del todo —el micro no la oye, así que el
croma no la ve— y no pide trabajo nuevo de tempo.

Y tiene un intercambio que hay que medir, no suponer: **callada, puedes irte de
tempo, y la transcripción va a seguir creyéndose el bpm del ajuste.** Con cuatro u
ocho compases la deriva suele ser pequeña, pero es exactamente lo que hay que
comprobar tocando antes de dar la claqueta por terminada. Si se va, las salidas
serían: dejarla sonar con auriculares pedidos, o detectar el tempo de verdad.

**20. Verificar el correo antes de la IA y de subir audio.** La aplicación se sigue
usando sin verificar; lo que cuesta dinero y ocupa disco, no. Con una dependencia
que hay que decir: **hoy el envío de correo no está probado contra un proveedor de
verdad**, solo el flujo contra Postgres, y eso está anotado en
`docs/PARA-PUBLICAR.md`. O sea que esta decisión convierte «mandar correos» en
requisito de la IA, y antes no lo era de nada.

**16. Se empieza por la claqueta.** Y estoy de acuerdo, por lo que ya está escrito
arriba: el metrónomo existe, hoy no suena al grabar, y de que la rejilla sea de fiar
cuelgan las figuras, los compases y los silencios. Es la respuesta más rentable de
las dieciséis.

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

**[D]** El recorrido, corregido:

1. Eliges tonalidad en la rueda.
2. Grabas con la guitarra. **No le dices si es punteo o acordes: se transcribe
   solo**, a partitura y a notas.
3. **Corriges lo que haya entendido mal**, que es un paso de primera clase y no un
   remiendo.
4. `ensayar` para tocarlo contra el metrónomo cuando ya hay algo.
5. Las salidas, para que la IA te diga por dónde seguir.

**[D] Se monta en muchas sesiones.** Puede caber en una, pero eso es un caso de
las muchas y no al revés: **hay que enfocarlo a muchas**.

**[D] Vives en un espacio**, y son los componentes los que te dejan usar ese mismo
espacio para varias cosas. Los tres espacios no son tres sitios donde ir viviendo.

### Lo que esas tres decisiones cambian

**Que se transcriba solo contradice
[adr/0048](docs/adr/0048-una-toma-dice-lo-que-es.md)**, que escribí anteayer y
decidía justo lo contrario. Lo hablo en el apartado 3, porque no es un cambio de
una línea.

**Que se monte en muchas sesiones sube «el lienzo no se guarda solo»** de detalle
del ROADMAP a fallo de los que estorban a diario: hoy, si cierras, la canción se
guarda solo si te acuerdas de guardarla como canción desde su pestaña, y al
reabrirla los bloques vuelven desagrupados. Con sesiones largas eso no es una
molestia, es perder trabajo.

**Que vivas en un espacio baja la prioridad de los tres repartos de fábrica** y
sube la de que las áreas se puedan tener todas a mano en uno. Lo que había
entendido yo —tres sitios, uno por tarea— hacía que cambiar de espacio fuera el
gesto central; no lo es.

### Lo que sé que está flojo

**[C]** No hay silencios, ni ligaduras, ni tresillos, ni segunda voz, y los
compases no se cierran: nada comprueba que lo de dentro sume. Un compás con hueco
se ve igual que uno lleno.

**[C]** La rejilla llega a la semicorchea desde anteayer; antes era la corchea y
apilaba las notas de cualquier punteo normal.

**[D]** El orden queda confirmado: **silencios → ligaduras → segunda voz →
tresillos → clave de fa → MusicXML**. Los dos primeros son lo que se ve y no piden
tocar el modelo; MusicXML va al final porque sale casi solo cuando los dos
primeros estén.

Y el paso 3 del recorrido —corregir lo que el micro entendió mal— **se apoya en
los dos primeros**: mientras un compás no se cierre, no hay forma de que la
partitura te enseñe que ahí falta algo.

---

## 3. Grabar con el micro — lo que entra

### Cómo funciona

**[C]** Hay **dos motores y no uno**, corriendo a la vez sobre la misma señal:

- **El croma** (`audio/chroma.ts` + `chord-engine.ts`) reconoce acordes
  rasgueados. Olvida la octava, así que duda con las inversiones.
- **La autocorrelación** (`audio/autocorrelation.ts`) lee **una** nota a la vez.
  Es el mismo motor del afinador y es el fiable.

**[C]** Antes apuntaban los dos a la vez, así que un punteo entraba con acordes
inventados encima. Hoy **la toma declara qué es** —rítmica o punteo— y solo corre
el motor que toca.

**[D] Y eso hay que quitarlo: tiene que transcribirse solo.** Grabas, la aplicación
decide si lo que oyó son notas o acordes, y tú corriges lo que haya entendido mal.

**[C]** Y hay un límite que no se arregla afinando umbrales: después del descuento
de armónicos, **una nota sola tiene casi la misma forma que su acorde mayor**. Un
Do pulsado y un Do rasgueado no se distinguen.

### La contradicción, y cómo creo que se sale de ella

Hay que decirlo claro: **[adr/0048](docs/adr/0048-una-toma-dice-lo-que-es.md) decide
lo contrario de lo que acabas de pedir**, lo escribí yo hace dos días, y la razón
que da está medida y sigue siendo verdad:

> Después del descuento de armónicos, **una nota sola tiene casi la misma forma que
> su acorde mayor**. Un Do pulsado y un Do rasgueado no se distinguen con lo que hay.

Eso no lo cambia una decisión. Lo que sí cambia tu decisión es **el problema**:
yo estaba intentando _acertar siempre_, y tú no has pedido eso. Has pedido que
transcriba solo **y que se pueda corregir**. Con eso, fallar deja de ser
inaceptable y pasa a ser normal, que es lo que va a ser de todas formas.

Así que lo que en el documento anterior era una suposición mía pasa a ser la mitad
del trabajo: **corregir tiene que costar un gesto.** Cambiar un acorde por una nota
y al revés, en la partitura, sin ir a otra pantalla.

**[S]** El orden que propongo, y aquí es donde más me puedes corregir otra vez:

1. **Corregir bien primero.** Mientras corregir sea incómodo, una transcripción
   automática que falla es peor que un selector que acierta.
2. **Después la detección**, que es contar cuántas notas suenan a la vez y no
   afinar umbrales: es lo único que de verdad separa un punteo de un rasgueo.
   Pide calibrar con grabaciones de tu guitarra, que es lo que
   [adr/0043](docs/adr/0043-dos-maneras-de-equivocarse.md) ya dejó anotado como
   pendiente.
3. **Y el selector se cae solo** cuando la detección acierte. Quitarlo antes
   devuelve los acordes inventados encima del punteo, que es el fallo que 0048 vino
   a cerrar: sería cambiar un gesto molesto por una parte que hay que limpiar a
   mano.

**[?]** Dos cosas que sigo sin saber y que cambian el punto 2:

- **¿Con qué grabas?** Micro del portátil con acústica delante, o eléctrica por
  interfaz. Mis medidas están hechas con WAV sintéticos, y con una guitarra real el
  croma falla más. Sin saber esto no puedo calibrar contra lo que vas a usar.
- **¿Cuánto grabas de una vez?** Cuatro compases o una canción entera. Lo he
  supuesto corto.

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

### Ronda 1 — contestado

1. **[D] Grabar con la guitarra es la puerta de entrada**, y se transcribe solo.
   Acerté en la puerta y me equivoqué en el gesto: sobra declarar qué estás
   tocando.
2. **[D] Se monta en muchas sesiones.** Guardar solo sube a lo urgente.
3. **[D] Se vive en un espacio**, y los componentes lo hacen servir para varias
   cosas.
4. **[D] El orden de la partitura es el que propuse**, con MusicXML al final y no
   al principio.

### Ronda 2 — lo que sigue abierto

1. **[?] Que las salidas son «tres opciones para elegir» y no «escríbeme la
   canción».** Decide si el modelo local sirve o si hay que asumir que esto se
   paga.
2. **[?] Que aprender es el andamio y componer el corazón.** Si es al revés, mis
   prioridades están invertidas.
3. **[?] Con qué grabas y cuánto de una vez.** Sin eso no puedo calibrar la
   detección automática contra lo que vas a usar de verdad.
4. **[?] Si «input de sonido» en las salidas era subir el audio**, que es el
   apartado 10 y cambia la promesa de privacidad.

---

## 10. Lo que creo que no debería hacer, y quiero confirmarlo

**[C]** Estas son reglas escritas en el proyecto, y las he respetado:

- **No subir audio.** Ni para mejorar el reconocimiento, ni para que la IA
  «escuche» la canción. Solo símbolos.
- **No añadir vidas ni bloqueos** por fallar.
- **No examinar a nadie** para colocarle de nivel.
- **No cobrar** todavía.

**[D] Y la primera cae: quieres subir el audio de verdad.**

Lo hago, pero te lo digo una vez y sigo: **esto no es una función más, cambia lo
que la aplicación promete.** Hoy hay escrito, en `CLAUDE.md` y en la regla 4 de las
capas, que el audio no sale del dispositivo, y la pantalla de registro lo dice con
estas palabras: «Nada de audio». Eso pasa a ser mentira el día que se suba, y una
documentación que miente es peor que no tenerla.

Lo que hace falta antes de escribir una línea, y no es opcional:

- **Un ADR** que lo decida, con lo descartado. La regla dice que no se hace sin
  uno, y este es exactamente el caso para el que se escribió esa regla.
- **Decir en pantalla qué se sube, a dónde va y cuánto se guarda**, y cambiar el
  texto del registro. Si el audio va a la API de Anthropic, quien lo graba tiene
  que saber que sale de su equipo y llega a un tercero.
- **Decidir la retención**: si se guarda, dónde y cuánto, o si se manda y se
  descarta. Esto hay que contestarlo antes, no después.
- **Y que siga funcionando sin subirlo.** Todo el reconocimiento de hoy vive en el
  navegador y es lo que hace que la aplicación funcione sin cuenta; subir audio
  tiene que ser algo que se añade, no algo de lo que dependa componer.

Lo que **no** cambia: lo que vuelva del modelo se sigue validando contra el
dominio. Que oiga la grabación no le da permiso para escribir un grado que no
existe.
