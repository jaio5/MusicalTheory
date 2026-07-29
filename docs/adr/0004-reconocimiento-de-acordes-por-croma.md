# ADR 0004 — Reconocimiento de acordes por croma y plantillas

Fecha: 2026-07-29 · Estado: aceptada

## Contexto

El modo componer trabaja con acordes, pero hasta ahora el acorde actual se
marcaba a mano. La detección de tono de [ADR 0002](./0002-deteccion-de-tono-propia.md)
no puede ayudar aquí, y no es un defecto de implementación sino del método: la
autocorrelación busca **un** periodo y un acorde tiene tres o cuatro a la vez.
Como decía el propio roadmap, cambiarlo significaba cambiar de algoritmo, y eso
pedía un ADR nuevo. Este.

El objetivo es acotado: reconocer el acorde que se está tocando en limpio, con
la guitarra en las manos y a un metro de la pantalla. No es transcripción
automática ni análisis de una mezcla.

## Decisión

Un segundo motor, **independiente del de tono**, que trabaja en el dominio de la
frecuencia: espectro → croma → comparación contra plantillas.

**Croma** ([`audio/chroma.ts`](../../src/audio/chroma.ts)). Cuánta energía hay de
cada una de las doce notas, olvidando la octava. Lo que se suma no es el espectro
entero sino **los picos**, y cada pico se descuenta si otro más grave lo explica
como armónico suyo —hasta el sexto armónico, con tolerancia de 0,35 semitonos, y
dejando un 20 % del original—. Sin ese descuento, una sexta al aire se lee como
un E mayor: su quinta y su tercera están ahí por física pura. Se mira de 70 a
2200 Hz y hasta 40 dB por debajo del pico más alto.

**Comparación** ([`core/music/chord-matching.ts`](../../src/core/music/chord-matching.ts)).
TypeScript puro, sin audio: entra el croma y salen candidatos ordenados por el
**coseno** contra las plantillas del dominio. Por defecto se buscan tríadas,
séptimas, quintas y suspendidos.

**Motor** ([`audio/chord-engine.ts`](../../src/audio/chord-engine.ts)). Diez
análisis por segundo, media móvil con peso 0,5 y cuatro confirmaciones seguidas
antes de anunciar nada, con umbral de parecido en 0,78.

Son **dos analizadores sobre la misma entrada** —2048 muestras para el tono,
8192 para el espectro— y no uno, porque miden cosas distintas: el tono quiere
ventana corta para responder al ataque, el acorde la quiere larga para separar
dos notas vecinas en las cuerdas graves.

## Alternativas descartadas

**Estirar la autocorrelación.** Descartada por imposible, no por costosa. La
función devuelve un periodo dominante; no hay parámetro que la haga devolver
tres. Es el límite del método, y está escrito así en ADR 0002.

**Croma ingenuo sobre el espectro entero.** Es la versión de libro y es la que
falla con guitarra. Los armónicos mienten: sumar toda la energía de cada casilla
hace que una sola cuerda pulsada dibuje un acorde mayor completo. El descuento
por armónicos es justamente lo que hace utilizable el método aquí.

**Puntuar solo por lo que sobra, o solo por lo que falta.** Las dos degeneran, y
en direcciones opuestas. Contando solo lo que suena y no debería, un acorde de
cinco notas gana siempre, porque cuantas más notas tiene más fácil le resulta
cubrir lo que suene. Contando solo lo que debería sonar y no suena, Am y C6 se
vuelven indistinguibles: son las mismas tres notas más una cuarta que en Am ni
siquiera existe. El coseno castiga las dos cosas a la vez, que es lo que hace
falta.

**Incluir novenas y tensiones en las plantillas.** Una novena tiene cinco notas
y en una guitarra casi nunca suenan las cinco, así que competiría con ventaja
injusta contra la tríada que de verdad se está tocando. Menos especies, menos
confusiones.

**Anunciar cada análisis según sale.** Un rasgueo pasa por media docena de
acordes falsos antes de asentarse. Sin media móvil y confirmaciones, la interfaz
es un cartel parpadeando. El precio son cuatro décimas de retardo, y se paga
con gusto.

**Un modelo entrenado.** Es lo que usa el estado del arte y reconoce inversiones
y voicings raros, que es exactamente donde este método duda. Se descarta por
tres razones: el peso que añade al navegador, que vuelve caja negra la única
pieza que interesa poder ajustar con la guitarra en la mano, y que obligaría a
revisar la promesa de privacidad si la inferencia no fuese local. Si algún día
las inversiones molestan de verdad, la parada siguiente es una transformada de
Q constante antes que un modelo.

## Consecuencias

**A favor**

- El acorde actual se detecta en vez de marcarse a mano, que era la carencia más
  visible del modo componer.
- La comparación es dominio puro y se prueba sin audio ni esperas.
- Los cuatro parámetros que gobiernan la sensación —cadencia, suavizado,
  confirmaciones y umbral— están juntos, con nombre y documentados.
- Cero dependencias nuevas.

**En contra**

- **Duda con las inversiones.** El croma olvida la octava a propósito, así que
  un C/E y un C son el mismo vector. Acierta con tríadas y séptimas sostenidas
  en limpio, que es el caso de uso declarado.
- **Sigue pidiendo señal limpia.** La distorsión ensucia el espectro y el
  descuento de armónicos deja de sostenerse.
- **Cuatro décimas de retardo** entre cambiar de acorde y verlo. Es deliberado,
  pero está ahí.
- **Solo reconoce lo que hay en la lista.** Un acorde fuera de las especies
  buscadas no sale como «desconocido», sale como el más parecido que haya
  superado el umbral, o como nada.
- **Otro análisis más en el hilo principal.** Se suma al de tono y refuerza lo
  que ya anota [ADR 0003](./0003-analisis-en-el-hilo-principal.md): antes de
  mover nada, medir.
