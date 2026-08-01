# Cuentas y planes

Qué da cada plan, quién comprueba qué, y qué se guarda de quien entra.

## Por qué hay planes

Casi toda la aplicación no cuesta nada de servir. El afinador, la rueda, el
mástil, el metrónomo, los acordes, las formas, el camino de progresiones y la
grabación **pasan enteros en el navegador de quien toca**: el servidor manda unos
ficheros y se desentiende. Eso es gratis y lo va a seguir siendo.

Lo que cuesta dinero es la IA. Cada pregunta al profesor y cada tanda de ideas es
una llamada al modelo que se paga por tokens, y hasta ahora la única defensa eran
diez peticiones por minuto y dirección: suficiente para que nadie machaque el
botón, inútil para que nadie se pase la tarde gastando. Con la clave puesta en un
sitio público, cualquiera que entre gasta de la misma cuenta.

Los planes son la respuesta a eso, y por eso lo que separan es **acceso al modelo
y cuánto**, no funciones de la guitarra.

## Los tres planes de pago, y lo que hay sin pagar

Lo que hay aquí escrito sale de `src/core/billing/plans.ts`. Si los dos no
coinciden, manda el código y este documento está mal.

|                                | Sin plan | Básico | Medio  | Pro     |
| ------------------------------ | -------- | ------ | ------ | ------- |
| Al mes                         | 0 €      | 4,99 € | 9,99 € | 19,99 € |
| Preguntar al profesor          | sí       | sí     | sí     | sí      |
| Grado Elemental (4 cursos)     | sí       | sí     | sí     | sí      |
| Grado Profesional (6 cursos)   | —        | sí     | sí     | sí      |
| Avance guardado en la cuenta   | —        | sí     | sí     | sí      |
| Repaso de lo que fallaste      | —        | sí     | sí     | sí      |
| Ideas de progresión            | —        | —      | sí     | sí      |
| El profesor sabe por dónde vas | —        | —      | —      | sí      |
| Peticiones a la IA al mes      | 15       | 147    | 181    | 363     |

**Los cupos de esa última fila no están escritos en ninguna parte: se calculan.**
Son los que salen con `claude-opus-5`, que es el modelo por defecto; con otro salen
otros, y la pantalla enseña los del modelo que haya puesto. Cómo se calculan y por
qué, más abajo en «Lo que cuesta la IA y de dónde salen los cupos».

**Son tres planes, no cuatro.** La primera columna no se vende: es lo que tiene
quien no ha pagado. Está en el catálogo del código porque la pregunta «¿puede este
pedir una idea?» hay que poder hacérsela también a él, pero la pantalla de planes
enseña tres tarjetas y cuenta lo demás en prosa.

Cuatro decisiones que conviene entender antes de discutirlas:

**El profesor entra sin pagar, con quince preguntas al mes.** Un plan gratis que no
deja probar lo que se paga no vende nada. Quince bastan para juzgar si contesta bien,
y cuestan unos veinte céntimos por cuenta: es gasto de captación, y es **el único
sitio de la aplicación que pierde dinero a propósito**.

**La IA pide cuenta.** Sin cuenta no hay a quién contarle el gasto: una dirección IP
se cambia con el móvil en la mano, y un contador en memoria se reinicia al desplegar.
Todo lo demás —afinador, rueda, mástil, metrónomo, acordes, grabación, el Grado
Elemental entero— sigue funcionando sin entrar.

**Cada escalón de pago trae una cosa que el anterior no.** Básico abre el temario
entero y el repaso; Medio añade las ideas de la IA; Pro, un profesor que sabe qué
llevas hecho. Un escalón que solo suba el cupo no se entiende: quien lo mira tiene
que poder decir en una frase por qué pagaría el siguiente.

**Las ideas empiezan en Medio.** Son la parte más cara —cada pulsación son entre
dos y cuatro progresiones razonadas— y la única que se puede pedir en cadena sin
leer lo anterior.

**El Grado Profesional va con plan.** Es la parte del temario que explica la teoría
que la pantalla de componer usa sin explicar, y es la que costó escribir. El
Elemental completo se queda gratis porque quien empieza tiene que poder llegar a
algún sitio sin pagar.

Un test comprueba que **cada plan incluye todo lo del anterior y cuesta más**: un
plan caro que quitase algo sería una trampa, y el test la impide.

### Los nombres viejos siguen valiendo

