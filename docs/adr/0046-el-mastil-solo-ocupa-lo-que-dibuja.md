# ADR 0046 — El mástil solo ocupa lo que dibuja

> **Ajustado por [ADR 0102](./0102-lo-que-se-lee-a-un-metro-se-ve-y-lo-que-se-pulsa-se-sujeta.md):** el tope del mástil pasa a `100dvh-31rem` (`xl`: `28rem`) y el arreglo conserva su suelo con el área de abajo abierta; y el mástil tiene suelo de 14 rem, así que en una ventana baja cede el arreglo.

Fecha: 2026-09-23 · Estado: aceptada · Ajusta: [ADR 0039](./0039-el-mastil-se-estira-a-lo-ancho.md), [ADR 0040](./0040-ni-cuadrado-ni-tira.md)

## Contexto

Con el mástil abierto en `/componer`, el arreglo se quedaba en su suelo —172 px— y
**no se veía ni un bloque de la canción**: solo su barra de botones. Mirar el
mástil y tus acordes a la vez, que es para lo que sirve tener los dos, no se
podía.

La explicación fácil era «no cabe todo», y es falsa. Midiendo lo que de verdad se
pinta dentro del `<svg>` frente a la caja que lo contiene:

| Ventana   | Caja del mástil | Alto del dibujo | Bandas vacías      |
| --------- | --------------- | --------------- | ------------------ |
| 1440×900  | 1416×512        | 363             | 79 + 70 = **149**  |
| 1920×1080 | 1896×692        | 486             | 109 + 97 = **206** |
| 1280×606  | 1256×218        | 201             | 11 + 6 = 17        |
| 1024×600  | 1000×184        | 169             | 9 + 5 = 14         |

En una ventana alta el mástil **reservaba hasta 206 px que no usaba**, mientras el
arreglo estaba en su mínimo justo encima.

El motivo es la combinación de dos decisiones que por separado están bien.
[ADR 0039](./0039-el-mastil-se-estira-a-lo-ancho.md) dio el alto al hueco
—`lg:h-[calc(100dvh-26rem)]`— y [ADR 0040](./0040-ni-cuadrado-ni-tira.md) puso un
tope de 5:1 a lo fino que puede quedar el dibujo. Cuando el hueco es
**relativamente más alto** que 5:1 —lo que pasa en una ventana alta—, el dibujo
llena el ancho, se queda en su proporción y deja el resto del alto en blanco.
`preserveAspectRatio` hace lo suyo; el problema es que nadie se lo había dicho al
hueco.

## Decisión

**El hueco pone el techo, no el alto.** La proporción del dibujo manda en los dos
tamaños y `lg:h-[…]` pasa a `lg:max-h-[…]`:

```
aspect-[712/198] w-full shrink-0 lg:max-h-[calc(100dvh-26rem)] xl:max-h-[calc(100dvh-24.25rem)]
```

En una ventana alta gana la proporción y la caja se queda en lo que el dibujo
necesita. En una ventana baja gana el tope, que es lo que ya hacía, y no cambia
nada.

Lo importante de esta decisión es lo que **no** cambia: el dibujo mide
exactamente lo mismo que antes. Medido, 363 px a 1440×900 y 486 a 1920×1080 en
los dos casos. No es un intercambio entre mástil y canción —eso ya se peleó tres
veces y el mástil ganó—: es devolver espacio que no se estaba usando.

| Ventana   | Dibujo antes | Dibujo ahora | Arreglo antes | Arreglo ahora |
| --------- | ------------ | ------------ | ------------- | ------------- |
| 1440×900  | 363          | **363**      | 172           | **218**       |
| 1920×1080 | 486          | **486**      | 172           | **265**       |
| 1280×606  | 201          | 201          | 163           | 163           |
| 1024×600  | 169          | 169          | 163           | 163           |

## Consecuencias

Con el mástil abierto a 1440×900 ya se ve la fila de bloques de la canción, no
solo sus botones. En ventanas bajas —que es donde se trabaja aquí— no cambia
nada, porque ahí el tope ya era lo que mandaba y las bandas eran de 14 y 17 px.

La sonda de medidas del skill `arrancar` sigue devolviendo cero en los cuatro
tamaños: nada se recorta ni se queda fuera de alcance.

Sigue habiendo bandas, de 31 y 41 px en total, y son las que el propio dibujo
lleva dentro —el margen bajo la sexta cuerda y el sitio de los números de
traste—. Esas no se pueden quitar sin cambiar el dibujo.

**Esto no arregla que el arreglo siga en su suelo en una ventana baja.** A
1280×606 el arreglo está en 163 px con el mástil abierto y sin él: ahí no sobra
nada que repartir, y lo que haga falta se saca plegando otra área.

## Alternativas descartadas

**Bajar el suelo del arreglo para que el mástil quepa más holgado.** Es lo
contrario de lo que hace falta, y además está medido en
[ADR 0040](./0040-ni-cuadrado-ni-tira.md): por debajo de 220 px el arreglo no
puede pintar ni sus propios mandos sin cortarlos.

**Subir el tope de 5:1** para que el dibujo se estire más y llene el hueco alto.
Se descarta porque es exactamente lo que
[ADR 0040](./0040-ni-cuadrado-ni-tira.md) rechazó tras verlo: pasado ese punto el
mástil es una tira y las notas dejan de leerse. La queja que dio origen a aquello
fue «se ve demasiado fino el mástil y las notas pequeñas».

**Quitarle alto al mástil de verdad**, no solo el que sobra. Se descarta sin
discusión: es la queja que este proyecto ya ha atendido tres veces seguidas —«se
ve demasiado pequeño el mástil»— y no se vuelve a abrir por 46 píxeles.

**Centrar el dibujo arriba en vez de en medio** (`preserveAspectRatio` a
`xMidYMin`), dejando toda la banda junta abajo. Se descarta porque no devuelve el
espacio a nadie: la banda seguiría siendo del mástil, solo que en un sitio menos
repartido.
