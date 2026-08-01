# ADR 0005 — Cuentas propias y el avance fusionado en el servidor

Fecha: 2026-07-30 · Estado: aceptada

## Contexto

Hasta ahora esta aplicación no tenía servidor de estado. Lo decía DESPLIEGUE.md
con orgullo: «no hay base de datos ni sesión de servidor, un despliegue nuevo no
pierde datos de nadie porque no hay datos de nadie». Las sesiones vivían en
IndexedDB y el avance del temario en `localStorage`.

Dos cosas rompen eso:

**La IA cuesta dinero y no hay a quién cobrárselo.** El roadmap ya lo tenía
apuntado: «con la clave puesta en un sitio público, cualquiera que entre puede
gastar». Un cupo por dirección IP se salta cambiando de red y se reinicia en cada
despliegue. Para cobrar por uso hay que saber de quién es el uso.

**El avance en un navegador se pierde y no viaja.** Borrar los datos del sitio
borra diez cursos. Y quien estudia en el portátil no encuentra nada en el móvil,
que es donde de verdad se hacen tres minutos de teoría.

Hay dos decisiones dentro, y la segunda es la que tiene trampa: _si_ hay cuentas,
y _quién fusiona_ cuando el mismo avance existe en dos sitios.

## Decisión

**Cuentas propias con Auth.js, Postgres y Drizzle**, en una capa nueva `src/server/`
que solo puede abrir `app/`, vigilada por ESLint en los dos sentidos.

Correo y contraseña como único proveedor, con `scrypt` de la biblioteca estándar de
Node. Sesión en cookie firmada, sin tabla de sesiones, y **el plan no viaja dentro
de la cookie**: se lee de la base de datos cada vez, que es cuando ya hay que ir a
mirar el cupo del día.

**Sin `DATABASE_URL` y `AUTH_SECRET`, la aplicación funciona entera y sin cuentas.**
Todo el mundo anónimo, plan gratis, avance en su navegador: exactamente como
funcionaba antes. Es la misma regla que ya cumplía `ANTHROPIC_API_KEY`, y lo que
permite que un clon recién bajado arranque y deje tocar la guitarra.

**El avance se guarda como un documento JSON**, uno por cuenta, y se lee siempre a
través de `parseProgress`, la misma función que ya limpiaba lo que venía del
`localStorage`. Lo que hay en la base de datos lo escribió el navegador de alguien:
eso lo convierte en entrada de usuario aunque haya dado la vuelta por Postgres.

**Y la fusión la hace el servidor.** El navegador sube lo que tiene, el servidor lo
junta con lo guardado y devuelve el resultado, que es el que el navegador se queda.
`mergeProgress` vive en el dominio, es pura y se queda con lo mejor de cada lado
—unión de lo hecho, la racha más larga que siga viva, todas las medallas— salvo en
dos sitios donde se queda con lo peor a propósito: del XP del día el mayor y no la
suma, porque dos aparatos abiertos a la vez no son el doble de trabajo; y de la cola
de repaso, los menos aciertos, porque dar por sabido lo que no se sabe es el único
error que esa cola no puede permitirse.

El navegador sigue siendo la copia de trabajo: se escribe primero en `localStorage`
y se sube después.

## Alternativas descartadas

**Fusionar en el navegador (leer, juntar, escribir).** Es lo primero que sale y es
lo que rompe con dos aparatos abiertos: el segundo en escribir borra lo que hizo el
primero, porque escribe el resultado de una lectura que ya está vieja. Fusionando en
el servidor, subir es idempotente y no hay que decidir quién gana.

**Que gane el servidor y el avance local se descarte al entrar.** Más simple, y
tira el trabajo de quien estudió sin cuenta y se registró después, que es el camino
normal de quien prueba la aplicación antes de decidir si le sirve.

**Que gane el más reciente por fecha de escritura.** Suena razonable hasta que se
piensa: el aparato con el reloj mal puesto gana siempre, y «más reciente» no es «más
completo». La unión no necesita relojes de acuerdo.

**Una tabla por unidad terminada, normalizada.** Más ortodoxo y no resuelve ninguna
pregunta que alguien vaya a hacer: el avance se lee y se escribe siempre completo
porque el camino se pinta entero. Lo que se pierde está escrito en el esquema: no se
puede preguntar cuánta gente terminó el tercer curso sin abrir todos los documentos.
Cuando eso haga falta, se normaliza.

**Supabase o Clerk.** Menos código que escribir, y a cambio su cliente entra en el
navegador y parte de las reglas de acceso se configuran fuera del repositorio. Con
[ADR 0001](./0001-capas-y-dominio-puro.md) en la mano, sacar reglas del código a un
panel es ir en la dirección contraria. Auth.js con Drizzle deja el esquema, la
política y las migraciones dentro del repositorio.

**bcrypt o argon2 para las contraseñas.** Las dos se compilan al instalar. Este
proyecto ya tropezó tres veces con herramientas que no ejecutan en su entorno
—están en el CLAUDE.md de `~/projects`— y una dependencia nativa es exactamente esa
clase de problema. `scrypt` viene en Node, lo recomienda OWASP y no instala nada.

**Sesión en base de datos en vez de en cookie firmada.** Una consulta por petición
para saber quién eres, cuando el identificador cabe en la cookie. Se descarta por
coste, no por seguridad: la cookie va firmada y solo lleva el identificador.

## Consecuencias

- Hay tres tablas, un directorio `drizzle/` con migraciones y dos variables de
  entorno nuevas. DESPLIEGUE.md ya no puede decir que no hay base de datos.
- El layout raíz lee la sesión, así que las páginas se sirven en cada petición.
  Hubo que forzarlo (`dynamic = 'force-dynamic'`): construir sin variables y
  arrancar con ellas —el camino del contenedor— dejaba la cuenta anónima
  prerenderizada dentro del HTML.
- **El audio y el vídeo siguen sin salir del equipo.** Lo que sube del progreso son
  identificadores de unidad, números y fechas. Esta decisión no abre esa puerta.
- Falta probarlo con Postgres de verdad: en la máquina donde se escribió no había
  ni base de datos ni Docker. Lo que falle ahí serán las consultas, no la política.
