# Cuentas y planes

Qué da cada plan, quién comprueba qué, y qué se guarda de quien entra.

## Por qué hay planes

Casi toda la aplicación no cuesta nada de servir. El afinador, la rueda, el
mástil, el metrónomo, los acordes, las formas, el camino de progresiones y la
grabación **pasan enteros en el navegador de quien toca**: el servidor manda unos
ficheros y se desentiende. Eso es gratis y lo va a seguir siendo.

Lo que cuesta dinero es la IA. Cada pregunta al profesor y cada tanda de salidas es
una llamada al modelo que se paga por tokens, y hasta ahora la única defensa eran
diez peticiones por minuto y dirección: suficiente para que nadie machaque el
botón, inútil para que nadie se pase la tarde gastando. Con la clave puesta en un
sitio público, cualquiera que entre gasta de la misma cuenta.

Los planes son la respuesta a eso, y por eso lo que separan es **acceso al modelo
y cuánto**, no funciones de la guitarra.

## Los dos planes de pago, y lo que hay sin pagar

Lo que hay aquí escrito sale de `src/core/billing/plans.ts`. Si los dos no
coinciden, manda el código y este documento está mal.

|                                | Sin plan | Básico  | Medio   |
| ------------------------------ | -------- | ------- | ------- |
| Al mes                         | 0 €      | 4,99 €  | 9,99 €  |
| O al año (dos meses gratis)    | —        | 49,90 € | 99,90 € |
| Preguntar al profesor          | sí       | sí      | sí      |
| Grado Elemental (4 cursos)     | sí       | sí      | sí      |
| Grado Profesional (6 cursos)   | —        | sí      | sí      |
| Avance guardado en la cuenta   | —        | sí      | sí      |
| Repaso de lo que fallaste      | —        | sí      | sí      |
| Tu canción en este navegador   | sí       | sí      | sí      |
| Tus canciones en la cuenta     | —        | sí      | sí      |
| Salidas de lo que tocas        | —        | —       | sí      |
| El profesor sabe por dónde vas | —        | —       | sí      |
| Preguntas al profesor al mes   | 15       | 96      | 193     |
| Preguntas que gasta una salida | —        | —       | 3       |

**La canción vive en este navegador, con plan o sin él**
([adr/0118](./adr/0118-la-cancion-vive-en-este-navegador-y-se-dice.md)): el lienzo se
guarda solo en IndexedDB, y quien no paga se lo puede llevar en MIDI o en una copia
`.caos.json`. Lo que pide plan es guardarla **también en la cuenta**, con nombre, para
abrirla desde otro aparato. La capacidad que abre las salidas se llama `'salidas'`
(antes `'versiones'`, adr/0124); no se guarda en la base, así que no hubo migración.

**Los cupos de esas dos últimas filas no están escritos en ninguna parte: se
calculan.** Son los que salen con `claude-sonnet-5-5`, que es el modelo por defecto
([adr/0103](./adr/0103-los-modelos-vigentes-y-el-de-por-defecto.md)); con otro salen
otros, y la pantalla enseña los del modelo que haya puesto. Cómo se calculan y por
qué, más abajo en «Lo que cuesta la IA y de dónde salen los cupos».

**Son dos planes de pago, no tres.** Hubo un Pro a 19,99 € que solo añadía un
profesor que sabe por dónde vas, y se fundió en Medio
([adr/0104](./adr/0104-el-plan-pro-se-replantea.md)). La primera columna no se vende:
es lo que tiene quien no ha pagado. Está en el catálogo del código porque la pregunta
«¿puede este preguntarle al profesor?» hay que poder hacérsela también a él, pero la
pantalla de planes enseña dos tarjetas y cuenta lo demás en prosa.

**Al mes o al año, el mismo plan.** El anual son diez meses —dos gratis— y abre lo
mismo con el mismo cupo; se elige en la ventana de pago
([adr/0106](./adr/0106-el-margen-se-cuenta-sin-iva-y-con-pago-anual.md)). El cupo se
calcula con lo que deja el anual al mes, que es menos: quien paga al mes deja más y
recibe lo mismo.

Cuatro decisiones que conviene entender antes de discutirlas:

**El profesor entra sin pagar, con quince preguntas al mes.** Un plan gratis que no
deja probar lo que se paga no vende nada. Quince bastan para juzgar si contesta bien,
y cuestan **diecinueve céntimos por cuenta** con el modelo por defecto —191 $ al mes
cada mil cuentas—, contando el reintento que se paga aunque el cupo cuente una y el
texto libre en su peor alfabeto. Aquí decía «unos veinte céntimos» con Opus 5 y era
menos de la mitad: con el reintento y el texto libre son cuarenta y ocho. Con un modelo
que no esté en la tabla, que se cobra como el peor caso, son 2,49 $ por cuenta. Es
gasto de captación, y es **el único sitio de la aplicación que pierde dinero a
propósito**; la tabla multiplicada está en `FREE_MONTHLY_ALLOWANCE`. **Y las cuentas
se fabrican**: registrarse no confirma el correo, así que lo que acota la suma no es
esta cifra sino el techo de gasto de lo gratis («El techo de gasto de todos», más
abajo).

