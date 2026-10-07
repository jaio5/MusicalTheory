# Para publicar y cobrar

**Nada de este documento está en marcha.** Aquí vive todo lo que hará falta el
día que esto salga de un equipo y lo use gente que paga, y está separado del
resto a propósito: mezclarlo con lo que funciona hoy es lo que hacía imposible
leer la documentación y saber qué es cierto.

Lo que sí funciona hoy está en los demás documentos, en presente. Lo que estorba
para usarla a diario, en [ROADMAP.md](./ROADMAP.md).

El plan es publicar la aplicación y **cobrar por suscripción**, con beneficio. No
hay fecha.

## Lo que está escrito y nunca se ha ejecutado

Tres puertos con la misma forma: sin sus variables de entorno hay una
implementación que no hace nada y **lo declara**, de modo que la aplicación
funciona entera sin ellos. Ninguno de los tres ha hablado con su servicio.

| Puerto     | Sin configurar                             | Qué falta para ejecutarlo                  |
| ---------- | ------------------------------------------ | ------------------------------------------ |
| **Cobro**  | `FakeBilling` cambia el plan sin cobrar    | Una clave de pruebas de Stripe y una tarde |
| **Correo** | `NoMailer` no manda, y la pantalla lo dice | Dos variables del proveedor                |
| **Modelo** | Contesta el dominio, o el Ollama de casa   | Una clave de API                           |

**El de cobro, en producción, no regala nada**: allí, sin Stripe, es `CobroCerrado`,
que no deja subir de plan. `FakeBilling` es solo fuera de producción.

