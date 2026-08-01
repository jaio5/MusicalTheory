# Caos ordenado

Aplicación web que escucha la guitarra por el micro y ordena la teoría mientras
tocas. Cada pantalla hace una cosa:

- **Aprender** — el camino: diez cursos en dos grados, en unidades cortas con su meta
  del día y su racha. **Empiezas por el nivel que quieras**: si ya sabes teoría, eliges
  el curso por el que entras. Las preguntas se escriben en la tonalidad en la que estés
  y lo que falles vuelve para repasarlo; la mitad de las unidades son de tocar,
  validadas por el micro.
- **Profesor** — pregunta lo que sea de teoría y te lo explica en tres frases con los
  acordes de tu tonalidad.
- **Componer** — eliges tonalidad en la rueda, encadenas acordes y ves de cuántas
  maneras se hacen a lo largo del mástil y a dónde puedes ir desde ahí.
  Reconoce el acorde que estás tocando, lleva metrónomo y te graba con la cámara
  detrás de la interfaz.
- **Afinar** — ocho afinaciones, de la estándar al open D, y nada más en
  pantalla.

La portada cuenta qué es y trae el afinador de verdad para probarlo sin entrar.

## Cuenta y planes

**Nada de la guitarra cuesta dinero.** El afinador, la rueda, el mástil, el
metrónomo, los acordes y la grabación pasan enteros en tu navegador, así que servirlos
no cuesta nada y van a seguir siendo gratis.

Lo que cuesta es la IA: cada pregunta al profesor y cada tanda de ideas es una llamada
a un modelo que se paga, y el temario del Grado Profesional. De eso van los tres
planes de pago —**Básico**, **Medio** y **Pro**, desde 4,99 € al mes—, que se leen y
se contratan en `/planes`. La tabla completa está en
[docs/CUENTAS-Y-PLANES.md](./docs/CUENTAS-Y-PLANES.md).

Dos cosas que conviene saber antes de nada:

- **Las cuentas son opcionales para casi todo, obligatorias para la IA.** Sin base de
  datos configurada la aplicación funciona entera —afinador, rueda, mástil, metrónomo,
  acordes, grabación y el Grado Elemental— con el avance en `localStorage`; lo único
  que pide cuenta es el profesor y las ideas, porque sin cliente no hay a quién
  contarle el gasto del modelo.
- **Los cupos de IA se calculan, no se escriben.** Salen de dividir lo que se puede
  gastar de cada plan entre lo que cuesta una petición con el modelo configurado, así
  que `ANTHROPIC_MODEL` los cambia sin tocar código. Con el de por defecto son 147
  peticiones al mes en Básico, 181 en Medio y 363 en Pro; con Haiku 4.5, cinco veces
  más. Un test comprueba que ningún plan pierde dinero.
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
ella el profesor y las ideas callan— y `DATABASE_URL` con `AUTH_SECRET` —sin ellas no
hay cuentas—. Si pones la base de datos, aplica las migraciones antes de entrar:

```bash
pnpm db:migrate
```

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

El audio y el vídeo no salen del dispositivo. No hay una línea de código de subida.
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
- [AI.md](./docs/AI.md) — contrato de los route handlers de ideas y profesor, y las
  dos puertas que acotan el gasto.
- [CUENTAS-Y-PLANES.md](./docs/CUENTAS-Y-PLANES.md) — qué da cada plan, quién
  comprueba qué y qué se guarda de ti.
- [DESPLIEGUE.md](./docs/DESPLIEGUE.md) — qué hace falta para publicarlo y qué
  se rompe según dónde.
- [ROADMAP.md](./docs/ROADMAP.md) — fases y deuda anotada.
- [adr/](./docs/adr/) — decisiones con sus alternativas descartadas.
