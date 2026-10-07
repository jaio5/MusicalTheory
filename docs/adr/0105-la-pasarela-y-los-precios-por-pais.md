# ADR 0105 — Stripe como vendedora oficial, y un precio en euros al publicar

Fecha: 2026-10-07 · Estado: aceptada, **sin dar de alta ni ejecutar** · Completa:
[ADR 0006](./0006-planes-y-puerto-de-facturacion.md) y
[ADR 0077](./0077-la-suscripcion-se-guarda-en-la-cuenta.md)

## Contexto

El cobro es un puerto ([adr/0006](./0006-planes-y-puerto-de-facturacion.md)) y detrás
hay un adaptador de Stripe escrito y probado con avisos de la forma que documenta
Stripe, **nunca contra Stripe** ([adr/0077](./0077-la-suscripcion-se-guarda-en-la-cuenta.md)).
Lo que no estaba decidido es **quién es el vendedor**, y de eso depende el IVA.

Una suscripción de software vendida a particulares paga el IVA **del país de quien
compra**. En la Unión se declara por la ventanilla única (OSS) desde España, cada
trimestre, con el tipo de cada país, del 17 % al 27 %. Fuera, cada país de
Latinoamérica que importa —México, Colombia, Chile, Argentina, Brasil— tiene su
propio régimen para servicios digitales de un proveedor extranjero, con alta y
declaraciones propias. Una persona sola no puede llevar eso. Y el estudio de negocio
apunta a esos dos mercados: hispanohablantes, en la Unión y en Latinoamérica.

Hay pasarelas que son **vendedoras oficiales** (_merchant of record_): venden ellas,
cobran y declaran el IVA de cada país, y pagan el neto. Las tarifas, de sus páginas
el 7 de octubre de 2026:

| Pasarela                             | Vendedora oficial | Comisión                                                                                                     | Encaje con lo escrito             |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Stripe Managed Payments              | sí, 80+ países    | 3,5 % + la de pagos: 1,5 % + 0,25 € con tarjeta europea; 3,15 % + 0,25 € de fuera, +2 % con cambio de divisa | Checkout y Billing: lo que ya hay |
| Paddle                               | sí                | 5 % + 0,50 $ por cobro; «precio a medida» por debajo de 10 $                                                 | Adaptador nuevo                   |
| Stripe sin vendedora, con Stripe Tax | no                | 1,5 % + 0,25 € (europea), + Stripe Tax                                                                       | Lo que ya hay                     |

Stripe Managed Payments admite negocios con sede en España, vende software como
servicio a más de 195 países y **solo funciona con Checkout y enlaces de pago**, que
es justo lo que usa el adaptador.

## Decisión

**La pasarela es Stripe, como vendedora oficial (Managed Payments).** El adaptador de
`server/billing/stripe.ts` se queda: Checkout para empezar, el portal para cambiar de
plan, el webhook para dar el plan. Lo que cambia es la cuenta de Stripe, no el código,
salvo que la sesión de Checkout pida algún parámetro para ir por Managed Payments, que
se añadiría ahí.

**El margen se calcula con su peor caso**: 8,65 % + 0,25 € por cobro —3,5 de vendedora
oficial, 3,15 de tarjeta de fuera del Espacio Económico Europeo y 2 de cambio de
divisa— ([adr/0106](./0106-el-margen-se-cuenta-sin-iva-y-con-pago-anual.md)). Con
tarjeta europea son 5 % + 0,25 €; los cupos son uno para todos y cuadran con el peor.

**Al publicar, un precio en euros para todos, con el IVA dentro.** 4,99 € es 4,99 € en
Madrid y en Ciudad de México; Stripe enseña la moneda local y convierte. **Los precios
rebajados por país quedan fuera** hasta que haya ventas que digan de dónde se compra y
dónde se abandona en el pago. Cuando entren, una regla:

> **El cupo de un plan se calcula con el precio más bajo al que se venda.**

Así el margen sigue siendo el que dice en todas partes, a cambio de que bajar el
precio en un país baje el cupo de todos. Si eso resulta caro, la salida es un cupo por
precio, que pide guardar en la cuenta a qué precio paga cada uno: es otra decisión, y
se tomará con datos.

**No se escribe ningún adaptador nuevo.** Lo pendiente —aprobación, productos,
precios, portal— está en [PARA-PUBLICAR.md](../PARA-PUBLICAR.md).

## Alternativas descartadas

**Paddle.** Es la vendedora oficial más conocida para software y cobra lo mismo en
todo el mundo, sin distinguir tarjetas. Pero pide **un adaptador entero nuevo**
—sesión de pago, avisos con su firma, su portal, su forma de cambiar de plan—, y todo
lo que [adr/0077](./0077-la-suscripcion-se-guarda-en-la-cuenta.md) resolvió para Stripe
habría que volver a resolverlo sin haber ejecutado ni lo primero. Y en un cobro de
4,99 € no es más barata: unos 0,68 € —los 0,50 $ fijos, al cambio— frente a 0,50 de
Stripe con tarjeta europea y 0,68 en su peor caso; solo gana en un anual pagado con
tarjeta de fuera. Su propia página dice que por debajo
de 10 $ el precio se negocia. **Es la alternativa escrita si Stripe no aprueba la
cuenta**, y solo entonces se escribe el adaptador.

**Stripe sin vendedora oficial, declarando el IVA por la OSS.** Es lo más barato —1,5 %

- 0,25 € con tarjeta europea— y lo que el adaptador ya hace. Para la Unión se puede
  llevar desde España; para Latinoamérica no, y dejar fuera Latinoamérica es dejar
  fuera la mitad de quien habla español. Y la responsabilidad del IVA de cada venta
  sería nuestra.

**Lemon Squeezy u otras vendedoras pequeñas.** Mismo modelo que Paddle, con la misma
pega del adaptador nuevo y menos recorrido. Ninguna ventaja sobre las dos de arriba.

**Precios por país desde el principio**, con paridad de poder adquisitivo. Es lo que
hace la competencia grande y vende más en Latinoamérica. Pero no hay ni una venta que
diga cuánto bajar ni dónde, cada precio rebajado baja el cupo de todos —o pide un cupo
por precio guardado en la cuenta—, y los precios de cada país hay que vigilarlos con el
cambio de divisa. Se decide con datos, no antes.

**Precio sin IVA, sumado en el pago.** Es lo habitual entre empresas, y a un
particular le enseña un precio en la pantalla y otro en el pago. En la Unión, además,
a un consumidor hay que enseñarle el precio final.

## Consecuencias

- **El IVA lo cobra y lo declara Stripe**; aquí no hay que llevar ninguna declaración.
  Los cupos suponen el 21 % español: en Hungría (27 %) una venta deja algo menos y en
  Luxemburgo (17 %) algo más. Con el modelo por defecto, el margen en Hungría es un 58 %
  en vez de un 60 %.
- **El adaptador no cambia**, y lo que falta probar contra Stripe es lo mismo que
  antes más tres cosas: que apruebe la cuenta, que el portal funcione con Managed
  Payments y si Checkout pide algo para ir por él.
- Los productos de Stripe llevan el código fiscal `txcd_10103000` (software como
  servicio, uso personal) y los precios, el IVA incluido. Está en
  [DESPLIEGUE.md](../DESPLIEGUE.md#cobrar-de-verdad).
- Si Stripe no aprueba la cuenta, esta decisión se reabre con Paddle, que es la
  segunda y está razonada aquí.
