# ADR 0016 — Salidas en vez de versiones: la declaración sube del compás al camino

Fecha: 2026-08-26 · Estado: aceptada · Enmienda: [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)

## Contexto

La función se construyó como «versiones de tu canción», y hacía exactamente eso:
la misma progresión con dos o tres acordes cambiados. Tres reglas la sujetaban, y
las tres estaban en el validador:

- el mismo número de compases, en el mismo orden;
- los mismos pulsos, copiados del original y no creídos al modelo;
- cada compás cambiado tenía que ser uno de los **cinco** movimientos de
  `reharmonization.ts` aplicado al acorde que había.

Sumadas, lo único que podía devolver era tu canción con algún acorde sustituido.

**Y eso no es lo que hace falta al componer.** Lo que hace falta cuando tienes
cuatro compases dando vueltas es que alguien te enseñe **tres sitios distintos
adonde podrían ir**, para elegir: alargar hasta cerrar, cortar de otra manera,
repartir los pulsos de otro modo, meter una parte que contraste. Canciones
distintas de la misma semilla, no la misma canción repintada.

Hay además un dato: con esas reglas, dos modelos locales de ocho mil millones de
parámetros no pasaban **ni una** de cuatro peticiones. Siempre por lo mismo:
declaraban un movimiento y no cambiaban el grado.

## Decisión

**La declaración sube del compás al camino.**

Cada propuesta dice cuál de **cinco salidas** ha tomado —`rearmonizar`, `seguir`,
`otro-final`, `estirar`, `contraste`— y devuelve la canción entera que resulta.
`core/music/paths.ts` vuelve a comprobar esa declaración contra el dominio: que un
`seguir` mantenga de verdad tus compases y cierre en la tónica, que un `estirar`
no toque un solo acorde, que un `contraste` sepa volver al principio y no cierre
—porque si cierra, es un `seguir`—.

Es la misma idea de [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md),
un piso más arriba. Y la de allí **no se retira**: `rearmonizar` es ahora una
salida más, y dentro de ella cada compás cambiado sigue declarando su movimiento y
`isMove` sigue volviéndolo a aplicar.

**Debajo hay una comprobación nueva, y es la que sostiene lo demás: cada salto que
no estaba en tu canción tiene que existir en `nextDegrees`.** Ese grafo armónico ya
estaba escrito y probado —de cada grado, adónde se suele ir y por qué—, y son unas
tres salidas por grado. Una parte nueva de cuatro compases tiene del orden de
ochenta caminos posibles: bastante para componer, poco para inventarse cualquier
cosa. **El mapa entero se le enseña al modelo en el prompt**, generado desde el
dominio: es el mismo truco que llevó las ideas de 0 de 4 a 4 de 4 —enseñarle lo que
el validador va a comprobar, en vez de pedírselo en prosa—.

Lo que se **deroga** de [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)
es una sola regla, la de «cambia el número de compases o su orden: eso ya no es una
versión de esa canción». Deja de ser cierto en cuanto lo que se pide no es una
versión.

**Una salida es una canción con sus partes, y se elige antes qué se pide.**

Lo que hacía falta al componer no era una progresión suelta: era _«continúame
esto»_. Así que una salida trae hasta cuatro partes con su nombre —tu parte,
estribillo, puente, cierre— usando el `SongSection` que el dominio ya modelaba. Y
quien toca elige antes de pedir entre **continuar la canción** y **retocar estos
compases**, como las tres pestañas de las ideas.

Esa elección no es de interfaz, es lo que hace que el esquema pueda exigir lo que
el validador comprueba: continuar necesita al menos una parte nueva y retocar
exactamente una parte, y un esquema JSON no puede condicionar eso a un campo que
el propio modelo rellena. Con el camino libre salían **cero salidas válidas de
cuatro peticiones**; eligiendo antes, **tres de tres**. Es la misma regla que ya
costó una vez con las ideas, aplicada antes de que costara otra.

**Tus compases no se le piden: los pone el servidor.** Al continuar, el modelo
devuelve solo las partes que añade. Pedirle que copiara tu progresión al principio
era la causa de que se descartara todo —«tu parte no es la que tocaste», 3 de 3—,
y no había ninguna razón para pedírsela: repetirla gastaba tokens y daba una
ocasión más de equivocarse.

**Una salida no pasa de 32 compases**, el mismo tope que tiene lo que se manda. No
es una regla musical: es lo que hace que el peor caso de la respuesta no crezca
respecto a lo que ya presupuestaba `core/billing`, y que los cupos del plan Pro
sigan valiendo sin tocar un número.

En pantalla se llaman **salidas**, y el botón dice «Salidas de esto». «Versiones»
prometía «la misma canción otra vez», que es justo lo que deja de ser.

## Consecuencias

- **Continuar funciona con un modelo local: `gemma4:e4b`, 4 de 4, todas con partes
  de verdad.** Sale `Lo que llevas(Am F C G) | verso(Am F C G Am)`: tu parte y una
  nueva que resuelve en la tónica.
- **Y `qwen3:8b` no llega: 0 de 4.** No porque falle el montaje, sino porque su
  «parte nueva» es siempre tu progresión copiada, y eso lo rechaza la regla de
  abajo. Es un rechazo correcto —enseñarte tus propios acordes con el rótulo
  «puente» parece roto— y deja la misma conclusión de siempre: los modelos locales
  sirven para probar la tubería, no para medir la calidad.
