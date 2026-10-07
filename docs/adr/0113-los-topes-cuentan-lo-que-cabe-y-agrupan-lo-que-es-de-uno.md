# ADR 0113 — Los topes cuentan lo que cabe y agrupan lo que es de uno

Fecha: 2026-10-07 · Estado: aceptada · Completa a
[ADR 0078](./0078-los-topes-se-cuentan-con-la-direccion-que-vio-nuestro-proxy.md) y
[ADR 0110](./0110-contar-sin-seguir.md)

## Contexto

La auditoría de seguridad del 7 de octubre de 2026 atacó los topes de frecuencia y
la analítica con prueba de explotación, y encontró seis cosas:

1. **La entrada no tenía tope de cuerpo.** `/api/auth/callback/credentials` lo lee
   Auth.js, no `readJsonBody`, así que los 128 KB de las demás rutas no la cubrían;
   el de serie de Next es de 10 MB. Veinte POST con un `email` de 8 MB llevaron el
   proceso de 46 a 687 MB, y no había tope de largo de contraseña en ningún sitio.
2. **La clave del limitador llevaba el correo entero.** Con uno de 4 MB, la fila no
   cabía en el índice de `rate_limits.key` (Postgres no indexa más de 8 KB), la
   sentencia fallaba, el `catch` se lo tragaba y el tope caía al contador de
   memoria —por proceso— que guardaba los megas un cuarto de hora. Lo mismo en
   `/olvidada`.
3. **Una IPv6 contaba por dirección suelta.** Cien direcciones de un mismo /64 eran
   cien contadores: cuarenta cuentas tomadas al entrar sin un solo freno, la IA y
   las métricas igual. Lo encontraron tres auditores.
4. **Sin `TRUSTED_PROXY_HOPS`, todos comparten un contador**, y diez peticiones de
   cualquiera dejan a todo el mundo sin IA, sin registro y sin entrar. El aviso era
   una línea de `console.warn` la primera vez que pasaba.
5. **Las métricas se envenenaban**: sesenta UUID inventados por minuto y dirección
   eran sesenta «primera vez», sin límite con IPv6; `unidad-terminada` la declara
   el navegador; leerlas traía todos los visitantes a memoria; y la cookie de una
   cuenta borrada volvía a crear el seudónimo que borrarla acababa de olvidar.
6. `docs/CUENTAS-Y-PLANES.md` decía que cambiar la contraseña no cierra las demás
   sesiones, y el código sube `sessionVersion` desde hace semanas.

## Decisión

**Tope de cuerpo en el proxy, igual al de lectura.** `next.config.ts` pone
`experimental.proxyClientMaxBodySize` a 128 KB, el mismo `MAX_CUERPO` de
`server/request-body.ts`. Como `src/proxy.ts` cubre todas las rutas, todo cuerpo
pasa por ahí. **Recorta, no rechaza**: es lo que hace Next con ese número
(`node_modules/next/dist/docs/…/proxyClientMaxBodySize.md`, comprobado en
`body-streams.js`).

**Y en `authorize`, lo enorme se contesta antes que nada**: un correo de más de 254
caracteres o una contraseña de más de 1024 son «no» sin tocar el limitador ni
`scrypt`. **`MAX_PASSWORD_LENGTH = 1024`** (`server/password.ts`) vale también al
crear, cambiar y restablecer —con el resultado de siempre, `contrasena-corta`, que
pasa a querer decir «fuera de medida»— y `verifyPassword` dice que no a una más
larga sin derivar nada.

**Las claves no llevan lo que llega de fuera en claro.** El correo va como
`huellaDeCorreo` —SHA-256 del correo normalizado, 32 caracteres— en entrar y en
`/olvidada`; y `limitRequest` cambia por su huella **cualquier** clave de más de 200
caracteres (`acotarClave`), en los dos contadores, por si alguien forma otra clave
sin acordarse. De paso, la tabla de topes deja de ser una lista de correos.

**Una IPv6 cuenta por su /64** (`agruparDireccion`, en `requesterKey`), después de
normalizar corchetes y puerto, zona, mayúsculas, ceros comprimidos y la IPv4
mapeada (`::ffff:192.0.2.1`, que vuelve a ser `192.0.2.1`). Una IPv4 cuenta entera.

**Sin `TRUSTED_PROXY_HOPS` en producción, un aviso que se ve, no una negativa a
arrancar.** `src/instrumentation.ts` escribe al arrancar un bloque de error que dice
qué pasa y cómo arreglarlo, y la primera petición lo repite. **`TRUSTED_PROXY_HOPS=0`
ya no es lo mismo que no ponerla**: se comporta igual —no se cree ninguna cabecera—
pero dice «no hay proxy, lo sé», y calla el aviso.

**Métricas:**

- **Diez visitantes nuevos al día por dirección** (/64 en IPv6), solo para los
  seudónimos de navegador. `registrarEvento` pregunta (`admitirNuevo`) solo si el
  visitante no existía; si la respuesta es no, el evento se suma igual, sin nadie.
