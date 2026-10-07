#!/usr/bin/env bash
#
# Levanta Postgres, aplica las migraciones y arranca la aplicación.
#
# Con `--db` levanta solo Postgres, en segundo plano, para usarlo con `pnpm dev`:
# es `pnpm docker:db`, y pasa por aquí para que el `.env` con sus contraseñas
# exista antes, que compose ya no arranca sin ellas.
#
# Con `--ia` levanta además Ollama y descarga el modelo de casa, para poder probar
# las tres pantallas de IA sin clave de Anthropic y sin pagar tokens. Es el perfil
# `ia` de `compose.yml`, más la dirección que la aplicación necesita para hablarle:
# **las dos cosas van juntas**, y que vayan juntas es lo que hace este script.
#
# Existe para que sean cero decisiones: comprueba que Docker es el de verdad,
# escribe el `.env` que falta con un secreto nuevo y llama a compose. Todo lo que
# hace se puede hacer a mano; lo que no se puede hacer a mano es acordarse.

set -euo pipefail

# Lo que escriba este guion —el `.env`, con el secreto de las sesiones y las
# contraseñas de la base— lo lee solo quien lo escribe. Con la máscara de
# siempre salía legible para cualquier usuario del equipo.
umask 077

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
#
# **Sin contraseñas fijas.** Antes escribía `caos:caos`, y compose las daba por
# defecto: un servidor levantado así tenía la base de todas las cuentas con la
# contraseña del README. Ahora se sacan al azar, y compose se niega a arrancar
# sin ellas (docs/adr/0117).
# ---------------------------------------------------------------------------
aleatorio() {
  # En hexadecimal y no en base64: va dentro de una URL de Postgres, y `+`, `/`
  # o `=` la romperían.
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    node -e "console.log(require('node:crypto').randomBytes($1).toString('hex'))"
  fi
}

if [[ ! -f .env ]]; then
  if command -v openssl >/dev/null 2>&1; then
    secreto="$(openssl rand -base64 32)"
  else
    secreto="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))")"
  fi
  clave_db="$(aleatorio 24)"
  clave_app="$(aleatorio 24)"

  cat > .env <<EOF
# Escrito por scripts/docker-arriba.sh. Es para tu equipo: no vale para publicar.
# Las contraseñas son al azar y solo valen para la base de este equipo.
POSTGRES_USER=caos
POSTGRES_PASSWORD=$clave_db
POSTGRES_DB=caos

# El rol con el que entra la aplicación dentro de compose: lee y escribe filas y
# nada más. Lo crea el contenedor de las migraciones.
POSTGRES_APP_USER=caos_app
POSTGRES_APP_PASSWORD=$clave_app

# Con qué se firma la cookie de sesión. Si cambia, todo el mundo vuelve a entrar.
AUTH_SECRET=$secreto

# La de aquí apunta al Postgres del contenedor desde el equipo, para \`pnpm dev\`,
# \`pnpm db:migrate\` y \`pnpm db:studio\`, y por eso entra como superusuario: migrar
# lo pide. Dentro de compose la cadena la pone compose.yml, con el rol de arriba.
DATABASE_URL=postgres://caos:$clave_db@localhost:5432/caos

# En qué puerto de tu equipo se ve la aplicación. Cámbialo si el 3000 ya lo tiene
# otro contenedor: lo de dentro sigue siendo el 3000.
APP_PORT=3000

# Todo escucha solo en este equipo (127.0.0.1). Para abrir la aplicación al móvil
# por la red de casa, descomenta esto; Postgres y Ollama tienen las suyas
# —POSTGRES_ESCUCHA_EN, OLLAMA_ESCUCHA_EN— y no hay motivo para abrirlos.
# APP_ESCUCHA_EN=0.0.0.0

# Opcional: sin ella contesta el modelo de casa si lo hay, y si tampoco lo hay,
# el dominio. La clave gana a los dos: mira docs/AI.md.
ANTHROPIC_API_KEY=

