# ADR 0075 — El modelo se carga al levantar, no con la primera pregunta

Fecha: 2026-10-01 · Estado: aceptada · Completa a
[ADR 0055](./0055-la-ia-se-enciende-desde-el-env.md), que dejaba el modelo
descargado pero no cargado

## Contexto

Con la IA en Docker ([ADR 0055](./0055-la-ia-se-enciende-desde-el-env.md)), la
primera pregunta al profesor después de cada `docker compose up` contestaba «No
hemos podido contactar con el modelo». Las siguientes funcionaban.

Medido en el registro de Ollama:

- **20:48:47**: llega la pregunta y Ollama empieza a cargar `qwen3:8b`.
- **20:50:14**: el modelo termina de cargar, a los 87 s. Son cinco gigas que se leen
  del volumen de Docker en WSL y se suben a la gráfica.
- **20:50:45**: Ollama apunta un 500 tras 1 min 59 s. La aplicación cortó al llegar a
  sus 120 s (`src/server/local-model.ts`), con la primera respuesta todavía a medias.

Con el modelo ya cargado, la misma pregunta tarda 15 s, y menos de 2 una vez que ha
generado algo. El fallo no era de red ni de configuración: es que `ia-modelo`
**descarga** el modelo y la aplicación arrancaba en cuanto acababa, pero nadie lo
**cargaba**. Lo cargaba la primera pregunta, y la carga no cabía en el tope.
`OLLAMA_KEEP_ALIVE=-1` ya hacía que no se descargara después; faltaba cargarlo antes.

## Decisión

**Un servicio `ia-calentar` en `compose.yml`, en el perfil `ia`, que carga el
modelo en la gráfica en cuanto `ia-modelo` lo ha descargado.** Es un `ollama run`
con un mensaje vacío, que carga sin generar nada, y termina.

**La aplicación no lo espera.** Sigue arrancando cuando acaba `ia-modelo`, en
segundos, y la carga va por detrás. Quien pregunte mientras tanto se queda en la cola
de Ollama hasta que el modelo esté listo. Para que eso quepa, el tope del modelo de
casa sube de 120 a 180 s: la carga en frío medida va de 87 a 108 s.

## Consecuencias

Medido tras parar Ollama y volver a levantar: `ia-calentar` termina con «Modelo
qwen3:8b cargado en la gráfica», `ollama ps` lo enseña con `UNTIL Forever`, y la
primera pregunta al profesor contesta en 1,5 s con un 200.

Lo que no cambia: con el equipo recién encendido la carga sigue costando hasta dos
minutos. Ahora pasa mientras se abre la página, en vez de durante la primera
pregunta. Quien pregunta en ese rato espera, pero no recibe el error.

Esto solo cubre el Ollama de Docker. El Ollama del equipo, el que encuentra
`pnpm docker:up` ([ADR 0050](./0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md)),
sigue cargando con la primera pregunta. Le protege el tope de 180 s, pero no se
precarga.

## Alternativas descartadas

**Subir solo el tope.** Con 180 s o más la primera pregunta acaba llegando, pero
tarda dos minutos, y quien acaba de levantar la aplicación lo vive como un
cuelgue. El tope es la red de seguridad, no el arreglo.

**Que la aplicación espere a que el modelo esté cargado**, como ya espera a la
descarga. No hay que pensar en nadie preguntando a medias, pero `localhost:3100`
no responde durante dos minutos después de cada `up`, y eso parece una aplicación
rota aunque no lo esté.

**Cargar el modelo desde la aplicación al arrancar.** Funcionaría igual, pero mete
en el servidor de Next un conocimiento de Docker y de Ollama que hoy vive solo en
`compose.yml`, y se ejecutaría también con la API de Anthropic puesta, donde no hay
nada que cargar.

**Un modelo más pequeño.** Carga antes, pero contesta peor, y el problema era
cuándo se carga, no lo que pesa.
