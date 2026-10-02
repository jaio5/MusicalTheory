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

- Que el portal, configurado para cambiar de plan con los tres precios, **acepta el
  flujo `subscription_update_confirm`** tal como se construye, con su prorrateo y la
  autenticación de la tarjeta.
- Que cancelar con `DELETE` sobre la suscripción **para el cobro** y que el aviso de
  baja llega y encuentra a su dueño.
- Que los cuatro avisos llegan con los campos que se leen —`payment_status`,
  `customer`, `subscription` y el precio de `items`— y que el orden en que llegan no
  cambia el plan que queda.
- Qué pasa con `past_due` a la vista: hoy no se corta el plan y **la aplicación no le
  dice nada a quien paga**.

El cobro fue mecánico porque
[adr/0006](./adr/0006-planes-y-puerto-de-facturacion.md) lo dejó como puerto desde
el principio; lo mismo el correo con
[adr/0013](./adr/0013-el-correo-como-puerto.md). Lo que falta no es escribir
código: es dar de alta servicios y probarlos.

## El dinero, que ya está calculado

Esta parte **no es una intención, es aritmética escrita y probada**, y por eso
merece leerse antes de tocar precios.

Los cupos de IA no se escriben a mano: se calculan desde el precio del plan, el
precio del modelo y el peor caso de tokens de cada petición
(`core/billing/cost.ts`, [adr/0008](./adr/0008-los-cupos-salen-del-precio.md)), y
se cuentan en preguntas al profesor: una salida gasta tres ([adr/0067](./adr/0067-el-cupo-se-cuenta-en-preguntas.md)).
Cambiar el precio de un plan cambia su cupo solo; cambiar de modelo también. Y un
test comprueba que ningún plan pierde dinero ni gastándose el cupo entero.

- **El 40 % del precio puede irse en modelo**, o sea un 60 % de margen. Es el
  único número del fichero que es una decisión de negocio y no una medida.
- **Los cuatro planes**: Gratis, Básico 4,99 €, Medio 9,99 € y Pro 19,99 €, cada
  uno con algo que el anterior no tiene.
- **El plan gratis pierde dinero a propósito**: quince peticiones al mes por
  cuenta, unos veinte céntimos con el modelo más caro. Es gasto de captación, y es
  el único sitio de la aplicación que pierde dinero queriendo. A partir de unos
  cientos de cuentas deja de ser captación y pasa a ser una factura; entonces hay
  que decidir, no descubrirlo.

El detalle entero, con la tabla de qué da cada plan y qué se guarda de ti, está en
[CUENTAS-Y-PLANES.md](./CUENTAS-Y-PLANES.md).

### Lo que el dinero supone y no mide

- **Los cupos suponen los tokens de entrada, no los miden.** La estimación sale de
  la longitud de los prompts, con holgura y un test que la vigila; confirmarla con
  `count_tokens` pide clave y red.
- **El precio del modelo está comprobado a mano** contra la tabla de la API el 25
  de agosto de 2026. Si cambia, se cambia en un sitio y los cupos se recalculan
  solos.

## Lo que exige publicar y hoy no existe

- **Sin probar contra un proveedor de correo de verdad.** El vale de un solo uso y
  el flujo entero están probados contra Postgres; el envío, nunca.
- **Cambiar de dirección de correo sigue sin poder hacerse.** Pide confirmar la
  nueva y avisar a la vieja: dos correos y dos vales más. No lo ha pedido nadie.
- **Aviso legal y política de privacidad.** No son código. Con usuarios reales y
  cobro, no son opcionales.
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

## Qué decidir cuando llegue el momento

No hace falta decidirlo hoy, pero conviene que esté escrito para no improvisarlo:

- **Qué modelo se sirve.** Es una variable de entorno y los cupos salen de su
  precio, así que cambiarlo es barato en código y caro en calidad: habría que
  medir otra vez si las salidas valen la pena.
- **Qué se hace con el plan gratis** cuando la captación pase a ser factura: bajar
  el número, quitarle la IA o poner un tope de gasto global.
- **Dónde se despliega.** Lo que hace falta y qué se rompe según dónde está en
  [DESPLIEGUE.md](./DESPLIEGUE.md).
