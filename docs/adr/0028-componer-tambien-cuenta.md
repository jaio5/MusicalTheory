# ADR 0028 — Componer también cuenta, y las partes dicen qué son

Fecha: 2026-09-13 · Estado: aceptada

## Contexto

Esta aplicación tiene dos mitades. Una enseña —el camino, las unidades, el
repaso— y tiene todo lo que hace que alguien vuelva mañana: XP, meta diaria,
racha, diez medallas. La otra deja componer —la rueda, el lienzo, las salidas de
la IA— y **no tenía nada de eso**.

El efecto era el que se lee en el [ROADMAP](../ROADMAP.md): «lo que compones no
cuenta como avance». Se podía pasar una tarde entera montando una canción con
ayuda del modelo y el marcador seguía en cero, la racha se rompía y la meta del
día quedaba sin cerrar. La aplicación decía, sin querer, que componer es el rato
de después y estudiar es lo que cuenta de verdad. Es justo al revés de lo que
promete la portada.

Y había un segundo hueco, más callado. Una parte del lienzo solo tenía **nombre**,
y el nombre es texto libre: «Parte 2», «lo del puente», «asdf». Sirve para
encontrarla en una lista y no sirve para lo único que de verdad importa, que es
**que el modelo sepa qué le estás pidiendo**. Continuar una estrofa y continuar un
estribillo no son la misma petición —una tiene que poder repetirse con otra letra,
el otro tiene que levantar y cerrar— y con «Parte 2» delante el modelo solo puede
adivinar. Adivinaba siempre lo mismo.

Los dos huecos son el mismo hueco visto desde dos sitios: **no había ningún
momento en el que componer fuera una decisión registrada.**

## Decisión

### Cuatro hechos, y un tope

Componer suma a la meta del día y mantiene la racha, exactamente igual que
repasar. Lo que cuenta son cuatro momentos, y los cuatro son **decisiones**, no
estados:

| Hecho     | Qué es                                     | XP  |
| --------- | ------------------------------------------ | --- |
| `parte`   | Le dices a una parte qué papel hace        | 10  |
| `cancion` | Guardas una canción                        | 15  |
| `salida`  | Te quedas con una de las que propuso la IA | 10  |
| `oido`    | Metes un acorde que oyó el micro           | 5   |

**No suman al XP del temario**, y eso no se puede negociar: `mergeProgress` y
`parseProgress` recalculan el total desde las unidades hechas, así que cualquier
punto sumado ahí desaparecería en cuanto alguien entrase en su cuenta desde otro
aparato. Es el mismo trato que ya tenía el repaso, y por la misma razón: el
temario mide el temario.

**Y hay un tope diario, igual a la meta del día entera.** Las dos mitades de esa
frase son la decisión. Que sea la meta entera dice que **una tarde componiendo
vale tanto como una tarde de unidades**; que haya tope es lo que separa «he
compuesto» de «he pulsado guardar cincuenta veces». Pasado el tope se sigue
componiendo igual y el día sigue contando para la racha: lo único que deja de
subir es el número, y el aviso lo dice en vez de callarse.

### Las partes dicen qué son

`SectionRole` tiene ocho valores —idea, intro, estrofa, pre-estribillo,
estribillo, puente, solo, final— y vive en `core/music/song.ts` con los demás
topes de lo que se guarda. Lo llevan la `Part` del lienzo y la `SongSection`
guardada, que son las dos caras de lo mismo.

**`idea` es el valor por omisión y es un papel de verdad**, no un «sin
clasificar». La mayoría de lo que se graba aquí son cuatro compases que todavía no
saben dónde van, y obligar a decidirlo antes de tiempo es pedir una decisión que
nadie tiene tomada. Se omite al guardar, como todo valor por omisión de ese
fichero, para que leer y volver a guardar den lo mismo.

**Y se le dice al modelo, también cuando es una idea.** La frase sale del catálogo
`ROLES` y no se escribe otra vez en la ruta, igual que el catálogo de salidas y el
de movimientos: lo que entiende quien compone y lo que entiende el modelo salen
del mismo sitio, o dentro de tres meses dicen cosas distintas.

### Un emisor, no una prop

