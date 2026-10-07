# ADR 0107 — Los armónicos se miden en su serie, y el bajo desempata

Fecha: 2026-10-07 · Estado: aceptada · Amplía: [ADR 0004](./0004-reconocimiento-de-acordes-por-croma.md) · Corrige en parte: [ADR 0020](./0020-lo-que-se-oyo-y-lo-que-se-supo.md) (contra quién se mide el margen)

## Contexto

Un estudio con guitarra sintética de Karplus-Strong, rasgueada y metida por el
micrófono falso de Chromium, repitió lo que ya decía el rodaje con guitarra de
verdad del 23 de septiembre:

- C F G Am → «G C F G»: **el La menor sale siempre como Do**, o desaparece.
- C G Am F Dm E Em D → 7 de 8, falla el La menor.
- C, C/E, G7, A, Bm → 2 de 5: el Si menor sale Si o Re, y aparecen acordes que
  nadie tocó.

[ADR 0043](./0043-dos-maneras-de-equivocarse.md) dejó escrito que eso pasaba por
el modelo de armónicos y que «no se arregla adivinando». Mirando los picos de un
La menor rasgueado, **no hacía falta adivinar: se veían tres causas, y ninguna era
un número mal puesto.**

1. **La tabla de armónicos no se parece a una cuerda grave.** `discountHarmonics`
   predecía cada armónico como una fracción fija de su fundamental —la octava a
   0,35, la quinta de encima a 0,2…— y además exigía que la fundamental fuera
   **más fuerte** que su armónico. En una cuerda grave no lo es: la caja casi no
   radia por debajo de cien hercios, y el La de la quinta cuerda medía 15 dB por
   debajo de su propia octava. Así que su serie no se descontaba.
2. **El séptimo armónico ni se miraba.** Se buscaba hasta el sexto. El séptimo de un
   La grave cae a treinta centésimas de un Sol, y con él el La menor se convertía
   en `Am7`; el noveno, en un Si. Una nota sola de Mi grave se leía `E7` por lo
   mismo.
3. **`Am7` y `C6` son las mismas cuatro notas**, el coseno les da la misma
   puntuación al decimal, y **el empate lo ganaba el que salía antes en el bucle**:
   el Do, que es la fundamental 0. Lo mismo `Bm7` contra `D6`. No era una lectura,
   era el alfabeto.

Y una cuarta que no fallaba el acierto sino la duda: el margen se medía contra el
segundo candidato, que casi siempre es **el mismo acorde con otra especie** —`C`
contra `Cmaj7`—. Los dos se apuntan igual, como Do mayor, pero el margen salía
cerca de cero y todo lo rasgueado iba con «?». En el diferido, **el cien por cien
de los acordes bien leídos salía dudoso**: el «?» no decía nada.

## Decisión

**1. Cada armónico se mide en su propia serie, no en una tabla.** Lo que una nota
explica de su armónico `h` es lo que miden sus vecinos de la serie, `h−1` y `h+1`
—el menor de los dos—: una serie cae sin saltos, y lo que el armónico tenga por
encima lo pone otra nota que cae en el mismo sitio, y se conserva. La fundamental
ya no tiene que ser más fuerte que su armónico; solo no ser ruido (un décimo del
pico más fuerte). Se mira hasta el duodécimo, que en el Mi grave son 989 Hz.

Solo se descuentan los armónicos **que caen en otra nota** —el 3, 5, 6, 7, 9…—. La
octava y sus dobles caen en la misma nota que la cuerda y sumarlos no miente.

El margen para dar un pico por armónico baja de 35 a **10 centésimas**: los
armónicos de una cuerda caen en múltiplos casi exactos —la rigidez los sube unas
pocas centésimas hasta el décimo— y, con 35 y hasta el duodécimo, casi cualquier
pico de una sala en silencio tenía otro debajo a una razón entera: el descuento se
comía el ruido a bocados y lo que quedaba parecía un acorde.

