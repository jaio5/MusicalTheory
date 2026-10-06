import type { Metadata } from 'next';
import Link from 'next/link';

import { Tuner } from '@features/tuner';
import { Disclosure } from '@ui/Disclosure';

import { EscenaPortada } from './EscenaPortada';
import { LandingWheel } from './LandingWheel';

export const metadata: Metadata = {
  title: 'Caos ordenado — aprende música y compón con ayuda',
  description:
    'Aprende teoría en unidades cortas y, con lo que llevas tocado, te propone por dónde puede seguir tu canción. En el navegador, sin cuenta y sin mandar tu audio a ninguna parte.',
};

/**
 * El marco de la portada, escrito una vez: de borde a borde, con el margen que
 * crece con la pantalla (`--margen`, en `escena-portada.css`).
 *
 * Fue `max-w-[min(90rem,92vw)]`, copiado en nueve sitios, y luego una columna de
 * 78 rem: en 2560 eso dejaba 680 píxeles vacíos a cada lado. La medida de lectura
 * no la pone el marco sino cada párrafo, con su `max-w-[68ch]`; el ancho que
 * sobra lo usan las columnas.
 */
const MARCO = 'portada-marco w-full';

/**
 * Dos columnas desde `lg`: el rótulo y el título a la izquierda, lo que cuentan a
 * la derecha. Es lo que hace que una franja de un párrafo no sea una tira estrecha
 * pegada a un lado con el resto de la pantalla vacío.
 */
/*
 * `minmax(0,1fr)` también en la columna única: una rejilla sin columnas
 * declaradas mide la suya por lo más ancho que lleva dentro, y con la letra del
 * navegador al doble el afinador pedía 473 px en un teléfono de 390. La página
 * entera se iba de lado. Con el cero, la columna es la pantalla y lo de dentro
 * se las arregla.
 */
const A_DOS =
  'grid grid-cols-[minmax(0,1fr)] gap-y-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-(--hueco)';

/** El aire vertical de cada franja. Nueve secciones, un solo ritmo. */
const FRANJA = 'py-24 sm:py-32 2xl:py-40';

const CLAIMS: readonly string[] = [
  'Sin saber solfeo',
  '0 bytes de audio enviados',
  'Sin instalar nada',
];

/**
 * Las cuatro pantallas, **sin numerar**. Llevaban «01 — Aprender … 04 — Afinar»
 * encima de cada titular, y un número promete un orden que aquí no existe: no
 * se empieza por aprender ni se acaba afinando, cada una es un sitio. El nombre
 * es el titular de la tarjeta, con su peso, y lo que hace cada una va debajo.
 */
const SCREENS: ReadonlyArray<{
  href: string;
  name: string;
  headline: string;
  body: string;
}> = [
  {
    href: '/aprender',
    name: 'Aprender',
    headline: 'Un camino de diez cursos, y empiezas por donde quieras',
    body: 'Dos grados y diez cursos de unidades cortas, con su meta del día y su racha. Las preguntas se escriben en la tonalidad en la que estés, no en un C mayor de libro, y al contestar te dicen por qué, aciertes o falles. La mitad de las unidades son de tocar: la aplicación oye si la nota ha sonado limpia antes de pasar a la siguiente. Y si ya sabes teoría, eliges el curso por el que entras y no pasas por lo que ya te sabes.',
  },
  {
    href: '/profesor',
    name: 'Profesor',
    headline: 'Pregunta lo que no te atreves a preguntar',
    body: 'Un profesor al que preguntarle cualquier cosa de teoría, que contesta en tres frases y con los acordes de la tonalidad que tengas puesta. Si un ejemplo tocable ayuda, lo da en grados y se resuelve a los acordes de verdad de esa tonalidad; no hay forma de que te enseñe un acorde que ahí no existe.',
  },
  {
    href: '/componer',
    name: 'Componer',
    headline: 'Guarda la idea antes de que se te olvide',
    body: 'Eliges la tonalidad en la rueda y encadenas acordes. De cada uno ves sus notas, hasta seis formas de hacerlo a lo largo del mástil y a dónde puedes ir desde ahí, con un punto verde, ámbar o rojo según cuánto se salga. Puedes buscar un acorde por su cifrado y te dice si entra, si cabe como color o si se va fuera.',
  },
  {
    href: '/afinar',
    name: 'Afinar',
    headline: 'Ocho afinaciones y nada más en pantalla',
    body: 'Estándar, drop D, medio tono abajo, un tono abajo, drop C, DADGAD, open G y open D. El afinador compara con la afinación que elijas, no con la de siempre, así que en drop C la sexta al aire está afinada cuando lo está de verdad.',
  },
];

