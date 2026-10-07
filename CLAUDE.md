# Caos ordenado — guía para trabajar aquí

Aplicación web para **aprender música y componer con ayuda**: escucha lo que tocas
por el micro, te enseña la teoría por unidades y te propone por dónde puede seguir
lo que llevas. Next.js 16 + React 19 + TypeScript, Tailwind v4, Zustand, Vitest.
Cuentas con Auth.js y Postgres (Drizzle), opcionales. Node 22+ y pnpm.

Hoy corre en un equipo y la usa una persona; **se publicará y se cobrará**, y eso
vive aparte en `docs/PARA-PUBLICAR.md`. **Este fichero es el mapa, no la
documentación**: el porqué está en `docs/`, en los ADR y en los comentarios.

**Lo que sabes de Next.js es de una versión anterior.** La que vale es la que
trae el paquete, en `node_modules/next/dist/docs/`, y lo recuerda @AGENTS.md. Ese
bloque va en inglés y **no se toca**: lo reescribe `next dev`, y si falta lo pega
al final de este fichero.

## Antes de dar nada por terminado

Los seis tienen que pasar. Corren solos en cada empujón
(`.github/workflows/ci.yml`).

```bash
pnpm test         # vitest
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint, incluidas las reglas de capas
pnpm format:check # prettier
pnpm coverage     # vitest con cobertura: el tope está en el 100 %
pnpm build        # build de producción
```

**La cobertura está en el cien por cien y el tope lo exige**: bajar de ahí es que
falta una prueba o falta explicar la rama con `v8 ignore` **y su razón**
(`docs/ESTILO.md`). `pnpm dev` levanta en http://localhost:3000 y no necesita base
de datos ni claves. Las cuentas piden Postgres y lo da Docker (`pnpm docker:up`);
**para verlo funcionando**, el skill `.claude/skills/arrancar/`. Todo lo de Docker,
el `.env` y los puertos: [docs/TRAMPAS.md](docs/TRAMPAS.md).

## Lo que muerde si no lo sabes

Una línea cada una; el porqué, las demás trampas y los enlaces, en [docs/TRAMPAS.md](docs/TRAMPAS.md).

- **Tras tocar un `.md`, `pnpm format`**, o `format:check` falla.
- **Un ejemplo de clase en un comentario es una clase de verdad**: tumba la hoja con los tests en verde, y lo caza `pnpm build` (`docs/ESTILO.md`).
- **Lo que se abre sobre algo que crece flota** (`ui/Disclosure`); desde una fila que se desplaza es un `popover` (`adr/0065`). **La navegación cambia en `md` y tres sitios lo saben**; lo caza la sonda de `arrancar` (`adr/0084`).
- **`docker compose up -d` no reconstruye** y `down` no para un perfil: `pnpm docker:up` y `pnpm docker:down`. La IA se enciende desde el `.env` (`adr/0055`).
- **El micrófono es uno** (`state/use-listening.ts`): no importes un motor de audio desde un componente (`adr/0079`).
- **Dieciséis colores y ninguno más**; `@layer components` no admite `hover:` (`adr/0070`). **Un `data-tour` lo busca algún paso**, o `tour/pasos.test.ts` falla (`adr/0108`).
- **Un modelo nuevo va a `MODEL_PRICES`** con su `pensamiento` y `esfuerzo` antes de ponerlo en `ANTHROPIC_MODEL`, o peor caso o un 400 (`adr/0103`).
- **`planOf` traduce los nombres viejos**, `pro` a Medio (`adr/0104`); **las variables de Stripe van juntas**, con los dos precios anuales (`adr/0105`).
- **Aprender no pide tonalidad**; la escala se lee con `selectEscala` (`adr/0109`).
- **Sin cuenta solo cuenta la vuelta quien dice que sí**; cambiar `AUTH_SECRET` reinicia la retención, borrar la cuenta llama a `olvidarCuenta`, y sin `TITULAR_*` no se abre al público (`adr/0110`, `adr/0111`).
- **El bajo solo desempata acordes con las mismas notas** (`adr/0107`). **Los exámenes de la IA solo van a la API con `--api`** y piden el Node 24 de `nvm` (`adr/0112`).
- **Un barril de pantallas las lleva todas al paquete de todas**: importa del módulo (`adr/0045`). Y `song.ts` solo importa tipos de `arrangement.ts`.
- **El techo `IA_TOPE_*_USD` cierra la IA también a quien paga** si el mensual se queda corto, y además va el límite de la consola de Anthropic (`adr/0114`). **El tope por minuto es por cuenta; el de dirección solo existe con `TRUSTED_PROXY_HOPS`**, y `=0` no es vacío: calla el aviso.
- **El SDK va con `maxRetries: 0`**, y una ruta nueva que llame al modelo pasa por `responderConModelo` o no reserva en el techo. Si cambia `textoLibre`, `cost.test.ts` falla a propósito: cuadra `TOKENS_POR_CARACTER_LIBRE`, que cambia cupos y tablas.
- **La marca del prompt no se escribe a mano** y un tope de texto libre se cuenta con `tokensEnElPeorCaso`, no con `.length`; **una regex sobre texto ajeno se recorta antes** y ancla su tira (47 s con 128 KB, `adr/0115`).
- **Una clave de tope no lleva nada de fuera en claro** (`huellaDeCorreo`), IPv6 cuenta por /64, `proxyClientMaxBodySize` trunca y debe igualar `MAX_CUERPO`, y el avance se funde en una transacción y se lee con el día del servidor (`adr/0113`, `adr/0116`).
- **Todo escucha en `127.0.0.1`** (`APP_ESCUCHA_EN=0.0.0.0` para el móvil), `pnpm docker:db` pasa por el script, la aplicación entra como `caos_app`, `sslmode=require` pasa a `verify-full` y `pnpm build` copia `.env` a `standalone` (`adr/0117`).

