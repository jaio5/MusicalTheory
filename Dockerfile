# Imagen para publicar la aplicación donde acepten un contenedor.
#
# Tres etapas para que la imagen final no lleve ni el código fuente ni las
# dependencias de desarrollo: solo la salida standalone de Next, que trae lo
# justo para arrancar.
#
# **La imagen base va con versión exacta y huella** (`@sha256:…`). `22-alpine` a
# secas es otra imagen cada semana: lo que se construye hoy no es lo que se
# construyó ayer, y no hay manera de saber qué entró. Dependabot abre la
# petición cuando sale una nueva, y se sube leyendo qué trae (docs/adr/0117).
# Las tres etapas usan la misma: cambiarla es cambiar las tres.

FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# La clave no se copia ni se necesita para compilar: se lee en cada petición.
RUN pnpm build
# Next copia el `.env` que encuentre a `.next/standalone/`. Aquí no hay ninguno
# —`.dockerignore` no lo deja entrar—, y esta línea es para que siga sin haberlo
# aunque alguien toque ese fichero: la imagen se sube a un registro.
RUN rm -f .next/standalone/.env .next/standalone/.env.*

# Las migraciones necesitan lo contrario que el servidor: drizzle-kit, el esquema
# en TypeScript y la carpeta `drizzle/`. Todo eso ya está en la etapa de
# construcción, así que esta se limita a cambiar el comando. No entra en la imagen
# final: `target: run` no pasa por aquí.
#
# Después de migrar da de alta el rol con el que entra la aplicación, que solo
# lee y escribe filas (`scripts/rol-de-la-aplicacion.mjs`). Es lo único, junto
# con migrar, que se hace con el superusuario.
FROM build AS migraciones
CMD ["sh", "-c", "pnpm db:migrate && node scripts/rol-de-la-aplicacion.mjs"]

FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Sin privilegios: un servidor que solo lee ficheros no necesita ser root.
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs
# **Los ficheros son de root y el proceso es `nextjs`**, así que el servidor no
# puede reescribir su propio código: quien consiga ejecutar algo dentro no deja
# un guion cambiado para el siguiente que entre. Por eso los `COPY` no llevan
# `--chown`. Lo único escribible es la caché de Next, que la pide al arrancar.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
RUN chmod -R a-w,a+rX /app && mkdir -p /app/.next/cache && chown nextjs:nodejs /app/.next/cache
# No hay `public/`: lo único que vivía ahí era el vídeo de la portada, y la escena
# que lo sustituye llega por `.next/static` con huella en el nombre (adr/0069).
# Si vuelve a haber una carpeta pública, se copia aquí a `./public`; sin ella, el
# `COPY` falla y la imagen no se construye.
USER nextjs
EXPOSE 3000
# Si contesta. Se pregunta por el icono y no por la portada a propósito: la
# portada se pinta en cada petición y lee la sesión, y un latido cada medio
# minuto no tiene por qué tocar la base. El icono lo sirve el mismo servidor de
# Node, así que si contesta, la aplicación está viva. Con `node` y no `wget`
# porque es lo único que seguro trae la imagen.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/favicon.ico').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server.js"]
