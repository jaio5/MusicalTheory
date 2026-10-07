# Validar: si esto le sirve a alguien más

Hoy la usa una persona. Esto es la hoja de trabajo para saber, **en ocho semanas**,
si la usaría alguien más y si pagaría, antes de seguir construyendo. No es código y
no lo puede hacer un agente. Lo que se mide con la guitarra está en
[MEDIR.md](./MEDIR.md); lo que hará falta para cobrar, en
[PARA-PUBLICAR.md](./PARA-PUBLICAR.md).

## El público de entrada

**El adulto hispanohablante que ya toca y quiere entender y escribir sus
canciones.** Sabe unos cuantos acordes abiertos, toca canciones de otros, se le
ocurren cosas suyas y no sabe por qué funcionan ni cómo seguirlas.

No es, de momento: el que empieza de cero, el niño, el profesional, el estudiante
de conservatorio que ya tiene clase de armonía. Si las sesiones dicen que el que
engancha es otro, se cambia de público; no se amplía.

## 10 sesiones observadas con guitarristas ajenos

Gente del público de entrada que **no conozca el proyecto**: ni amigos que
quieran agradar, ni músicos de la familia. Se busca en escuelas de música, foros,
grupos de guitarra y locales de ensayo. 45 minutos, con su guitarra, en su
ordenador o su móvil. Se graba la pantalla y la voz **solo con su permiso por
escrito**.

### Guion

1. **Antes (5 min).** Qué toca, desde cuándo, si compone, qué usa hoy para
   aprender (YouTube, tablaturas, un profesor). Nada de enseñar la aplicación.
2. **Tareas (30 min).** Se le da la tarea en una frase y se calla uno. Si pregunta,
   «¿qué harías tú?». **No se ayuda** salvo que lleve tres minutos atascado, y eso
   se apunta como fallo de la tarea.
3. **Después (10 min).** Qué fue lo más útil, qué sobraba, qué esperaba encontrar y
   no estaba, **si volvería mañana y para qué**, y cuánto pagaría al mes (sin
   sugerir cifra).

### Las tareas

| #   | Tarea, como se le dice                                   | Hecha si…                                   |
| --- | -------------------------------------------------------- | ------------------------------------------- |
| 1   | «Entra y haz lo que te apetezca cinco minutos.»          | Sin tarea: se mira adónde va solo           |
| 2   | «Afina la guitarra con esto.»                            | Afina las seis cuerdas                      |
| 3   | «Toca algo tuyo y consigue que quede escrito.»           | Hay una parte con sus acordes en el lienzo  |
| 4   | «Si algo está mal escrito, corrígelo.»                   | Corrige al menos un bloque                  |
| 5   | «Pídele ideas para seguir tu canción y quédate con una.» | Aplica una salida                           |
| 6   | «Busca por qué esa idea funciona.»                       | Llega al porqué, al profesor o a una unidad |
| 7   | «Guarda la canción para seguir otro día.»                | Guardada (con o sin cuenta)                 |

### Qué se observa, en la hoja de cada sesión

- **Dónde duda**: cada vez que para más de diez segundos, en qué pantalla y qué
  buscaba. Es lo más valioso de la sesión.
- **Qué lee y qué no**: si lee los textos o los salta; qué palabra no entiende.
- **El micro**: si escribió lo que tocó; cuántos «?» salieron y si los entendió;
  si se fió de algo que estaba mal.
- **Las salidas**: si las escuchó, si entendió el porqué, si se quedó con alguna
  **porque le gustó** y no por acabar la tarea.
- **Frases literales**, entre comillas, sobre todo las de sorpresa y las de
  enfado.
- Tareas hechas sin ayuda, de 7.

**Lo que dice no cuenta tanto como lo que hace.** «Está muy bien» no es dato; «¿lo
puedo usar con mi grupo?» sí.

## 10 entrevistas con profesores de escuelas de música

30 minutos, con la aplicación delante solo al final. Escuelas privadas y
municipales, de guitarra moderna sobre todo; alguno de conservatorio para
contrastar.

1. ¿Qué alumnos adultos tienes y qué buscan cuando llegan?
2. ¿Cuántos quieren componer o entender lo que tocan, y qué haces con ellos hoy?
3. ¿Qué les mandas para casa, y qué hacen de verdad?
4. ¿Qué herramientas usan tus alumnos sin que se lo digas? ¿Cuáles recomiendas?
5. ¿Qué es lo que más te cuesta explicar de armonía?
6. _(Enseñando la aplicación diez minutos.)_ ¿Qué está mal o explicado de otra
   manera de como lo explicas tú?
7. **¿Se lo mandarías como deberes? ¿A quién, y para qué parte?**
8. ¿Qué tendría que tener para que lo usaras en clase?
9. **¿Tu centro pagaría por esto? ¿Quién lo decide y con qué presupuesto?** Si no
   el centro, ¿el alumno?
10. ¿A quién más debería enseñárselo?

Lo que se busca: si hay **un uso de deberes** concreto, y si el que paga es el
centro, el profesor o el alumno. Una respuesta «sí, mándamelo» se cierra en el
momento con una fecha para probarlo con dos alumnos.

## Métricas y umbrales

Durante las ocho semanas, con la aplicación publicada para el público de entrada.
La retención la cuenta la analítica propia, sin cookies ni servicios de fuera
([adr/0110](./adr/0110-contar-sin-seguir.md)); solo ve a quien ha entrado con
cuenta o ha dicho que sí, y eso se dice al leer la cifra.

| Métrica                                           | Umbral               |
| ------------------------------------------------- | -------------------- |
| Registros (cuentas creadas)                       | **200**              |
| Retención a 7 días (vuelve entre el día 7 y 13)   | **≥ 20 %**           |
| Retención a 30 días (vuelve entre el día 30 y 36) | **≥ 8 %**            |
| Personas que vuelven **solas** cada semana        | **3**, sin avisarles |
| Personas que pagan o reservan plaza de pago       | **10**               |

- **«Solas»** quiere decir sin correo, mensaje ni recordatorio de quien la hace.
  Se apunta a mano quién era cada una y si se le había escrito.
- **Pagar o reservar** es dar la tarjeta o un correo con «avísame cuando se pueda
  pagar, a X € al mes». Un «pagaría» en una entrevista no cuenta.
- Las cohortes de 7 y 30 días se miran **semana a semana**, no al final: si a la
  cuarta semana la de 7 días está por debajo del 10 %, se para a mirar por qué antes
  de seguir captando.

## El criterio de parada, a las 8 semanas

Se decide con la tabla en la mano, el mismo día, y se escribe como ADR.

- **Seguir**: se cumplen los cinco umbrales, o cuatro y el que falla es el de
  registros (es un problema de canal, no de producto).
- **Cambiar de público o de forma**: retención por debajo, pero las sesiones o los
  profesores señalan un uso concreto que sí engancha —deberes de una escuela, un
  grupo que compone junto—. Ocho semanas más, solo con ese uso.
- **Parar**: retención a 7 días por debajo del 10 % **y** nadie que vuelva solo
  **y** menos de 3 que paguen o reserven. Se deja como herramienta propia, que
  ya lo es, y no se construye más para otros.

Lo que **no** cambia la decisión: que guste a quien la hace, que la técnica esté
bien, ni que falte una función. Si a la semana ocho la respuesta es «falta tal cosa
y entonces sí», eso es parar con otras palabras.
