# ADR 0077 — La suscripción se guarda en la cuenta, y cambiar de plan va por el portal

> **Completado por [ADR 0114](./0114-el-gasto-de-la-ia-tiene-techo-y-la-cuenta-se-cierra-en-orden.md):** el gasto de la IA tiene un techo propio y la cuenta se cierra en orden, también a quien paga.

Fecha: 2026-10-02 · Estado: aceptada, **sin probar contra Stripe** · Completa
[ADR 0006](./0006-planes-y-puerto-de-facturacion.md), que dejó el cobro como puerto

## Contexto

El puerto de facturación estaba y detrás solo había un cobrador de mentira. La
auditoría del 2 de octubre lo leyó pensando en el día en que haya uno de verdad y
encontró cinco sitios donde publicar tal cual habría costado dinero:

- **El webhook buscaba a quién cambiar el plan por los metadatos del aviso**, y
  por el correo cuando abría el portal. Un aviso viejo que llega tarde —Stripe no
  garantiza el orden— traía una suscripción ya soltada y le devolvía el plan de
  pago a quien se había dado de baja. Y Checkout con `customer_email` crea un
  cliente nuevo cada vez: buscar «el cliente de este correo» devolvía uno cualquiera.
- **Pasar de un plan de pago a otro abría otro Checkout**, y Stripe crea con él una
  suscripción nueva: la vieja seguía cobrando.
- **Cualquier estado malo cortaba el plan.** Un cobro que falla una vez dejaba sin
  plan a quien paga, cuando Stripe lo reintenta durante días.
- **Cancelar bajaba el plan y no le decía nada a Stripe**, que seguía cobrando cada
  mes a quien ya no tenía nada.
- **En producción, sin Stripe, el cobrador era el de mentira**: a una copia publicada
  a la que le faltara una de las cinco variables bastaba pulsar «Pro» para tener Pro.

## Decisión

**La suscripción vive en `users`**: `stripe_customer_id` y `stripe_subscription_id`,
este último único (migración `drizzle/0005`). Se escriben a la vez que el plan, en
una sentencia (`vincularSuscripcion`), porque son lo mismo dicho tres veces.

- **Los avisos de la suscripción se aplican a quien la tiene guardada**
  (`planDeSuscripcion`), no a quien digan los metadatos. Una suscripción que ya se
  soltó no encuentra a nadie, y el orden de llegada deja de importar. El portal usa
  el cliente guardado, no el correo.
- **Cambiar de plan con la suscripción viva va por el portal**, con el flujo
  `subscription_update_confirm`: ahí Stripe enseña el prorrateo, cobra la diferencia
  y pide la autenticación de la tarjeta si hace falta. El plan nuevo llega después
  con `customer.subscription.updated`.
- **`past_due` e `incomplete` no tocan el plan**, como pide la guía de Stripe: se
  avisa a quien paga, no se le corta. Quitan `canceled`, `unpaid`,
  `incomplete_expired` y `paused`; un estado que no se conoce tampoco toca nada
  (`accesoDe`).
- **Cancelar va primero a Stripe y, si falla, no se toca el plan.** Un 404 es que ya
  no existía y cuenta como hecho. Invierte lo de antes.
- **En producción sin pasarela, `CobroCerrado`**: no deja subir de plan. Fuera de
  producción sigue `FakeBilling`.

## Consecuencias

Una copia publicada sin Stripe no regala planes. Quien cancela y ve un fallo tiene
que volver a intentarlo, pero no se queda pagando sin plan.

**Nada de esto se ha ejecutado contra Stripe.** Los nombres de los campos y de los
estados salen de su documentación y los tests prueban la petición que se construye
y qué se hace con lo que conteste, con avisos de la forma que ella describe. Que el
portal esté configurado para cambiar entre esos precios, que el flujo
`subscription_update_confirm` acepte la petición tal cual y que los avisos lleguen
en el orden y con los campos esperados es lo primero que habrá que ver con una
clave de pruebas ([PARA-PUBLICAR.md](../PARA-PUBLICAR.md), [DESPLIEGUE.md](../DESPLIEGUE.md)).

Las columnas nacen vacías: una cuenta con plan de pago puesto antes de esta
migración no tiene suscripción guardada, y ningún aviso de Stripe le cambiará el
plan.

**Una cuenta, una suscripción** (añadido tras la revisión final). Antes de vincular
un pago, el webhook pregunta a Stripe por el estado de esa suscripción: si ya está
terminada no da nada, y si no se sabe contesta 500 para que Stripe reintente. Nunca
pisa otra suscripción guardada. Si la guardada sigue viva, cancela la nueva; si está
muerta, la nueva ocupa su sitio. Así dos Checkout a la vez dejan una sola cobrando, y
un pago reintentado después de la baja no devuelve el plan. Cuesta una llamada a
Stripe por pago, y **cancelar la que sobra no devuelve su primer cobro**: queda en el
registro, solo con identificadores, para devolverlo a mano. Descartadas: fiarse del
aviso, que no sabe si llega tarde; un registro de eventos vistos, que no arregla dos
suscripciones vivas; y cancelar la vieja, que es la que conocen la cuenta y los avisos.

## Alternativas descartadas

**Buscar por metadatos o por correo.** Los metadatos los escribimos al crear la
sesión y dicen quién empezó el pago, no quién tiene hoy la suscripción; el correo
cambia y Checkout crea un cliente por pago. Los dos reabrían un plan a quien se dio
de baja.

**Otro Checkout para cambiar de plan.** Es lo más corto y cobra dos veces.

**Actualizar la suscripción por la API**, cambiando el precio desde el servidor. Se
salta la pantalla donde Stripe enseña el prorrateo y la autenticación de la
tarjeta, que es lo que hay que dejarle a Stripe.

**Cortar el plan en el primer `past_due`.** Castiga un fallo que casi siempre es
transitorio, y Stripe ya manda `unpaid` o `canceled` cuando los reintentos se agotan.

**Una variable que encienda el cobrador de mentira en producción.** Es un
interruptor para que una copia publicada regale planes, y la única razón de tenerlo
sería probar: para eso está el entorno de desarrollo.