**Y lo que hay escrito para Stripe** —cancelar en Stripe antes de bajar el plan,
cambiar de plan por el portal y no por otro Checkout, los cuatro avisos del webhook
con `payment_status` y los estados de la suscripción— sale de su documentación y
está probado con avisos de la forma que ella describe, **nunca contra Stripe**
([DESPLIEGUE.md](./DESPLIEGUE.md#cobrar-de-verdad)).

**Lo que falta probar contra Stripe**, con una clave de pruebas y la CLI
(`stripe listen`), y hasta entonces no se sabe
([adr/0077](./adr/0077-la-suscripcion-se-guarda-en-la-cuenta.md)):

- Que el portal, configurado para cambiar de plan con los cuatro precios —dos planes,
  al mes y al año—, **acepta el flujo `subscription_update_confirm`** tal como se
  construye, con su prorrateo y la autenticación de la tarjeta, también para pasar de
  mensual a anual.
- Que cancelar con `DELETE` sobre la suscripción **para el cobro** y que el aviso de
  baja llega y encuentra a su dueño.
- Que los cuatro avisos llegan con los campos que se leen —`payment_status`,
  `customer`, `subscription` y el precio de `items`— y que el orden en que llegan no
  cambia el plan que queda.
- Qué pasa con `past_due` a la vista: hoy no se corta el plan y **la aplicación no le
  dice nada a quien paga**.

### La pasarela como vendedora oficial, decidida y sin dar de alta

[adr/0105](./adr/0105-la-pasarela-y-los-precios-por-pais.md) decide **Stripe Managed
Payments**: Stripe es la vendedora oficial, cobra el IVA de cada país y lo declara
ella, en la Unión y en Latinoamérica. Nada de eso existe todavía. Lo que hay que hacer
y comprobar, en este orden:

- **Que Stripe apruebe la cuenta para Managed Payments.** Lo decide una revisión suya
  según el tipo de negocio y el país; España está entre los admitidos y una
  suscripción de software para uso personal entre los productos, pero la aprobación
  no se puede dar por hecha. **Si no la aprueba**, la alternativa escrita es Paddle,
  que pide un adaptador nuevo: no se escribe hasta entonces.
- **Los cuatro precios con el IVA incluido** y el código fiscal `txcd_10103000`
  (software como servicio, uso personal) en los dos productos. Los cupos suponen el
  IVA dentro del precio: con el IVA encima, el precio que se ve no sería el de la
  pantalla.
- **Que la sesión de Checkout no pida nada más para ir por Managed Payments.** Si lo
  pide, es un parámetro en `server/billing/stripe.ts`; hoy no se manda ninguno.
- **Que el portal funcione con Managed Payments**: cambiar de plan, cancelar y ver
  facturas. La documentación dice que las suscripciones solo se crean desde Checkout
  o enlaces de pago, que es lo que se hace; **no dice nada del portal**, y es de lo
  que depende cambiar de plan sin cobrar dos veces
  ([adr/0077](./adr/0077-la-suscripcion-se-guarda-en-la-cuenta.md)).
- **La comisión de verdad.** Los cupos suponen el peor caso, 8,65 % + 0,25 € por
  cobro (adr/0106). Con las primeras ventas se sabrá cuánto es tarjeta europea y
  cuánto de fuera: si casi todo es europeo, el 5 % + 0,25 € deja subir los cupos.

### Precios por país, decididos y sin poner

Al publicar, **un precio en euros para todos**; Stripe enseña la moneda local y
convierte. Precios rebajados por país —Latinoamérica, sobre todo— quedan fuera hasta
que haya ventas que los justifiquen, y cuando entren **el cupo se calcula con el más
bajo al que se venda el plan**, o el margen deja de ser el que dice
([adr/0105](./adr/0105-la-pasarela-y-los-precios-por-pais.md)). Lo que hay que mirar
con las primeras ventas: de dónde son, cuántas abandonan en el pago y cuánto pesa el
IVA de cada país, que con un precio igual en todas partes hace que una venta en
Hungría (27 %) deje menos que una en España.

El cobro fue mecánico porque
[adr/0006](./adr/0006-planes-y-puerto-de-facturacion.md) lo dejó como puerto desde
el principio; lo mismo el correo con
[adr/0013](./adr/0013-el-correo-como-puerto.md). Lo que falta no es escribir
código: es dar de alta servicios y probarlos.

## El dinero, que ya está calculado

Esta parte **no es una intención, es aritmética escrita y probada**, y por eso
merece leerse antes de tocar precios.

Los cupos de IA no se escriben a mano: se calculan desde lo que entra de cada plan
—el precio sin IVA ni comisión—, el precio del modelo y el peor caso de tokens de
cada petición (`core/billing/cost.ts`, [adr/0008](./adr/0008-los-cupos-salen-del-precio.md),
[adr/0106](./adr/0106-el-margen-se-cuenta-sin-iva-y-con-pago-anual.md)), y se cuentan
en preguntas al profesor: una salida gasta tres ([adr/0067](./adr/0067-el-cupo-se-cuenta-en-preguntas.md)).
Cambiar el precio de un plan cambia su cupo solo; cambiar de modelo también. Y un
test comprueba que ningún plan pierde dinero ni gastándose el cupo entero.

- **El 40 % de lo que entra puede irse en modelo**, o sea un 60 % de margen sobre
  el precio sin IVA (21 %, supuesto) y sin la comisión del peor caso (8,65 % + 0,25 €).
  Contado sobre el precio con IVA, como se hacía, era un 43–45 %.
- **Tres planes**: Gratis, Básico 4,99 € y Medio 9,99 €, o 49,90 € y 99,90 € al
  año, cada uno con algo que el anterior no tiene. Pro se fundió en Medio
  ([adr/0104](./adr/0104-el-plan-pro-se-replantea.md)).
- **El modelo por defecto es Sonnet 5.5**: 96 preguntas al mes en Básico y 193 en
  Medio ([adr/0103](./adr/0103-los-modelos-vigentes-y-el-de-por-defecto.md)).
- **El plan gratis pierde dinero a propósito**: quince preguntas al mes por cuenta,
  dieciséis céntimos con el modelo por defecto contando el reintento —162 $ al mes
  cada mil cuentas—. Es gasto de captación, y es el único sitio de la aplicación que
  pierde dinero queriendo. A partir de unos cientos de cuentas deja de ser captación
  y pasa a ser una factura; entonces hay que decidir, no descubrirlo.

El detalle entero, con la tabla de qué da cada plan y qué se guarda de ti, está en
[CUENTAS-Y-PLANES.md](./CUENTAS-Y-PLANES.md).

### Lo que el dinero supone y no mide

- **Los cupos suponen los tokens de entrada, no los miden.** La estimación sale de
  la longitud de los prompts, con holgura y un test que la vigila; confirmarla con
  `count_tokens` pide clave y red.
- **El precio del modelo está comprobado a mano** contra la tabla de la API el 7
  de octubre de 2026, y lo que acepta cada modelo para pensar, contra su
  documentación el mismo día. Si cambia, se cambia en un sitio y los cupos se
  recalculan solos.
- **La calidad de Sonnet 5.5 no está medida.** El examen del profesor
  (`scripts/examen-del-profesor.ts`) y el de las salidas se han pasado con el modelo
  de casa, no con la API. Antes de publicar hay que pasarlos con Sonnet 5.5 y con
  Haiku 4.5: si Haiku da lo mismo, dobla los cupos
  ([adr/0103](./adr/0103-los-modelos-vigentes-y-el-de-por-defecto.md)). Cuesta dinero
  y pide clave.
- **La reserva para pensar es una estimación.** Mil veinticuatro tokens para Opus 5.5
  y Fable, que no dejan apagarlo; lo que piensan de verdad con esfuerzo `low` y un
  esquema JSON se lee en `usage.output_tokens_details.thinking_tokens` y no se ha
  mirado nunca.
- **`between_tools` no lo conoce el SDK instalado** (0.115) y va con un `as`. Que la
  API lo acepte junto a `output_config.format` está en su documentación y no se ha
  probado.

## Lo que exige publicar y hoy no existe

- **Sin probar contra un proveedor de correo de verdad.** El vale de un solo uso y
  el flujo entero están probados contra Postgres; el envío, nunca.
- **Cambiar de dirección de correo sigue sin poder hacerse.** Pide confirmar la
  nueva y avisar a la vieja: dos correos y dos vales más. No lo ha pedido nadie.
- ~~**Aviso legal y política de privacidad.**~~ **Escritos el 7 de octubre de
  2026**: `/aviso-legal` y `/privacidad`, que leen del entorno quién publica y a qué
  modelo va la pregunta ([adr/0111](./adr/0111-la-edad-se-declara-y-el-titular-se-configura.md)).
  Lo que sigue en pie está en la sección de abajo: los datos del titular, y que
  **los textos no los ha revisado nadie que sepa de leyes**.
- **Nada de las cuentas está probado contra Postgres de forma continua.** Se
  ejecutó a mano dos veces —el 25 y el 26 de agosto de 2026— y las dos salieron
  fallos que ningún test veía. No hay nada que lo repita solo.
- **Brotli, sin poner.** `next start` sirve gzip y no Brotli. Lo que hace falta
  está escrito en
  [DESPLIEGUE.md](./DESPLIEGUE.md#lo-que-hay-que-saber-una-vez-publicado): Brotli en
  el proxy o la CDN. **No se ha ejecutado**: no hay proxy delante de ninguna copia
  publicada, porque no hay ninguna. La caché de lo estático ya no hace falta: lo que
  había en `public/` —el vídeo de la portada— se fue, y lo que lo sustituye llega con
  huella en el nombre ([adr/0069](./adr/0069-la-portada-es-una-escena-de-pixel.md)).
- **El límite de frecuencia en memoria** es por instancia. Con base de datos se
  comparte; con varias instancias y sin ella, cada una lleva su cuenta.
- ~~**Entrar no tiene límite de intentos.**~~ **Hecho el 27 de septiembre de
  2026**, antes de comprobar la contraseña, que es lo que evita gastar el `scrypt`
  que el tope viene a proteger ([adr/0054](./adr/0054-entrar-tiene-tope-de-intentos.md)).
  Desde el 2 de octubre se cuenta por **correo y dirección juntos** —cinco por
  minuto—, con dos topes más anchos detrás: veinte por minuto por dirección y
  treinta por cuarto de hora por correo. Con el correo solo, cinco intentos de
  cualquiera dejaban fuera al dueño de la cuenta. Lo que sigue en pie es lo de
  abajo: **el contador de memoria es por instancia**, así que sin base de datos cada
  una lleva su cuenta.
- **Los topes por dirección piden `TRUSTED_PROXY_HOPS`.** Sin ella no se cree
  `X-Forwarded-For` —la escribe el cliente— y todo el mundo comparte un contador
  ([DESPLIEGUE.md](./DESPLIEGUE.md#detrás-de-un-proxy-de-quién-es-cada-petición)).
  **No se ha probado detrás de un proxy de verdad.**
- **El lienzo de componer es por navegador y no por persona.** Se guarda solo en la
  IndexedDB de este navegador ([adr/0081](./adr/0081-el-lienzo-se-guarda-solo-en-el-navegador.md)):
  no pasa por la cuenta ni por el servidor, así que **quien comparta navegador ve la
  canción del otro** —también una persona que cierre sesión y entre otra— y quien
  cambie de aparato no ve la suya. Para un equipo compartido habría que atarlo a la
  cuenta o borrarlo al cerrar sesión; hoy no se hace ninguna de las dos.
- **La inyección en el profesor está acotada, no resuelta.** `qwen3:8b` resiste dos de
  ocho disfraces de la marca, con la marca bien borrada
  ([adr/0015](./adr/0015-un-solo-canal-de-texto-libre.md), «Corrección»): lo que
  limita el abuso es que lo que sale solo lo ve quien pregunta, el tope de 400 tokens
  y el cupo del plan. **Contra la API no se ha medido**, y habría que repetir los
  mismos ocho casos antes de publicar con otro modelo.
- **Registrarse no exige verificar el correo, y el plan gratis da quince
  peticiones de IA.** Así que una dirección inventada son quince llamadas al
  modelo pagadas, y el registro admite cinco por minuto.
  [ADR 0015](./adr/0015-un-solo-canal-de-texto-libre.md) apoya su argumento en que
  el abuso «se hace inútil» por el cupo y la cuenta obligatoria: el cupo aguanta,
  **la cuenta obligatoria hoy no es una barrera**. Lo que hay que decidir es si la
  IA gratis se pone detrás de un correo verificado —no la aplicación, que funciona
  sin cuenta a propósito—. **Decidido el 26 de septiembre de 2026: se verifica antes
  de la IA y antes de subir audio.** Y eso convierte mandar correos en requisito de
  la IA, cuando hoy no lo es de nada: el envío sigue sin probarse contra un
  proveedor de verdad, que es el primer punto de esta lista.

## Para abrir al público sin cobrar

Los pasos, en orden y diciendo qué está probado, están en
[DESPLIEGUE.md](./DESPLIEGUE.md#la-primera-copia-pública-sin-cobro-los-pasos). Lo que
de ahí no es técnico y **es requisito para abrir**:

- **Los datos del titular: `TITULAR_NOMBRE`, `TITULAR_NIF`, `TITULAR_DOMICILIO`,
  `TITULAR_CORREO` y `TITULAR_ALOJAMIENTO`.** Mientras falte uno, el aviso legal y la
  política de privacidad dicen que faltan —con el nombre de la variable— y que sin
  ellos no se abre. No se inventan: un NIF de ejemplo publicado parece cumplir y no
  identifica a nadie (LSSI-CE art. 10).
- **Que alguien que sepa lea los dos textos.** Lo que dicen de la aplicación está
  comprobado contra el código y lo vigila `app/legales.test.tsx`; lo que dicen de la
  ley lo ha escrito quien programa.
- **Si contesta la API de Anthropic, comprobar que sigue en el Marco de Privacidad
  de Datos UE-EE. UU.** (dataprivacyframework.gov) y aceptar su acuerdo de
  tratamiento. La política lo afirma en cuanto hay `ANTHROPIC_API_KEY`; si deja de
  ser verdad, hay que cambiar la frase o el proveedor.
- **Los acuerdos de tratamiento del alojamiento, la base y el correo.** Los tres
  tratan datos por cuenta de quien publica (RGPD art. 28); con Vercel, Neon o Resend
  es aceptar el suyo.
- **La analítica sin cuenta solo cuenta a quien dice que sí**, y no se le pregunta
  con ninguna ventana: se decide en `/privacidad`. Así que la retención que sale es
  casi entera la de quien tiene cuenta. Si hace falta la de todos, lo que hay que
  añadir es una pregunta al entrar, con «sí» y «no» igual de grandes
  ([adr/0110](./adr/0110-contar-sin-seguir.md)). Un identificador sin preguntar no
  es una opción: la AEPD no exime la medición de audiencia del consentimiento.
- **La migración 0006** —la analítica y la edad declarada— solo se ha aplicado en
  PGlite, en los tests. La primera vez contra un Postgres de verdad es al desplegar.

## Lo que pedirá cobrar, además de Stripe

- **Que nunca se pueda cobrar a un menor.** La cuenta pide declarar tener 14 años o
  más (LOPDGDD art. 7), y eso **basta para tratar sus datos, no para contratar**: un
  menor no emancipado no puede obligarse con una suscripción. Antes de abrir el
  cobro, la ventana de pago tiene que pedir declarar la mayoría de edad —o el
  permiso de quien tenga la patria potestad— y negarse sin ella, y las cuentas sin
  `mayor_de_14_en` (las de antes de que se preguntara) tienen que declararla al
  pagar. Hoy no hay nada de eso porque no se cobra.
- **Las condiciones de contratación**: precio con impuestos, renovación, cómo se
  cancela y el desistimiento de catorce días (y cuándo se pierde al empezar a usar
  un contenido digital). El aviso legal de hoy solo cubre el uso gratis.

## Qué decidir cuando llegue el momento

No hace falta decidirlo hoy, pero conviene que esté escrito para no improvisarlo:

- **Qué modelo se sirve.** Está decidido Sonnet 5.5
  ([adr/0103](./adr/0103-los-modelos-vigentes-y-el-de-por-defecto.md)), y es una
  variable de entorno: cambiarlo es barato en código y caro en calidad, y hay que
  medir otra vez si las salidas valen la pena. Un modelo nuevo de la API va primero a
  la tabla de `cost.ts` con lo que acepta; si no, se cobra como el peor caso.
- **Qué se hace con el plan gratis** cuando la captación pase a ser factura: bajar
  el número, quitarle la IA o poner un tope de gasto global.
- **Dónde se despliega.** Lo que hace falta y qué se rompe según dónde está en
  [DESPLIEGUE.md](./DESPLIEGUE.md).