**La IA pide cuenta.** Sin cuenta no hay a quién contarle el gasto: una dirección IP
se cambia con el móvil en la mano, y un contador en memoria se reinicia al desplegar.
Todo lo demás —afinador, rueda, mástil, metrónomo, acordes, grabación, el Grado
Elemental entero— sigue funcionando sin entrar.

**Cada escalón de pago trae una cosa que el anterior no.** Básico abre el temario
entero, el repaso y guardar tus canciones; Medio añade la IA que acompaña mientras
compones: las salidas y un profesor que sabe qué llevas hecho. Un escalón que solo
suba el cupo no se entiende: quien lo mira tiene que poder decir en una frase por qué
pagaría el siguiente.

**Las salidas empiezan en Medio, y son lo más caro que hay.** Estuvieron en Pro
mientras Medio tenía las ideas; al retirarse las ideas, Medio se quedaba igual que
Básico y las salidas bajaron un escalón
([adr/0066](./adr/0066-las-ideas-se-retiran-y-las-salidas-bajan-a-medio.md)). Cada
tanda manda la progresión entera y devuelve tres progresiones enteras con su porqué,
así que cuesta más del doble que una pregunta al profesor. Es también lo que más
trabajo de dominio lleva detrás: lo que devuelve el modelo se comprueba movimiento a
movimiento antes de enseñarse.

**El cupo se cuenta en preguntas al profesor, y una salida gasta tres.** Es un solo
cupo, compartido: quien tiene Medio puede hacer 193 preguntas, o 64 salidas, o
cualquier mezcla. Dividir entre la petición más cara, como se hacía, dejó a Medio con
menos que Básico en cuanto las salidas bajaron a Medio
([adr/0067](./adr/0067-el-cupo-se-cuenta-en-preguntas.md)).

**El Grado Profesional va con plan.** Es la parte del temario que explica la teoría
que la pantalla de componer usa sin explicar, y es la que costó escribir. El
Elemental completo se queda gratis porque quien empieza tiene que poder llegar a
algún sitio sin pagar.

**Lo que se cobra del Profesional es el camino, no el texto.** Las lecciones se
generan en el navegador y viajan en el JavaScript de `/aprender/[unidad]` para todo
el mundo, así que quien lo descargue puede leerlas sin plan. Está medido y aceptado:
es teoría de conservatorio, y lo que el plan da es abrirlo en orden, que cuente, el
repaso y el profesor ([adr/0116](./adr/0116-el-avance-que-sube-se-comprueba.md)).

Un test comprueba que **cada plan incluye todo lo del anterior y cuesta más**: un
plan caro que quitase algo sería una trampa, y el test la impide.

### Los nombres viejos siguen valiendo

Los planes de pago se llamaron Estudiante y Conservatorio antes de ser tres, y el
tercero, Pro, se fundió en Medio. `planOf` traduce `estudiante` a Básico y
`conservatorio` y `pro` a Medio, y `/planes/estudiante` y `/planes/pro` siguen llevando
a su ventana. Medio trae todo lo que traía Pro, así que quien lo tuviera no pierde
nada. Sin eso, una fila vieja caería al plan gratis y
le cerraría la puerta a alguien que había pagado, en silencio y sin que nadie se
enterara hasta que se quejara: un renombrado no puede degradar a nadie. La tabla de
alias se borra cuando no quede ninguna fila con esos valores, no antes.

## Por dónde se entra: el avatar

Arriba a la derecha hay un círculo, y hace **dos cosas distintas** según quién mire.
No es un descuido de coherencia: es que las dos situaciones no se parecen en nada.

- **Sin cuenta** es un enlace directo a `/registro`. Un desplegable cuya única
  opción es «entrar» obliga a dos clics para llegar al mismo sitio.
- **Con cuenta** es un desplegable con las cuatro cosas que se pueden mirar de la
  tuya —perfil, suscripción, contraseña y privacidad— y el botón de salir. Llevar
  siempre al perfil obligaría a rebotar desde allí a las otras tres.

Las cuatro son **anclas de `/cuenta`** (`#perfil`, `#suscripcion`, `#contrasena`,
`#privacidad`) y no cuatro direcciones. Son cosas que se miran de una en una y muy
de tarde en tarde, y repartirlas obligaría a volver atrás para pasar de una a otra.

`/registro` es pantalla propia y no un panel dentro de la cuenta: quien llega no
viene a mirar nada, viene a rellenar tres campos **y decir si tiene 14 años o
más**. Por debajo no se crea la cuenta —lo comprueba también el servidor— y se
dice que sin ella la aplicación funciona igual
([adr/0111](./adr/0111-la-edad-se-declara-y-el-titular-se-configura.md)). El interruptor «ya tengo cuenta»
sigue estando —la mitad de las veces uno no se acuerda—, lo que cambia es cuál
viene puesto. Y si ya has entrado, no se pinta el formulario: crear una segunda
cuenta sin querer es perder el avance de la primera.

## Qué se puede cambiar de tu cuenta

