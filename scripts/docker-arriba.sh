#!/usr/bin/env bash
#
# Levanta Postgres, aplica las migraciones y arranca la aplicación.
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

# Opcional: sin ella, el profesor y las ideas dicen que no hay modelo configurado.
ANTHROPIC_API_KEY=
EOF
  gris 'Escrito .env con un AUTH_SECRET nuevo. No se sube: está en .gitignore.'
fi

# ---------------------------------------------------------------------------
# Y arriba. `--build` para que un cambio en el código se note sin acordarse de
# reconstruir, que es el fallo que hace pensar que un arreglo no ha funcionado.
# ---------------------------------------------------------------------------
gris 'Levantando Postgres, aplicando migraciones y arrancando la aplicación...'
exec docker compose up --build "$@"
