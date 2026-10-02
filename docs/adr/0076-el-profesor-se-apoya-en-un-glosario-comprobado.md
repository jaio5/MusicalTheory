# ADR 0076 — El profesor se apoya en un glosario comprobado

> **Ampliado y corregido el 2 de octubre de 2026** (sección «Corrección», al final): el lector de respuestas **sí lee nombres en castellano** en ciertos sitios, y un paréntesis tras un acorde es un aparte con su propia progresión.

Fecha: 2026-10-02 · Estado: aceptada · Se apoya en:
[ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md), que verifica las
salidas contra el dominio, y [ADR 0015](./0015-un-solo-canal-de-texto-libre.md), que
fija el canal de la pregunta · Respeta el presupuesto de
[ADR 0008](./0008-los-cupos-salen-del-precio.md) y
[ADR 0067](./0067-el-cupo-se-cuenta-en-preguntas.md)

## Contexto

Con el modelo de casa —`qwen3:8b` en Ollama—, a «¿qué es una cadencia perfecta?» en
Do mayor el profesor contestó, en dos intentos:

- «el movimiento de I a V a I. En C mayor, es C a G a C»;
- «es el IV-V en la tonalidad. En C mayor, es F-C».

Las dos están mal: la perfecta es V → I, G → C. Y las dos llegaban a la pantalla,
porque de la prosa del profesor la ruta solo miraba que no estuviera vacía.

La causa estaba en el prompt: llevaba la tonalidad y los símbolos de grado válidos,
y nada más. **Ni los acordes de la tonalidad ni una sola definición**: el modelo lo
sacaba todo de memoria. Y una tercera, que salió al medir: el cliente manda la
tónica con sostenidos, así que Si bemol mayor viajaba como «A# mayor», y el modelo
contestó que su dominante era «E#».