Quien sabe que acabas de guardar una canción es `features/songs`; quien lleva la
racha es `features/learn`; y **un feature no importa de otro** (regla 2). Los
hechos viajan por un `Emisor` en `state/hechos-de-componer.ts`, que las dos capas
sí pueden abrir.

Lo escucha `useProgress`, y **solo cuando se lo piden**: hay varias pantallas que
lo llaman a la vez, cada una con su copia del avance, y dos apuntados contarían
cada hecho dos veces y se pisarían al guardar.

## Consecuencias

`Progress` gana un campo, `composeToday`, que se guarda y se sincroniza. Al
fusionar dos aparatos se queda **el mayor y no la suma**, igual que `xpToday`: dos
navegadores abiertos a la vez inventarían un tope que nadie llegó a gastar dos
veces.

Tres medallas nuevas —«Primera canción», «De oído», «A tu manera»— y con ellas
trece en total, así que el contador de la pantalla de medallas cambia solo.

El aviso de lo que ha contado es **un aviso y no una pantalla**, que es toda la
diferencia con `UnitDone`: una unidad termina y se celebra, y componer no termina
nunca. Aparece en una esquina, no se puede pulsar, no roba el foco y se va a los
cuatro segundos.

Y queda una deuda dicha en voz alta: **lo que devuelve el modelo con el papel
puesto no está medido.** Sabemos que la frase llega al prompt —hay un test— y no
sabemos si cambia lo que contesta, porque eso solo se puede saber midiendo contra
la API, que es lo primero del [ROADMAP](../ROADMAP.md) y sigue sin hacerse.

## Alternativas descartadas

**Que componer suba el XP del temario.** Es lo primero que uno intenta y es
imposible de sostener: el total se recalcula desde las unidades hechas en dos
sitios, así que los puntos durarían hasta la primera sincronización. Aunque se
pudiera, diría que componer una canción avanza el Grado Profesional, y no lo
avanza.

**Sin tope diario.** Componer no tiene final, así que sin tope el marcador se gana
con el ratón: pulsar guardar en bucle cerraría la meta y mantendría la racha sin
tocar la guitarra. Un marcador que se gana con el ratón no mide nada, y el día que
alguien lo descubra deja de creerse también el resto.

**Un tope más bajo que la meta** —veinte de cuarenta, por ejemplo— para que
componer no pudiera cerrar el día solo. Se descarta porque diría exactamente lo
que este ADR viene a corregir: que componer vale la mitad. Quien se pasa la tarde
montando una canción ha practicado, y la aplicación tiene que poder decirlo.

**Premiar «tener cuatro compases» en vez de «decir qué parte es».** Era el hecho
obvio y es el peor: tener compases pasa solo mientras arrastras bloques, así que
premiarlo es premiar el movimiento. Decidir que eso es el estribillo es una
decisión, cuesta un segundo de pensar, y además es la que mejora lo que devuelve
el modelo.

**Adivinar el papel desde la armonía.** Cuatro compases que vuelven a la tónica se
parecen a un estribillo, y el dominio tiene con qué intentarlo. Se descarta porque
es adivinar sobre lo único que la aplicación no puede saber: si eso es el
estribillo lo sabe quien lo ha tocado, y equivocarse aquí envenena la petición al
modelo con una premisa falsa que nadie escribió.

**Hilar un `onCompuesto` desde `ComposeScreen` hasta los cuatro sitios.** Es lo
que pedía la regla de capas leída al pie de la letra, y significa una prop nueva
atravesando tres paneles que no tienen nada que ver entre sí. Una prop olvidada en
cualquiera de ellos es un hecho que deja de contar **sin que nada avise**, que es
el peor tipo de fallo que este proyecto puede tener en el marcador.

**Una pantalla de celebración al componer, como la de fin de unidad.** Componer no
tiene final: cualquier cosa que tape el lienzo o pida un clic para quitarse está
interrumpiendo lo único que la pantalla quiere que hagas. La celebración grande
sigue siendo de las unidades, que sí terminan.

**Vidas, corazones o un ranking.** Ya estaban descartados y se vuelven a descartar
aquí, porque «que componer parezca un juego» es justo la petición que los trae de
vuelta. Fallar no bloquea, y el avance de esta aplicación es de una persona en su
navegador: un ranking necesita gente contra la que competir.