`PATCH /api/cuenta`, con la sesión abierta y diez intentos por minuto y dirección —que solo existe con
`TRUSTED_PROXY_HOPS`: sin él todo el mundo comparte el mismo tope—.
Su propio contador y no el de registrarse, porque comprobar contraseñas es
exactamente lo que hace quien las prueba a lo bruto, y gastar los intentos de una
cosa no puede dejar sin registrarse a quien comparte salida a internet.

- **El nombre**, o borrarlo. Es lo único que se enseña de ti —el saludo del perfil
  y la letra del círculo—, y no decirlo es una respuesta válida.
- **La contraseña**, pidiendo la de ahora. Se pide **aunque ya haya sesión**: una
  cookie viva en un ordenador prestado no puede bastar para quedarse con la cuenta.
  Si en la misma petición vienen las dos cosas y la contraseña actual no es la que
  dice, no se guarda tampoco el nombre.
- **El correo, no.** Identifica la cuenta, y cambiarlo pide confirmar la dirección
  nueva antes de mover nada. Sin envío de correo eso se queda a medias y deja
  cuentas apuntando a buzones que no existen. Recuperar la contraseña sin la de
  ahora va por `/olvidada`, que manda un enlace de un solo uso **solo si esta copia
  manda correo**; si no, la pantalla lo dice.

