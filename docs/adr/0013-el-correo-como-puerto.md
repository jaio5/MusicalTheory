# ADR 0013 — El correo es un puerto, y recuperar la contraseña es un vale de un solo uso

Fecha: 2026-08-25 · Estado: aceptada · Cierra: la deuda de [ADR 0005](./0005-cuentas-y-avance-en-servidor.md)

## Contexto

Desde la fase 8 no había forma de recuperar una contraseña olvidada, y estaba
dicho en la pantalla en vez de escondido: sin envío de correo, cualquier forma de
recuperarla sería peor que no tenerla.

Ese argumento se sostenía mientras no se cobraba. Deja de sostenerse en cuanto se
cobra: alguien que paga 19,99 € al mes, olvida la contraseña y no tiene forma de
volver, pierde la cuenta **y** el dinero, y lo único que puede hacer es escribir a
un buzón que tampoco existe.

## Decisión

**El correo es un puerto**, con el mismo patrón que el cobro
([ADR 0006](./0006-planes-y-puerto-de-facturacion.md)) y por la misma razón: el
flujo entero se escribe, se prueba y funciona antes de elegir proveedor, y
enchufar uno después no toca ni las rutas ni las pantallas.

Sin sus dos variables de entorno, `mailer()` devuelve `NoMailer`, que no manda
nada y **lo declara**. La pantalla lee ese `sends` y dice que aquí no se puede
recuperar la contraseña, en vez de prometer un correo que dejaría a alguien
esperando delante de un buzón vacío. Es la misma mecánica que hace que la ventana
de pago avise cuando no se cobra.

El proveedor elegido para la primera implementación manda correo con un `POST` y
cuatro campos, sin SDK, igual que Stripe. **Cambiarlo es un fichero**: la
dirección, los nombres de los campos y la cabecera de autenticación. Nada más lo
conoce.

**Recuperar la contraseña es un vale de un solo uso**, con cuatro reglas:

1. **Se guarda la huella, no el vale.** Lo que viaja en el correo es el vale; en
   la base de datos está su SHA-256. Quien se lleve la tabla entera no puede
   entrar en ninguna cuenta con lo que hay dentro. Es el mismo motivo por el que
   las contraseñas tampoco se guardan.
2. **Caduca en una hora.** Un vale sin caducidad es una segunda contraseña que
   nadie sabe que tiene, escrita en un buzón de correo.
3. **Un solo uso**, y pedir uno nuevo gasta los anteriores: si no, pedir tres
   correos dejaría tres puertas abiertas.
4. **Usarlo echa a las demás sesiones**, subiendo `sessionVersion`. Quien
   recupera la contraseña suele estar haciéndolo porque alguien más entró, y
   dejar viva esa sesión sería recuperar la cuenta a medias.

Y una quinta que no es del vale sino de la pantalla: **la respuesta es la misma
exista o no ese correo**. Contestar «ese correo no tiene cuenta» convertiría esto
en un buscador de quién está registrado aquí, que es justo lo que la pantalla de
entrar ya evita al no decir cuál de los dos campos falló.

## Consecuencias

- Se puede publicar cobrando sin dejar a nadie fuera de su propia cuenta.
- Un clon recién bajado sigue funcionando entero sin configurar correo, y lo dice.
- `SHA-256` a secas para el vale y `scrypt` para la contraseña **no es una
  incoherencia**: un vale son 256 bits de azar y no se adivina con un diccionario,
  así que el coste de cálculo no defiende de nada ahí y sí haría lenta cada
  comprobación. Lo que se busca en los dos casos es que la tabla no sirva para
  entrar.
- Tres peticiones por minuto y dirección, menos que en el resto: cada una manda un
  correo, y un correo que no pediste es molestia para quien lo recibe y reputación
  quemada para quien lo manda.
- **Cambiar de dirección de correo sigue sin poder hacerse.** Pide confirmar
  primero la nueva y luego avisar a la vieja, que son dos correos y dos vales más.
  Ahora ya se puede hacer; no se ha hecho porque nadie lo ha pedido.

## Alternativas descartadas

**Preguntas de seguridad.** No hacen falta ni proveedor ni variables. Se descartan
porque son una contraseña peor: la respuesta suele ser pública o adivinable, y en
la práctica la gente escribe una segunda contraseña que olvida igual.

**Un enlace mágico para entrar, sin contraseña.** Sería el mismo vale, y quitaría
las contraseñas del proyecto entero. Se descarta porque cambia cómo se entra para
todo el mundo, no solo para quien ha olvidado algo, y deja la cuenta atada a que
el buzón siga siendo tuyo. Es una decisión distinta y merecería su propio ADR.

**Guardar el vale en claro** y compararlo tal cual. Más simple y es lo que hace
mucha gente. Se descarta por lo mismo que las contraseñas: una copia de seguridad
mal guardada, un registro de consultas o un volcado de la tabla se convierten en
acceso a todas las cuentas que tuvieran un vale vivo.

**Mandar el correo con un SDK.** Se descarta como el de Stripe: son cuatro campos
en un `POST`, y una dependencia menos es una menos que actualizar y auditar.