Los planes de pago se llamaron Estudiante y Conservatorio antes de ser tres.
`planOf` traduce `estudiante` a Básico y `conservatorio` a Pro, y `/planes/estudiante`
sigue llevando a la ventana de Básico. Sin eso, una fila vieja caería al plan gratis y
le cerraría la puerta a alguien que había pagado, en silencio y sin que nadie se
enterara hasta que se quejara: un renombrado no puede degradar a nadie. La tabla de
alias se borra cuando no quede ninguna fila con esos valores, no antes.

## Dónde se paga

Una pantalla por plan: `/planes` los enseña y `/planes/basico`, `/planes/medio` y
`/planes/pro` son las ventanas de pago. Pantalla propia y no un botón en la lista,
porque ahí se está a punto de comprometer un pago mensual y eso merece ver qué plan,
cuánto, y **qué se abre exactamente que no tuvieras ya**: lo que ya tenías no es lo
que estás comprando, así que solo lo nuevo se marca como nuevo.

Es también donde entra quien no tiene cuenta, sin salir de la pantalla: no hay a
quién cobrarle sin cuenta, y mandarle a otra dirección a registrarse le hace perder
el plan que había elegido.

**No hay formulario de tarjeta, y no es un olvido.** Mientras el cobrador no cobre
(ver más abajo), unos campos de tarjeta que no llevan a ninguna pasarela serían un
decorado que se parece demasiado a un cobro de verdad. Lo que hay es el resumen, el
precio, un aviso de que no se cobra nada —antes del botón, no en letra pequeña
debajo— y un botón que activa el plan. `/planes/gratis` no existe: da 404, porque el
plan gratis no es una compra.

## Quién comprueba qué

Dos veces, y a la misma tabla:

- **La pantalla** pregunta a `core/billing` para saber si enseña un botón o un
  candado. El candado dice qué plan hace falta y cuánto cuesta, porque un candado
  que no dice cómo se abre es una pared.
- **La ruta** pregunta a `server/entitlements.ts`, que pregunta a `core/billing`,
  antes de gastar un céntimo.

Que las dos consulten la misma función es lo que evita el caso peor: una pantalla
que promete algo que el servidor rechaza. Si esa tabla se escribiera dos veces,
llegaría el día en que dijeran cosas distintas.

### Las tres puertas de las rutas de IA

En este orden, y el orden importa:

1. **Diez por minuto y dirección**, en memoria (`server/rate-limit.ts`). No sabe de
   planes: aunque pagues, no hay razón para hacer diez peticiones en un segundo.
   Comprobarlo es gratis.
2. **Tener cuenta.** Sin ella se responde `401` y no se llama al modelo.
3. **Los dos cupos del plan** (`server/ai-usage.ts`). Es una escritura en la base de
   datos, así que va última: si fuera antes, cada pulsación de más costaría una
   consulta.

El cupo **se descuenta antes de llamar al modelo**, no después. Parece al revés de lo
razonable y no lo es: descontar después deja pasar dos peticiones simultáneas y, si el
proceso se cae a mitad de llamada, la llamada se ha pagado y no se ha contado. Se
cobra el intento, y por eso las rutas reintentan una sola vez.

Los dos contadores suben y se comprueban **en la misma sentencia** —el `where` de un
`on conflict` con los dos topes dentro—, y por eso la tabla tiene una fila por cuenta
y mes con el día dentro: con dos escrituras hay una rendija entre ellas por la que se
cuelan dos peticiones simultáneas.

### El mes y el día son los del servidor, en UTC

No los de quien pregunta. El que paga la factura es el servidor y el cupo es suyo. La
consecuencia es que a quien esté en Sídney el cupo se le renueva a media tarde; la
alternativa —creerse la zona horaria que diga el navegador— permitiría renovar el
cupo cambiando la hora del ordenador.

**La racha es otra cosa y se cuenta en la hora de quien toca**, porque no cuesta
dinero y porque para quien practica a las once de la noche en Madrid el día es el suyo.

## Lo que cuesta la IA y de dónde salen los cupos

Esta sección existe porque los cupos estuvieron escritos a mano y **perdían dinero**.
Cuarenta peticiones al día son mil doscientas al mes; con Opus 5 y los topes de salida
que tenían las rutas, eso eran entre veintiséis y sesenta euros de coste para un plan
de 4,99 €. Nadie los había multiplicado. El razonamiento completo y las alternativas
están en [adr/0008](./adr/0008-los-cupos-salen-del-precio.md).

Ahora los cupos son una división, en [`core/billing/cost.ts`](../src/core/billing/cost.ts):

```
cupo mensual = (precio del plan × 40 %) / coste del peor caso de una petición
```

- **El 40 %** es lo único que es una decisión de negocio y no una medida: la parte del
  precio que puede irse en llamadas al modelo. Deja un **60 % de margen** para
  servidor, base de datos, comisión de la pasarela cuando la haya, IVA y beneficio.