Para saber cuánto fallaba se escribió un examen, `scripts/examen-del-profesor.ts`:
28 preguntas de guitarrista en nueve tonalidades, mayores y menores, cada una con
lo que tiene que decir y lo que no puede decir. Va por el mismo camino que la ruta
—el mismo prompt, el mismo esquema, el mismo validador y el mismo reintento— contra
`OLLAMA_URL`. **Antes de este cambio, 12 de 28** con el banco definitivo —entre 9
y 12 en cuatro pasadas, porque el banco se fue afinando y el modelo no contesta
siempre igual—. Fallaban la perfecta en las tres tonalidades en que se preguntó, la
plagal en Re menor («i - VII - VI - i»), la deceptiva en Mi menor, la relativa de La
mayor («c menor»), la dominante de Si bemol («E#»), la séptima de dominante en La
menor, el ii–V–I («do–sol–do»), el mixolidio, el lidio («quinta aumentada»), los
siete modos, la tercera mayor («tres semitonos»), la armónica («un VII bemol»), el
prestado y la dominante secundaria.

## Decisión

**Un glosario de teoría en el dominio, `core/music/glossary.ts`, que se le da al
profesor y con el que se comprueba lo que contesta.**

- **Medio centenar de entradas** de lo que pregunta un guitarrista: cadencias,
  funciones y sustitución, tríadas y cuatríadas, sus y quintas, intervalos, escalas,
  los siete modos, relativa, armadura, círculo, sensible, ii–V–I, dominantes
  secundarias, prestados, modulación, blues de doce y lo justo de ritmo. Cada una
  con sus nombres sin tildes, una definición breve y lo que depende de la tonalidad.
- **Lo que depende de la tonalidad no está escrito: se calcula.** Las cadencias van
  en grados y las resuelve `resolveDegree`; la armadura sale de `keySignature`, la
  relativa del círculo, la sustitución de `substitutionOfDegree`, los intervalos de
  `CHORD_SHAPES` y el carácter de los modos de `SCALES`. Así el dato no puede mentir
  en ninguna de las veinticuatro, y un test lo comprueba en todas.
- **La tabla de la tonalidad va siempre**: los acordes diatónicos agrupados por papel,
  y en menor también el V mayor de la armónica.
- **Se eligen una o dos entradas por las palabras de la pregunta**, normalizada. Gana
  la frase más larga y lo que cubre no cuenta para otra; sin ninguna que case no se
  añade nada. Van bajo «Teoría de referencia, comprobada: úsala y no la contradigas»,
  y el prompt de sistema dice en una frase que eso manda sobre lo que recuerde.
- **Lo que contesta se comprueba.** Las cadencias y la relativa tienen una firma que
  se lee en un texto. Si la pregunta las nombra —o la respuesta—, la respuesta tiene
  que escribir su progresión y no otra que la contenga dando la vuelta, ni la de
  otra cadencia sin nombrarla. Lo que no pasa lo devuelve `validateTeacherAnswer`
  como nulo y la ruta reintenta con otra temperatura.
- **La tonalidad se escribe con `keyName`** en la cabecera de los dos prompts.
- **Sin clave, contesta el glosario**: si la pregunta casa, `respuestaSinIA` devuelve
  su entrada resuelta, marcada «Sin IA», y pasa el mismo validador.

## Consecuencias

**Después del cambio, 26 de 28**, con el mismo examen y el mismo modelo. Las dos
pasadas se hicieron contra el Ollama del equipo, con el mismo `qwen3:8b` que trae el
de Docker: desde WSL, el contenedor no contestaba en el 11435. Quedan dos:
«¿por qué suena tan bien un ii–V–I?» contesta sin un solo acorde y dice que el bajo
sube una quinta del ii al V —la referencia dice que cae—, y «¿qué diferencia hay entre
los siete modos?» contesta una vaguedad sin nombrar ninguno. Ninguno de los dos tiene
firma, así que el validador no los ve.

Hubo una medida intermedia de 21 de 28 con **un falso rechazo**: «en C mayor, el G se
va al Am» es una cadencia rota bien dicha, y el lector no conocía «se» como palabra
entre dos acordes. La ruta la tiró dos veces y habría contestado «no ha venido bien
formada». Por eso las respuestas buenas con las que se prueba el validador son las
que escribió el modelo, copiadas tal cual en `glossary.test.ts`.

**El presupuesto de tokens no se sube y los cupos no cambian.** El peor caso real lo
construye `server/prompts.test.ts` pieza a pieza: la tabla y la cabecera de la
tonalidad más larga de las veinticuatro, la escala de nombre más largo, la unidad de
título más largo, las dos entradas más largas en su peor tonalidad y la pregunta
hasta su tope. Da 692 tokens de 700. Para caber, el prompt de sistema se apretó de
1.077 a 862 caracteres sin quitarle ninguna instrucción, y cada entrada tiene un tope
de 180 caracteres que el test exige en las veinticuatro tonalidades.

Lo que no aguanta:

- **El validador lee acordes y grados escritos, no entiende la frase.** Acepta de menos
  antes que rechazar de más: una pregunta por otra tonalidad no se comprueba, y lo que
  no tiene firma —casi todo— pasa sin mirarse. En el examen de después pasan respuestas
  con errores pequeños fuera de las firmas: «la menor natural tiene la séptima justa»,
  o una relativa bien dicha seguida de unos grados inventados.
- **Las notas de Fa sostenido mayor y vecinas** salen con los doce nombres del dominio:
  el vii° de F# es «Fdim = F Ab Cb» y no «E#dim». El glosario escribe por letras, pero
  parte de la fundamental que le da el cifrado.
- **Con nombres en castellano** —«de Sol a Do»— el lector no ve acordes: la aplicación
  escribe en cifrado anglosajón y el prompt también, pero si el modelo cambia, el
  validador rechazaría una cadencia bien dicha.
- **Es un 8B en local.** Contra la API no se ha pasado el examen.

## Alternativas descartadas

**Un RAG con documentos externos**: indexar apuntes o un manual y recuperar
fragmentos. Mete texto que nadie ha comprobado, y que no está en la tonalidad de quien
pregunta: un manual explica la cadencia perfecta en Do mayor, que es justo lo que el
prompt pide no hacer. Y añade una base vectorial y un índice que mantener para
cincuenta conceptos que caben en un fichero.

**Pasarle un libro entero en el prompt.** Son miles de tokens por pregunta, y de esa
longitud salen los cupos de todos los planes: multiplicaría el coste de cada pregunta
y dividiría el cupo de cada plan, para que el modelo busque en un texto lo que el
dominio ya sabe calcular.

**Cambiar de modelo.** Con la API el profesor acertará más, pero el modelo de casa es el
que se usa para probar sin factura, y un modelo mejor no hace que lo que dice esté
comprobado: solo hace que falle menos a menudo. Esto vale para los dos.

**Validar con un segundo modelo** que juzgue si la respuesta es correcta. Es una
segunda llamada por pregunta —el doble de coste en la cuenta del cupo— y un juez que
también puede equivocarse. Contra el dominio la comprobación es determinista y gratis.

**Subir el presupuesto de tokens.** Era la salida si no cabía, y cabe apretando el
prompt de sistema y las entradas. Subirlo habría bajado los cupos de todos los planes.

**Tablas escritas a mano por tonalidad.** Veinticuatro copias de cada dato son
veinticuatro sitios donde equivocarse. El dominio ya resuelve grados en acordes, y es
lo que usa el resto de la aplicación: si el glosario dijera otra cosa, la pantalla y
el profesor se contradirían.

## Corrección del 2 de octubre de 2026

La viñeta de «lo que no aguanta» que dice que con nombres en castellano el lector no
ve acordes **ya no es cierta**. Después de la auditoría, `validateTeacherAnswer` lee:

- **Una nota en castellano es acorde solo donde va un acorde y no una palabra.**
  «la» es un artículo y «si» una conjunción, y los dos van delante de acordes. Cuenta
  junto a una flecha —«sol → do»—, en «de X a Y» o con mayúscula **fuera del principio
  de frase**; al empezar la frase, «La» y «Si» siguen siendo palabras. En la
  afirmación de la relativa, solo con «mayor» o «menor» detrás.
- **Un paréntesis justo detrás de un acorde es un aparte**, con su propia progresión:
  «V → I (G → C)» es la cadencia dicha dos veces, no cuatro acordes seguidos. Antes
  solo se saltaba una etiqueta de un único grado o acorde, y la ruta rechazaba una
  respuesta buena.
- **«en» entre un grado y un acorde es la tonalidad**, no un paso: «V → I en C» es la
  cadencia en Do. Con un verbo —«el V resuelve en C»— sí es un paso.

Descartado: saltar solo las etiquetas del otro tipo, que deja fuera los apartes con
progresión, y cortar la cadena siempre en el paréntesis, que parte una progresión que
sigue detrás de él. Sigue valiendo todo lo demás de «lo que no aguanta»: acepta de
menos antes que rechazar de más.
