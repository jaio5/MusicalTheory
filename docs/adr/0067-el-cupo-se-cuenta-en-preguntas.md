# ADR 0067 — El cupo se cuenta en preguntas al profesor, y una salida gasta varias

Fecha: 2026-10-01 · Estado: aceptada · Corrige: el cálculo de cupos de
[ADR 0008](./0008-los-cupos-salen-del-precio.md) · Cierra lo que dejó abierto
[ADR 0066](./0066-las-ideas-se-retiran-y-las-salidas-bajan-a-medio.md)

## Contexto

El cupo de un plan era su presupuesto dividido entre **la petición más cara que
ese plan puede hacer** ([ADR 0008](./0008-los-cupos-salen-del-precio.md)). Con
eso, quien se gaste el cupo entero en lo más caro no pasa del presupuesto, y cada
petición descontaba una del contador, fuera la que fuera.

Funcionó mientras la petición más cara de cada plan subía con el precio. Dejó de
funcionar con [ADR 0066](./0066-las-ideas-se-retiran-y-las-salidas-bajan-a-medio.md):
al bajar las salidas a Medio, el cupo de Medio pasó a dividirse entre una tanda de
salidas, que cuesta 2,19 preguntas al profesor. Medio daba **67 peticiones al mes
y Básico 73**, con cualquier modelo de la tabla un 9 % menos, costando el doble.
El número cuadraba con el dinero y engañaba a quien lo leía, y el test de
`cost.test.ts` que pide que cada plan dé más cupo que el anterior fallaba por eso.

## Decisión

**El cupo se cuenta en preguntas al profesor, y cada petición gasta las que
cuesta.** Es un solo cupo, compartido como antes.

- El cupo de **todos** los planes es su presupuesto entre el coste de una
  pregunta: `presupuesto / coste('profesor', modelo)`.
- Una petición gasta `unidadesDe(clase, modelo)` = coste de esa petición entre
  coste de una pregunta, **redondeado hacia arriba**. Una pregunta gasta una y una
  tanda de salidas, tres, con cualquier modelo de la tabla de hoy.
- **Enteras o nada**: con dos preguntas restantes no cabe una salida, y no se
  apunta nada. Lo comprueba la misma sentencia de `server/ai-usage.ts` que ya
  miraba los dos topes; las columnas de `ai_usage` son los mismos enteros, ahora
  en preguntas, así que **no hay migración**.
- Las pantallas lo dicen sin tecnicismos: «148 preguntas al profesor al mes; una
  salida gasta 3». La segunda mitad solo en los planes con salidas.

El redondeo hacia arriba es lo que mantiene la promesa de
[ADR 0008](./0008-los-cupos-salen-del-precio.md): gastado el cupo entero en
salidas, el gasto se queda por debajo del presupuesto, y lo vigila un test con
todos los modelos y con uno desconocido. El margen del peor mes se calcula ahora
para cada clase de petición que el plan abre, y gana el más caro.

Con `claude-opus-5`, al mes y al día:

| Plan   | Antes (0066) | Ahora              |
| ------ | ------------ | ------------------ |
| Básico | 73 · 12      | 73 · 12            |
| Medio  | 67 · 11      | 148 · 24 preguntas |
| Pro    | 135 · 22     | 296 · 48 preguntas |

Medio da algo menos de 50 salidas al mes y Pro, 98. Gastado en salidas, Medio
sigue dando más que Básico en preguntas porque Básico no puede pedirlas.

## Alternativas descartadas

**Subir el precio de Medio** hasta que su cupo en salidas pasara del de Básico.
Arregla el número sin tocar el contador, y cambia una decisión de precio por una
cuenta: harían falta 10,92 € y el precio lo eligió el usuario, que no lo
quiere tocar. Además el problema volvería con la próxima petición cara que entre
en un plan barato.

**Aceptar que Medio dé menos y cambiar el test.** Es honrado con el dinero: cada
petición de Medio vale más. Pero la pantalla de planes enseñaría un número más
pequeño en el plan más caro, y eso se lee como una trampa, que es lo que el test
existe para impedir. Debilitarlo sería quitar la alarma en vez de apagar el fuego.

**Dos cupos, uno por clase de petición.** Ya se descartó en
[ADR 0006](./0006-planes-y-puerto-de-facturacion.md): dos números que explicar en
vez de uno, y quien paga quiere gastar en lo que le haga falta hoy.

## Consecuencias

- `monthlyAiRequests` y `dailyAiRequests` dan **preguntas**, no peticiones. La
  constante `UNIDAD_DEL_CUPO` dice cuál es la unidad, y `worstFeature` ya no existe.
- `spendAiRequest` recibe cuántas unidades gasta; `spendAi` las calcula con el
  modelo configurado.
- El aviso de cupo agotado dice, si lo pedido era una salida, que una salida gasta
  tres: con dos restantes, «se te han acabado» sin más se leería como mentira.
- El cupo diario tiene que caber al menos una salida. Con los precios de hoy el más
  pequeño de pago es 6 al día (Básico con `claude-fable-5`), y Básico no tiene
  salidas; el más pequeño con salidas es 12.
- Si un día una petición costara menos que una pregunta, gastaría una igualmente:
  el redondeo hacia arriba nunca da cero.
