# Caos ordenado

**Aprende música y compón con ayuda.** La aplicación te enseña la teoría por
unidades cortas y, con lo que llevas tocado, te propone por dónde puede seguir tu
canción: te la continúa, le hace sus partes y te explica por qué.

El micro es cómo entra lo que tocas —te oye, reconoce el acorde y la tonalidad— y
no hace falta escribir nada ni saber solfeo para empezar. Nada de lo que suena
sale de tu equipo.

Hoy corre en un equipo y la usa una persona. La idea es publicarla y cobrar por
suscripción; lo que eso pide está en
[docs/PARA-PUBLICAR.md](./docs/PARA-PUBLICAR.md), y **nada de eso está en marcha**.

Cada pantalla hace una cosa:

- **Aprender** — el camino: diez cursos en dos grados, en unidades cortas con su meta
  del día y su racha. **Empiezas por el nivel que quieras**: si ya sabes teoría, eliges
  el curso por el que entras. Las preguntas se escriben en la tonalidad en la que estés
  y lo que falles vuelve para repasarlo; la mitad de las unidades son de tocar,
  validadas por el micro.
- **Profesor** — pregunta lo que sea de teoría y te lo explica en tres frases con los
  acordes de tu tonalidad.
- **Componer** — un banco de trabajo con áreas que se pliegan y se arrastran, y
  **tres maneras de escribir la misma canción**: _tocando_ —abres el micro, tocas, y
  lo que suena entra con sus acordes, sus duraciones y su punteo, con la toma de
  audio al lado—, _escribiendo_ por bloques o en la partitura, y _ensayando_, que la
  toca contra el metrónomo y te dice cuántos compases salieron, tu racha y cuál se
  te atragantó. Al lado, la rueda para elegir tonalidad, de cuántas maneras se hace
  cada acorde a lo largo del mástil y a dónde puedes ir desde ahí. Y **graba un
  trozo**: solo el sonido,
  que te suena ahí mismo y te descargas si vale; al parar lo vuelve a escuchar
  entero con calma y te ofrece salidas —canciones distintas que arrancan de lo que
  llevas, con sus partes—, comprobadas contra la teoría antes de enseñártelas.
- **Afinar** — ocho afinaciones, de la estándar al open D, y nada más en
  pantalla.

La portada cuenta qué es y trae el afinador de verdad para probarlo sin entrar.

## Cuenta y planes

**Nada de la guitarra cuesta dinero.** El afinador, la rueda, el mástil, el
metrónomo, los acordes y la grabación pasan enteros en tu navegador, así que servirlos
no cuesta nada y van a seguir siendo gratis.

Lo que cuesta es la IA: cada pregunta al profesor y cada tanda de salidas es una llamada
a un modelo que se paga, y el temario del Grado Profesional. De eso van los dos
planes de pago —**Básico** y **Medio**, desde 4,99 € al mes o 49,90 € al año—, que se
leen y se contratan en `/planes`. La tabla completa está en
[docs/CUENTAS-Y-PLANES.md](./docs/CUENTAS-Y-PLANES.md).

Dos cosas que conviene saber antes de nada:

- **Las cuentas son opcionales para casi todo, obligatorias para la IA.** Sin base de
  datos configurada la aplicación funciona entera —afinador, rueda, mástil, metrónomo,
  acordes, grabación y el Grado Elemental— con el avance en `localStorage`; lo único
  que pide cuenta es el profesor y las salidas, porque sin cliente no hay a quién
  contarle el gasto del modelo. Se crea en `/registro`, a donde lleva el avatar de
  arriba a la derecha, y una vez dentro ese mismo avatar abre tu perfil, tu
  suscripción, tu contraseña y qué se guarda de ti.
