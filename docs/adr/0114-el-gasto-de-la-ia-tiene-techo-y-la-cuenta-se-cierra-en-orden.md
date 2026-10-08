# ADR 0114 — El gasto de la IA tiene techo, y la cuenta se cierra en orden

Fecha: 2026-10-07 · Estado: aceptada · Completa
[ADR 0067](./0067-el-cupo-se-cuenta-en-preguntas.md),
[ADR 0077](./0077-la-suscripcion-se-guarda-en-la-cuenta.md) y
[ADR 0088](./0088-el-profesor-siempre-contesta-y-sabe-mas.md)

## Contexto

Una auditoría de pagos del 7 de octubre encontró, cada uno con su prueba, siete
fallos que juntos decían lo mismo: **el dinero estaba acotado por cuenta y nada lo
acotaba en total**, y el cierre de una cuenta o de una suscripción se fiaba de cosas
que no son de fiar.

1. **No había techo de gasto global.** Quince preguntas gratis por cuenta y un registro
   que no confirma el correo: cien direcciones registrando al ritmo que deja el límite
   gastaban **unos 650 $ por hora** con Sonnet 5.5, sin nada que lo parara antes de la
   factura.
2. **El límite por minuto era por dirección y antes de leer la cuenta.** Sin
   `TRUSTED_PROXY_HOPS` todas las peticiones son la misma dirección, y diez anónimas
   seguidas dejaban sin IA a todas las cuentas. Y una petición anónima validaba su
   cuerpo —trabajo de dominio— antes de que nadie mirara si había cuenta.
3. **El SDK reintentaba por debajo de la ruta**: `maxRetries: 1` más
   `MAX_MODEL_ATTEMPTS = 2` son hasta cuatro llamadas por petición, y el coste suponía
   dos.
4. **Borrar la cuenta no cancelaba la suscripción**: Stripe seguía cobrando a quien ya
   no existía, y sus avisos contestaban «esa cuenta ya no está».
5. **El webhook se fiaba del estado del aviso** en los cambios de suscripción. Stripe
   reintenta durante días y sin orden: un `updated(active)` que llega tras el `unpaid`
   devolvía el plan. Y **`past_due` conservaba el plan sin plazo**, dependiendo de que
   Stripe estuviera configurado para acabar en `unpaid`.
6. **Borrarse y volver con el mismo correo devolvía el cupo** del mes entero.
7. **Los tokens del texto libre estaban subestimados**: contados como castellano, a 3,2
   caracteres por token, 75; con caracteres chinos o yi, hasta 587.

## Decisión

### El techo de gasto, en dinero y aparte del cupo

Una fila por mes (`ai_gasto`) con lo gastado entre todos, el de hoy y la parte del
plan gratis, y **cuatro topes** configurables en dólares: `IA_TOPE_DIARIO_USD` (10 de
serie), `IA_TOPE_MENSUAL_USD` (150), `IA_TOPE_GRATIS_DIARIO_USD` (2) e
`IA_TOPE_GRATIS_MENSUAL_USD` (30). Un valor que no se entiende no apaga el tope: se
queda el de serie.

- **Se reserva el peor caso antes de llamar** (`requestCostMicros`) y los topes que
  tocan van en el `where` del `on conflict`, **en una sentencia**, como el cupo.
  **Se asienta lo real después**: el `usage` de cada llamada al precio de
  `MODEL_PRICES`; sin `usage` —tiempo agotado, conexión cortada—, el peor caso de
  esa llamada; un error que contestó la API, cero.
- **Va antes que el cupo de la cuenta**, y si el cupo dice que no, la reserva se
  devuelve: una petición parada por el techo no le cuesta una pregunta a nadie.
- El de todos cierra la IA a todo el mundo; el de lo gratis, solo lo gratis. Un
  `503` con `model_unavailable`, una frase que dice que no es el cupo de quien pide y
  hasta cuándo, y `Retry-After` hasta la medianoche UTC o el día uno.
- Solo cuenta la API. Sin base de datos no hay cuentas, y sin cuentas no hay IA.
- **No sustituye al límite de gasto de la consola de Anthropic**, que es del dueño
  de la clave y se documenta como obligatorio en `DESPLIEGUE.md`.

### Las puertas, de lo barato a lo caro

Dirección (sesenta por minuto, clave `ia-ip`, **solo si hay proxy de confianza**) →
modelo → **cuenta, antes de leer el cuerpo** → **diez por minuto y cuenta** → cuerpo →
techo y cupo → modelo → asentar.

### El SDK no reintenta

`maxRetries: 0`. Un `429` o un `5xx` de la API se reintentan en el bucle de la ruta,
dentro de los mismos `MAX_MODEL_ATTEMPTS`; sin red, un tiempo agotado o una negativa,
no. Nunca más de dos llamadas por petición, que es lo que cuenta el coste.

### El texto libre, en su peor alfabeto

`presupuestoDe` suma a la entrada `TEXTO_LIBRE × TOKENS_POR_CARACTER_LIBRE`: 240 × 2 =
480 tokens. Un token es al menos un byte, y el contrato recorta lo libre a lo que
pesaría como 240 letras latinas
([adr/0115](./0115-la-marca-no-se-adivina-y-lo-libre-se-acota-en-el-peor-alfabeto.md)): lo que
más bytes deja pasar son 240 letras latinas con tilde, de dos bytes. Un test lo
comprueba con el recorte de verdad, alfabeto por alfabeto. Los cupos bajan: Básico de
113 a 96 preguntas y Medio de 227 a 193 con Sonnet 5.5.