# El modelo de casa, para \`pnpm dev\`: descoméntalo solo si levantas Ollama por tu
# cuenta fuera de compose.
# OLLAMA_URL=http://localhost:11434
# OLLAMA_MODEL=qwen3:8b

# El modelo de casa dentro de compose. \`pnpm docker:ia\` pone las dos solo, y a
# mano **hay que descomentar las dos**: la de arriba levanta los contenedores y la
# de abajo le dice a la aplicación dónde están. Con una sola, Ollama arranca y
# nadie le habla.
# COMPOSE_PROFILES=ia
# OLLAMA_URL_DOCKER=http://ollama:11434
EOF
  gris 'Escrito .env con un AUTH_SECRET y contraseñas nuevas. No se sube: está en .gitignore.'
else
  # Un `.env` de antes de las contraseñas obligatorias: se completa sin tocar lo
  # que ya tiene. Solo se añade, nunca se cambia una línea.
  if ! grep -q '^POSTGRES_PASSWORD=' .env; then
    # Si la base ya existe, se creó con la contraseña que compose daba por
    # defecto, y Postgres no la cambia al arrancar: poner otra la dejaría fuera.
    if docker volume inspect caos-ordenado_datos >/dev/null 2>&1; then
      clave_db='caos'
      gris 'Tu base se creó con la contraseña de antes, «caos»: se apunta en .env para no perderla. Cámbiala si este equipo sale a internet (docs/DESPLIEGUE.md).'
    else
      clave_db="$(aleatorio 24)"
    fi
    printf '\n# Añadida por scripts/docker-arriba.sh: compose ya no la da por defecto.\nPOSTGRES_PASSWORD=%s\n' "$clave_db" >> .env
  fi
  if ! grep -q '^POSTGRES_APP_PASSWORD=' .env; then
    printf '\n# Añadida por scripts/docker-arriba.sh: el rol con el que entra la aplicación,\n# que solo lee y escribe filas. Lo crea el contenedor de las migraciones.\nPOSTGRES_APP_PASSWORD=%s\n' "$(aleatorio 24)" >> .env
    gris 'Añadida a .env la contraseña del rol de la aplicación.'
  fi
fi
# El `.env` lleva el secreto de las sesiones: que no lo lea nadie más del equipo.
chmod go-rwx .env

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

perfiles=()
resto=()
solo_db=0
mensaje='Levantando Postgres, aplicando migraciones y arrancando la aplicación...'

for arg in "$@"; do
  if [[ "$arg" == '--db' ]]; then
    solo_db=1
  elif [[ "$arg" == '--ia' ]]; then
    # El perfil levanta los contenedores; la dirección le dice a la aplicación
    # dónde están. Una sin la otra deja a Ollama arrancado y sin nadie que le
    # hable, que es peor que no levantarlo: parece que funciona.
    #
    # Y pisa lo que hubiera encontrado en el equipo unas líneas más arriba, a
    # propósito: si levantas el de compose es porque quieres ese.
    perfiles+=(--profile ia)
    export OLLAMA_URL_DOCKER='http://ollama:11434'
    export OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3:8b}"
    mensaje='Levantando todo lo de siempre y, ademas, Ollama con su modelo. La primera vez se descargan unos 5 GB.'
  else
    resto+=("$arg")
  fi
done

if [[ $solo_db == 1 ]]; then
  gris 'Levantando solo Postgres, para usarlo con `pnpm dev`.'
  exec docker compose up -d db ${resto[@]+"${resto[@]}"}
fi

# Y arriba. `--build` para que un cambio en el código se note sin acordarse de
# reconstruir, que es el fallo que hace pensar que un arreglo no ha funcionado.
gris "$mensaje"
exec docker compose ${perfiles[@]+"${perfiles[@]}"} up --build ${resto[@]+"${resto[@]}"}