- **Los cupos de IA se calculan, no se escriben.** Salen de dividir lo que se puede
  gastar de cada plan entre lo que cuesta una petición con el modelo configurado, así
  que `ANTHROPIC_MODEL` los cambia sin tocar código. Se cuentan en
  preguntas al profesor, y una salida gasta tres porque cuesta más servirla
  ([adr/0067](./docs/adr/0067-el-cupo-se-cuenta-en-preguntas.md)). Con el modelo por
  defecto, Sonnet 5.5, son 96 preguntas al mes en Básico y 193 en Medio; con Haiku
  4.5, el doble. Un test comprueba que ningún plan deja menos de un 60 % de margen
  sobre lo que entra, sin IVA ni comisión.
- **Hoy no se cobra de verdad.** Detrás del cambio de plan hay un cobrador de mentira
  que cambia el plan y no pasa por caja. Es una decisión con su
  [ADR](./docs/adr/0006-planes-y-puerto-de-facturacion.md), no un olvido, y significa
  que cualquiera con una cuenta puede darse el plan más alto.

## Cómo arrancarlo

Requiere Node 22 o superior y pnpm.

```bash
pnpm install
cp .env.example .env.local   # nada de esto es obligatorio para arrancar
pnpm dev                     # http://localhost:3000
```

`.env.local` tiene dos partes y las dos son opcionales: la clave de Anthropic —sin
ella contesta el dominio, o el modelo de casa si lo has levantado— y `DATABASE_URL`
con `AUTH_SECRET` —sin ellas no hay cuentas—. Si pones la base de datos, aplica las migraciones antes de entrar:

```bash
pnpm db:migrate
```

### Con cuentas, sin montar nada: Docker

```bash
pnpm docker:up       # Postgres, migraciones y la aplicación, en http://localhost:3000
pnpm docker:db       # solo Postgres, para usarlo desde `pnpm dev`
pnpm docker:ia       # además, un modelo en tu equipo para probar la IA sin clave
pnpm docker:ia-sola  # solo ese modelo, sin la aplicación
pnpm docker:down     # parar todo; con -v además borra los datos
```

Por debajo es un solo `compose.yml` y la IA va en un **perfil**, así que también
sirve `docker compose` a secas:

```bash
docker compose up                  # la aplicación
docker compose --profile ia up     # y además el modelo de casa
docker compose up ollama           # solo el modelo
```

**Para que `docker compose up -d` traiga también la IA**, dos líneas en el `.env`:

```bash
COMPOSE_PROFILES=ia
OLLAMA_URL_DOCKER=http://ollama:11434
```

Van juntas: la primera enciende el perfil y la segunda le dice a la aplicación dónde
está. Con ellas puestas no hace falta ni el script ni acordarse de nada, porque
`ollama` es un nombre fijo de la red de compose
([adr/0055](./docs/adr/0055-la-ia-se-enciende-desde-el-env.md)). Si ya tienes un
Ollama en el equipo, mueve el puerto con `OLLAMA_PORT=11435` o `up` falla con «port
is already allocated».

**Un Ollama que ya corra en tu equipo, en cambio, solo lo encuentra `pnpm docker:up`**:
su dirección es la IP de tu máquina y cambia al reiniciar, así que no se puede
escribir en `compose.yml`
([adr/0050](./docs/adr/0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md)).

`pnpm docker:up` escribe el `.env` que falte con un `AUTH_SECRET` nuevo, así que no
hay nada que rellenar a mano. Si el 3000 ya lo tiene otro contenedor tuyo, cambia
`APP_PORT` en ese `.env`. Los detalles, en
[docs/DESPLIEGUE.md](./docs/DESPLIEGUE.md).

### Probar la IA sin pagar tokens

