# ADR 0050 — La dirección del Ollama del equipo la calcula el script, no compose

Fecha: 2026-09-24 · Estado: aceptada · Completa a [ADR 0047](./0047-la-ia-es-un-perfil-no-un-fichero.md)

## Contexto

Con un Ollama corriendo en el equipo, con `qwen3:8b` descargado y contestando, la
aplicación decía que **no hay ningún modelo configurado**. Levantada con
`docker compose up -d`, que el README ofrece como alternativa a `pnpm docker:up`.

La causa, medida:

| Qué                                  | Resultado |
| ------------------------------------ | --------- |
| `OLLAMA_URL` dentro del contenedor   | **vacía** |
| `ANTHROPIC_API_KEY`                  | vacía     |
| `modelProvider()` con las dos vacías | `ninguno` |

`compose.yml` lee `OLLAMA_URL: ${OLLAMA_URL_DOCKER:-}`, y esa variable **no la
pone compose**: la calcula `scripts/docker-arriba.sh`, porque la del `.env` dice
`localhost` —que sirve a `pnpm dev`— y dentro de un contenedor `localhost` es el
propio contenedor. Arrancando con `docker compose` a secas nadie la calcula, y la
IA se queda apagada con un mensaje correcto y desconcertante: el modelo está ahí
al lado.

La pregunta es si eso se puede arreglar en `compose.yml`, para que arrancar por
donde sea dé lo mismo. Se midió, y **no**: desde el contenedor, al Ollama de la
máquina solo se llega por la IP de `eth0`.

| Dirección probada desde el contenedor           | Resultado                                              |
| ----------------------------------------------- | ------------------------------------------------------ |
| `http://localhost:11434`                        | rechazada: es el contenedor                            |
| `http://host.docker.internal:11434`             | rechazada (192.168.65.254): apunta a Windows, no a WSL |
| La puerta del puente, `http://172.17.0.1:11434` | rechazada                                              |
| `http://172.25.84.171:11434` —`eth0` de WSL—    | **contesta**                                           |

Y esa IP **cambia al reiniciar**, así que no hay ninguna dirección estable que
escribir en un fichero.

## Decisión

**La dirección de un Ollama que ya corre en el equipo se calcula al arrancar, y la
calcula `scripts/docker-arriba.sh`.** Mira la IP de `eth0`, comprueba que algo
contesta ahí y solo entonces exporta `OLLAMA_URL_DOCKER`.

Es lo que ya hacía. Lo que añade este ADR es **decir que arrancar con
`docker compose up` a secas deja la IA apagada a propósito**, y por qué no se
arregla: no es un descuido de `compose.yml`, es que no existe la dirección fija
que haría falta.

Así que el trato queda escrito donde se tropieza —`CLAUDE.md`, el `README`,
`docs/AI.md` y el propio `compose.yml`—: **`pnpm docker:up` para tener IA, y
después de cada reinicio otra vez**, porque la IP de antes ya no vale.

## Consecuencias

`docker compose up` sigue levantando la aplicación entera, que es lo que [ADR
0047](./0047-la-ia-es-un-perfil-no-un-fichero.md) prometió, y sigue sin pedir
gráfica. Lo que no da es la IA de casa.

Un `.env` con `OLLAMA_URL_DOCKER` escrito a mano funciona hasta el siguiente
reinicio y luego apunta a una IP que ya es de otro. Eso es peor que no tenerla:
la aplicación **cree** que hay modelo, gasta cupo y falla al contactar, que es
justo lo que [ADR 0014](./0014-un-modelo-de-casa-para-probar.md) evitó dejando la
variable vacía por defecto.

Medido de paso, y merece saberse: el modelo tarda **89 s en cargarse en la
gráfica** y 0,9 en contestar. `local-model.ts` da 120 s, así que cabe, pero
Ollama lo descarga a los cinco minutos sin uso y la primera pregunta después de
una pausa vuelve a pagarlos.

## Alternativas descartadas

**Una dirección por defecto en `compose.yml`**, con
`extra_hosts: ['host.docker.internal:host-gateway']`. Es lo primero que se probó y
está en la tabla de arriba: rechazada. Con Docker Desktop, `host.docker.internal`
es **Windows**, y Ollama corre dentro de WSL. La puerta del puente tampoco llega.

**Escribir `OLLAMA_URL_DOCKER` en el `.env`.** Caduca en el siguiente reinicio, y
caduca en silencio: una dirección puesta hace que la aplicación se crea que hay
modelo y gaste cupo antes de descubrir que no contesta.

**Levantar siempre el Ollama del perfil `ia`**, que sí tiene nombre fijo
—`http://ollama:11434`— y no necesita ninguna IP. Se descarta como valor por
defecto porque pide una gráfica NVIDIA y cinco gigas de descarga, y eso es
exactamente lo que [ADR 0047](./0047-la-ia-es-un-perfil-no-un-fichero.md) puso en
un perfil para que `docker compose up` no lo arrastre. Sigue siendo la opción
buena para quien no tenga un Ollama propio: `pnpm docker:ia`.

**Que la aplicación busque el Ollama ella misma** al arrancar, probando
direcciones. Se descarta porque convierte una variable de entorno en una
adivinanza con red por medio, dentro de un servidor que tiene que responder en
frío, y porque acertar no es el problema: el problema es que la IP de hoy no es la
de mañana, y eso lo resuelve igual de bien calcularla al levantar.