- **El peor caso, no el típico.** Quien quiera gastar gastará el máximo, así que el
  cupo cuadra con el máximo. Calcularlo sobre el gasto medio funciona hasta que
  aparece el primer usuario que aprieta.
- **El tope de salida no es una estimación**: es el `max_tokens` que imponen las
  rutas, leído del mismo sitio que el cálculo. Escritos por separado se separarían.
- **Un euro se cuenta como un dólar.** Es falso a nuestro favor y evita tener que
  vigilar el cambio de divisa cada mes.

Con eso, y los precios de la API a 30 de julio de 2026:

|                          | Opus 5 (5/25 $)  | Sonnet 5 (3/15 $) | Haiku 4.5 (1/5 $) |
| ------------------------ | ---------------- | ----------------- | ----------------- |
| Una pregunta al profesor | 1,35 cts         | 0,81 cts          | 0,27 cts          |
| Una tanda de ideas       | 2,20 cts         | 1,32 cts          | 0,44 cts          |
| Básico                   | 147/mes · 24/día | 246 · 40          | 739 · 120         |
| Medio                    | 181/mes · 30/día | 302 · 49          | 908 · 147         |
| Pro                      | 363/mes · 59/día | 605 · 98          | 1817 · 294        |

**Cambiar `ANTHROPIC_MODEL` multiplica los cupos sin tocar una línea de código**, y
la pantalla enseña los del modelo que haya puesto. Es potente y es un cañón: bajar de
modelo sube los cupos y baja la calidad de las respuestas, y de lo segundo no avisa
nada.

Un test comprueba que **ningún plan de pago pierde dinero con ningún modelo**, ni
gastándose el cupo entero, ni con un modelo que no esté en la tabla —a un modelo
desconocido se le supone el precio del más caro—.

### Dos topes, no uno

- **El del mes protege el dinero.** Es el periodo de facturación y es el que sale de
  la división de arriba.
- **El del día protege la experiencia.** Está puesto en cinco días de gasto medio:
  evita fundirse el mes en una tarde y quedarse veintinueve días sin profesor, que es
  una forma rara de cumplir lo prometido.

Cuando se agota uno, el mensaje dice **cuál**: no se arreglan igual, uno se espera a
mañana y el otro se arregla subiendo de plan o esperando al día uno.

### Sin pensar, y a propósito

Las dos rutas piden al modelo que **no piense** y trabajan con esfuerzo bajo. La
respuesta la fija un esquema JSON: no hay nada que razonar. En Opus 5 el pensamiento
viene encendido por defecto y se cobra como salida, así que dejarlo puesto
multiplicaba el coste de cada pregunta y podía gastarse el `max_tokens` pensando y
devolver una respuesta truncada: se paga y no se sirve.

Con el pensamiento apagado, la documentación del modelo avisa de que puede colarse
alguna etiqueta interna en la salida, así que los dos prompts de sistema piden
explícitamente que no las incluya. Los prompts viven juntos en
[`server/prompts.ts`](../src/server/prompts.ts) porque de su longitud dependen los
cupos: `server/prompts.test.ts` los mide y falla si crecen hasta comerse la holgura
del presupuesto de tokens.

## El avance: dónde vive y cómo se junta

El navegador sigue siendo la copia de trabajo, también con cuenta. Se escribe
siempre primero en `localStorage` y se sube después, así que terminar una unidad no
espera a la red y una unidad terminada en un túnel no se pierde.

**La fusión la hace el servidor**, no el navegador. Es lo importante: si el
navegador leyera, fusionara y escribiera, dos aparatos abiertos a la vez se
pisarían y el segundo en escribir borraría lo del primero. Fusionando en el
servidor, subir es siempre seguro y nunca hay que decidir quién gana.

Qué hace la fusión (`mergeProgress`, en el dominio y con tests):

- **La unión de las unidades hechas.** Nadie estudió de menos.
- **La racha más larga que siga viva.** Una racha de treinta días que se cortó hace
  un mes no es una racha viva, y no revive al fusionar.
- **Todas las medallas**, en el orden del catálogo.
- **Del XP del día, el mayor y no la suma.** Sumar dos aparatos que estuvieron
  abiertos a la vez inventaría trabajo que no se hizo.
- **De la cola de repaso, lo peor de cada una.** Si un aparato dice que la pregunta
  se sabe y el otro que se acaba de fallar, lo cierto es que se falló: dar por
  sabido lo que no se sabe es el único error que esa cola no puede permitirse.