const QUESTIONS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: '¿Qué necesito para usarlo?',
    a: 'La guitarra, un navegador reciente y permiso de micrófono. No hay que instalar nada ni conectar interfaz de audio: con el micro del portátil o del móvil llega.',
  },
  {
    q: '¿Sirve con guitarra eléctrica?',
    a: 'Sí, tanto a pelo como enchufada. Si usas mucha distorsión la detección pierde precisión; con un sonido limpio o poco saturado va fina.',
  },
  {
    q: '¿Reconoce acordes o solo notas sueltas?',
    a: 'Las dos cosas, con dos análisis distintos. El afinador busca una sola altura, así que ahí se toca nota a nota. En componer hay además un reconocedor de acordes que trabaja con el espectro: acierta con tríadas y séptimas tocadas en limpio, y duda con las inversiones, porque olvida en qué octava está cada nota.',
  },
  {
    q: '¿Hace falta saber teoría?',
    a: 'No. Puedes tocar y leer los nombres que van saliendo; la explicación está ahí cuando la quieras y se calla cuando no. Y si ya sabes, en el camino eliges por qué curso entras: no hay que pasar por lo que ya te sabes.',
  },
  {
    q: '¿Cuánto cuesta?',
    a: 'El afinador, la rueda, el mástil, el metrónomo, los acordes y grabar lo que tocas son gratis y lo van a seguir siendo: pasan enteros en tu navegador, así que servirlos no cuesta nada. Lo que se paga es la IA —el profesor y las salidas de lo que compones son llamadas a un modelo— y el temario del Grado Profesional, en tres planes desde 4,99 € al mes. Sin pagar nada tienes el Grado Elemental completo y unas preguntas al profesor al día.',
  },
];

/**
 * La portada: qué es esto y cómo funciona, con el afinador de verdad para
 * probarlo sin salir de aquí.
 *
 * Lo que se puede tocar aquí es el afinador y la rueda, que son las dos cosas
 * que se entienden solas. Lo demás vive en su pantalla, porque cada una pide
 * sitio y atención, y meterla aquí sería enseñar una foto de la aplicación en
 * vez de la aplicación.
 *
 * **Se separa por color de fondo, no por líneas.** Antes cada sección llevaba su
 * `border-b`: ocho reglas de un píxel de lado a lado, que es lo que hace que una
 * página parezca una tabla. Ahora las franjas alternan fondo y superficie —hielo,
 * blanco, hielo— así que el corte se ve sin dibujar nada, y por eso el orden de
 * las secciones no se puede tocar sin mirar: dos seguidas del mismo color se
 * funden en una.
 *
 * Y quien manda en el reparto es **lo que lleva dentro, no el orden**: una sección
 * con un panel va sobre el hielo, porque `.superficie` es casi blanco y sobre la
 * franja blanca se queda en su borde, sin elevarse. Le pasa al afinador, y por eso
 * es la única que arrastra una línea: es la que queda pegada al encabezado, que
 * también es hielo.
 */
