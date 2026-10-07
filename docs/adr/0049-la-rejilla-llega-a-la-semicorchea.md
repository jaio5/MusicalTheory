# ADR 0049 — La rejilla llega a la semicorchea, y nadie se dibuja encima de nadie

Fecha: 2026-09-24 · Estado: aceptada · Corrige a [ADR 0019](./0019-punteos-y-partitura.md)

## Contexto

Al transcribir un punteo de audio a partitura **salían notas superpuestas**. Se
veía como un problema del motor de tono —«no recoge bien lo que toco»— y no lo
era: el motor las oía todas y bien. Las apilaba la escritura.

[ADR 0019](./0019-punteos-y-partitura.md) puso el tiempo «en pulsos, sobre una
rejilla de medio pulso», con la corchea como figura más corta. Eso es lo que se
podía dibujar entonces, y el comentario de `melody.ts` lo defendía: más fino
daría notas que el pentagrama no sabe escribir.

La medida, con las funciones de verdad. Seis notas a 150 ms, que es tocar
semicorcheas a 100 pulsaciones por minuto —lo que sale de cualquier guitarra en
una escala, no un caso raro—:

| Rejilla               | Inicios que salen                  | Notas visibles |
| --------------------- | ---------------------------------- | -------------- |
| Media pulsación (0,5) | `0 · 0,5 · 0,5 · 1 · 1 · 1,5`      | 4 de 6         |
| Un cuarto (0,25)      | `0 · 0,25 · 0,5 · 0,75 · 1 · 1,25` | 6 de 6         |

Con la rejilla en la corchea **cada dos notas caían en el mismo sitio**: tres
pares, dibujados uno encima de otro. Y las que sobrevivían duraban el doble de lo
tocado, porque `snapLength` también se iba a la corchea.

Eran dos fallos y uno tapaba al otro. El segundo es más pequeño pero no se cura
con el primero: **el inicio se redondea a la rejilla y la duración a la figura más
parecida, y son dos redondeos distintos.** Nada garantiza que el final de una nota
no se pase del inicio de la siguiente, por fina que sea la rejilla.

## Decisión

**Dos cosas, y van juntas: la rejilla baja a un cuarto de pulso y la lista de
figuras empieza en la semicorchea.**

Lo que decía `melody.ts` era cierto y sigue siéndolo; lo que pasa es que el
argumento se mueve con la lista. **La rejilla no puede ser más fina que la figura
más corta** —volverían las notas que no se pueden escribir— **ni más gruesa**
—se apilan—. Son la misma cosa mirada dos veces, y ahora hay un test que las ata:
`GRID` es el mínimo de `NOTE_LENGTHS`, y si alguien mueve una sin la otra salta.

**Y al escribir, ninguna nota pasa de donde empieza la siguiente.** Cada nota
entra al menos una posición de rejilla después de la anterior, y si la anterior se
había ido más allá, se recorta.

Se **empuja hacia delante**, no se descarta: la nota sonó, y la exactitud de
milisegundos ya se perdió al escribirla en figuras. Lo que no se puede perder es
la nota.

Recortar tiene su propia trampa, y costó un segundo repaso: **el hueco entre dos
inicios de la rejilla no es siempre una figura.** Dos notas a 0,75 pulsos de
distancia dejan un hueco que es una corchea con puntillo, y esa no está en la
lista. Recortando al hueco exacto se rompía justo la garantía que la lista existe
para dar. Por eso el recorte baja a la figura más larga que cabe —`figuraQueCabe`,
que no es `snapLength`: una busca la que **cabe** y la otra la más **parecida**, y
la más parecida a 0,7 es la negra, que no cabe—.

## Consecuencias

Un punteo rápido se transcribe entero y con su figura. El pentagrama deja de
tener dos cabezas en el mismo punto, que no es que se leyera mal: **no se podía
leer**, porque un punteo es una línea y una línea no tiene dos notas a la vez.

La semicorchea obliga al dibujo a llevar **dos corchetes**, y eso es
`arrange/Staff.tsx`. Antes solo había uno porque solo había corcheas.

Lo que esto no arregla, y sigue en el [ROADMAP](../ROADMAP.md): no hay silencios,
así que el hueco entre dos notas no se escribe; no hay tresillos, así que un
punteo en grupos de tres se redondea a algo que no es; y los compases no se
cierran. Nada de eso lo tapaba la rejilla: lo tapaba que las notas se apilaban
antes de llegar ahí.

## Alternativas descartadas

**Dejar la rejilla en la corchea y fundir las que choquen**, como ya se funden las
alturas repetidas. Se descarta porque no es lo mismo: dos veces la misma altura
seguida **es** una nota sostenida partida por el historial, y fundirla recupera lo
que se tocó. Dos alturas distintas en la misma posición son dos notas, y quedarse
con una borra la mitad de la escala que acabas de tocar.

**Bajar más, a un octavo de pulso o al tiempo libre.** Se descarta por lo mismo
que la corchea estaba mal: la rejilla y la figura van juntas, y la fusa no está
dibujada ni hay quien la pida. El tiempo libre además tira la partitura entera:
sin rejilla no hay figuras, y sin figuras no hay pentagrama, solo una lista de
milisegundos.

**Apilarlas a propósito, como un acorde.** Se descarta porque un punteo es una
voz, y porque lo que se toca ya se declara: [ADR
0048](./0048-una-toma-dice-lo-que-es.md) separó la toma de rítmica de la de
punteo justo para que los acordes los escriba el motor de acordes. Un acorde
dentro del punteo sería el mismo falso positivo entrando por otra puerta.

**Recortar la nota anterior al hueco exacto** en vez de a la figura que cabe. Es
lo que se escribió primero, y estaba mal: metía duraciones de 0,75 pulsos, que es
precisamente lo que la lista de figuras existe para impedir. Una nota sin figura no
se dibuja, y la lista vive en el dominio —y no en el dibujo— para que eso no pueda
pasar.

**Arreglar solo el apilado y dejar la duración doblada.** Se descarta porque la
duración doblada es lo que hace que la canción suene a otra cosa al reproducirla:
seis semicorcheas escritas como seis corcheas duran el doble y no encajan en el
compás. Se veía menos que el apilado y molesta igual.