El XP total no se fusiona: se recalcula desde las unidades hechas, que ya están
unidas. Es la misma regla que ya protegía al `localStorage`.

Entrar en una cuenta desde un navegador donde ya se había estudiado sin cuenta no
pierde nada, y salir tampoco borra nada: el avance local se queda donde está.

## Qué se guarda de quien entra

Tres tablas y nada más (`src/server/db/schema.ts`):

- **`users`**: correo en minúsculas, nombre si lo ha dicho, la contraseña cifrada y
  el plan.
- **`progress`**: el avance entero como un documento JSON, uno por cuenta. Incluye
  por qué curso decidió empezar, que es una preferencia y no un logro.
- **`ai_usage`**: una fila por cuenta y día con cuántas llamadas al modelo lleva.

**Ni una muestra de audio ni un fotograma de vídeo.** Eso no sale del equipo, y las
cuentas no han cambiado eso: lo que viaja del progreso son identificadores de
unidad, números y fechas.

### Las contraseñas

`scrypt`, el del módulo `crypto` de Node. Sin dependencias: bcrypt y argon2 se
compilan al instalar, y una dependencia que se compila es la que rompe el
despliegue en la máquina sin compilador. Es la misma razón que hay detrás de
[adr/0002](./adr/0002-deteccion-de-tono-propia.md), y `scrypt` es una de las tres
funciones que OWASP recomienda para esto.

El formato guardado lleva sus propios parámetros dentro
—`scrypt$16384$8$1$sal$clave`— para poder subir el coste mañana sin invalidar lo
guardado hoy.

Dos detalles que no se ven y que están probados:

- **La comparación es en tiempo constante.** Comparar con `===` filtra cuántos
  bytes iniciales acertaste por lo que tarda en fallar.
- **Entrar con un correo que no existe cifra igual de lento.** Si no, la diferencia
  se mide desde fuera y regala la lista de quién tiene cuenta aquí.

### El plan no viaja en la cookie

La cookie de sesión lleva solo el identificador de la cuenta. El plan se lee de la
base de datos cada vez que hace falta, que es justo cuando ya hay que ir a mirar el
cupo del día. Si el plan fuese dentro de la cookie, quien acaba de pagar seguiría
viendo candados y quien acaba de bajarse seguiría gastando, hasta que la cookie
caducara.

## Cómo se cobra: no se cobra

Hay una interfaz de facturación (`server/billing/port.ts`) y detrás está
`FakeBilling`, que **cambia el plan y no cobra nada**. Es el mismo patrón que
`AudioInput` o `SessionStorage`, y el porqué está en
[adr/0006](./adr/0006-planes-y-puerto-de-facturacion.md).

La pantalla de planes lo sabe: el cobrador declara `charges: false` y por eso puede
avisar de que aquí no se cobra. Una pantalla de pago que no cobra y no lo dice es
una pantalla que engaña.

**Antes de publicar esto de cara al mundo hay que saber que cualquiera con una
cuenta puede darse el plan Pro**: entra en `/planes/pro`, pulsa el botón y lo tiene.
Mientras el cobrador sea este, los cupos protegen del gasto accidental y no del que
quiere gastar.

## Lo que hace falta configurar

| Variable       | Hace falta            | Para qué                                                          |
| -------------- | --------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL` | Solo para las cuentas | Postgres. Sin ella no hay cuentas y todo lo demás funciona igual. |
| `AUTH_SECRET`  | Solo para las cuentas | Firmar la cookie de sesión. Sin ella tampoco hay cuentas.         |

Hacen falta las dos: `authAvailable()` pide base de datos **y** secreto. Con una
sola, las pantallas de cuenta dicen que esta copia no tiene cuentas, en vez de
fallar con un error de servidor que no explica nada.

Las migraciones se generan a mano y se guardan en `drizzle/`:

```bash
pnpm db:generate   # tras cambiar el esquema
pnpm db:migrate    # aplica lo pendiente; necesita DATABASE_URL
```

No se aplican al arrancar. Una aplicación que migra al levantarse funciona muy
bien hasta el día en que se despliegan dos instancias a la vez.

## Lo que no está probado

Los planes, los permisos, los cupos anónimos, el cifrado de contraseñas, la fusión
de avances, la cola de repaso, el punto de partida, las tarjetas de plan y la ventana
de pago tienen tests. **Lo que no se ha probado
todavía es el camino con base de datos de verdad**: registrarse, entrar, cambiar de
plan y ver el avance aparecer en otro navegador. En la máquina donde se escribió
esto no había Postgres ni Docker disponible. Lo que falle ahí serán las consultas,
no la política de planes.
