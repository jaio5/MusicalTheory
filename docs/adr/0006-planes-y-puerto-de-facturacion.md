# ADR 0006 — Tres planes en el dominio y la facturación como puerto

Fecha: 2026-07-30 · Estado: aceptada

## Contexto

Con cuentas ([ADR 0005](./0005-cuentas-y-avance-en-servidor.md)) ya se puede saber
de quién es cada llamada al modelo. Falta decidir dos cosas distintas que es fácil
mezclar:

1. **Dónde vive la política**: qué incluye cada plan y quién contesta a la pregunta
   «¿puede este pedirle una idea al modelo?».
2. **Cómo se cobra**, que exige una cuenta de Stripe, productos creados en su panel,
   un webhook accesible desde internet y decisiones que no son de código.

Mezclarlas significa que no hay planes hasta que haya pasarela. Y hay una razón
concreta para no esperar: lo que de verdad hace falta hoy es **el candado**, porque
sin él la clave de Anthropic paga lo que gaste cualquiera que entre.

## Decisión

**La política, en el dominio.** `core/billing/plans.ts` es una tabla de tres planes
con sus permisos y su cupo diario, TypeScript puro. La consultan las dos orillas: la
pantalla para enseñar un candado y la ruta para no gastar dinero. **La misma
función**, y ahí está el valor: si la política se escribiera dos veces, llegaría el
día en que la pantalla enseña abierto lo que el servidor cierra, que se lee como que
la aplicación está rota.

Los permisos son verbos, no pantallas: `profesor`, `ideas`, `grado-profesional`,
`sincronizar`, `repaso`. Así una pantalla se puede enseñar entera con la parte de IA
apagada, en vez de desaparecer y dejar un hueco sin explicación.

La única flecha entre las dos mitades del dominio va de `billing/` a `music/` —los
planes saben qué es un grado— y nunca al revés: la teoría musical no cambia según lo
que pagues, y un `core/music` que importase precios dejaría de poder probarse solo.

**El cobro, un puerto.** `server/billing/port.ts` declara la interfaz y hoy la
implementa `FakeBilling`, que cambia el plan y no cobra. Es el mismo patrón que
`AudioInput`, `CameraInput` y `SessionStorage`, donde se ganó poder probar el
afinador sin micrófono.

La interfaz contempla ya la respuesta **«ir a pagar a otro sitio»** con una
dirección, que es la forma que tiene Stripe Checkout, aunque el cobrador de hoy no
la use nunca. Son cuatro líneas ahora y es la diferencia entre añadir una
implementación y rediseñar la ruta y la pantalla.

Y el cobrador declara si cobra: `charges: false` hace que la pantalla de planes
avise de que aquí no se cobra nada. Una pantalla de pago que no cobra y no lo dice
es una pantalla que engaña, y el día que se enchufe Stripe deja de avisarlo sola.

## Alternativas descartadas

**Stripe de verdad ahora, en modo prueba.** Es lo honesto si la idea es cobrar
pronto, y cuesta una cuenta, productos en un panel, un secreto de webhook y una
dirección pública a la que Stripe pueda llamar. Nada de eso hace falta para que el
candado exista, y el candado es lo urgente. Queda como el siguiente paso, no como
un rediseño.

**Planes sin cobro nunca, con el plan puesto a mano en la base de datos.** Se
ahorra el puerto entero. Se descarta porque convierte la aplicación en una
demostración: el objetivo declarado es que quien use la IA la pague.

**La tabla de planes en la base de datos, editable sin desplegar.** Suena flexible y
saca la política del repositorio, que es justo lo que [ADR 0001](./0001-capas-y-dominio-puro.md)
evita. Además dejaría de poderse probar sin base de datos, y hoy los planes tienen
tests que corren en milisegundos.

**Los permisos como niveles numéricos** (`plan >= 2`). Más corto de escribir y no
dice nada al leerlo: `can(plan, 'ideas')` explica qué se está preguntando y
`nivel >= 2` obliga a ir a buscar qué era el dos. Además impide que un plan incluya
algo que otro más caro no incluya, que hoy no pasa pero es una restricción que nadie
ha pedido.

**Cupos separados para profesor y para ideas.** Dos números que explicar en vez de
uno. Quien paga quiere gastar su cupo en lo que le haga falta hoy.

## Consecuencias

- Los tres planes, sus permisos y el cruce con el temario están escritos y probados
  sin que exista ninguna pasarela. Un test comprueba que cada plan incluye todo lo
  del anterior y cuesta más.
- Las rutas de IA responden `402` con el plan que hace falta y `429` con el cupo
  gastado, las dos con frases que dicen cuánto cuesta abrirlo. Está en
  [AI.md](../AI.md).
- **Cualquiera con una cuenta puede darse el plan Conservatorio** mientras el
  cobrador sea el falso. Está dicho en su propio fichero, en
  [CUENTAS-Y-PLANES.md](../CUENTAS-Y-PLANES.md) y en DESPLIEGUE.md, porque es lo
  que hay que saber antes de publicar esto de cara al mundo.
- Enchufar Stripe es escribir `server/billing/stripe.ts`, una ruta de webhook y una
  línea en `server/billing/index.ts`. Ni las pantallas ni las rutas de IA cambian.