### Borrar la cuenta, en orden

Contraseña → **guardar lo gastado del mes por la huella del correo** → **cancelar la
suscripción** con el mismo cobrador que el botón de cancelar → borrar. Si la pasarela
no contesta, `502` y no se borra nada; si no se puede guardar lo gastado, `500` y
tampoco.

La huella es un HMAC del correo con `AUTH_SECRET`, nunca el correo, en
`ai_uso_heredado` con el mes y un número; se guarda el mayor de lo que hubiera y lo de
ahora, y lo de meses pasados se borra. Al volver, la primera petición del mes hereda lo
gastado (`on conflict do nothing`, así que no hereda dos veces).

### El webhook pregunta a Stripe, y `past_due` tiene siete días

`customer.subscription.updated` y `.deleted` solo dicen **qué suscripción**; el estado
y el precio se le preguntan a Stripe, como ya hacía el pago. Con `past_due`,
`users.impagada_desde` apunta el primer aviso (`coalesce`: los siguientes no reinician
el plazo), y pasados **`DIAS_DE_GRACIA` = 7** días la cuenta se lee como gratis
(`planEnVigor`, al leer, en `toUser`). Cualquier estado vivo que no sea `past_due` borra
la fecha.

Siete días: Stripe reintenta durante días y su guía pide avisar, no cortar en el
primer fallo; una semana deja tiempo a sus reintentos y a cambiar la tarjeta, y lo que
se regala es como mucho un cuarto del mes de un plan cuyo gasto en modelo es el 40 % de
lo que deja: no se pierde dinero ni gastándolo entero.

## Cifras

Gasto máximo provocable, con Sonnet 5.5:

|                                    | Antes                              | Ahora, con los de serie |
| ---------------------------------- | ---------------------------------- | ----------------------- |
| Con cuentas gratis                 | sin techo: ~650 $/h, ~15.600 $/día | 2 $/día, 30 $/mes       |
| Total                              | sin techo                          | 10 $/día, 150 $/mes     |
| Llamadas por petición              | hasta 4                            | 2                       |
| Tokens del texto libre en el coste | 75                                 | 480                     |

## Descartadas

- **Un tope de cuentas gratis o confirmar el correo** en lugar del techo. Confirmar el
  correo encarece fabricar cuentas pero no lo impide, y no acota la suma; un tope de
  cuentas es otro número sin dinero detrás. El techo es el número que importa, en la
  unidad que importa.
- **Contar el gasto después de la llamada, sin reservar.** Todas las peticiones que
  llegan antes de que termine la primera pasarían a la vez.
- **Contar en preguntas y no en dinero.** El cupo ya cuenta preguntas; lo que se quiere
  acotar es la factura, y cambiar de modelo cambiaría el techo sin que nadie lo tocara.
- **Una fila por día y otra por mes, o una por ámbito.** Dos escrituras dejan una
  rendija entre ellas, como en el cupo.
- **Fiarse solo del límite de la consola de Anthropic.** Corta a todos de golpe, sin
  decir nada en la pantalla y sin distinguir lo gratis de lo pagado; y es del dueño de
  la clave, no de la aplicación. Van los dos.
- **Contar los reintentos del SDK en `requestCostMicros`.** Arreglaba el coste
  bajando todos los cupos a la mitad por unos reintentos que casi nunca pasan; quitar
  el del SDK y reintentar `429`/`5xx` en el bucle deja el mismo aguante sin pagarlo.
- **Descartar los avisos más viejos que el último aplicado** en vez de preguntar a
  Stripe. Pide guardar una marca por suscripción y aún se fía del estado del aviso más
  nuevo, que también puede llegar tarde; preguntar cuesta una llamada y ya se hacía en
  los pagos.
- **Documentar la configuración obligatoria de Stripe para `past_due`** en vez de un
  plazo en la aplicación. Deja la regla fuera del código y de los tests, en un panel
  que nadie revisa.
- **Guardar el correo de las cuentas borradas**, o su hash sin secreto. Lo primero es
  justo lo que borrar la cuenta promete no hacer; lo segundo se deshace probando una
  lista de correos.
- **Tres tokens por carácter**, sin contar con el recorte del contrato. Es el peor
  caso si el contrato solo acotara unidades UTF-16; con el recorte por peso, cobraba
  240 tokens que no pueden llegar.

## Consecuencias

- La IA puede cerrarse para todos, y quien paga lo verá si el mensual se queda corto:
  hay que ajustarlo a los clientes (`DESPLIEGUE.md`), y el `503` lo dice.
- Una petición cuesta una escritura más en la base al terminar (asentar).
- El límite por dirección es más ancho que antes —sesenta y no diez— y no existe sin
  proxy de confianza: lo que acota a un atacante con muchas cuentas es el techo, no la
  dirección.
- El día del cupo no se hereda al volver con el mismo correo, solo el mes, que es el
  que protege el dinero.
- **Nada del webhook se ha ejecutado contra Stripe**, como el resto de
  [adr/0077](./0077-la-suscripcion-se-guarda-en-la-cuenta.md).