## Las capas y quién importa a quién

```
app/ → features/ → state/ → audio/ ↘
     ↘           → ui/              core/
      server/    → media/ ──────────↗
```

Cinco reglas, todas menos la cuarta vigiladas por ESLint:

1. **`core/` es TypeScript puro.** Si un test de `core/` necesita un `window`, la
   pieza está mal colocada.
2. **Un `feature` no importa de otro.** Lo compartido sube a `core/`, `ui/` o
   `state/`.
3. **`audio/` y `media/` exponen interfaces**: nada de `AudioContext` suelto en un
   componente.
4. **El audio no sale del dispositivo.** A la IA solo viajan símbolos; a la base de
   datos, identificadores, números y fechas.
5. **`src/server/` solo lo abre `app/`**, y no importa del navegador.

Alias: `@core/*`, `@audio/*`, `@media/*`, `@server/*`, `@state/*`, `@features/*`,
`@ui/*`, `@/*`. Las capas de arriba importan de `@core/music` y `@core/billing`
—los índices—, no de los ficheros sueltos.

## Dónde está cada cosa

La tabla completa está en [docs/ENCONTRAR-UN-FICHERO.md](docs/ENCONTRAR-UN-FICHERO.md);
esto es lo que más se busca.

| Busco...                                    | Está en                                                              |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Teoría musical, y qué acorde proponer       | `src/core/music/`, `suggestions.ts`, `paths.ts`, `encaje.ts`         |
| Detección de tono y de acordes              | `audio/autocorrelation.ts`, `chroma.ts` (`leerEspectro`, 0107)       |
| Medir el motor con grabaciones; leer un WAV | `scripts/medir-tomas.ts`, `core/music/medir-tomas.ts`, `core/wav.ts` |
| La canción: bloques, partes, lienzo         | `core/music/arrangement.ts`, `song.ts`, `features/arrange/`          |
| La escala de una tonalidad, y cómo se lee   | `state/workspace.ts` (`escalaDeLaTonalidad`, `selectEscala`)         |
| El recorrido de la primera visita           | `features/tour/` (`tramos.ts`), `state/recorrido.ts`                 |
| La IA: rutas, llamada al modelo, qué cuesta | `server/ai-route.ts`, `ask-model.ts`, `core/billing/cost.ts`         |
| Planes, cupos, ingreso neto, pago anual     | `src/core/billing/` (`cost.ts`: `netoDeUnCobroMicros`), 0105/0106    |
| Cuentas, la edad para crearlas              | `src/server/`, `users.ts` (`createUser`), `account/AccessForm`       |
| Contar el uso y la retención                | `core/analytics.ts`, `server/metricas.ts`, `app/api/metricas`        |
| Titular, privacidad y aviso legal           | `server/titular.ts`, `app/(marco)/privacidad`, `aviso-legal`         |
| Techo de gasto de la IA; plazo de gracia    | `server/ai-gasto.ts` (0114), `plans.ts` (`planEnVigor`)              |
| La marca y su clave; enlaces del modelo     | `core/marca.ts` (0115), `core/prosa-del-modelo.ts`                   |
| Fundir el avance; tope por cuenta           | `server/progress-repo.ts` (0116), `tope-por-cuenta.ts`               |
| Al arrancar; largo de contraseña; TLS       | `src/instrumentation.ts`, `password.ts`, `db/client.ts` (`tlsPara`)  |
| El rol de la aplicación en la base          | `scripts/rol-de-la-aplicacion.mjs` (adr/0117)                        |

