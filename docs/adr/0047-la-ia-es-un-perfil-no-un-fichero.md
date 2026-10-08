# ADR 0047 — La IA es un perfil, no un fichero

> **Hoy `compose.yml` tiene seis servicios** y los de la IA son tres: `ollama`, `ia-modelo` e `ia-calentar`. El fichero superpuesto de la primera redacción ya no existe.

Fecha: 2026-09-24 · Estado: aceptada · Sustituye el punto 4 de [ADR 0014](./0014-un-modelo-de-casa-para-probar.md)

## Contexto

El modelo de casa vivía en `compose.ia.yml`, un fichero que se **superpone** al
principal. [ADR 0014](./0014-un-modelo-de-casa-para-probar.md) lo decidió así por
una razón que sigue siendo buena: Ollama pide una gráfica NVIDIA, y
`docker compose up` tiene que seguir funcionando en un portátil que no la tenga.

La razón es buena; el mecanismo tenía tres costes que no se vieron entonces:

**`docker compose up` no podía levantar la IA nunca.** Hacía falta
`-f compose.yml -f compose.ia.yml`, dos banderas en el orden correcto, o acordarse
de `pnpm docker:ia`. Quien abría el proyecto y hacía lo obvio no encontraba la
puerta.

**No se podía levantar solo la IA.** El fichero de arriba no añadía servicios:
también **parcheaba** `app`, poniéndole la dirección de Ollama y un `depends_on`.
Así que pedir el modelo arrastraba la aplicación, Postgres y las migraciones.
Iterar sobre un prompt con `pnpm dev` y un Ollama en contenedor —que es
exactamente para lo que se hizo— obligaba a levantarlo todo.

**Un equipo sin gráfica tenía que editar el fichero.** La instrucción escrita era
«comenta el bloque `deploy`»: una edición a mano en un fichero versionado, que o
se sube sin querer o se pierde al actualizar.

## Decisión

**Un solo `compose.yml`, y los dos servicios de la IA con `profiles: ['ia']`.**

Lo que eso da, sin banderas ni ficheros:

```bash
docker compose up                  # la aplicación. Ni sabe que la IA existe
docker compose --profile ia up     # todo
docker compose up ollama           # solo el modelo, sin la aplicación
docker compose up db               # solo Postgres, para `pnpm dev`
```

Los tres costes desaparecen a la vez. El motivo original queda **mejor servido
que antes**: un equipo sin gráfica no comenta nada, simplemente nunca pide el
perfil, y el bloque `deploy` puede quedarse escrito donde está.

**`depends_on` con `required: false`** es lo que hace separables los dos grupos.
Con el perfil puesto, `app` espera a que el modelo esté descargado antes de
aceptar peticiones —si no, la primera pregunta contesta un 502 mientras bajan
cinco gigas, y eso no se parece en nada a «está descargando»—. Sin el perfil, esa
dependencia no existe y no arrastra nada.

**Y `pnpm docker:down` lleva `--profile '*'`.** Esto se descubrió probándolo, no
leyéndolo: `docker compose down` a secas **no para lo que está en un perfil**.
Deja Ollama corriendo con sus cinco gigas en la gráfica y encima falla al borrar
la red con un «resource is still in use» que no dice quién la usa. Es la trampa
que este mecanismo trae de regalo, y está escrita en la cabecera de `compose.yml`.

## Consecuencias

`compose.ia.yml` se borra. Quien tuviera el reflejo de los dos `-f` se encuentra
con que el segundo fichero ya no está, que es mejor que encontrárselo desfasado.

Queda **una cosa que hay que poner a pares** y no se puede evitar: el perfil
levanta los contenedores, y `OLLAMA_URL_DOCKER` le dice a la aplicación dónde
están. Compose no sabe poner una variable de entorno según el perfil activo, así
que las dos van juntas o no funciona. Se mitiga de dos maneras: `pnpm docker:ia`
pone las dos, y el `.env` que escribe el script las trae comentadas **en líneas
consecutivas bajo un mismo aviso**.

El fallo si alguien pone solo una es silencioso —Ollama arranca y nadie le habla,
así que la aplicación dice que no hay modelo configurado— y por eso el aviso está
escrito en los tres sitios donde puede mirarse: el `.env`, `compose.yml` y el
script.

## Alternativas descartadas

**Dejar los dos ficheros y añadir el perfil igualmente.** Se descarta porque son
dos mecanismos para lo mismo: quien lea el proyecto tendría que entender los dos
y saber cuál gana. Un fichero con perfiles es lo que Compose tiene para esto.

**Poner `OLLAMA_URL: http://ollama:11434` siempre**, para quitar el emparejado.
Es lo más cómodo y es lo peor: sin el perfil, la aplicación creería que hay un
modelo local, **gastaría cupo** y contestaría 502 al no encontrarlo. Sin la
variable dice que no hay modelo configurado y no gasta nada, que es la diferencia
entre un error honesto y uno caro (`docs/AI.md`).

**`include:` en vez de perfiles**, que también mantiene los servicios en su
fichero. Se descarta porque `include` es incondicional: mezcla siempre, así que
la IA volvería a estar en el `up` de todo el mundo, gráfica o no.

**Un perfil más para la gráfica**, de modo que `ia` funcione en CPU y `ia-gpu`
reserve el dispositivo. Se descarta porque obligaría a declarar el servicio dos
veces, y duplicar una definición para cambiar cuatro líneas es exactamente lo que
este proyecto evita en todas partes. Comentar cuatro líneas una vez, en el único
caso en que hace falta, cuesta menos.
