# ADR 0065 — Lo que se abre desde una fila que se desplaza es un `popover`

Fecha: 2026-10-01 · Estado: aceptada · Matiza la regla de `screens/coherencia`
de que lo que abre un trozo de pantalla es siempre `ui/Disclosure`

## Contexto

En un teléfono, `/componer` gastaba 365 px de marco sobre 844: cabecera, una
barra de dos filas, la línea de la tonalidad, la bandeja de abajo y la
navegación. Para bajarlo, la barra de la cabecera pasa a ser **una sola fila que
se desplaza de lado**, con los espacios, las pestañas de área, el metrónomo, la
tonalidad y un «Más» que recoge la bandeja.

Tres de esas pastillas abren algo: el tempo y el compás del metrónomo, la rueda
de la tonalidad cuando ya hay una, y la lista de la bandeja. Lo que abre un trozo
de pantalla en esta aplicación es `ui/Disclosure`, y `screens/coherencia` lo
vigila. Pero el panel de un `Disclosure` —también el flotante— se ancla **dentro
de su contenedor**, y el contenedor aquí es una fila con `overflow-x-auto`: el
panel sale recortado por la propia fila que lo contiene, o empuja la fila hacia
abajo y deshace lo que se ganó.

## Decisión

**Esos tres paneles son `popover="auto"` del navegador**, abiertos con
`popoverTarget` desde su pastilla. El panel sale en la capa de arriba del
documento, así que no lo recorta la fila; se cierra con Escape o tocando fuera,
y el botón que lo abre lleva su estado sin escribirlo a mano. La API está en los
navegadores a los que va esto desde 2024; en jsdom falta, y los tests la
sustituyen.

**La regla de `Disclosure` sigue valiendo en todo lo demás.** El `popover` es para
lo que se abre **desde una fila que se desplaza**, que es lo único que un
`Disclosure` no puede hacer bien. Fuera de la barra compacta de componer no hay
ninguno.

## Consecuencias

Hay dos maneras de abrir un panel en la aplicación, y quien añada uno tiene que
elegir: `Disclosure` si vive en un sitio que no se desplaza, `popover` si vive en
una de las tiras. Si aparece un cuarto caso, lo suyo es subir el patrón a una
pieza de `ui/`, en vez de repetir `popoverTarget` a mano.

El `popover` no sabe dónde está su botón: sale donde lo coloque su CSS, no pegado
debajo de la pastilla. Hoy los tres salen centrados, que en un teléfono es lo que
se lee mejor. Anclarlos al botón pediría `anchor-positioning`, que todavía no
traen todos.

## Alternativas descartadas

**`ui/Disclosure` flotante dentro de la fila.** Es lo que pide la regla, y no
funciona: el panel queda dentro de un contenedor con desplazamiento lateral y sale
recortado por él. Sacarlo de la fila es exactamente lo que hace un `popover`.

**Un portal de React hacia el final del documento.** Saca el panel del recorte
igual que un `popover`, pero obliga a calcular su posición, a cerrar con Escape y
al tocar fuera, y a devolver el foco: todo lo que el `popover` del navegador ya
trae hecho. Es más código para el mismo resultado.

**Volver a la barra de dos filas.** No abre nada en ningún sitio raro, pero es la
que se comía 133 px en un teléfono, que es el problema de partida.
