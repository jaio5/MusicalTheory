# ADR 0030 — Cambiar de modo traduce la canción, no la recorta

Fecha: 2026-09-17 · Estado: aceptada · Amplía: [ADR 0018](./0018-el-lienzo-de-montar.md)

## Contexto

Un montaje son **grados**, no acordes: `I`, `vi`, `IV`, `V`. El tono con el que
suenan lo pone la rueda, y eso es lo que permite cambiar de tonalidad sin tocar un
solo bloque. Es una de las decisiones que mejor han envejecido de este proyecto.

Tiene un agujero, y llevaba tiempo abierto: **los dos modos no nombran los mismos
grados**. En mayor hay `I`, `ii`, `iii`, `IV`, `vi`, `vii°`; en menor hay `i`,
`ii°`, `III`, `iv`, `v`, `VI`, `VII`. Así que un montaje escrito en Do mayor deja
de poder leerse en cuanto la rueda pasa a La menor: `resolveDegree` y `nextDegrees`
lanzan `RangeError` con un grado que no les toca.

Y no lanzaban en un sitio inocente. Con cuatro bloques puestos y un clic en la
rueda, **la pantalla de componer entera se caía**: React tiraba el árbol y encima
de media hora de trabajo aparecía un «This page couldn't load. Reload to try
again». Reproducido en el navegador, no deducido leyendo.

Lo llamativo es que el arreglo estaba escrito. `arrangement.ts` tenía
`keepDegreesOfMode`, con su docblock explicando este mismo fallo, y
`arrangement-store` tenía la acción `keepMode` con el comentario «lo llama el
cambio de rueda». **No lo llamaba nadie.** Escrito, probado y sin enchufar.

## Decisión

Al cambiar el modo, **cada grado se dice en el modo nuevo por su función**. El `I`
pasa a `i`, el `IV` a `iv`, el `vi` a `VI`. La canción no pierde una sola parte:
cambia de color.

Lo hace `translateToMode` en `core/music/arrangement.ts`, apoyada en
`degreeInMode`, que es la tabla de equivalencias entre los dos catálogos. Y lo
dispara `state/montaje-en-su-modo.ts`, que vigila la tonalidad **y** el montaje.

Dos detalles del enchufe que no son opcionales:

- **Se engancha al modo que sale de `selectActiveKey`, no a `pinKey`.** El modo no
  cambia solo pulsando la rueda: también al detectar una tonalidad por el micro, al
  volver a hacer caso a la detección y al retomar una sesión guardada.
- **No puede ser un efecto de React.** Un efecto corre después de pintar, y para
  entonces el lienzo ya ha intentado leer los grados viejos y ha lanzado. Los
  avisos de Zustand se reparten dentro del propio `set`, antes del repintado.

Sobreviven todos los grados menos tres: las dominantes secundarias de `ii`, `iii`
y `vi`, que en menor caen en sitios que no existen. Esas se quedan fuera, porque
allí ese acorde no está.

## Alternativas descartadas

**Filtrar los grados que no existen**, que es lo que hacía `keepDegreesOfMode`.
Era lo que ya estaba escrito y es lo que primero se probó. Quita el fallo y pone
uno peor: de `I`, `vi` y `IV` no sobrevive **ninguno** en menor, así que pasar de
Do mayor a La menor dejaba el lienzo en blanco sin avisar. Cambiar un cierre de la
aplicación por un borrado silencioso del trabajo no es arreglarlo; es esconderlo
donde tarda más en verse.

**Conservar los acordes que suenan** en vez de la función: que el `I` de Do mayor
—un Do— siguiera siendo un Do al pasar a La menor, o sea el `III`. Suena a que
respeta más lo hecho, y es justo lo contrario de lo que este montaje es. Aquí un
bloque **es una función**, y por eso cambiar de tonalidad nunca ha tocado un
bloque: si al cambiar de modo la casa dejara de ser la casa, el montaje pasaría a
ser una lista de acordes con el tono pegado, que es el modelo que este proyecto
descartó desde el principio.

**Impedir el cambio, o preguntar antes.** «Tienes una canción empezada, ¿seguro?»
es un diálogo delante de un gesto que la gente hace para probar cómo suena algo.
El cambio es reversible —se vuelve por el mismo camino— y el deshacer sigue ahí.
Un aviso para una operación que no pierde nada solo enseña a ignorar los avisos.

**Que el dominio no lance y devuelva un acorde cualquiera.** Entonces el fallo deja
de verse y aparece como un acorde raro en mitad de una canción. `resolveDegree`
lanza con un grado imposible porque eso _es_ un error de programación; lo que
estaba mal no era que lanzase, sino que nadie impidiera que llegase a hacerlo.

## Consecuencias

- Cambiar de modo con la canción empezada es seguro, y además es una herramienta:
  se oye la misma canción en menor de un clic.
- Hay una invariante nueva que mantener —el montaje siempre está en el modo de la
  tonalidad puesta— y quien la sostiene es un único fichero, con sus tests.
- `state/montaje-en-su-modo.test.ts` la fija. Tres de sus cinco casos fallan si se
  desenchufa la vigilancia, que es exactamente lo que había pasado.
