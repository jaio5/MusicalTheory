# ADR 0010 — Dos temas: el negro de casa, el claro a un clic

Fecha: 2026-08-01 · Estado: aceptada

## Contexto

La aplicación nació oscura y con una idea detrás: **un amplificador de válvulas
visto de noche**. Chasis de latón, tapizado oxblood, resplandor verde sobre negro
cálido. Está escrito en `ui/tokens.ts` desde la fase 0 y sostiene la portada, el
afinador y el mástil.

Lo que esa decisión nunca miró es dónde se usa esto: con la guitarra puesta, de
día, junto a una ventana. Un tema oscuro es cómodo de noche y difícil de leer con
luz de frente, y hasta ahora no había alternativa: quien lo quisiera claro no
tenía dónde pedirlo.

## Decisión

**El negro sigue siendo el de casa, y el claro es la salida para quien lo
necesite.**

Esta decisión se escribió primero al revés —claro de base— y se corrigió el mismo
día: la identidad del proyecto está escrita desde la fase 0 y no la cambia una
paleta nueva. Lo que faltaba no era otro tema por defecto, era **poder elegir**.

Y no cuelga de `prefers-color-scheme`: esto es negro salvo que se pida claro. Un
sistema en claro no significa que quien toca la guitarra quiera esta aplicación en
claro, y hacer que la identidad dependa del ajuste del móvil es regalar la decisión.

La paleta clara, la que se ofrece, es blanco, tres grises cálidos y un oro. Elegante por lo que no
tiene: un solo acento. El oro es el mismo hilo del latón —esto sigue siendo un
amplificador— bajado a `#A16207`, que es lo que hace falta para que un texto de
acento llegue a 4,5:1 sobre blanco; el dorado bonito de las paletas, `#D4AF37`, no
lo cumple ni de lejos. Los grises son cálidos y no azules: sobre blanco puro, un
gris azulado deja la pantalla con aire de hospital.

Tres piezas lo sostienen:

1. **Los nombres de los tokens no cambian entre temas.** `brass` es «el acento»,
   `oxblood` «lo que va mal» y `tube` «lo que va bien», valga lo que valga cada uno
   en cada tema. Por eso **ningún componente se entera de esto**: piden
   `text-brass-bright` y les sale lo que toque.
2. **`@theme inline`** en Tailwind: el bloque solo dice qué utilidad usa qué
   variable, y las variables se declaran por tema. Con los valores dentro de
   `@theme` no habría forma de cambiarlos en caliente.
3. **Un guion de tres líneas en el `<head>`**, antes de pintar. Sin él hay
   destello: el HTML llega con el tema por defecto, el navegador lo pinta y React
   lo cambia al arrancar. Para quien eligió oscuro, eso es un fogonazo blanco en la
   cara en cada carga.

El overlay de grabación **no sigue al tema**: se dibuja encima del vídeo de la
cámara, no encima de la aplicación, y ahí la letra clara con sombra se lee sobre
cualquier imagen mientras que la oscura desaparece en cuanto se toca una pared
clara.

## Alternativas descartadas

**Dejarlo oscuro y ya.** Es la identidad y funciona de noche. Pero no se puede
elegir, y el sitio donde más se usa esto —un salón de día— es justo donde peor se
lee.

**Seguir al sistema.** Era la primera versión de esto: tres valores —claro, oscuro
y «lo que diga el sistema»—. Se quitó porque hace que la identidad del proyecto
dependa de un ajuste del móvil: alguien con el sistema en claro abriría en blanco
una aplicación cuya idea es un amplificador visto de noche. La preferencia se
guarda solo cuando se pide el claro; volver al oscuro **borra** la preferencia, así
que lo de la casa es la ausencia de elección.

**Una cookie en vez de `localStorage`.** Permitiría pintar el tema desde el
servidor sin guion, pero obliga a servir HTML distinto por tema y a que el layout
lea la petición. Tres líneas en el `<head>` cuestan menos y no atan el renderizado.

**Un ciclo de tres botones** —claro, oscuro, sistema—. Obliga a pasar por el que no
quieres para volver al que sí, y nadie entiende qué hace el tercer clic. El
conmutador alterna entre dos y «sistema» es de donde se parte.

## Consecuencias

Lo que se gana: se puede leer de día sin renunciar a lo que esto es. Quien no elija
nada abre en negro, como siempre.

Lo que cuesta: **dos paletas que mantener**. El test de `ui/tokens.test.ts` compara
las dos contra sus bloques de CSS, así que separarlas falla ahí y no en pantalla
tres semanas después. Y cada color nuevo hay que pensarlo dos veces —literalmente—
comprobando contraste en los dos fondos.

Lo que queda pendiente: el oscuro es el de siempre y está rodado; **el claro no lo
ha visto nadie con la guitarra en la mano**. Los contrastes cumplen en el papel,
pero eso no es haberlo usado.
