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
(`core/billing/cost.ts`, [adr/0008](./adr/0008-los-cupos-salen-del-precio.md)).
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
- **El límite de frecuencia en memoria** es por instancia. Con base de datos se
  comparte; con varias instancias y sin ella, cada una lleva su cuenta.

## Qué decidir cuando llegue el momento

No hace falta decidirlo hoy, pero conviene que esté escrito para no improvisarlo:

- **Qué modelo se sirve.** Es una variable de entorno y los cupos salen de su
  precio, así que cambiarlo es barato en código y caro en calidad: habría que
  medir otra vez si las salidas valen la pena.
- **Qué se hace con el plan gratis** cuando la captación pase a ser factura: bajar
  el número, quitarle la IA o poner un tope de gasto global.
- **Dónde se despliega.** Lo que hace falta y qué se rompe según dónde está en
  [DESPLIEGUE.md](./DESPLIEGUE.md).