**`/componer` es un banco de trabajo de áreas** con tres espacios, tres maneras de
escribir la misma canción: `Tocando`, `Escribir` y `Ensayar`. **Se entra por
`Escribir` con solo la canción abierta**
([adr/0109](docs/adr/0109-lo-que-se-da-por-hecho-al-empezar.md)). Las demás rutas:
`/aprender` (solo el camino), `/aprender/[unidad]`, `/aprender/repaso`, `/profesor`,
`/afinar`, `/planes` con `/planes/[plan]`, `/registro`, `/cuenta`, `/privacidad`,
`/aviso-legal` y la portada `/`. Las páginas viven en `src/app/(marco)/`, menos la
portada. Hay **dos planes de pago, Básico y Medio, con pago anual**.

## La documentación, y qué contesta cada fichero

Leer el que toque antes de tocar código de esa zona. **Son la fuente del porqué.**

| Fichero                        | Contesta                                                            |
| ------------------------------ | ------------------------------------------------------------------- |
| `docs/ESTILO.md`               | Cómo se escribe: idioma, comentarios, interfaz, temas, tests        |
| `docs/ENCONTRAR-UN-FICHERO.md` | Cómo está ordenado el código y la tabla completa «busco X»          |
| `docs/TRAMPAS.md`              | Lo que solo se descubre tropezando, con su porqué y sus enlaces     |
| `docs/ARCHITECTURE.md`         | Capas, qué importa qué, notas para quien viene de Angular           |
| `docs/DOMAIN-MUSIC.md`         | La teoría que implementa el código, en lenguaje de músico           |
| `docs/AUDIO-PITCH.md`          | Cómo se detecta el tono y el acorde, y qué limitaciones tienen      |
| `docs/RECORDING.md`            | Permisos, canvas, formatos, descarga local                          |
| `docs/AI.md`                   | Contrato de los route handlers y las puertas del gasto              |
| `docs/CUENTAS-Y-PLANES.md`     | Qué da cada plan, qué cuesta la IA y qué se guarda de ti            |
| `docs/MEDIR.md`                | Medir el motor con guitarras reales y la IA contra la API           |
| `docs/VALIDAR.md`              | Validar con personas: sesiones, entrevistas, umbrales, cuándo parar |
| `docs/ROADMAP.md`              | **Lo que falta**, ordenado por lo que estorba a diario              |
| `docs/PARA-PUBLICAR.md`        | **Lo que hará falta al publicar y cobrar.** Nada está en marcha     |
| `docs/HISTORIA.md`             | Las fases hechas, una línea cada una, y los fallos que enseñaron    |
| `docs/DESPLIEGUE.md`           | Qué hace falta para publicar y qué se rompe según dónde             |
| `docs/adr/`                    | Decisiones con sus alternativas descartadas. Van ciento diecisiete  |

Tres reglas: **toda decisión con alternativas reales se escribe como ADR** con sus
descartadas; **cuando cambies comportamiento, actualiza el documento que lo
describía**; y **los documentos hablan en presente y solo de lo que se puede
comprobar**, que lo no ejecutado vive en `PARA-PUBLICAR.md` diciéndolo.

## Cómo se escribe aquí

Todo en español: código comentado, tests, documentación y commits. Los comentarios
explican **por qué**, no qué. Commits: `tipo(ámbito): frase en minúscula y sin
tildes`, contando el efecto que se nota, no el fichero:
`fix(mastil): se ve entero al abrirlo, sin arrastrar nada`.

## Lo que este proyecto no hace

Cada una, con su porqué, en [docs/TRAMPAS.md](docs/TRAMPAS.md).

- **No sube audio** (con cuenta sí sube el avance: identificadores, números y fechas)
  **ni graba vídeo** ([adr/0023](docs/adr/0023-grabar-solo-el-sonido.md)).
- **No cobra todavía**, ni pide una tarjeta. **No esconde el texto del Grado Profesional**: viaja en el JS; se cobra el camino y la IA (`adr/0116`).
- **No tiene vidas ni corazones, ni examina a nadie** para colocarle de nivel.
- **No exige cuentas**, **no las crea a menores de 14** ni **manda correos sin configurarlo**.
- **No usa analítica de terceros ni cookies de seguimiento**
  ([adr/0110](docs/adr/0110-contar-sin-seguir.md)).
- **No detecta la tonalidad rasgueando**: el motor de tono es monofónico.
- **No acierta siempre con los acordes**: una nota sola sale como su quinta (`C5`), y
  el acierto solo está medido con guitarra sintética
  ([adr/0107](docs/adr/0107-los-armonicos-se-miden-en-su-serie.md)).