- **Lo que declara el navegador sale marcado** al leer: cada fila de `ultimos30`
  lleva `declarado`, verdadero para `visita`, `unidad-terminada` y `toma-grabada`.
- **La retención se cuenta en SQL**: una fila con ocho números, sea cual sea la
  tabla. La definición sigue siendo `computeRetention`, y `metricas.test.ts`
  compara las dos con trescientos visitantes al azar con semilla.
- **La cuenta se identifica con `currentSession`**, que comprueba que la cuenta
  existe y que la cookie no es de antes de cambiar la contraseña, y no con
  `currentCookie`.

Cada ataque tiene su test, que falla sin el arreglo: `server/tope-del-cuerpo.test.ts`
(el cuerpo de 8 MB llega recortado), `server/auth.test.ts` («lo enorme y lo repartido,
al entrar»), `server/rate-limit-real.test.ts` («una clave de megas»),
`server/rate-limit.test.ts` (IPv6, claves y el aviso), `api/metricas/route.con-base.test.ts`
(envenenar, el /64 y la cuenta borrada).

## Consecuencias

- **Quien sirve sin proxy en producción ve el aviso en cada arranque** hasta que
  ponga `TRUSTED_PROXY_HOPS=0`. Es el caso del Docker de casa: `compose.yml` pasa la
  variable vacía.
- **El aviso no protege de nada**: el contador compartido sigue siendo una puerta
  para dejar a todos sin servicio. Lo que lo arregla es poner la variable.
- **Un /64 entero comparte contador.** Una oficina o una red móvil con IPv6 detrás de
  un mismo /64 frena antes; es lo mismo que ya pasaba con una IPv4 detrás de un NAT.
- **Una contraseña de más de 1024 caracteres guardada antes de esto ya no entra.**
  Nadie la escribe a mano; quien la tuviera, por el enlace de `/olvidada`.
- **Con la entrada recortada a 128 KB, lo de más no llega a Auth.js** y la respuesta es
  la de unas credenciales malas. No hay 413: para eso, el proxy de delante
  (`docs/DESPLIEGUE.md`).
- **Una casa con más de diez navegadores nuevos en un día** cuenta los demás solo en lo
  sumado. La retención sin cuenta ya era aproximada ([ADR 0110](./0110-contar-sin-seguir.md)).
- **`unidad-terminada` sigue declarándola el navegador.** Contarla en el servidor
  pide hacerlo al subir el avance (`app/api/progreso`), y eso es otra pieza.
- **La retención está escrita dos veces**, en TypeScript y en SQL. Lo que las ata es
  el test de equivalencia; cambiar una sin la otra lo rompe.
- **Las métricas piden una consulta más** por evento con sesión: la de la cuenta y su
  gasto, que hace `currentSession`.

## Alternativas descartadas

**Negarse a arrancar en producción sin `TRUSTED_PROXY_HOPS`.** Es lo más seguro y
lo que no deja olvidarla. Rompe a quien sirve en producción sin proxy —el Docker de
casa, un `next start` en la red local—, donde no hay valor correcto que poner, y
convierte una actualización en una caída. Con el `0` explícito habría salida, pero
el coste del olvido es frenar de más, no abrir nada: un aviso alto basta.

**Topes más anchos cuando no hay proxy**, para que diez peticiones no dejen a todos
fuera. Un contador compartido con un tope de cien sigue siendo uno, y deja de frenar
a quien prueba contraseñas: cambia un problema visible por uno que no se ve.

**Un tope de cuerpo de 64 KB**, como proponía la auditoría. El proxy recorta sin
avisar a quien manda, y una canción o un avance de entre 64 y 128 KB, que
`readJsonBody` acepta, llegaría partido y se leería como cuerpo vacío. Igual que
`MAX_CUERPO`, nada que pase de ahí se acepta de todos modos.

**Leer el cuerpo de la entrada a mano antes de Auth.js.** Habría que envolver el
manejador de `app/api/auth`, que es de Auth.js; el tope del proxy cubre lo mismo sin
tocarlo, y el de `authorize` cubre lo que llegue recortado.

**Rechazar en `authorize` lanzando un error** en vez de contestar nulo. Diría que el
correo es demasiado largo, y eso no lo escribe nadie que vaya a entrar.

**Agrupar IPv6 por /48 o /56.** Frenaría más a quien tiene un prefijo grande, y a la
vez juntaría en un contador a vecinos de un mismo proveedor que reparte /64. El /64
es la subred más pequeña de IPv6 (RFC 4291), así que es lo menos que tiene una línea.

**Contar `unidad-terminada` en el servidor ya.** Es lo exacto, y pide tocar
`app/api/progreso`, que estaba en otras manos; marcarla como declarada dice lo que
hay sin esperar.

**Acotar la lectura de métricas** —traer como mucho N visitantes— en vez de pasarla a
SQL. Es más corto y da números falsos en cuanto se llega al tope, sin decirlo.

**Un tope de nuevos que cuente también las cuentas.** Una cuenta solo da un
seudónimo, y crearla ya tiene su propio tope; contarla aquí solo restaría huecos a
los navegadores.