export default function Portada() {
  return (
    <div className="portada fondo-sala text-text">
      {/* Lo mismo que hace `AppShell`, y por lo mismo: sin esto, llegar al
          contenido de la portada con el teclado cuesta pasar por la marca, los
          tres enlaces de la barra y el botón de abrir. Va `fixed` y no
          `absolute` porque aquí el marco de fuera no está posicionado ni
          recorta, que es lo que allí lo mantiene escondido. */}
      <a
        href="#contenido"
        className="bg-brass text-background min-h-tap fixed top-2 left-2 z-50 inline-flex -translate-y-20 items-center rounded-md px-4 text-sm font-medium focus:translate-y-0"
      >
        Saltar al contenido
      </a>

      {/* La barra no existe hasta que se baja: arriba del todo son la marca y
          tres enlaces flotando sobre la sala, y el velo con su línea aparecen al
          primer scroll. Lo hace `.barra-portada` con `animation-timeline`, sin
          una línea de JavaScript; donde no lo haya, sale la barra opaca de
          siempre. Es de la sala en los dos temas (`.escenario-oscuro`): una
          franja clara encima de la noche partía el encabezado en dos. */}
      <header className="barra-portada escenario-oscuro sticky top-0 z-20 border-b border-transparent">
        {/* `flex-wrap`: con la letra del navegador al doble, la marca y el
            «Abrir» no caben en 390 y se salían por la derecha —493 px de
            documento—; envolviendo, el botón baja a su fila y la página no
            se desplaza de lado. A tamaño normal no cambia nada: cabe. */}
        <div className={`${MARCO} flex flex-wrap items-center gap-x-4 gap-y-2 py-3`}>
          <span className="font-display text-text inline-flex items-center gap-2 text-lg tracking-tight">
            <span aria-hidden="true" className="bg-brass size-2 rounded-full" />
            Caos ordenado
          </span>
          {/* Los tres de la barra y el de abrir **con alto de dedo**.

              Medían veinte y veintiséis píxeles, y son lo primero que se toca en
              toda la aplicación: la portada es donde llega quien no la conoce, y
              casi siempre desde un teléfono. La regla de los 44 px estaba escrita
              y vigilada dentro de la aplicación, pero la portada no pasa por
              `ui/Screen` ni por `ui/Button`, así que se quedaba fuera. */}
          {/* La navegación y el botón, en el mismo grupo empujado a la derecha.

              Con el `ml-auto` solo en la navegación, en un teléfono —donde la
              navegación no se enseña— no quedaba nada que empujara: el «Abrir» se
              pegaba a la marca y la mitad derecha de la barra quedaba vacía. */}
          <div className="ml-auto flex items-center gap-2">
            <nav
              aria-label="Secciones"
              className="text-text-muted hidden items-center gap-1 text-sm sm:flex"
            >
              <a
                href="#probar"
                className="hover:text-text min-h-tap inline-flex items-center px-3 transition-colors"
              >
                Afinador
              </a>
              <a
                href="#pantallas"
                className="hover:text-text min-h-tap inline-flex items-center px-3 transition-colors"
              >
                Pantallas
              </a>
              <a
                href="#privacidad"
                className="hover:text-text min-h-tap inline-flex items-center px-3 transition-colors"
              >
                Privacidad
              </a>
            </nav>
            <Link
              href="/componer"
              className="border-border text-text hover:border-brass hover:text-brass-bright min-h-tap inline-flex items-center rounded-md border px-4 text-sm font-medium transition-colors"
            >
              Abrir
            </Link>
          </div>
        </div>
      </header>

      {/* El contenido, en su marco.

          Es la única pantalla que no pasa por `AppShell`, que es quien pone el
          `<main>` y el salto en todas las demás, y se quedó sin los dos: de los
          doce destinos de la aplicación, la portada era el único sin región
          principal y sin manera de saltarse la cabecera con el teclado. Justo
          la primera que ve cualquiera. El `tabIndex` de -1 es lo que hace que el
          foco se mueva de verdad al saltar, igual que allí. */}
      <main id="contenido" tabIndex={-1} className="portada-contenedor">
        {/* El encabezado: la sala de píxel a sangre, y el titular escrito en su
          pared.

          Estuvo en una caja a la derecha del texto, y antes fue un vídeo. La caja
          la hacía una foto más de la página; a sangre es el sitio donde pasa todo,
          y el titular se lee como un cartel colgado en el local. Para que se lea,
          la sala es oscura en los dos temas —es de noche— y un velo oscurece la
          pared que queda detrás de las letras (`.hero-velo`). Sube por detrás de
          la barra, que flota encima, lo que ella mide (`--alto-barra`). */}
        <section className="hero-escena escenario-oscuro">
          <EscenaPortada />
          <div aria-hidden="true" className="hero-velo" />
          <div className={`${MARCO} hero-texto`}>
            {/* La columna del titular la mide la sala que tiene al lado, no una
                caja fija: el tamaño de la letra sale de su ancho (`.hero-titular`). */}
            <div className="hero-columna">
              <h1 className="font-display hero-titular entra tracking-[-0.02em] text-balance">
                {/* Dos frases, dos renglones como mínimo: con la columna ancha y la
                    letra en su mínimo, el equilibrado subía la «Y» al primero. */}
                <span className="block">Toca. Aprende.</span>{' '}
                <span className="block">Y que la canción siga.</span>
              </h1>
              <p className="text-text-muted hero-entradilla entra mt-6 max-w-[40ch] [animation-delay:120ms]">
                Teoría en unidades cortas, y una canción que sigue por donde la dejaste. Te oye por
                el micro, y tu audio no sale de aquí.
              </p>

              {/* A todo el ancho por debajo de `sm`: apilados con su ancho de texto,
                  uno de 179 y otro de 192 píxeles se leían como dos tamaños. */}
              <div className="entra mt-9 flex flex-wrap gap-3 [animation-delay:240ms]">
                <Link
                  href="/componer"
                  className="bg-brass text-background hover:bg-brass-bright min-h-tap inline-flex w-full items-center justify-center rounded-md px-6 text-base font-medium transition-colors active:translate-y-px sm:w-auto 2xl:min-h-14 2xl:px-8 2xl:text-lg"
                >
                  Empezar a tocar
                </Link>
                <a
                  href="#probar"
                  className="border-border text-text hover:border-brass hover:text-brass-bright min-h-tap inline-flex w-full items-center justify-center rounded-md border px-6 text-base transition-colors active:translate-y-px sm:w-auto 2xl:min-h-14 2xl:px-8 2xl:text-lg"
                >
                  Probar el afinador
                </a>
              </div>

              <ul className="text-text-muted entra mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs [animation-delay:320ms] sm:text-sm 2xl:text-base">
                {CLAIMS.map((claim) => (
                  <li key={claim} className="flex items-center gap-2">
                    <span aria-hidden="true" className="bg-brass block h-1 w-1 rounded-full" />
                    {claim}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* `#probar` y no `#afinador`: ese id ya lo lleva el `Panel` del propio
          afinador, que vive dentro de esta sección. Dos elementos con el mismo id
          en el mismo documento es HTML inválido, y el salto del enlace acababa
          donde decidiera el navegador. */}
        <section id="probar" className="border-border border-t">
          {/* El afinador a la derecha desde `xl`, y lo que lo explica a su lado.
              Debajo del texto, en 2560, era un panel de 768 píxeles pegado a la
              izquierda con dos tercios de la franja vacíos. */}
          <div
            className={`${MARCO} ${FRANJA} revelar grid grid-cols-[minmax(0,1fr)] gap-y-10 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-center xl:gap-x-(--hueco)`}
          >
            {/* Sin antetítulo. Las franjas llevaban un rótulo de 12 px encima del
                titular —«Pruébalo aquí», «La rueda de quintas», «Privacidad»—,
                que es un `.rotulo` nombrando un trozo de página, justo lo que
                `docs/ESTILO.md` dice que no es: el titular carga con su peso y lo
                que el rótulo decía va dentro de él o sobra. */}
            <div>
              <h2 className="font-display text-fluid-title tracking-tight">
                Un afinador de verdad, ahora
              </h2>
              <p className="text-text-muted text-fluid-body mt-4 max-w-[60ch] leading-relaxed">
                Hace falta el micro para escuchar la cuerda y calcular su frecuencia. El sonido se
                analiza en tu equipo: no se graba y no se envía. Es el mismo afinador que hay
                dentro, no una demostración.
              </p>
              <p className="text-text-muted mt-4 text-sm">
                Con otra afinación —drop D, DADGAD, open G— entra en{' '}
                <Link href="/afinar" className="enlace">
                  la pantalla de afinar
                </Link>
                .
              </p>
            </div>

            <div className="w-full max-w-3xl xl:max-w-[56rem] xl:justify-self-end">
              <Tuner />
            </div>
          </div>
        </section>

        <section id="pantallas" className="bg-surface">
          <div className={`${MARCO} ${FRANJA} revelar`}>
            {/* Cuatro, y no tres. Decía «tres pantallas» debajo de cuatro tarjetas
              desde que afinar se separó de componer: quien las cuenta encuentra
              una de más, que es la peor manera de empezar a fiarse de algo. */}
            <div className={`${A_DOS} lg:items-end`}>
              <h2 className="font-display text-fluid-title tracking-tight">
                Cuatro pantallas, cuatro cosas
              </h2>
              <p className="text-text-muted text-fluid-body max-w-[60ch] leading-relaxed">
                Cada una está hecha para una cosa y trae dentro lo que hace falta para esa cosa. No
                hay que montarse nada ni buscar dónde está lo que quieres.
              </p>
            </div>

            {/* Cuatro columnas cuando caben, y dos cuando no. En tres, la cuarta
              tarjeta se quedaba sola en una fila con dos tercios de la pantalla
              vacíos al lado. El hueco entre ellas crece con la pantalla, y el
              texto de cada una lleva su tope: en 2560 una tarjeta mide 540. */}
            <div className="mt-12 grid gap-x-(--hueco) gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
              {SCREENS.map((screen) => (
                // Columna con el enlace empujado abajo: los cuatro textos miden
                // distinto y los cuatro «Abrir» acababan a cuatro alturas, que en
                // una fila de tarjetas se lee como que están descuadradas.
                //
                // La línea de arriba se tiñe de latón al pasar por encima: es la
                // única señal de que la columna entera es un destino, y cuesta una
                // transición. La flecha del enlace acompaña.
                <article
                  key={screen.href}
                  className="border-border hover:border-brass group flex flex-col border-t pt-8 transition-colors"
                >
                  <h3 className="font-display text-fluid-subtitle tracking-tight">{screen.name}</h3>
                  <p className="text-text text-fluid-body mt-2 max-w-[32ch] font-medium">
                    {screen.headline}
                  </p>
                  <p className="text-text-muted text-fluid-body mt-3 max-w-[60ch] leading-relaxed">
                    {screen.body}
                  </p>
                  <Link
                    href={screen.href}
                    className="enlace min-h-tap mt-auto -ml-2 inline-flex items-center gap-1 self-start px-2 pt-3"
                  >
                    Abrir {screen.name.toLowerCase()}
                    <span
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section>
          {/* La rueda en el centro de su mitad. Con `auto`, la columna medía lo que
              la rueda y se iba al borde derecho, lejos del texto que la explica. */}
          <div className={`${MARCO} ${FRANJA} revelar ${A_DOS} lg:items-center`}>
            <div>
              <h2 className="font-display text-fluid-title tracking-tight">
                La rueda gira sola hasta tu tonalidad
              </h2>
              <p className="text-text-muted text-fluid-body mt-4 max-w-[60ch] leading-relaxed">
                Mientras tocas, la aplicación acumula las notas que aparecen y calcula en qué
                tonalidad estás. Cuando lo tiene claro, la rueda gira y coloca esa tonalidad arriba
                del todo.
              </p>
              <p className="text-text-muted text-fluid-body mt-3 max-w-[60ch] leading-relaxed">
                A partir de ahí, lo que queda cerca en la rueda es lo que suena natural a
                continuación, y lo que queda lejos es el sitio al que ir cuando quieres que la
                canción se tuerza. Si cambias de tonalidad a mitad de una idea, la rueda vuelve a
                girar.
              </p>
            </div>

            <LandingWheel />
          </div>
        </section>

        <section className="bg-surface">
          <div className={`${MARCO} ${FRANJA} revelar ${A_DOS}`}>
            <h2 className="font-display text-fluid-title tracking-tight">
              Graba lo que tocas y escúchate
            </h2>
            <p className="text-text-muted text-fluid-body max-w-[68ch] leading-relaxed lg:pt-7">
              Desde la pantalla de componer se graba lo que estás tocando sin salir de ella, y al
              parar te suena ahí mismo: lo primero que puedes hacer con una toma es oírla y decidir
              si vale. Si vale, se descarga a tu disco; si no, se tira y se vuelve a intentar. Solo
              el sonido, y no sale de tu equipo.
            </p>
          </div>
        </section>

        <section id="privacidad">
          <div className={`${MARCO} ${FRANJA} revelar ${A_DOS}`}>
            <h2 className="font-display text-fluid-title tracking-tight">
              Tu audio no sale de aquí
            </h2>
            <div className="lg:pt-7">
              <p className="text-text-muted text-fluid-body max-w-[68ch] leading-relaxed">
                El micrófono se analiza dentro del navegador, en tu ordenador. Nadie escucha lo que
                tocas y no queda ninguna grabación en ningún servidor. Lo que grabas, igual: se
                guarda en la memoria de la pestaña y se descarga desde ahí.
              </p>
              <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
                Cuando le pides una idea al modelo o le preguntas al profesor, lo único que viaja
                son nombres:
              </p>
              <p className="text-brass-bright mt-4 font-mono text-lg">Am7 · F · C · G</p>
              <p className="text-text-muted text-fluid-body mt-3 max-w-[68ch] leading-relaxed">
                y la tonalidad. Ni un segundo de sonido.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-surface">
          <div className={`${MARCO} ${FRANJA} revelar ${A_DOS}`}>
            <h2 className="font-display text-fluid-title tracking-tight">Preguntas</h2>
            <div>
              {QUESTIONS.map((item) => (
                <Disclosure
                  key={item.q}
                  summary={item.q}
                  tone="grande"
                  className="border-border border-b py-5"
                >
                  <p className="text-text-muted text-fluid-body mt-3 max-w-[68ch] leading-relaxed">
                    {item.a}
                  </p>
                </Disclosure>
              ))}
            </div>
          </div>
        </section>

        <section>
          {/* La despedida, de cartel como el titular: grande a la izquierda, y lo
              que hay que hacer abajo a la derecha. */}
          <div
            className={`${MARCO} revelar grid grid-cols-[minmax(0,1fr)] gap-y-8 py-28 sm:py-36 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-x-(--hueco) 2xl:py-48`}
          >
            <h2 className="font-display portada-cartel max-w-[18ch] tracking-[-0.02em] text-balance">
              Coge la guitarra y enciende el micro
            </h2>
            <div>
              <p className="text-text-muted text-fluid-body max-w-[60ch] leading-relaxed">
                Se empieza tocando. Si a los cinco minutos no te aporta nada, cierras la pestaña y
                no ha pasado nada.
              </p>
              <Link
                href="/componer"
                className="bg-brass text-background hover:bg-brass-bright min-h-tap mt-8 inline-flex items-center rounded-md px-7 text-lg font-medium transition-colors active:translate-y-px 2xl:min-h-14 2xl:px-9"
              >
                Empezar a tocar
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-border text-text-muted border-t">
        {/* Los cinco del pie **también se pulsan con el dedo**. Eran renglones de
            veinte píxeles: en un teléfono, cinco destinos pegados y ninguno con
            alto de dedo es la manera de acabar entrando donde no querías. */}
        <div className={`${MARCO} flex flex-wrap items-center gap-x-1 gap-y-1 py-6 text-sm`}>
          <span className="font-display text-text min-h-tap mr-3 inline-flex items-center px-1">
            Caos ordenado
          </span>
          <Link
            href="/aprender"
            className="hover:text-text min-h-tap inline-flex items-center px-3 transition-colors"
          >
            Aprender
          </Link>
          <Link
            href="/profesor"
            className="hover:text-text min-h-tap inline-flex items-center px-3 transition-colors"
          >
            Profesor
          </Link>
          <Link
            href="/componer"
            className="hover:text-text min-h-tap inline-flex items-center px-3 transition-colors"
          >
            Componer
          </Link>
          <Link
            href="/afinar"
            className="hover:text-text min-h-tap inline-flex items-center px-3 transition-colors"
          >
            Afinar
          </Link>
          <Link
            href="/planes"
            className="hover:text-text min-h-tap inline-flex items-center px-3 transition-colors"
          >
            Planes
          </Link>
          <span className="ml-auto px-1">Hecho para tocar de noche</span>
        </div>
      </footer>
    </div>
  );
}
