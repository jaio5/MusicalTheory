# ADR 0101 — Lo que dice una salida es verdad sitio por sitio, y el giro del vamp

Fecha: 2026-10-05 · Estado: aceptada · Amplía el
[ADR 0097](./0097-las-salidas-se-juzgan-por-lo-que-encajan.md) y el
[ADR 0099](./0099-formas-y-movimientos-nuevos.md)

## Contexto

Los motivos del juez, las frases de quien construye las salidas y lo que escribe el
modelo hablan de la canción: «V i en el 8», «IV V/vi: el bajo baja medio tono»,
«Tu bucle vuelve a empezar por I V», «Un periodo: semicadencia en V en el 4». Se
escribían con plantillas, y una plantilla no mira la canción. El quinto examen
(`corpus-quinto`) encontró «la dominante en el 9» en un blues menor con el VI7 en el
9, «el 1, el 5 o el 9 ya no dicen…» con esos tres sin tocar y «un periodo» en un
puente seguido de su vuelta. Cada corpus nuevo destapaba otra mentira distinta, y
`diceAlgoFalso` iba por diez frases concretas.

El validador del modelo (`loQueNoEsta`, en `features/versions/contract.ts`) tenía
el mismo defecto por el otro lado: leía «resuelve en la tónica» de un enlace y lo
comparaba con **el final de toda la canción**, no con el sitio que el enlace nombra.

Y el quinto examen enseñó un hueco del dominio: sobre un vamp de funk (`I7 I7 IV7
I7`) ningún movimiento lleva de la I al bVII, así que retocarlo daba el V7–I7 de una
cadencia clásica o el ivm7 de una balada.

## Decisión

- **La regla general**: `core/music/lo-que-dice.ts` (`loQueNoEsVerdad(texto,
LoQueHay)`, con `hablaDeUnSitio`). **Si un texto nombra un sitio, se mira qué hay
  en ese sitio**: un enlace «X Y en el N», «X en el N», «el X del compás N», «Tu bucle
  vuelve a empezar por X Y», una forma, un papel, un estilo o un grado. El compás N se
  busca en el compás N, contado por pulsos; si el enlace dice adónde llega
  («resuelve en la tónica», «da su relativa»), se mira adónde llega. Lee **grados**,
  no acordes; y lo que no sabe leer lo acepta.
- **La usan tres**: el juez (sus motivos), el generador (`nombre` y `que` de cada
  salida) y el validador `loQueNoEsta`, que traduce los acordes a grados (`aGrados`) y
  ya no compara un enlace con el final de la canción.
- **Se mide barriendo**: `lo-que-dice.test.ts` recorre los cinco corpus y 600
  canciones al azar —**6.195 salidas y 57.841 frases, 0 falsas**—. El mismo barrido
  sobre el validador pasaba de **1.862 motivos rechazados a 0** (52.311 textos).
- **El movimiento `vaiven` («Giro del vamp»)** en `reharmonization.ts`, **solo con
  `Entorno.vampDeTonica`** (`esUnVampDeFunk`): en mayor I→bVII7 o IV7 y IV→bVII7; en
  menor i→VII7, v7 o iv7 y iv→VII7. En mayor, un I que va al IV se queda: ya es su
  dominante. Con él son **trece** los movimientos de `MOVES`.

## Consecuencias

- **Una frase nueva ya no necesita una lista de mentiras.** Si nombra un sitio, la
  regla la comprueba; si habla de algo que la regla no sabe leer, no se comprueba, y
  ahí sigue mandando el cuidado de quien la escribe.
- **Los motivos que el modelo copia dejan de rechazarse por error**, y se acaba el
  caso inverso: el validador dejaba pasar un «resuelve» que no era verdad en el sitio
  que nombraba.
- **Quien añada una plantilla que nombre un sitio** tiene que dejar que
  `lo-que-dice.test.ts` la barra: lo hace solo si sale de un corpus o de las 600
  canciones al azar.
- El giro del vamp es solo del funk: en un pop, quitar la tónica por un bVII es otra
  cosa, y se juzga como un préstamo.

## Alternativas descartadas

**Seguir con diez mentiras concretas en `diceAlgoFalso`.** Cada corpus nuevo
destapaba otras, y cada arreglo era por el caso y no por la causa.

**Aflojar el validador para que pasaran los motivos.** Los 1.862 rechazos se
acababan, pero dejaba pasar mentiras de verdad: lo que sobraba no era rigor, era
comparar con el sitio equivocado.

**Contar los giros del funk como préstamos genéricos.** El préstamo del bVII es de
casa en un rock y una licencia en un jazz; en un vamp de funk es el vaivén, y juzgarlo
como préstamo lo castigaba o lo premiaba por la razón equivocada.
