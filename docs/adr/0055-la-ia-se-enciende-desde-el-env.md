# ADR 0055 — La IA se enciende desde el `.env`, no desde la línea de órdenes

Fecha: 2026-09-28 · Estado: aceptada · Completa [ADR 0047](./0047-la-ia-es-un-perfil-no-un-fichero.md) y [ADR 0050](./0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md)

## Contexto

Quien usa esto pidió que la IA se levantara **con `docker compose up -d`**, sin
tener que acordarse de un script ni de una bandera.

Y había dos maneras de tener un modelo de casa, con una diferencia que lo decide
todo:

| De dónde sale el modelo   | Su dirección desde el contenedor           | ¿Sobrevive a un reinicio? |
| ------------------------- | ------------------------------------------ | ------------------------- |
| Un Ollama del equipo      | la IP de `eth0`, que **cambia**            | no: hay que recalcularla  |
| El Ollama del perfil `ia` | `http://ollama:11434`, un nombre de la red | **sí**                    |

[ADR 0050](./0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md) cerró
la primera: no existe ninguna dirección fija que valga —`host.docker.internal`
apunta a Windows y no a WSL, y la puerta del puente tampoco llega—, así que la
calcula `scripts/docker-arriba.sh` al levantar. Eso funciona, pero obliga a pasar
por el script, que es justo lo que se pedía quitar.

La segunda sí tiene dirección fija. Lo único que faltaba era encenderla sin
escribir `--profile ia` cada vez.

## Decisión

**Dos líneas en el `.env`, y `docker compose up -d` trae la IA sola.**

```
COMPOSE_PROFILES=ia
OLLAMA_URL_DOCKER=http://ollama:11434
```

Compose lee `COMPOSE_PROFILES` del `.env` como cualquier otra variable, así que el
perfil queda encendido para **todas** las órdenes de ese directorio: `up`, `down`,
`logs`. No hay que recordar la bandera y no hay una manera de arrancar que deje la
mitad fuera.

**Van juntas y no sirve una sin la otra**, que es lo que ya decía `compose.yml`:
con solo el perfil, Ollama arranca y nadie le habla; con solo la dirección, la
aplicación apunta a un contenedor que no existe y **gasta cupo** para fallar.

**Y no se cambia el valor de fábrica de `compose.yml`.** El perfil sigue siendo un
perfil, así que un equipo sin gráfica NVIDIA hace `docker compose up` y no se entera
de que existe, que es lo que [ADR 0047](./0047-la-ia-es-un-perfil-no-un-fichero.md)
protegía. Lo que cambia es **este** equipo, por su `.env`, que no se versiona.

### El choque de puertos, que hay que saber

Con un Ollama nativo corriendo, el contenedor **no puede publicar el 11434**: `up`
falla con «port is already allocated». Se mueve con `OLLAMA_PORT` —aquí, el 11435—
y no afecta a nada de dentro: la aplicación le habla por el nombre `ollama` y por el
11434 de la red interna. Es el mismo choque que ya tenía el 5432 de Postgres con el
Postgres de Windows.

## Consecuencias

Medido después de hacerlo, con `docker compose up -d` a secas:

| Qué                                       | Resultado                                 |
| ----------------------------------------- | ----------------------------------------- |
| La gráfica llega al contenedor            | RTX 3060, 12 GB                           |
| La aplicación espera a que el modelo esté | sí: arranca cuando `ia-modelo` termina    |
| Primera respuesta                         | **86 s** —cargar el modelo en la gráfica— |
| Siguientes                                | **6,4 s**                                 |
| Lo que ocupa el modelo cargado            | 6,9 GB de los 12                          |

**La primera vez descarga 5,2 GB** y la aplicación no arranca hasta que acaba. Es a
propósito —si no, la primera pregunta contestaría un 502 mientras bajan cinco
gigas— pero conviene saberlo antes de esperar mirando.

**Y ahora hay dos Ollama en la máquina**, el nativo y el del contenedor, cada uno
con su copia de cinco gigas en disco y los dos queriendo la misma gráfica. Caben
—6,9 de 12 con uno cargado— pero no es gratis. Quien no use `pnpm dev` puede parar
el nativo.

## Alternativas descartadas

**Quitar el perfil y que `ollama` se levante siempre.** Es lo más directo y rompe lo
que [ADR 0047](./0047-la-ia-es-un-perfil-no-un-fichero.md) decidió: el servicio
reserva una gráfica NVIDIA, así que en un portátil sin ella `docker compose up`
dejaría de arrancar del todo. Un equipo que no quiere IA no puede quedarse sin
aplicación por eso.

**Escribir la IP del Ollama nativo en `OLLAMA_URL_DOCKER`.** Evitaría los cinco
gigas y la segunda copia. Se descarta porque **caduca en el siguiente reinicio y
caduca en silencio**: la aplicación creería que hay modelo, gastaría cupo y fallaría
al contactar. Es literalmente lo que
[ADR 0050](./0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md)
descartó.

**Compartir la carpeta de modelos del Ollama nativo** con un `volumes:` en vez del
volumen con nombre, para no bajar los cinco gigas dos veces. Tiene sentido y no se
hace ahora porque ata `compose.yml` a una ruta del equipo de quien lo escribió, y
este fichero lo usan más máquinas. Si la segunda copia molesta, esto es lo primero
que hay que mirar.

**Parar el Ollama nativo y dejar solo el del contenedor.** Sería más limpio en disco
y en gráfica, y se descarta porque el nativo es el que usa `pnpm dev`: sin él, para
probar prompts habría que levantar compose entero.