Cambiar la contraseña **echa a las demás sesiones**: sube `sessionVersion` en la
fila de la cuenta, en la misma sentencia que la contraseña (`changePassword`,
`server/users.ts`), y una cookie firmada con la versión de antes deja de valer al
leerla (`currentSession`, `server/entitlements.ts`). Restablecerla con el enlace de
`/olvidada` hace lo mismo. La contraseña nueva tiene que medir **entre 8 y 1024
caracteres**: sin tope, una de megas llegaba entera a `scrypt`
([adr/0113](./adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).

## Dónde se paga

Una pantalla por plan: `/planes` los enseña y `/planes/basico` y `/planes/medio` son
las ventanas de pago. Pantalla propia y no un botón en la lista, porque ahí se está a
punto de comprometer un pago y eso merece ver qué plan, cuánto, y **qué se abre
exactamente que no tuvieras ya**: lo que ya tenías no es lo que estás comprando, así
que solo lo nuevo se marca como nuevo.

**Al mes o al año se elige ahí**, al lado del precio, con un selector que viene en
«al mes»: es lo que se puede dejar en cualquier momento, y quien quiere el año lo elige
sabiendo que lo elige. Las tarjetas de `/planes` dicen el anual debajo del mensual, en
pequeño, porque es la misma compra pagada de otra manera y no otro plan. Pasar de
mensual a anual con la suscripción viva va por el portal de la pasarela, como cambiar
de plan ([adr/0077](./adr/0077-la-suscripcion-se-guarda-en-la-cuenta.md)).

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

  **Y lleva a `/planes`, siempre**, que es donde están las tarjetas con lo que
  incluye cada una. Llevaba a `/cuenta`, que es la pantalla de quién eres y no tiene
  ni tarjetas ni precios: el enlace decía «ver los planes» y dejaba a quien lo
  pulsaba a un salto de lo que había ido a ver. La dirección la decide un solo
  sitio, `ui/PlansLink.tsx`, para que no vuelva a haber dos respuestas a la misma
  pregunta. Sin cuenta también se va allí: se entra desde la propia ventana del
  plan.

- **La ruta** pregunta a `server/entitlements.ts`, que pregunta a `core/billing`,
  antes de gastar un céntimo.

Que las dos consulten la misma función es lo que evita el caso peor: una pantalla
que promete algo que el servidor rechaza. Si esa tabla se escribiera dos veces,
llegaría el día en que dijeran cosas distintas.

### Las puertas de las rutas de IA

En este orden, de lo que no cuesta nada a lo que cuesta dinero, y el orden importa
([adr/0114](./adr/0114-el-gasto-de-la-ia-tiene-techo-y-la-cuenta-se-cierra-en-orden.md)):

1. **Sesenta por minuto y dirección**, una capa barata con su propia clave (`ia-ip`)
   que para a quien aporrea sin leer ni la sesión. **Solo cuando hay dirección**: sin
   `TRUSTED_PROXY_HOPS` todas las peticiones son la misma, y un tope común es el fallo
   que se quitó.
2. **Que haya modelo.** Sin ninguno, un `503` que lo dice, antes de tocar nada.
3. **Tener cuenta**, **antes de leer el cuerpo**. Sin ella se responde `401` sin hacer
   trabajo de dominio con lo que traiga.
4. **Diez por minuto y cuenta** (`frenarPorCuenta`). No sabe de planes: aunque pagues,
   no hay razón para hacer diez peticiones en un segundo. **Era por dirección y antes
   de leer la cuenta**, y sin proxy de confianza diez peticiones anónimas dejaban sin
   IA a todas las cuentas a la vez.
5. **El cuerpo**, por el lector acotado.
6. **El techo de gasto de todos y los dos cupos del plan** (`server/ai-gasto.ts`,
   `server/ai-usage.ts`). Son escrituras en la base de datos, así que van las últimas.

El cupo **se descuenta antes de llamar al modelo**, no después. Parece al revés de lo
razonable y no lo es: descontar después deja pasar dos peticiones simultáneas y, si el
proceso se cae a mitad de llamada, la llamada se ha pagado y no se ha contado. Se
cobra el intento, y por eso las rutas reintentan una sola vez. **Y el SDK no reintenta
por debajo** (`maxRetries: 0`): con su reintento, una pregunta podían ser cuatro
llamadas y el coste suponía dos. Un `429` o un `5xx` de la API se reintentan en el
bucle de la ruta, dentro de los mismos dos intentos.

Los dos contadores suben y se comprueban **en la misma sentencia** —el `where` de un
`on conflict` con los dos topes dentro—, y por eso la tabla tiene una fila por cuenta
y mes con el día dentro: con dos escrituras hay una rendija entre ellas por la que se
cuelan dos peticiones simultáneas.

### El techo de gasto de todos

El cupo acota a cada cuenta y **nada acotaba la suma**. Con quince preguntas gratis
por cuenta y un registro que no confirma el correo, cien direcciones registrando al
ritmo que deja el límite gastaban unos **650 $ por hora** con Sonnet 5.5
([adr/0114](./adr/0114-el-gasto-de-la-ia-tiene-techo-y-la-cuenta-se-cierra-en-orden.md)).
Ahora hay cuatro topes en dinero, en una fila por mes (`ai_gasto`):

| Tope                | Variable                     | De serie |
| ------------------- | ---------------------------- | -------- |
| Todos, al día       | `IA_TOPE_DIARIO_USD`         | 10 $     |
| Todos, al mes       | `IA_TOPE_MENSUAL_USD`        | 150 $    |
| Plan gratis, al día | `IA_TOPE_GRATIS_DIARIO_USD`  | 2 $      |
| Plan gratis, al mes | `IA_TOPE_GRATIS_MENSUAL_USD` | 30 $     |

- **Se reserva el peor caso antes de llamar y se asienta lo real después.** Reservar
  es lo atómico —los topes van en el `where` del `on conflict`, como el cupo—; lo real
  sale del `usage` de cada respuesta al precio de `MODEL_PRICES`, y una llamada sin
  `usage` —un tiempo agotado— se queda en el peor caso. Si el proceso se cae entre
  medias, se cuenta de más.
- **El de todos cierra la IA para todo el mundo**, de pago incluido, con un `503` que
  dice que no es el cupo de quien pide y hasta cuándo, y `Retry-After` hasta la
  medianoche UTC o el día uno. **El de lo gratis cierra solo lo gratis**: un ataque
  con cuentas gratis no deja sin profesor a quien paga.
- **Va antes que el cupo**: una petición que el techo para no le cuesta una pregunta
  a nadie. Si después es el cupo el que dice que no, la reserva se devuelve.
- **Solo cuenta la API.** El modelo de casa y el dominio no cuestan.
- **Sin base de datos no se sirve**: sin cuentas no hay IA, y un contador que no
  contesta cierra igual que el cupo.
- **Los de serie son los de una copia que acaba de abrir.** Con clientes, el mensual
  tiene que cubrir lo que pueden gastar sus cuentas de pago más el de lo gratis
  (`docs/DESPLIEGUE.md`). Y no sustituye al **límite de gasto de la consola de
  Anthropic**, que es del dueño de la clave y el único que para una clave robada.

Con los de serie, el gasto máximo pasa de **sin techo** (unos 650 $/h, unos 15.600 $
al día) a **10 $ al día y 150 $ al mes**, y un ataque con cuentas gratis a **2 $ al día
y 30 $ al mes**.

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
lo que entra al mes = precio − IVA − comisión de la pasarela   (el menor: al mes o el anual entre doce)
cupo mensual        = (lo que entra al mes × 40 %) / coste de una pregunta al profesor
lo que gasta una petición = su coste / coste de una pregunta, hacia arriba
```

- **El 40 %** es lo único que es una decisión de negocio y no una medida: la parte de
  **lo que entra de verdad** que puede irse en llamadas al modelo. Deja un **60 % de
  margen** para servidor, base de datos y beneficio.
- **Lo que entra es el precio sin IVA y sin comisión.** Estuvo contado sobre el
  precio con IVA, y el «60 %» era mentira: de 4,99 € se van 0,87 de IVA y hasta 0,68
  de comisión, y el margen real en el peor mes quedaba entre el **43 y el 45 %**
  ([adr/0106](./adr/0106-el-margen-se-cuenta-sin-iva-y-con-pago-anual.md)).
  - **IVA: el 21 % de España, y es un supuesto.** La pasarela es la vendedora oficial
    ([adr/0105](./adr/0105-la-pasarela-y-los-precios-por-pais.md)) y cobra el IVA del
    país de quien paga, que en la Unión va del 17 % al 27 %. En Hungría (27 %) el
    margen con el modelo por defecto baja del 60 al 58 %; en Luxemburgo (17 %) sube.
  - **Comisión: el peor caso de Stripe Managed Payments**, 8,65 % + 0,25 € por
    cobro: 3,5 % de ser la vendedora oficial, 3,15 % de una tarjeta de fuera del
    Espacio Económico Europeo y 2 % de cambio de divisa. Con una tarjeta europea son
    5 % + 0,25 €.
  - **El menor entre mensual y anual**, porque el cupo es uno por plan y el anual,
    con dos meses gratis, deja menos al mes: 3,06 € en Básico frente a 3,44 al mes,
    y 6,14 € en Medio frente a 7,14.
- **El peor caso, no el típico.** Quien quiera gastar gastará el máximo, así que el
  cupo cuadra con el máximo: gastado entero en lo más caro, no pasa del presupuesto.
  Lo garantiza redondear hacia arriba lo que gasta cada petición —una salida cuesta
  2,01 preguntas y gasta 3—. Calcularlo sobre el gasto medio funciona hasta que
  aparece el primer usuario que aprieta.
- **El tope de salida no es una estimación**: es el `max_tokens` que imponen las
  rutas, leído del mismo sitio que el cálculo. Escritos por separado se separarían.
  **Y en los modelos que no dejan apagar el pensamiento lleva una reserva de 1.024
  tokens para pensar**, que el coste paga entera: lo que piensan se cobra como salida
  y cuenta dentro del tope.
- **El texto libre se cuenta en su peor alfabeto.** La pregunta y las directrices se
  medían como castellano, a 3,2 caracteres por token: 75 tokens. Con caracteres chinos
  o yi eran hasta 587, y el cupo no los pagaba. Un token es al menos un byte, y el
  contrato recorta lo libre a lo que pesaría como 240 letras latinas
  ([adr/0115](./adr/0115-la-marca-no-se-adivina-y-lo-libre-se-acota-en-el-peor-alfabeto.md)), así
  que el peor caso son 240 letras con tilde de dos bytes: **480 tokens más** en la
  entrada de cada petición (`peorTextoLibreEnTokens`,
  [adr/0114](./adr/0114-el-gasto-de-la-ia-tiene-techo-y-la-cuenta-se-cierra-en-orden.md)).
  Es lo que bajó Básico de 113 a 96 preguntas y Medio de 227 a 193.
- **Un euro se cuenta como un dólar.** Es falso a nuestro favor y evita tener que
  vigilar el cambio de divisa cada mes.

Con eso, y los precios de la API a 7 de octubre de 2026 (entrada/salida por millón):

|                          | Sonnet 5.5 (2/10 $) | Haiku 4.5 (1/5 $) | Opus 5 (5/25 $) | Opus 5.5 (4/20 $) | Fable 5.1 (10/50 $) |
| ------------------------ | ------------------- | ----------------- | --------------- | ----------------- | ------------------- |
| Pensamiento              | se apaga            | no piensa         | se apaga        | no se apaga       | no se apaga         |
| Una pregunta al profesor | 1,27 cts            | 0,64 cts          | 3,18 cts        | 6,64 cts          | 16,60 cts           |
| Una tanda de salidas     | 2,55 cts            | 1,28 cts          | 6,38 cts        | 9,20 cts          | 23,00 cts           |
| Una salida gasta         | 3 preguntas         | 3                 | 3               | 2                 | 2                   |
| Básico                   | 96/mes · 16/día     | 192 · 31          | 38 · 7          | 18 · 3            | 7 · 2               |
| Medio                    | 193/mes · 32/día    | 386 · 63          | 77 · 13         | 36 · 6            | 14 · 3              |

Sonnet 5 cuesta y da lo mismo que Sonnet 5.5, y Fable 5 lo mismo que Fable 5.1. **Un
modelo vigente nunca cae en el precio de respaldo**: está en la tabla, y un test lo
comprueba. Uno que no esté se cobra como Fable pensando, y sus cupos salen de siete.

Antes de esta cuenta, con Opus 5 y el margen sobre el precio con IVA, Básico daba 73
preguntas al mes y Medio 148; con el margen contado bien, Opus 5 daría 45 y 90, y con
el texto libre en su peor alfabeto, 38 y 77. El cambio a Sonnet 5.5 es lo que deja los
cupos por encima de los de antes con el margen de verdad ([adr/0103](./adr/0103-los-modelos-vigentes-y-el-de-por-defecto.md)).

**Los números de la tabla son preguntas, no peticiones.** Si el cupo se dividiera
entre la pregunta y cada salida gastara una sola, el plan prometería un número que el
dinero no paga: es exactamente el fallo que este fichero vino a arreglar. Por eso lo
caro gasta más de una, y un test comprueba que gastar el cupo entero en salidas no
pasa del presupuesto con ningún modelo ([adr/0067](./adr/0067-el-cupo-se-cuenta-en-preguntas.md)).

**Cambiar `ANTHROPIC_MODEL` multiplica los cupos sin tocar una línea de código**, y
la pantalla enseña los del modelo que haya puesto. Es potente y es un cañón: bajar de
modelo sube los cupos y baja la calidad de las respuestas, y de lo segundo no avisa
nada.

Un test comprueba que **ningún plan de pago pierde dinero con ningún modelo**, ni
gastándose el cupo entero, ni con un modelo que no esté en la tabla, y que el margen
sobre lo que entra es al menos el 60 % con todos.

### Dos topes, no uno

- **El del mes protege el dinero.** Es el periodo de facturación y es el que sale de
  la división de arriba.
- **El del día protege la experiencia.** Está puesto en cinco días de gasto medio:
  evita fundirse el mes en una tarde y quedarse veintinueve días sin profesor, que es
  una forma rara de cumplir lo prometido.

Cuando se agota uno, el mensaje dice **cuál**: no se arreglan igual, uno se espera a
mañana y el otro se arregla subiendo de plan o esperando al día uno.

### Sin pensar donde se puede, y a propósito

Las dos rutas piden al modelo que **piense lo menos posible** y trabajan con esfuerzo
bajo. La respuesta la fija un esquema JSON: no hay nada que razonar. El pensamiento se
cobra como salida y cuenta dentro del `max_tokens`, así que dejarlo puesto multiplica
el coste de cada pregunta y puede gastarse el tope pensando y devolver una respuesta
truncada: se paga y no se sirve.

**Cada modelo se apaga de una manera, y mandarles lo mismo a todos era un 400.** Se
mandaba `thinking: disabled` y `effort: low` a todos; Opus 5.5 y Fable no dejan apagar
el pensamiento, Sonnet 5.5 lo apaga con `between_tools` y Haiku 4.5 no acepta
`effort`. Con cualquiera de ellos puesto, ninguna pregunta llegaba a contestarse. Qué
acepta cada uno está en la tabla de `cost.ts` y lo manda
[`server/ask-model.ts`](../src/server/ask-model.ts) (`opcionesDelModelo`):

| Modelo                       | `thinking`      | `effort` | Reserva para pensar |
| ---------------------------- | --------------- | -------- | ------------------- |
| Opus 5, Sonnet 5, Sonnet 4.6 | `disabled`      | `low`    | —                   |
| Sonnet 5.5                   | `between_tools` | `low`    | —                   |
| Opus 5.5, Fable 5 y 5.1      | sin mandar      | `low`    | 1.024 tokens        |
| Haiku 4.5                    | sin mandar      | sin él   | —                   |
| Uno que no esté en la tabla  | sin mandar      | `low`    | 1.024 tokens        |

Con el pensamiento apagado, la documentación del modelo avisa de que puede colarse
alguna etiqueta interna en la salida, así que los dos prompts de sistema piden
explícitamente que no las incluya. Los prompts viven juntos en
[`server/prompts.ts`](../src/server/prompts.ts) porque de su longitud dependen los
cupos: `server/prompts.test.ts` los mide y falla si crecen hasta comerse la holgura
del presupuesto de tokens. Desde que el profesor lleva los acordes de la tonalidad y
hasta dos entradas del glosario de teoría
([adr/0076](./adr/0076-el-profesor-se-apoya-en-un-glosario-comprobado.md)), ese test
construye el peor prompt de verdad pieza a pieza en vez de reservar un hueco a ojo,
y cabe en los mismos 700 tokens.

## El avance: dónde vive y cómo se junta

El navegador sigue siendo la copia de trabajo, también con cuenta. Se escribe
siempre primero en `localStorage` y se sube después, así que terminar una unidad no
espera a la red y una unidad terminada en un túnel no se pierde.

**La fusión la hace el servidor**, no el navegador. Es lo importante: si el
navegador leyera, fusionara y escribiera, dos aparatos abiertos a la vez se
pisarían y el segundo en escribir borraría lo del primero. Fusionando en el
servidor, subir es siempre seguro y nunca hay que decidir quién gana. **Y en una
transacción** (`fusionarAvance`, con `select … for update`): leer, fundir y escribir
sueltos dejaba que dos subidas simultáneas se pisaran igual dentro del servidor
([adr/0116](./adr/0116-el-avance-que-sube-se-comprueba.md)).

**Lo que sube se comprueba con el día del servidor.** `parseProgress` recibe `hoy`
(UTC) y no se cree una fecha posterior a mañana, una racha más larga que los días
que lleva existiendo la aplicación ni un XP del día por encima de lo posible
(`MAX_XP_DEL_DIA`). Las medallas que lo hecho demuestra se calculan, y de las demás
se quedan solo las posibles. Lo guardado pasa por lo mismo al leerse, así que un
valor envenenado antes se repara en la siguiente subida. Subir el avance tiene tope
por cuenta —sesenta por minuto—, y guardar canciones otro —treinta—.

Qué hace la fusión (`mergeProgress`, en el dominio y con tests):

- **La unión de las unidades hechas.** Nadie estudió de menos.
- **La racha más larga que siga viva.** Una racha de treinta días que se cortó hace
  un mes no es una racha viva, y no revive al fusionar.
- **Todas las medallas**, en el orden del catálogo, que ya llegan comprobadas.
- **Del XP del día, el mayor y no la suma.** Sumar dos aparatos que estuvieron
  abiertos a la vez inventaría trabajo que no se hizo. Y lo mismo con **lo que de
  ese XP salió de componer**, que se guarda aparte porque tiene su propio tope
  diario ([adr/0028](./adr/0028-componer-tambien-cuenta.md)): con la suma, dos
  navegadores abiertos a la vez gastarían un tope que nadie llegó a gastar dos
  veces.
- **De la cola de repaso, lo peor de cada una.** Si un aparato dice que la pregunta
  se sabe y el otro que se acaba de fallar, lo cierto es que se falló: dar por
  sabido lo que no se sabe es el único error que esa cola no puede permitirse.

El XP total no se fusiona: se recalcula desde las unidades hechas, que ya están
unidas. Es la misma regla que ya protegía al `localStorage`.

Entrar en una cuenta desde un navegador donde ya se había estudiado sin cuenta no
pierde nada, y salir tampoco borra nada: el avance local se queda donde está.

## Qué se guarda de quien entra

Lo de las cuentas está en ocho tablas, y la analítica en tres más
(`src/server/db/schema.ts`):

- **`users`**: correo en minúsculas, nombre si lo ha dicho, la contraseña cifrada,
  el plan, **cuándo declaró tener 14 años o más** —nulo en las cuentas de antes de
  que se preguntara— y **desde cuándo falla el cobro**, si falla (`impagada_desde`,
  el plazo de gracia de «Cómo se cobra»).
- **`progress`**: el avance entero como un documento JSON, uno por cuenta. Incluye
  por qué curso decidió empezar, que es una preferencia y no un logro.
- **`ai_usage`**: una fila por cuenta y mes con cuántas preguntas del cupo lleva,
  y las de hoy.
- **`ai_uso_heredado`**: lo que había gastado este mes **una cuenta que se borró**,
  por la **huella de su correo** —un HMAC con `AUTH_SECRET`, nunca el correo— y un
  número. Sin esto, borrarse y volver con el mismo correo devolvía el cupo entero; al
  volver se suma. Se borra al mes siguiente, que es cuando deja de proteger nada
  ([adr/0114](./adr/0114-el-gasto-de-la-ia-tiene-techo-y-la-cuenta-se-cierra-en-orden.md)).
- **`ai_gasto`**: cuánto se ha gastado en el modelo **entre todos**, en dinero, este
  mes y hoy. No es de nadie: es el techo de gasto.
- **`rate_limits`**: cuántas peticiones seguidas lleva una dirección. No es de
  nadie: la clave es una dirección IP —una IPv6, su /64— y para qué era el
  contador; el de la analítica guarda la huella de la dirección, no la dirección, y
  los de entrar y `/olvidada` la **huella del correo**, no el correo
  ([adr/0113](./adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
  Las filas se borran solas al caducar la ventana.
- **`password_resets`**: el vale para recuperar la contraseña, **por su huella SHA-256 y
  nunca el vale**, con su caducidad (una hora) y cuándo se gastó
  ([adr/0013](./adr/0013-el-correo-como-puerto.md)).
- **`songs`**: una fila por canción —no un documento por cuenta como el avance,
  porque una canción se abre, se renombra y se borra de una en una—. Dentro van la
  tonalidad, el tempo y **los grados**, nunca los cifrados: por eso una canción
  guardada se puede abrir en otro tono sin traducir nada.

Y la analítica ([adr/0110](./adr/0110-contar-sin-seguir.md)), que no es de la
cuenta sino de cómo se usa la aplicación:

- **`metricas_conteo`**: cuántas veces pasó cada cosa cada día —una visita a una
  ruta, una unidad terminada, una canción guardada, una toma—. Sumado, sin nadie
  dentro.
- **`metricas_visitantes`** y **`metricas_dias`**: un seudónimo —HMAC con
  `AUTH_SECRET` de la cuenta, o del número al azar de un navegador que ha dicho que
  sí— con su primer día y los días en que estuvo. Ni correo ni IP. Los días se
  borran a los trece meses, y los de una cuenta **al borrarla**: el seudónimo no
  cuelga de `users` con una clave foránea, así que lo borra a mano la ruta de borrar
  la cuenta.

**Ni una muestra de audio.** Eso no sale del equipo, y las
cuentas no han cambiado eso: lo que viaja del progreso son identificadores de
unidad, números y fechas, y lo que viaja de una canción son grados, un número,
nombres de sección —texto que puso quien las escribió— y —desde
[adr/0028](./adr/0028-componer-tambien-cuenta.md)— qué papel hace cada parte,
que es uno de ocho valores escritos en el código y no texto libre.

### Las contraseñas

`scrypt`, el del módulo `crypto` de Node. Sin dependencias: bcrypt y argon2 se
compilan al instalar, y una dependencia que se compila es la que rompe el
despliegue en la máquina sin compilador. Es la misma razón que hay detrás de
[adr/0002](./adr/0002-deteccion-de-tono-propia.md), y `scrypt` es una de las tres
funciones que OWASP recomienda para esto.

El formato guardado lleva sus propios parámetros dentro
—`scrypt$16384$8$5$sal$clave`— para poder subir el coste sin invalidar lo guardado.
**Se subió el 2 de octubre de 2026**: los de antes (`p=1`) eran el ejemplo de la
documentación de Node y tardaban 31 ms; los de ahora son una de las cinco
combinaciones de OWASP (`N=2^14, r=8, p=5`), tardan unos 120 ms y ocupan los mismos
16 MiB. Una cuenta con los viejos sigue entrando, y **al entrar se vuelve a cifrar**
con los nuevos, que es el único momento en que se tiene la contraseña en claro.

Dos detalles que no se ven y que están probados:

- **La comparación es en tiempo constante.** Comparar con `===` filtra cuántos
  bytes iniciales acertaste por lo que tarda en fallar.
- **Entrar con un correo que no existe cifra igual de lento**, con los parámetros
  de hoy. Si no, la diferencia se mide desde fuera y regala la lista de quién tiene
  cuenta aquí.

### El plan no viaja en la cookie

La cookie de sesión lleva solo el identificador de la cuenta. El plan se lee de la
base de datos cada vez que hace falta, que es justo cuando ya hay que ir a mirar el
cupo del día. Si el plan fuese dentro de la cookie, quien acaba de pagar seguiría
viendo candados y quien acaba de bajarse seguiría gastando, hasta que la cookie
caducara.

## Cómo se cobra: no se cobra

Hay una interfaz de facturación (`server/billing/port.ts`) y, sin Stripe, detrás
está `FakeBilling`, que **cambia el plan y no cobra nada** —fuera de producción— o
`CobroCerrado`, que en producción no deja subir de plan. Es el mismo patrón que
`AudioInput` o `SessionStorage`, y el porqué está en
[adr/0006](./adr/0006-planes-y-puerto-de-facturacion.md).

La pantalla de planes lo sabe: el cobrador declara `charges: false` y por eso puede
avisar de que aquí no se cobra. Una pantalla de pago que no cobra y no lo dice es
una pantalla que engaña.

**Fuera de producción, cualquiera con una cuenta puede darse el plan Medio**: entra
en `/planes/medio`, pulsa el botón y lo tiene. En producción ya no: antes sí, en
cualquier copia publicada a la que le faltara una variable de Stripe.

**Borrar la cuenta cancela antes la suscripción**, por el mismo cobrador que el botón
de cancelar: primero se para el cobro y, si la pasarela no contesta, **no se borra
nada** y se dice por qué (`502`). Antes se borraba la cuenta y Stripe seguía cobrando
cada mes a quien ya no existía, con sus avisos contestados «esa cuenta ya no está»
([adr/0114](./adr/0114-el-gasto-de-la-ia-tiene-techo-y-la-cuenta-se-cierra-en-orden.md)).

**Un cobro que falla tiene siete días de gracia** (`DIAS_DE_GRACIA`). Con `past_due`
Stripe reintenta el cobro, y su guía pide avisar y no cortar; pero conservaba el plan
**sin plazo**, y dependía de que Stripe estuviera configurado para acabar en `unpaid`.
Ahora el primer `past_due` apunta la fecha, el plan se conserva una semana y después
se lee como gratis; en cuanto Stripe cobra, vuelve. **Y los avisos de la suscripción
no se creen**: el webhook le pregunta a Stripe cómo está ahora, igual que con los
pagos, porque un `active` reintentado días después del `unpaid` devolvía el plan.

**La pasarela será Stripe, como vendedora oficial** (Managed Payments): cobra el IVA
de cada país de la Unión y de Latinoamérica y lo declara ella, que es lo que una
persona sola no puede hacer en treinta países. Por qué Stripe y no Paddle, y por qué
un solo precio en euros al publicar, está en
[adr/0105](./adr/0105-la-pasarela-y-los-precios-por-pais.md). **Nada de eso se ha
ejecutado**: lo que falta está en [PARA-PUBLICAR.md](./PARA-PUBLICAR.md).

## Lo que hace falta configurar

| Variable       | Hace falta            | Para qué                                                          |
| -------------- | --------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL` | Solo para las cuentas | Postgres. Sin ella no hay cuentas y todo lo demás funciona igual. |
| `AUTH_SECRET`  | Solo para las cuentas | Firmar la cookie de sesión. Sin ella tampoco hay cuentas.         |

Y los cuatro topes del techo de gasto de la IA (`IA_TOPE_*_USD`), opcionales y con
valores de serie prudentes: la tabla está en «El techo de gasto de todos».

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
de pago tienen tests.

**El camino con base de datos de verdad ya está andado**, con el Postgres de
`compose.yml` (1 de agosto de 2026): se crean las tablas de entonces (hoy son once), se registra una cuenta
—y el correo se normaliza, y el repetido da 409—, se entra y se rechaza la contraseña
equivocada, se cambia el nombre y la contraseña —y con la vieja ya no se entra—, se
sube de plan, el avance se fusiona sin perder nada al mandar menos del que hay, y el
contador de `ai_usage` sube al pedirle algo al modelo. Estuvo escrito sin ejecutar
desde la fase 8 hasta entonces, y lo que salió de ejecutarlo fue una falta de
concordancia en un mensaje —«Las ideas de la IA _entra_ en el plan Medio»—, no un
fallo de consulta.

Lo que sigue sin probarse es lo que pide dinero o infraestructura de verdad: la
pasarela de pago —`StripeBilling` está escrita y nunca se ha ejecutado contra Stripe, adr/0077— y las respuestas del modelo con una clave puesta.