`pnpm docker:ia` levanta además un [Ollama](https://ollama.com) con `qwen3:8b`, y
la aplicación le pregunta a él mientras no haya clave de Anthropic. La primera vez
descarga unos 5 GB y los guarda; **pide una gráfica NVIDIA**, y sin ella hay que
comentar el bloque `deploy` de `compose.yml` y armarse de paciencia.

Va en un perfil y no en un fichero aparte
([adr/0047](./docs/adr/0047-la-ia-es-un-perfil-no-un-fichero.md)), lo que permite
levantarlo **solo a él** con `pnpm docker:ia-sola` para iterar sobre los prompts
con `pnpm dev` delante, sin Postgres ni contenedor de la aplicación.

A mano, el perfil y la dirección **van juntos**: `COMPOSE_PROFILES=ia` levanta los
contenedores y `OLLAMA_URL_DOCKER=http://ollama:11434` le dice a la aplicación
dónde están. El `.env` las trae comentadas en líneas consecutivas, y
`pnpm docker:ia` pone las dos por ti.

No es lo mismo que la API y no pretende serlo: sirve para ajustar los prompts sin
factura. Lo que hace y lo que no, en [docs/AI.md](./docs/AI.md).

## Cómo pasar los tests

```bash
pnpm test        # una pasada
pnpm test:watch  # en watch
pnpm typecheck   # tipos
pnpm lint        # ESLint, incluidas las reglas de capas
pnpm build       # build de producción
```

Los cinco corren solos en cada empujón: [.github/workflows/ci.yml](./.github/workflows/ci.yml).

## Cómo publicarlo

Hace falta un servidor de Node —hay rutas de servidor para que la clave de
Anthropic no llegue nunca al navegador— y HTTPS, o no hay permiso de micrófono.
Postgres solo si quieres cuentas. Los tres caminos, con sus comandos, en
[docs/DESPLIEGUE.md](./docs/DESPLIEGUE.md).

## Aviso: hace falta señal limpia

La detección de tono es **monofónica** y necesita señal sin distorsión.

- Una sola nota cada vez. Un acorde rasgueado no lo identifica el afinador: la
  autocorrelación devuelve un periodo, no varios. Para acordes hay otro análisis
  —espectro y plantillas— y solo en componer; acierta con tríadas y séptimas
  sostenidas en limpio y duda con inversiones.
- **Sin distorsión.** Un previo saturado genera armónicos que pueden superar a
  la fundamental, y entonces el analizador detecta la octava de arriba. Con
  Guitar Rig, usa el canal limpio antes de los pedales.
- Deja que la nota suene. El ataque de la púa tarda unos 30 ms en estabilizarse.

## Privacidad

El audio no sale del dispositivo. No hay una línea de código de subida.
A la IA solo viajan símbolos: tonalidad, escala, nombres de notas y grado actual.
Con cuenta se guarda además tu avance del temario —identificadores de unidad, números
y fechas— y tu contraseña cifrada; nunca una muestra de sonido. Ver
[docs/AI.md](./docs/AI.md), [docs/RECORDING.md](./docs/RECORDING.md) y
[docs/CUENTAS-Y-PLANES.md](./docs/CUENTAS-Y-PLANES.md).

## Documentación

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — capas, qué importa qué y por qué,
  con notas para quien viene de Angular.
- [DOMAIN-MUSIC.md](./docs/DOMAIN-MUSIC.md) — la teoría que implementa el
  código, en lenguaje de músico.
- [AUDIO-PITCH.md](./docs/AUDIO-PITCH.md) — cómo se detecta el tono y qué
  limitaciones tiene.
- [RECORDING.md](./docs/RECORDING.md) — permisos, composición en canvas,
  formatos y descarga local.
- [AI.md](./docs/AI.md) — contrato de los route handlers del profesor y las salidas, y las
  dos puertas que acotan el gasto.
- [CUENTAS-Y-PLANES.md](./docs/CUENTAS-Y-PLANES.md) — qué da cada plan, quién
  comprueba qué y qué se guarda de ti.
- [DESPLIEGUE.md](./docs/DESPLIEGUE.md) — qué hace falta para publicarlo y qué
  se rompe según dónde.
- [ROADMAP.md](./docs/ROADMAP.md) — fases y deuda anotada.
- [adr/](./docs/adr/) — decisiones con sus alternativas descartadas.