**2. El análisis en diferido mira hasta mil hercios, como el de en vivo**
(`ACORDES_HASTA_HZ`). El techo estaba solo en el motor en vivo, con su porqué
escrito; el diferido seguía mirando hasta 2200 y leyendo séptimas que nadie tocó.

**3. El bajo desempata, y solo desempata.** `leerEspectro` devuelve con el croma
la nota más grave que suena de verdad —tras el descuento, y pesando al menos un
15 % del pico más fuerte, para que el zumbido de la red no sea el bajo—, y
`readChord` la usa **entre candidatos con las mismas notas**: con La abajo es
`Am7`, con Do es `C6`. Fuera de un empate exacto no manda, así que una inversión
sigue siendo su acorde: un `C/E` se lee Do, no Mi menor. Y el empate sigue siendo
un empate: elegir por el bajo no quita el «?».

**4. El margen se mide contra el primer candidato que se escribiría distinto**: la
fundamental y la tríada de dentro, o las notas si no lleva tríada. Es la misma
identidad con la que el motor en vivo confirma y con la que la captura funde
repetidos. `C` contra `Cmaj7` deja de ser una duda; `C6` contra `Am7` lo sigue
siendo. Las alternativas que se ofrecen al corregir no cambian.

## Lo medido

**Todo con guitarra sintética. Con una guitarra de verdad está sin medir**, y es lo
siguiente que hay que hacer: esto cambia el modelo de armónicos, y los armónicos de
una guitarra real no son los de ninguna de las dos de aquí.

Dos guitarras distintas: la de `audio/guitarra-sintetica.ts` para ajustar, y otra
Karplus-Strong escrita aparte —retardo fraccionario, posición de la púa, brillo,
unos cents de desafinación por cuerda, resonancias de caja y zumbido de red— para
los dos conjuntos ciegos, con otras posturas (cejillas en el quinto y séptimo
traste) y otras semillas. Dieciséis acordes —C, G, D, A, E, Am, Em, Dm, F, Bm,
G7, D7, A7, E7, C/E, G/B—, cuatro maneras de tocar —abajo, abajo-arriba, arpegio
con los dedos, bajo y rasgueo—, ruido de sala a tres niveles y progresiones
enteras. Acierto es la fundamental y la tríada, que es lo que se apunta; «exacto»
cuenta además la séptima.

| Conjunto (tramos)        | Vía         | Tríada antes | Tríada después | Am antes → después | Bm antes → después |
| ------------------------ | ----------- | ------------ | -------------- | ------------------ | ------------------ |
| Ajuste (72)              | En diferido | 75 %         | 99 %           | 0/5 → 5/5          | 0/4 → 4/4          |
| Ajuste (72)              | En vivo     | 83 %         | 99 %           | 1/5 → 5/5          | 0/4 → 4/4          |
| Ciego 1 (116)            | En diferido | 64 %         | 90 %           | 0/9 → 6/9          | 0/7 → 7/7          |
| Ciego 1 (116)            | En vivo     | 74 %         | 93 %           | 0/9 → 6/9          | 1/7 → 7/7          |
| Ciego 2, el último (116) | En diferido | 60 %         | 90 %           | 0/7 → 5/7          | 0/7 → 4/7          |
| Ciego 2, el último (116) | En vivo     | 72 %         | 94 %           | 0/7 → 5/7          | 2/7 → 7/7          |

**Los mayores no empeoran en conjunto**: en el último ciego, de 36/45 a 41/45 en
diferido y de 41/45 a 43/45 en vivo, aunque un Re suelto pasó de bien a mal en cada
vía. El primer ciego sirvió para quitar o dejar cada una de las cuatro piezas —todas
ayudaban o no restaban—, y como el margen de diez centésimas se decidió **después**
de mirarlo, se generó un segundo ciego antes de ese cambio y no se miró hasta el
final.

