# ADR 0066 — Las ideas se retiran y las salidas bajan a Medio

Fecha: 2026-10-01 · Estado: aceptada · Sustituye en lo que toca a las ideas a
[ADR 0006](./0006-planes-y-puerto-de-facturacion.md),
[ADR 0008](./0008-los-cupos-salen-del-precio.md),
[ADR 0015](./0015-un-solo-canal-de-texto-libre.md),
[ADR 0016](./0016-salidas-en-vez-de-versiones.md) y
[ADR 0033](./0033-el-copiloto-propone-y-no-escribe.md)

## Contexto

Las ideas eran la petición al modelo que proponía progresiones mientras
compones: `/api/ideas`, el panel `features/ideas/IdeasPanel` en el área de abajo
de `/componer` y el botón «Pídeme una idea» del lienzo, que dejaba el pedido en
`state/pedido-de-ideas.ts` y abría el panel.

Cuando se escribe esto, la función ya no existía para nadie, y se comprueba
leyendo el código:

- **La ruta estaba borrada**: sin `src/app/api/ideas/route.ts`, toda petición
  acababa en un 404.
- **El panel no estaba montado**: «Ideas» había salido de los editores de abajo
  de `ComposeScreen`, así que nada lo pintaba.
- **El botón del lienzo no abría nada**: llamaba a `abrirAbajo('ideas')`, un
  editor que ya no estaba en la lista de la pantalla.

Y quedaba el resto repartido por el código: el contrato, el prompt y su esquema,
la respuesta sin IA, la capacidad `ideas` en los planes, su presupuesto de
tokens y el cálculo de cupos que la tenía como peor caso de Medio.

**Lo que dejaba en los planes es lo que obliga a decidir.** La capacidad `ideas`
era lo único que tenía Medio y no Básico: sin ella, los dos planes daban lo mismo
y Medio costaba el doble. Y [ADR 0006](./0006-planes-y-puerto-de-facturacion.md)
y `plans.ts` piden que cada escalón traiga **una cosa que el anterior no**.

## Decisión

**Las ideas se retiran enteras**: la ruta, el panel, el contrato, el prompt y su
esquema, `ideasSinIA`, la capacidad `ideas`, `AiFeature` `ideas`,
`TOKEN_BUDGETS.ideas`, `MAX_IDEAS` y los dos topes de contexto que solo usaban
ellas (`MAX_RECENT_NOTES`, `MAX_RECENT_CHORDS`), el botón «Pídeme una idea» y
`state/pedido-de-ideas.ts`. De paso salen de `EDITORES_DE_ABAJO` en
`state/banco.ts` las dos pestañas que ya no eran editores: `ideas` y `grabar`,
que es un papel de la toma desde [ADR 0056](./0056-grabar-es-un-papel-de-la-toma.md).
Un reparto guardado que las traiga abre el área cerrada, como cualquier editor
que ya no existe.

**Y las salidas —la capacidad `versiones`— bajan de Pro a Medio.** Los planes
quedan así, con los precios de siempre:

| Plan   | Lo que trae                                                  |
| ------ | ------------------------------------------------------------ |
| Básico | profesor, Grado Profesional, sincronizar, repaso y canciones |
| Medio  | lo de Básico **y las salidas**                               |
| Pro    | lo de Medio **y el profesor que sabe por dónde vas**         |

Las salidas son la IA que propone mientras compones, que es lo que Medio decía
vender, y cada plan vuelve a tener lo suyo.

**El copiloto local se queda tal cual.** Los bloques fantasma —`state/propuesta.ts`,
`arrange/BloqueFantasma`, aceptar con `Tab` y descartar con `Esc`— no importan
nada de las ideas, y la regla de [ADR 0033](./0033-el-copiloto-propone-y-no-escribe.md)
sigue en pie: nada entra en la canción sin que lo acepte una persona.

## Alternativas descartadas

**Medio con solo más cupo de IA.** Mantiene la escalera sin mover nada de sitio:
Medio sería Básico con más peticiones. Es exactamente lo que `plans.ts` y
[ADR 0006](./0006-planes-y-puerto-de-facturacion.md) dicen que no se entiende —un
escalón que solo sube el cupo—, y quien lo mira no sabría decir en una frase por
qué pagarlo.

**Quitar el plan Medio.** Dos planes de pago en vez de tres, y ninguno vacío. Se
descarta porque deja un salto de 4,99 € a 19,99 € sin nada en medio y obliga a
tocar todo lo que da por hechos tres planes —las tarjetas, las ventanas de pago,
`planOf` con los nombres viejos y las filas que ya tengan `medio` guardado—, por
una función que se ha ido y no por algo que falle en ellos.

**Dejar la capacidad `ideas` en la tabla, sin nada detrás.** Es lo que había al
empezar: Medio prometía en su tarjeta algo que no se podía usar. Una tabla de
precios que promete lo que no hay es peor que no tenerla.

## Consecuencias

- **Medio daba menos peticiones al mes que Básico**, y fue la consecuencia que
  más se notó. El cupo de un plan era su presupuesto entre su petición más cara
  ([ADR 0008](./0008-los-cupos-salen-del-precio.md)), y la más cara de Medio pasó
  de ser una tanda de ideas a una tanda de salidas: con `claude-opus-5`, Básico 73
  al mes y Medio 67. Lo arregla
  [ADR 0067](./0067-el-cupo-se-cuenta-en-preguntas.md): el cupo se cuenta en
  preguntas al profesor y una salida gasta varias.
- **Nada llena ya los bloques fantasma.** `state/propuesta.ts` y su tira siguen
  probados y funcionando, pero quien llamaba a `proponer` era el panel de ideas.
  Hoy el copiloto que propone en línea no tiene quien proponga.
- Las rutas de IA son dos, `/api/teacher` y `/api/versiones`, con el mismo cuerpo
  común. Lo que solo cubría la ruta de ideas —la frenada por frecuencia y la
  respuesta cortada— se prueba ahora desde la de salidas.
- `IconoIdeas` sale de `ui/icons.tsx`: no lo usa nadie.
- Las canciones guardadas no cambian. El papel «Una idea» de una parte
  (`ROLES` en `core/music/song.ts`) no tiene nada que ver con esta función y se
  queda.
