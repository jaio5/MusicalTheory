# ADR 0033 — El copiloto propone y nunca escribe

Fecha: 2026-09-17 · Estado: aceptada · Amplía: [ADR 0016](./0016-salidas-en-vez-de-versiones.md)

## Contexto

Las ideas de la IA viven hoy en una pestaña de la barra de abajo, entre «Salidas»
y «Sesiones». El copiloto más caro del producto —cada pulsación son varias
progresiones razonadas, y de la longitud de esos prompts salen los cupos de todos
los planes ([ADR 0008](./0008-los-cupos-salen-del-precio.md))— está detrás de un
botón gris, en una lista donde nada dice que sea distinto de las sesiones
guardadas.

Cuando por fin se abre, tapa la mitad de la pantalla, así que **no ves la canción
sobre la que estás pidiendo ideas**. Y con el arreglo de [ADR 0032](./0032-la-progresion-y-el-montaje-son-lo-mismo.md)
hay por primera vez un sitio evidente donde una propuesta encaja: al final de lo
que llevas escrito.

Eso abre la pregunta que este documento contesta: **si lo que propone el modelo
entra solo o hay que aceptarlo.** Es una pregunta de producto, no de
implementación, y tiene respuestas defendibles en los dos lados.

## Decisión

**El copiloto vive en línea, al final del arreglo, y lo que propone entra como
bloques fantasma que hay que aceptar.** Punteados, sin el punto de color de
seguridad, con `Tab` para aceptar —de uno en uno o todos— y `Esc` para
descartar.

**Nada entra en el arreglo sin que lo acepte una persona.** Ni al pedirlo, ni al
aceptar una parte, ni «porque estaba vacío».

La razón es lo que esta aplicación dice ser. Aquí se viene a **componer**, y una
herramienta que modifica tu canción por su cuenta convierte el trabajo en algo
que hay que revisar en vez de algo que es tuyo. La diferencia entre las dos cosas
no se ve en un uso y se ve en diez: con el copiloto escribiendo, dejas de
reconocer qué partes decidiste tú.

Cuatro reglas que van con ella:

- **El cupo restante se ve antes de gastarlo**, en la barra superior. Quien paga
  tiene derecho a saber cuánto le queda sin entrar en su cuenta, y a quien le
  quedan dos peticiones le cambia lo que pide.
- **Los cinco estados de error son parte del diseño**, no un `catch` con un
  aviso: sin cuenta, plan insuficiente, cupo del día, cupo del mes y modelo
  caído se ven distintos y dicen qué hacer. El enlace a `/planes` sale cuando
  toca, con la regla que ya está escrita una vez en `ui/PlansLink.tsx`.
- **Los cifrados del modelo no se creen: se recalculan desde los grados** contra
  la tonalidad activa. Ya es así y no se deshace.
- **A la IA no se le pregunta lo que el dominio calcula gratis.** Los siete
  acordes de una tonalidad salen de `core/music/progressions.ts` y no se pagan.

## Alternativas descartadas

**Que la propuesta entre sola y se pueda deshacer.** Es lo que hacen los
asistentes de código, y ahí funciona porque el resultado se lee de un vistazo y
el deshacer es instantáneo. Aquí no: una progresión se evalúa **oyéndola**, que
lleva ocho segundos, y para entonces ya no sabes si lo que suena lo pusiste tú.
Deshacer arregla el estado, no la sensación de que la canción se te ha movido
sola.

**Un panel aparte con las propuestas, como hoy, pero mejor colocado.** Mantiene
la separación entre «lo que propone» y «donde va», y esa separación es justo el
trabajo que el copiloto debería ahorrarte: leer cuatro acordes en una lista y
buscarles sitio a mano. En línea, la propuesta ya está en su sitio y solo falta
decir que sí.

**Preguntar con un diálogo de confirmación.** Un modal por cada propuesta es una
interrupción por cada idea, y este producto no mete modales. El fantasma **es**
la confirmación: se ve dónde va, se oye antes de aceptarlo y se descarta sin
pulsar nada.

**Dejar que el copiloto reescriba lo ya escrito** —rearmonizar en el sitio—. Es
tentador porque `paths.ts` ya sabe hacerlo, pero es la forma más directa de
romper la regla de arriba, y además es la salida que peor se le da a todos los
modelos según `docs/ROADMAP.md`. Si algún día se hace, se hará proponiendo una
parte nueva al lado, no pisando la que hay.

## Por dónde va

**Hecho: propone y no escribe.** Lo propuesto vive en `state/propuesta.ts` —no en
`core/music/arrangement.ts`, que es la parte de la decisión que más se nota: si
viviera en el montaje sonaría al pulsar «Escuchar la canción», entraría en el
guion del ensayo y se guardaría con la canción—. Sale punteado al final de la
última parte, en su propia tira y no dentro de la de acordes, así que se ve
también en la vista de partitura y se lee sin dudar dónde acaba tu canción.
Pulsar un fantasma acepta hasta ahí, `Tab` acepta todo, `Mayús+Tab` uno y `Esc`
descarta; aceptar de golpe es **un** paso de deshacer. Y el cupo está en la barra
de arriba (`ui/CupoDeIA.tsx`), solo con cuenta, porque sin ella el servidor cuenta
por dirección y no hay número que prometer.

**Falta: pedirlo desde el lienzo.** Hoy la propuesta se pide desde el panel de
ideas del área de abajo, que hay que abrir, y la gracia del copiloto es no tener
que ir a buscarlo.

## Consecuencias

- El arreglo gana un estado que **no es parte de la canción**: los bloques
  fantasma. Viven en `state/`, no en `core/music/arrangement.ts`, porque una
  propuesta sin aceptar no es música todavía.
- El cupo sube a la barra superior y deja de estar solo dentro de los paneles que
  lo gastan.
- A la IA siguen viajando símbolos —tonalidad, escala, notas recientes, grado
  actual y ahora los grados del arreglo—. Ni una muestra de audio. La regla 4 de
  las capas no se negocia.
- Si hiciera falta un cuarto `kind`, manda el contrato: se tocan
  `features/ideas/contract.ts`, `server/prompts.ts`, su test de longitud,
  `docs/AI.md` y el cálculo de cupos. No hay vía rápida.
