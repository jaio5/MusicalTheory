# ADR 0078 — Los topes cuentan con la dirección que vio nuestro proxy, y entrar lleva tres claves

Fecha: 2026-10-02 · Estado: aceptada · Sustituye en parte a
[ADR 0054](./0054-entrar-tiene-tope-de-intentos.md): la tabla de claves y la cifra
de `scrypt`

## Contexto

La auditoría de seguridad del 2 de octubre probó los topes de frecuencia por fuera y
salieron tres cosas.

- **La dirección de quien pide era una cabecera que escribe el cliente.** Los topes
  tomaban la primera entrada de `X-Forwarded-For`; con doce peticiones cambiando esa
  cabecera, cada una tenía su propio contador y el tope no paraba a nadie. Vale para
  entrar, el registro, la cuenta olvidada y las tres rutas de IA, que cuestan dinero.
- **El tope de entrar del [ADR 0054](./0054-entrar-tiene-tope-de-intentos.md)
  dejaba sin entrar al dueño.** Contaba cinco por minuto por correo, solo, y eso es
  justo lo que ese ADR descartó al hablar de bloquear la cuenta: cualquiera, sabiendo
  un correo, la dejaba cerrada fallando cinco veces. Su tabla decía que el tope por
  correo «corta la misma cuenta desde muchos sitios», y con ese número también cortaba
  a su dueño desde el suyo.
- **`scrypt` no costaba lo que dicen esos documentos.** Los cien milisegundos eran
  31 medidos, porque `N=16384, r=8, p=1` es el ejemplo de la documentación de Node y
  no una de las combinaciones que recomienda OWASP.

Y dos huecos de carrera: el vale de recuperar la contraseña se leía, se comprobaba y
se marcaba al final, así que dos peticiones a la vez con el mismo enlace cambiaban
las dos la contraseña; y el tope de canciones contaba y escribía en dos sentencias,
así que dos guardados a la vez con 49 dejaban 51.

## Decisión

**`TRUSTED_PROXY_HOPS` dice cuántos proxies de confianza hay delante, y la dirección
se toma contando esos saltos desde la derecha de `X-Forwarded-For`**
(`requesterKey`, `server/rate-limit.ts`). Cada proxy añade a la derecha la dirección
de quien le habló: con uno, la última; con dos —una CDN y un nginx—, la penúltima. Lo
de su izquierda lo escribe el cliente.

**Sin la variable no se cree ninguna cabecera**, ni `X-Forwarded-For` ni `X-Real-IP`,
y todo el mundo comparte un contador; en producción se avisa una vez en el registro.
Un valor que no es un entero no negativo cuenta como cero. `vitest.config.ts` la pone
a 1 para que los tests de las rutas manden su cabecera.

**Entrar lleva tres claves** (`server/auth.ts`), y las tres se miran antes de
comprobar la contraseña:

| Clave              | Tope               | Qué corta                                           |
| ------------------ | ------------------ | --------------------------------------------------- |
| Correo y dirección | 5 por minuto       | probar contraseñas contra una cuenta desde un sitio |
| Dirección          | 20 por minuto      | una cuenta tras otra desde un sitio                 |
| Correo             | 30 cada 15 minutos | la misma cuenta desde muchos sitios                 |

El tope estrecho cuenta el par, así que quien se equivoca desde su casa no impide
entrar a nadie más, y el dueño de una cuenta atacada desde fuera entra desde la suya.
El del correo solo es ancho a propósito: frena un ataque repartido sin que cinco
fallos ajenos cierren la cuenta.

**`scrypt` pasa a `N=2^14, r=8, p=5`**, una de las cinco combinaciones de OWASP:
119 ms medidos el 2 de octubre de 2026 y 16 MiB por comprobación. Lo guardado con los
parámetros viejos sigue entrando y **se vuelve a cifrar al entrar**, que es cuando se
tiene la contraseña en claro. El hash de nadie con el que se comprueba un correo que
no existe lleva los parámetros de hoy.

**`/api/cuenta/olvidada` contesta igual exista o no la cuenta**: el vale y el correo
se hacen después de contestar (`after()` de Next), de modo que la respuesta no tarda
más con un correo registrado. Con su tope: tres por minuto por dirección y tres cada
quince minutos por correo.

**El vale se gasta en una sola sentencia** que lo marca solo si sigue sin usar y sin
caducar, dentro de la transacción que cambia la contraseña. **El tope de canciones
bloquea la fila de la cuenta** (`FOR UPDATE`) antes de contar: una sola sentencia
`insert … select … where count < 50` no basta en `read committed`, porque la segunda
espera a la primera pero cuenta con la foto de cuando empezó.

## Consecuencias

Detrás de un proxy, **hay que poner `TRUSTED_PROXY_HOPS`**, o los topes frenan de
más: un contador para todo el mundo. Es lo que se prefirió a frenar de menos. Con
`next start` suelto no hay cómo distinguir la cabecera que puso Next de la que
escribió el cliente: pone la del socket solo si no venía ya.

**No se ha probado detrás de un proxy de verdad.** Los tests mandan la cabecera a
mano.

**El tope ancho de correo no es inexistente**: treinta fallos en un cuarto de hora
contra un correo hacen esperar también a su dueño. Es el precio de frenar el ataque
repartido, y mucho más caro de provocar que los cinco de antes.

**La parte del 0054 que sigue en pie**: el tope va antes de comprobar la contraseña,
se cuenta para cualquier correo exista o no, y se dice con `DEMASIADOS_INTENTOS`.
**El contador de memoria sigue siendo por instancia** sin base de datos.

## Alternativas descartadas

**La primera entrada de `X-Forwarded-For`.** Es lo que había, y la escribe quien
pide.

**`X-Real-IP`.** Es otra cabecera que llega por el cable: sin saber qué hay delante,
no es más fiable que la primera.

**Fiarse por defecto de la última entrada.** Sin proxy delante, esa entrada es la que
puso el cliente. Un valor por defecto que regala la evasión es peor que uno que frena
de más y lo dice en el registro.

**N=2^17, r=8, p=1.** Es otra de las cinco y cuesta lo mismo en procesador, pero pide
128 MiB por intento y tarda 289 ms: cinco a la vez serían 640 MiB de un servidor
pequeño, y esa memoria es justo la que se ahorra quien ataca.

**Un retraso fijo para que `/olvidada` tarde igual.** Se cumple dentro de la
petición, y el tiempo que tarda el envío no es fijo. Hacer el trabajo después de
contestar es que lo que hace la respuesta sea literalmente lo mismo.
