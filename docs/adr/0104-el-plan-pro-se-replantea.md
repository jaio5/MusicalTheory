# ADR 0104 — Pro se funde en Medio

> **Cifras de hoy:** el cupo más alto es de 193 preguntas al mes con el modelo por defecto, no 227. Mira [`CUENTAS-Y-PLANES.md`](../CUENTAS-Y-PLANES.md).

Fecha: 2026-10-07 · Estado: aceptada · Corrige: los tres planes de
[ADR 0006](./0006-planes-y-puerto-de-facturacion.md) y el reparto de
[ADR 0066](./0066-las-ideas-se-retiran-y-las-salidas-bajan-a-medio.md)

## Contexto

Había tres planes de pago: Básico a 4,99 €, Medio a 9,99 € y Pro a 19,99 €. Desde que
las salidas bajaron a Medio ([adr/0066](./0066-las-ideas-se-retiran-y-las-salidas-bajan-a-medio.md)),
**lo único que Pro añadía era un permiso**, `profesor-con-progreso`: que el profesor
sepa qué unidades llevas hechas antes de contestar.

El estudio de negocio lo puso al lado de lo que hay fuera: Yousician cobra 14,99 $ al
mes por mucho más contenido, y Pro pedía cinco euros más que eso por una frase de
contexto en el prompt. Y ese permiso **no cuesta nada servirlo**: va dentro del mismo
presupuesto de 700 tokens de entrada que cualquier pregunta al profesor, que
`server/prompts.test.ts` mide con el peor prompt de verdad. Pagar el doble de Medio
era pagar el doble de cupo, y un escalón que solo sube el cupo es justo lo que la
regla de los planes prohíbe: quien lo mira tiene que poder decir en una frase por qué
pagaría el siguiente.

## Decisión

**Pro desaparece y lo que traía entra en Medio.** Quedan dos planes de pago, Básico
y Medio, más lo que hay sin pagar. Medio es «lo de Básico, las salidas de la IA
mientras compones y un profesor que sabe por dónde vas»: las dos cosas que acompañan
mientras compones, en el mismo escalón.

**Nadie pierde nada**:

- `planOf` traduce `pro` —y `conservatorio`, que era su nombre de antes— a Medio, y
  Medio trae todos los permisos que traía Pro. Una fila de `users` con `pro` dentro
  resuelve como Medio sin migración, igual que se hizo con los nombres viejos.
- `/planes/pro` lleva a la ventana de Medio, por el mismo `planOf`.
- Una sesión de pago abierta antes, con `plan: 'pro'` en los metadatos, da Medio en el
  webhook. El precio `STRIPE_PRICE_PRO` deja de leerse: **nunca se ha cobrado nada**
  —la pasarela no se ha ejecutado ([adr/0077](./0077-la-suscripcion-se-guarda-en-la-cuenta.md))—,
  así que no hay suscripciones a ese precio que traducir.
- `PlanId` deja de incluir `pro`: lo que pueda venir guardado entra por `planOf`, que
  acepta cualquier cosa.

La pantalla de planes enseña dos tarjetas, la ventana de pago dos planes al lado
(`ElPlanEntreLosDePago`, que se llamaba `ElPlanEntreLosTres`), y Medio sigue siendo
el recomendado.

## Alternativas descartadas

**Bajar Pro a 14,99 €.** Lo pone a la altura de Yousician y deja el problema: sigue
añadiendo una frase de contexto que no cuesta nada, y sigue siendo un escalón que
vende cupo. Con el margen de [adr/0106](./0106-el-margen-se-cuenta-sin-iva-y-con-pago-anual.md)
daría unas 340 preguntas al mes con el modelo por defecto, y nadie que estudie con
una guitarra hace once preguntas al día.

**Darle a Pro algo que lo justifique**, más cupo o algo nuevo. Más cupo es lo que la
regla prohíbe. Algo nuevo sería inventar una prestación para sostener un precio, que
es el orden al revés: no hay nada en el ROADMAP que pida un tercer escalón.

**Quitar Pro y quitar con él el profesor que sabe por dónde vas.** Más simple en la
tabla. Pero es una prestación que funciona, que no cuesta nada servir y que hace al
profesor mejor: quitarla sería empeorar el producto para ahorrar una fila.

**Ponerlo en Básico.** Básico ya trae el temario entero, el repaso y las canciones;
la regla pide que Medio traiga algo que Básico no, y hoy eso son las salidas.
Añadirle el profesor con progreso no rompe la regla, pero la IA que acompaña
mientras compones va mejor junta, y deja a Básico como «aprender y guardar».

**Renombrar Medio**, ahora que es el de arriba. «Medio» sin un tercero encima se lee
raro, y se pensó en «Completo». Cambiar el nombre es cambiar frases en pantallas,
candados y mensajes del servidor, y es una decisión de marca, no de precio: queda
para cuando se decida cómo se llama lo que se vende.

## Consecuencias

- **Dos planes de pago**, con lo que trae cada uno en
  [CUENTAS-Y-PLANES.md](../CUENTAS-Y-PLANES.md). El test que pide que cada plan
  incluya todo lo del anterior y cueste más sigue en pie, y uno nuevo comprueba que
  `pro` resuelve con todos los permisos que tenía.
- **El cupo más alto baja de 296 preguntas a 227** con el modelo por defecto, porque
  no hay plan de 19,99 €. Quien tenía Pro —nadie que haya pagado— pasa a tener el
  cupo de Medio.
- `scripts/usuarios-de-prueba.ts` sigue creando una cuenta `pro`, que entra como
  Medio: sobra, y se puede quitar.
- El nombre de Medio queda pendiente, escrito arriba.