- Retocar sigue siendo lo que peor se le da a los dos —devuelven la canción tal
  cual—, que es el mismo límite de siempre.
- **Tres fallos que solo aparecieron pidiéndoselo a un modelo de verdad**, y los
  tres eran de diseño, no del modelo:
  - Dejar `steps` y `sections` los dos opcionales en el esquema. El modelo elegía
    el que no tocaba y se descartaba todo. Una forma, siempre.
  - Pedirle que copiara tus compases. Ver arriba.
  - Un «puente» que era tu progresión copiada tal cual: pasaba todas las reglas
    —los saltos existen, no cierra, sabe volver— y era tu parte con otro nombre.
    Ahora al menos una parte nueva tiene que aportar algo.
  - **`nextDegrees` no incluye el salto de un grado a sí mismo**, porque contesta
    a dónde se _va_ desde un grado. Pero un acorde que dura dos compases es un
    acorde que dura dos compases: se estaba rechazando media música, incluido un
    cierre con dos compases de tónica que es lo más normal que hay. Quedarse
    siempre vale, y ahora está escrito.
- **De 0 de 4 a 4 de 4, con los dos modelos locales.** `qwen3:8b` devuelve una
  salida válida en las cuatro peticiones; `gemma4:e4b`, siete salidas válidas en
  cuatro peticiones, con compases nuevos de verdad.
- **Y el que peor iba en todo lo demás es el que mejor va aquí.** `gemma4:e4b`
  fallaba la puerta del tema del profesor 5 de 8 veces, y aquí produce más
  variedad que `qwen3`. Es un recordatorio de que «este modelo es mejor» no es una
  propiedad del modelo sino de la tarea.
- **`rearmonizar` sigue siendo la salida más difícil**, y los dos modelos la fallan
  igual: devuelven la canción tal cual. Era el 100 % de la función y ahora es un
  quinto de ella, lo que explica el 0 de 4 de antes mejor que ninguna otra cosa.
- **Con la API no se ha medido.** Es lo que falta, y es lo único que puede decir si
  las salidas de un modelo bueno valen la pena musicalmente.
- Los pulsos ya no se copian en silencio: **son información**. Una `rearmonizar` que
  los toca se descarta en vez de corregirse, porque `estirar` existe justo para
  cambiarlos y dejar pasar una mentira ahí sería dejar sin sentido a la otra.
- La pantalla tiene tres estados de compás donde tenía dos —nuevo, cambiado, igual—,
  porque desde que una salida puede alargar, saber qué no tocaste es la mitad de la
  información.
- El presupuesto de entrada sube a unos 1.035 tokens de los 1.400, por el mapa de
  saltos. Cabe con holgura y está medido en `prompts.test.ts`.
- **Por dentro se sigue llamando `versiones`**: la ruta, la carpeta y la capacidad
  del plan. Renombrarlo toca cuarenta ficheros y habría ahogado el cambio de
  comportamiento en un diff de nombres. Es deuda, está en el ROADMAP, y es
  mecánica.

## Alternativas descartadas

**Dejar que las salidas se alejen sin comprobar nada**, confiando en que el modelo
proponga cosas razonables. Es la opción obvia y la que mata la función: sin
verificación, tres salidas son tres listas de acordes que cualquiera puede probar a
mano, y el argumento de [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)
—que el porqué es la mitad de lo que se vende— vale igual aquí.

**Permitir que una salida cambie de tonalidad.** Es lo más potente para componer:
irse a una vecina de la rueda con un acorde pivote que exista en las dos, y
`circle-of-fifths.ts` ya sabría comprobarlo. Se descarta **de momento**, no para
siempre: pide teoría nueva en `core/music` —qué es una vecina, qué es un pivote
válido, cómo se leen los grados después de mudar— y esto ya era bastante cambio.
Es la primera candidata a un sexto camino.

**Una llamada por salida, con el usuario eligiendo cuál quiere**, como las tres
pestañas de las ideas. Daría mejores resultados: el modelo se concentra en una sola
tarea en vez de repartirse entre tres, y se nota —de las tres que propone, sobrevive
una—. Se descarta porque triplica el gasto de la petición más cara del proyecto, y
de ahí salen los cupos. Si algún día se mide que la calidad lo justifica, esto es lo
primero que hay que reconsiderar.

**Mantener «versiones» como nombre de pantalla** y cambiar solo lo de dentro. Menos
trabajo y ningún rótulo que tocar. Se descarta porque la palabra promete «la misma
canción otra vez»: alguien que pulsara esperando una rearmonización y recibiera una
canción cuatro compases más larga pensaría que está roto, no que ha entendido mal.

**Que el modelo devuelva la canción entera, incluida tu parte**, que es como
empezó. Parecía más seguro: un solo sitio donde se arma la canción. Se descartó
midiéndolo —el modelo no copia bien tus compases y se caía todo— y además era peor
en lo demás: repetir tu progresión gasta tokens de salida, de los que salen los
cupos. Ahora devuelve solo lo que añade y tu parte la pone el contrato, así que no
hay forma de que llegue cambiada.
