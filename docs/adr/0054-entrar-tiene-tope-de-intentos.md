# ADR 0054 — Entrar tiene tope de intentos, y por dos claves

Fecha: 2026-09-27 · Estado: aceptada · Completa [ADR 0015](./0015-un-solo-canal-de-texto-libre.md)

## Contexto

De revisar la seguridad salió esto: **entrar no tenía ningún tope de intentos.** Lo
tenían el registro —cinco por minuto—, el cambio de cuenta y las tres rutas de IA.
El `authorize` de `server/auth.ts`, no.

Lo único que había enfrente era el coste de `scrypt`, unos cien milisegundos por
intento. Y eso **no es una defensa, es el problema al revés**:

| Quién paga   | Cuánto por intento    |
| ------------ | --------------------- |
| El servidor  | ~100 ms de procesador |
| Quien prueba | una petición          |

Así que la misma puerta servía para dos cosas distintas: adivinar una contraseña, y
gastar el procesador de la máquina sin gastar nada.

Lo que sí estaba bien hecho, y sigue: la contraseña se comprueba también cuando el
correo no existe —con un hash que no es de nadie— así que entrar no se puede usar
de buscador de cuentas.

## Decisión

**Cinco intentos por minuto, contados por dirección y por correo, antes de
comprobar la contraseña.**

**Antes de `verifyPassword` y no después**, que es lo que hace que sirva: comprobar
primero gastaría el `scrypt` que esto viene a evitar.

**Y las dos claves hacen falta, porque son dos ataques distintos:**

| Clave         | Qué corta                           | Sin ella                               |
| ------------- | ----------------------------------- | -------------------------------------- |
| Por dirección | muchas contraseñas desde un sitio   | basta con probar una cuenta tras otra  |
| Por correo    | la misma cuenta desde muchos sitios | basta con cambiar de salida a internet |

El correo se cuenta **en minúsculas y sin espacios**, que es como se guarda: si no,
alternar mayúsculas daría un cupo nuevo por cada forma de escribirlo.

Y se cuenta **para cualquier correo, exista o no**, así que esto no se convierte en
lo que el hash de nadie vino a evitar: un correo inventado se limita igual que uno
de verdad, y desde fuera no se distinguen.

**Pasarse de intentos se dice como lo que es.** Las dos cosas —«esa no es tu
contraseña» y «has probado demasiado»— llegan al cliente por el mismo sitio, y
decir la primera a quien tiene la contraseña bien es mandarle a cambiar una que
funciona. Va con un código propio, `DEMASIADOS_INTENTOS`, que vive en
`core/auth-errors.ts` porque lo lanza `server/` y lo traduce `state/`, y `state/`
no puede abrir `server/`. Es la misma razón por la que existe `core/ai-errors.ts`.

## Consecuencias

Quien se equivoca al teclear dos o tres veces no nota nada. Quien prueba
contraseñas se queda en cinco por minuto y por cuenta.

**El tope de una cuenta no cierra la puerta a otra**, y hay un test que lo fija: si
lo hiciera, bastaría con fallar cinco veces contra el correo de alguien para dejarle
sin entrar. Eso convertiría la defensa en el ataque.

**El de memoria es por instancia**, como el del registro: con base de datos se
comparte, y sin ella cada instancia lleva su cuenta. Ya estaba anotado en
`PARA-PUBLICAR.md` y ahora aplica también a esto.

Lo que **no** arregla: una contraseña que ya se filtró por otro sitio. El tope
retrasa adivinarla, no la cambia.

## Alternativas descartadas

**Bloquear la cuenta al quinto fallo, hasta que su dueño la desbloquee.** Es más
duro contra quien adivina y abre la puerta a algo peor: **cualquiera podría dejar
sin entrar a cualquiera** sabiendo solo su correo. Pide además un camino para
volver —un correo de desbloqueo— y hoy mandar correos no está probado contra un
proveedor de verdad.

**Ir haciendo esperar más en cada fallo**, doblando el retraso. Suena mejor y en
este servidor es peor: el retraso se cumple **dentro de la petición**, así que cada
intento tendría una petición abierta más tiempo. Se paga con lo mismo que se venía
a proteger.

**Un captcha.** Es lo que de verdad separa a una persona de un programa, y se
descarta por ahora porque son terceros, una clave más y un aviso de privacidad más,
para un servicio que todavía no ha salido. Si el tope no basta, esto es lo que hay
que mirar primero.

**Contar solo por dirección**, que es lo que hacen `esperaPorFrecuencia` y el
registro. Se descarta con la tabla de arriba: deja abierto ir a por una cuenta
concreta desde varias salidas, que es exactamente el ataque contra el que se pone
un tope al entrar.

**Contar solo por correo.** Deja abierto probar una contraseña floja contra muchas
cuentas desde el mismo sitio, que es el ataque de fuerza bruta al revés y el que
más cuentas se lleva en la práctica.