En Chromium, con el micrófono falso y ocho progresiones —las tres del estudio y las
cinco del último ciego—, **los acordes que nadie tocó pasan de 8 a 1**, y el La
menor de C F G Am se escribe en todas las vueltas en vez de en una de cada dos.

**Lo que empeora, y hay que decirlo:**

- **Una nota sola se lee como su quinta** (`C5`) en vez de como su acorde con
  séptima, y a veces **sin «?»**: en diferido, de 0 a 0, 1 y 3 de 8 notas según el
  conjunto; en vivo, de 4 a 5, de 3 a 3 y de 4 a 4. Un punteo sigue sin poder
  leerse por el croma ([ADR 0048](./0048-una-toma-dice-lo-que-es.md) lo separa).
- **Ventana a ventana se afirman más errores**: del 0–2 % al 3–4 % de las ventanas
  sale mal y sin «?». A cambio, los bien leídos dejan de dudar de todo —del 95–98 %
  con «?» a un 30–45 %—; tramo a tramo, lo mal afirmado sigue en uno o ninguno.
- **El arpegio con los dedos es lo que peor aguanta**: lo que queda mal en los
  ciegos es casi todo arpegio, donde la tercera suena una vez por vuelta y a veces
  se pierde (`A5` por `Am`).
- **Las inversiones siguen sin escribirse**: `C/E` se lee Do, que es lo que el
  bloque sabe guardar. El bajo se sabe y solo se usa para desempatar.
- El análisis en diferido sigue marcando con «?» la mayoría de los tramos —la peor
  de sus ventanas, como decidió [ADR 0043](./0043-dos-maneras-de-equivocarse.md)—.

Los generadores y las cifras están fuera del repositorio, en el directorio de
trabajo de la sesión; el resumen, en [AUDIO-PITCH.md](../AUDIO-PITCH.md).

## Consecuencias

`leerEspectro` es la nueva entrada del croma, con su bajo; `chromaFromSpectrum`
sigue existiendo y devuelve lo mismo que antes —solo el croma—. `readChord` acepta
`bajo`. `chordsOfRecording` no cambia de firma, pero lee distinto: con el techo de
mil hercios y con el bajo.

El coste sube y no se nota: un análisis en vivo sobre ruido, el peor caso, pasa de
unas 0,05 a unas 0,2 ms, de los cien que hay entre análisis.

## Alternativas descartadas

**Calibrar la tabla.** Se probó subirla entera (×2) y cambiarla por 1/n o 1/n¹·⁵:
mejoraba poco y seguía sin poder con una fundamental más floja que su armónico,
porque predice desde la fundamental. Y era calibrar contra la guitarra sintética,
que tiene justo los armónicos que se le pusieron.

**Plantillas con los armónicos dentro**, en vez de descontarlos del espectro: un
`Am` que ya espera su Sol del séptimo armónico. Necesita la misma tabla de
amplitudes que se estaba quitando, solo que escondida en las plantillas.

**Un estimador de varias alturas entero** —sumar armónicos por candidato, quitar el
mejor y repetir—. Es lo que se hace en la literatura y es más de lo que hacía
falta: la regla de los vecinos de la serie es la mitad que importa, y cabe en el
descuento que ya había.

**Que el bajo premie siempre la fundamental.** Arreglaría más empates de los
exactos, y convertiría cada `C/E` con un Si de sobra en un Mi menor. Solo desempata
lo que el coseno no puede separar.

**Subir el suelo de parecido o el del diferido** para que el ruido no llegara a
acorde. Es tapar el síntoma, y [ADR 0043](./0043-dos-maneras-de-equivocarse.md) ya
explica por qué callar es peor que preguntar. El ruido se arregló donde se rompía:
en el margen del armónico.

**Medir el margen en diferido con un percentil** en vez de con la peor ventana,
para que no salga casi todo con «?». Es una decisión de
[ADR 0043](./0043-dos-maneras-de-equivocarse.md) y no de este cambio; queda
anotada.
