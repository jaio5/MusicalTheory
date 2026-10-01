# ADR 0074 — La diana de la rueda sale de una cuenta

Fecha: 2026-10-01 · Estado: aceptada

## Contexto

Las casillas de la rueda de quintas medían 31 unidades de 260 y los anillos se
pisaban: entre 37 y 44 puntos de cada rueda eran de dos casillas a la vez. Pulsar
abajo en «C» elegía La menor.

## Decisión

**La diana mide 36 unidades más 2 de holgura, y los radios salen de ella**
(`features/wheel/WheelOfFifths.tsx`): dentro 74, fuera 112. Doce dianas alrededor
de un círculo solo se tocan si la cuerda entre vecinas, `2·r·sen 15°`, es menor
que la diana más la holgura; de ahí sale el radio de dentro, y el de fuera es ese
más una diana y otra holgura.

La diana es **invisible y aparte del disco visible**, y los clics solo valen en el
círculo. La rueda **crece con el 42 % de su caja**, entre 24 y 34 rem, así que solo
crece en la portada.

## Consecuencias

Desde una rueda de 318 px la diana mide 44 px o más. **A 320 de ventana no se
puede**: sale de 38 px.

Al revisarlo apareció otra cosa: el texto del repaso sin plan decía que lo fallado
se apunta, y no se apunta. Ahora dice la verdad. **Queda una decisión del
usuario**: si sin plan debe apuntarse.

## Alternativas descartadas

**Zonas de clic en cuña.** Se descartan a favor de una diana medida.

**Un selector mayor/menor con un solo anillo.** Cambia lo que la rueda enseña.

**Agrandar solo la caja.** Los anillos seguirían pisándose.
