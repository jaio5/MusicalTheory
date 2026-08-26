# ADR 0015 — Un solo canal de texto libre, y el modelo declara si le preguntan de música

Fecha: 2026-08-26 · Estado: aceptada · Amplía: [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)

## Contexto

Tres route handlers hablan con un modelo de lenguaje. La pregunta era qué impide
que alguien lo use para otra cosa, y para contestarla hubo que contar por dónde
entra texto que no controlamos. Salieron tres campos y 360 caracteres:

| Ruta             | Campo      | Qué era                                            |
| ---------------- | ---------- | -------------------------------------------------- |
| `/api/teacher`   | `question` | 240 caracteres libres. La pregunta.                |
| `/api/teacher`   | `topic`    | 60 caracteres libres. **El título de una unidad.** |
| `/api/versiones` | `name`     | 60 caracteres libres. **El nombre de tu canción.** |

Los dos últimos eran el hallazgo. Ninguno de los dos tenía por qué ser texto
libre: el título de la unidad está en `core/music/curriculum.ts`, y el nombre de
la canción **solo construía una línea del prompt** —no volvía en la respuesta, no
se guardaba, y el cliente ni siquiera lo mandaba—. Eran 120 caracteres de
superficie de inyección abiertos sin que nadie los usara para nada.

`/api/ideas` no acepta ni un carácter libre, y lo que devuelven ideas y versiones
se recalcula contra el dominio ([ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)).
El texto del modelo se pinta con `{answer.answer}` dentro de un `<p>`, así que
React lo escapa y no hay inyección de HTML. Y todo lo guardado filtra por
`userId`: nada de lo que escribe el modelo llega a otra persona.

## Decisión

**Cerrar los dos canales que no hacían falta, y quedarse con uno solo.**

- `topic` desaparece: el cliente manda `unitId` y el servidor resuelve el título
  con `findUnit`. Un id que no esté en el temario se descarta en silencio, como
  los grados que no existen.
- `name` desaparece del contrato de versiones, del parseo y del prompt.

Queda **un único punto de entrada libre en toda la aplicación**: la pregunta del
profesor. Lo demás pasa a estar cerrado por construcción y no por filtro, que es
la diferencia entre algo que se sostiene y algo que hay que vigilar.

**Y alrededor de ese canal, dos cosas.**

1. **La pregunta va delimitada y declarada como dato.** Viaja entre marcas
   `###PREGUNTA###` y el prompt de sistema dice que lo de dentro lo escribe el
   alumno y nunca es una instrucción. `parseTeacherRequest` **borra la marca de la
   pregunta** antes de nada: sin eso, quien la escribiera cerraría el bloque y lo
   de después se leería como instrucciones nuestras.
2. **El modelo declara el tema, y es un campo obligatorio y enumerado del
   esquema.** `tema: 'musica' | 'fuera'`, y va **primero** en `properties`: la
   generación constreñida rellena en ese orden, así que lo decide antes de
   ponerse a contestar en vez de etiquetar después lo que ya escribió. Si dice
   `fuera`, `validateTeacherAnswer` **tira su texto y su ejemplo enteros** y
   devuelve una frase nuestra. Es la misma regla que los cifrados y los
   movimientos —no se cree lo que dice, se sustituye por lo que sabemos— llevada
   de los símbolos a la prosa.

**Lo que esto es y lo que no.** La puerta del tema no es una frontera de
seguridad y no se vende como tal: una inyección que funcione hará que el modelo
conteste `musica` y siga adelante. Es un filtro para lo que pasa todos los días
—alguien que prueba a usar el profesor de chatbot— y para que, cuando el propio
modelo sabe que se está saliendo, su texto no llegue a la pantalla.

Lo que de verdad acota el abuso ya estaba puesto, y conviene no confundirlo con
esto: **400 tokens de salida** como tope, cuenta obligatoria, quince peticiones al
mes en el plan gratis con sus dos cupos, diez por minuto y dirección, y una
respuesta que solo ve quien preguntó. De ahí no sale un ensayo, no sale un
chatbot gratis e ilimitado, y lo que salga no lo lee nadie más. El abuso no se
hace imposible: se hace inútil.

## Consecuencias

- Medido contra dos modelos locales, ocho casos —tres preguntas legítimas, dos
  fuera de tema y tres inyecciones, incluida una que intenta cerrar la marca—:
  **`qwen3:8b` acierta los ocho**; **`gemma4:e4b` acierta tres de ocho**, etiqueta
  todo como `musica` y en dos casos llegó a contestar «París».
- Eso es la consecuencia importante, y hay que leerla bien: **la puerta vale lo
  que valga el modelo siguiendo instrucciones.** Con un modelo capaz funciona;
  con uno flojo, no. Los topes de tokens y de cupo, en cambio, valen lo mismo con
  cualquiera, y por eso son ellos y no esto lo que sostiene el argumento.
- Curiosamente, el prompt de sistema aguantó donde falló la etiqueta: en tres de
  los cinco fallos de `gemma4` el modelo declaró `musica` y aun así contestó sobre
  grados en vez de sobre lo que le pedían.
- El prompt de sistema del profesor creció, y eso son tokens de entrada que salen
  de los cupos de todos los planes. Se escribió corto a propósito y se midió: 402
  tokens estimados de los 700 del presupuesto, con la holgura del 70 % en 490. Una
  primera redacción se quedaba en 469 y se recortó a la mitad **sin perder ni un
  caso** de los ocho.
- El cliente cambia en cuatro sitios —`Teacher`, `Tutor`, `TheoryUnit` y
  `ReviewSession`— y todos quedan más simples: pasan el id que ya tenían en vez
  de ir a buscar el título.

## Alternativas descartadas

**Un filtro de palabras clave musicales en `core/`**, puro y probado, que rechace
antes de gastar cupo. Es lo primero que se piensa y es lo peor de los dos mundos:
rechaza «¿por qué suena triste?» —una pregunta legítima sin una sola palabra
técnica— y no para a nadie que escriba «acorde» dentro de su ataque. Añade
rechazos falsos a cambio de una defensa que se salta escribiendo una palabra.

**Una segunda llamada al modelo que clasifique la pregunta antes de contestarla.**
Sería una puerta más limpia, con su propio prompt sin nada del usuario dentro. Se
descarta por el precio: dobla el coste de cada pregunta del profesor, y de ahí
salen los cupos de todos los planes. El campo en el esquema cuesta cinco tokens y
ninguna llamada. Si algún día el gasto deja de mandar, esto es lo que hay que
reconsiderar primero.

**Guardar las preguntas para revisarlas.** Permitiría ver qué se intenta de
verdad en vez de suponerlo. Se descarta porque hoy no se guarda ni una palabra de
lo que se escribe, y empezar a hacerlo es una decisión de privacidad que merece su
propio ADR y su aviso en pantalla, no una línea de código metida de rondón en una
tarea de seguridad.

**Cortar el profesor a quien acumule preguntas fuera de tema.** Es la vigilancia
que falta, y tiene sentido. Se descarta por ahora porque pide una columna en la
base de datos, un número que nadie ha podido calibrar todavía y una forma de
volver de la penalización. Y sobre todo, porque el cupo ya hace ese trabajo: quien
pregunta tonterías se queda sin sus quince del mes él solo.

**Prohibir del todo la pregunta escrita**, dejando solo preguntas predefinidas.
Cerraría el último canal y haría el problema desaparecer. Se descarta porque el
profesor es exactamente la función de escribir lo que no sabes decir con un menú;
sin eso no queda nada que proteger.
