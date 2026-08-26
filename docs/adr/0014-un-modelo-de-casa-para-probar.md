# ADR 0014 — Un modelo de casa para probar, y por qué no es el de producción

Fecha: 2026-08-26 · Estado: aceptada · Amplía: [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)

## Contexto

Las tres rutas de IA —profesor, ideas y versiones— solo se podían probar de dos
maneras, y ninguna valía del todo.

Con clave de Anthropic, cada pulsación es dinero. Probar en serio una pantalla
—veinte peticiones seguidas cambiando el prompt hasta que la respuesta sirva— es
la clase de gasto que no se nota hasta la factura, y encima invita a probar poco,
que es exactamente lo contrario de lo que hace falta mientras se ajusta un prompt.

Sin clave contesta el dominio (`server/fake-model.ts`, [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)),
y eso arregla la mitad del problema: se pueden probar las pantallas, la
reproducción y los errores sin gastar un céntimo. Pero solo la mitad. **El dominio
no se equivoca nunca**, porque construye las respuestas aplicando movimientos que
él mismo sabe verificar. Todo lo que se juega de verdad en estas tres rutas —si un
modelo suelto acierta con los grados, si se inventa un cifrado, si declara el
movimiento equivocado y la versión entera se cae— es justo lo que un puerto falso
no puede enseñar. La validación contra el dominio nunca se ha visto rechazar nada.

## Decisión

**Un tercer proveedor: un modelo que corre en el equipo, servido por Ollama en un
contenedor.** Es el cuarto puerto con la misma forma que el cobrador que no cobra,
el correo que no manda y el modelo que no piensa.

Cuatro cosas lo definen:

1. **El reparto vive en `ask-model.ts`, que ya existía.** Las tres rutas siguen
   llamando a `askModel` con prompt, esquema y tope de tokens, y no saben quién
   contesta. La validación contra el dominio que hacen después es la misma para
   los tres, que es lo que hace posible enchufar uno nuevo sin tocarlas.
2. **Sin SDK.** Ollama habla JSON por HTTP y `fetch` está en el runtime. El SDK de
   Anthropic sigue importado desde un único fichero del proyecto, que es la regla
   que evita que la clave acabe en el bundle del navegador.
3. **La clave gana al modelo local.** `OLLAMA_URL` es una variable que se pone
   para probar y se olvida puesta; si ganara ella, un despliegue con las dos
   configuradas serviría en silencio respuestas de un modelo de ocho mil millones
   de parámetros a quien ha pagado el plan Pro. Para probar en local se quita la
   clave, que es lo explícito.
4. **En un fichero de compose aparte** (`compose.ia.yml`, `pnpm docker:ia`),
   porque pide una gráfica NVIDIA y `docker compose up` tiene que seguir
   funcionando en un equipo que no la tenga.

Las tres decisiones de coste que se tomaron para la API se traducen, no se
reinventan: no pensar (`think: false`), el mismo tope de tokens que impone el
presupuesto (`num_predict`) y el esquema JSON constriñendo la generación
(`format`). En local no cuestan dinero, pero cuestan segundos y respuestas
truncadas, que con la guitarra en las manos es peor.

**Esto es para probar, no para producción.** Está escrito aquí y en el código
porque un puerto que funciona invita a usarlo en serio, y la calidad de un modelo
de este tamaño no es la de la API.

## Consecuencias

- Se puede iterar sobre los tres prompts sin límite y sin factura, que es lo que
  hacía falta.
- **Se amortizó el primer día.** Lo primero que apareció al preguntarle de verdad
  fue un fallo del proyecto, no del modelo: `IDEAS_SCHEMA` no exigía los `degrees`
  que `validateIdeas` da por hechos, así que una respuesta válida se barría entera
  y la ruta contestaba 502 con el cupo ya gastado. Afectaba igual a la API —la
  salida estructurada garantiza lo que el esquema exige, no lo que el validador
  espera—, y no lo veía ningún test porque el dominio que contesta sin clave
  construye siempre respuestas completas. Con el esquema corregido: 36 de 36
  peticiones, dos modelos, las seis combinaciones.
- **Nada de esto está probado contra un Ollama de verdad todavía.** Lo que hay
  escrito son las dos traducciones —el cuerpo de la petición y la lectura de la
  respuesta—, con sus pruebas unitarias, y el montaje de compose. La primera vez
  que se levante puede pedir un ajuste; el sitio donde caería es
  `server/local-model.ts` y nada más.
- **La verificación de las versiones se puede ver trabajar por primera vez.** Se
  espera que con un modelo pequeño rechace bastante —declarar un movimiento que no
  es el que hizo, cambiar el número de compases—, y eso no sería un fallo del
  montaje sino la medida de que
  [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md) defiende de algo
  real. **Cuánto, no se sabe todavía: no se ha ejecutado.** Es lo primero que hay
  que medir, y el número va en el ROADMAP cuando exista.
- **Los cupos salen pequeños.** `configuredModel` devuelve el nombre del modelo
  local, que no está en la tabla de precios, así que `priceOf` lo cobra al precio
  del más caro conocido ([ADR 0008](./0008-los-cupos-salen-del-precio.md)). Es
  incómodo al probar y es lo correcto: el cupo defiende de un gasto, y suponer
  coste cero sería literalmente dividir entre cero.
- La primera petición después de levantar el contenedor tarda lo que tarde en
  cargar los pesos en la gráfica, y por eso el tope de espera son dos minutos.
- Una dependencia más que mantener, pero solo en desarrollo: la imagen final del
  Dockerfile no la lleva.

## Alternativas descartadas

**Un proxy que hable el protocolo de Anthropic** —LiteLLM o similar— para no
escribir adaptador ninguno y cambiar solo el `baseURL` del SDK. Menos código
nuestro. Se descarta porque mete una pieza intermedia que hay que levantar,
configurar y actualizar, y porque el sitio donde suele romperse es justo el que
importa aquí: cómo traduce la salida estructurada por esquema JSON. Un fallo ahí
se vería como «el modelo no respeta el esquema» y se buscaría en el modelo.

**Ollama instalado en el sistema, sin contenedor.** Funciona hoy mismo y se salta
el asunto de la gráfica en Docker. Se descarta porque no queda escrito en ninguna
parte: quien clone el repositorio no sabría qué instalar ni qué modelo, y esto
existe para que probar sea barato, no para que además haya que averiguarlo.

**Meter el modelo local en la tabla de precios con coste cero** y así tener cupos
grandes mientras se prueba. Se descarta por dos motivos, y el segundo pesa más que
el primero: el cupo se calcula dividiendo el presupuesto entre el coste, así que
cero da infinito; y aunque se arreglara con un caso aparte, sería la primera vez
que la tabla de precios miente, y esa tabla es la que evita perder dinero.

**Un modelo más grande, de los que sí podrían pasar la verificación de las
versiones.** Se descarta de momento por lo que ocupa: pasa de cinco a más de
veinte gigas y deja de entrar en una gráfica normal, con lo que se acaba probando
en la CPU y una respuesta tarda minutos. `OLLAMA_MODEL` lo permite cuando haga
falta, que es lo que importa que estuviera abierto.

**Ampliar `fake-model.ts` para que se equivoque a propósito** y así ejercitar los
caminos de error sin descargar nada. Se descarta porque prueba los errores que se
nos ocurran, y lo que hacía falta era ver los que se le ocurren a un modelo. Los
casos concretos que aparecen —declarar mal el movimiento, saltarse un compás— no
estaban en la lista que habríamos escrito.
