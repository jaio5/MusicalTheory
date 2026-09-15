#!/usr/bin/env bash
#
# Levanta Postgres, aplica las migraciones y arranca la aplicación.
#
# Con `--ia` levanta además Ollama y descarga el modelo de casa, para poder probar
# las tres pantallas de IA sin clave de Anthropic y sin pagar tokens.
#
# Existe para que sean cero decisiones: comprueba que Docker es el de verdad,
# escribe el `.env` que falta con un secreto nuevo y llama a compose. Todo lo que
# hace se puede hacer a mano; lo que no se puede hacer a mano es acordarse.

set -euo pipefail

cd "$(dirname "$0")/.."

rojo() { printf '\033[31m%s\033[0m\n' "$1" >&2; }
gris() { printf '\033[2m%s\033[0m\n' "$1"; }

# ---------------------------------------------------------------------------
# La trampa de WSL, que en este proyecto ya ha mordido con npx, con mvnw y con
# node: el PATH de Windows va detrás del de Linux, así que `docker` puede ser el
# `.exe` de Windows. Ese no habla con nada desde aquí si Docker Desktop no tiene
# encendida la integración con esta distribución.
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  rojo 'No hay docker en el PATH.'
  rojo 'En WSL: enciende Docker Desktop y activa Settings > Resources > WSL integration para esta distribución.'
  rojo 'Sin Docker Desktop: sudo apt install docker.io && sudo service docker start'
  exit 1
fi

if [[ "$(command -v docker)" == /mnt/* ]]; then
  rojo "El docker que sale del PATH es el de Windows: $(command -v docker)"
  rojo 'Desde WSL no sirve. Enciende Docker Desktop y activa Settings > Resources > WSL integration.'
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  rojo 'Docker está instalado pero su servicio no contesta.'
  rojo 'Arráncalo —Docker Desktop, o `sudo service docker start`— y vuelve a probar.'
  exit 1
fi

# ---------------------------------------------------------------------------
# El `.env`. Compose lo lee solo, y `pnpm dev` también, así que la cadena de
# conexión que se escribe aquí es la del equipo —`localhost`— y no la de la red de
# compose: dentro de los contenedores la pone compose.yml, que allí sí se llama `db`.
# ---------------------------------------------------------------------------
if [[ ! -f .env ]]; then
  if command -v openssl >/dev/null 2>&1; then
    secreto="$(openssl rand -base64 32)"
  else
    secreto="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))")"
  fi

  cat > .env <<EOF
# Escrito por scripts/docker-arriba.sh. Es para tu equipo: no vale para publicar.
POSTGRES_USER=caos
POSTGRES_PASSWORD=caos
POSTGRES_DB=caos

# Con qué se firma la cookie de sesión. Si cambia, todo el mundo vuelve a entrar.
AUTH_SECRET=$secreto

# La de aquí apunta al Postgres del contenedor desde el equipo, para \`pnpm dev\`
# y \`pnpm db:studio\`. Dentro de compose la cadena la pone compose.yml.
DATABASE_URL=postgres://caos:caos@localhost:5432/caos

# En qué puerto de tu equipo se ve la aplicación. Cámbialo si el 3000 ya lo tiene
# otro contenedor: lo de dentro sigue siendo el 3000.
APP_PORT=3000

# Opcional: sin ella contesta el modelo de casa si lo hay, y si tampoco lo hay,
# el dominio. La clave gana a los dos: mira docs/AI.md.
ANTHROPIC_API_KEY=

# El modelo de casa. Con \`pnpm docker:ia\` esto lo pone compose; descoméntalo solo
# si levantas Ollama por tu cuenta y quieres usarlo desde \`pnpm dev\`.
# OLLAMA_URL=http://localhost:11434
# OLLAMA_MODEL=qwen3:8b
EOF
  gris 'Escrito .env con un AUTH_SECRET nuevo. No se sube: está en .gitignore.'
fi

# ---------------------------------------------------------------------------
# Y arriba. `--build` para que un cambio en el código se note sin acordarse de
# reconstruir, que es el fallo que hace pensar que un arreglo no ha funcionado.
#
# `--ia` no se le pasa a compose: se traduce en un fichero más. Va en un fichero
# aparte porque pide una gráfica NVIDIA, y `docker compose up` tiene que seguir
# funcionando en un equipo que no la tenga.
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# El modelo de casa que ya corre en el equipo, si lo hay.
#
# Dentro del contenedor `localhost` es el propio contenedor, asi que la
# `OLLAMA_URL` del `.env` —que apunta al bucle local para `pnpm dev`— no vale
# aqui. Y la IP de la maquina cambia al reiniciar, asi que se calcula ahora en
# lugar de escribirse a mano en un fichero que caduca.
#
# Si no contesta nadie, no se pone nada: la aplicacion dira que no hay modelo
# configurado, que es el comportamiento correcto y no un fallo.
# ---------------------------------------------------------------------------
if [[ -z "${OLLAMA_URL_DOCKER:-}" ]]; then
  ip_equipo=$(ip -4 addr show eth0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1)
  if [[ -n "$ip_equipo" ]] && curl -sf --max-time 2 "http://$ip_equipo:11434/api/tags" >/dev/null 2>&1; then
    export OLLAMA_URL_DOCKER="http://$ip_equipo:11434"
    gris "Modelo de casa encontrado en $OLLAMA_URL_DOCKER; la aplicación lo usará."
  fi
fi

ficheros=(-f compose.yml)
resto=()
mensaje='Levantando Postgres, aplicando migraciones y arrancando la aplicación...'

for arg in "$@"; do
  if [[ "$arg" == '--ia' ]]; then
    ficheros+=(-f compose.ia.yml)
    mensaje='Levantando todo lo de siempre y, ademas, Ollama con su modelo. La primera vez se descargan unos 5 GB.'
  else
    resto+=("$arg")
  fi
done

gris "$mensaje"
exec docker compose "${ficheros[@]}" up --build ${resto[@]+"${resto[@]}"}
