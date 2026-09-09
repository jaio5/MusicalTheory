import type { Metadata } from 'next';
import Link from 'next/link';

import { Tuner } from '@features/tuner';
import { Disclosure } from '@ui/Disclosure';

import { HeroVideo } from './HeroVideo';
import { LandingWheel } from './LandingWheel';

export const metadata: Metadata = {
  title: 'Caos ordenado — aprende música y compón con ayuda',
  description:
    'Aprende teoría en unidades cortas y, con lo que llevas tocado, te propone por dónde puede seguir tu canción. En el navegador, sin cuenta y sin mandar tu audio a ninguna parte.',
};

/**
 * El ancho de la portada, escrito una vez.
 *
 * Estaba copiado en nueve sitios como `max-w-[min(90rem,92vw)] px-6`, y noventa
 * rem son mil cuatrocientos cuarenta píxeles: en un monitor ancho, un párrafo
 * cruzaba la pantalla entera. Setenta y ocho es la medida de lectura que ya
 * usaban los `max-w-[68ch]` de dentro, ahora también por fuera.
 */
const ANCHO = 'mx-auto w-full max-w-[min(78rem,92vw)] px-6';

/** El aire vertical de cada franja. Nueve secciones, un solo ritmo. */
const FRANJA = 'py-24 sm:py-32';

const CLAIMS: readonly string[] = [
  'Sin saber solfeo',
  '0 bytes de audio enviados',
  'Sin instalar nada',
];

const SCREENS: ReadonlyArray<{
  href: string;
  step: string;
  name: string;
  headline: string;
  body: string;
}> = [
  {
    href: '/aprender',
    step: '01',
    name: 'Aprender',
    headline: 'Un camino de diez cursos, y empiezas por donde quieras',
    body: 'Dos grados y diez cursos de unidades cortas, con su meta del día y su racha. Las preguntas se escriben en la tonalidad en la que estés, no en un C mayor de libro, y al contestar te dicen por qué, aciertes o falles. La mitad de las unidades son de tocar: la aplicación oye si la nota ha sonado limpia antes de pasar a la siguiente. Y si ya sabes teoría, eliges el curso por el que entras y no pasas por lo que ya te sabes.',
  },
  {
    href: '/profesor',
    step: '02',
    name: 'Profesor',
    headline: 'Pregunta lo que no te atreves a preguntar',
    body: 'Un profesor al que preguntarle cualquier cosa de teoría, que contesta en tres frases y con los acordes de la tonalidad que tengas puesta. Si un ejemplo tocable ayuda, lo da en grados y se resuelve a los acordes de verdad de esa tonalidad; no hay forma de que te enseñe un acorde que ahí no existe.',
  },
  {
    href: '/componer',
    step: '03',
    name: 'Componer',
    headline: 'Guarda la idea antes de que se te olvide',
    body: 'Eliges la tonalidad en la rueda y encadenas acordes. De cada uno ves sus notas, hasta seis formas de hacerlo a lo largo del mástil y a dónde puedes ir desde ahí, con un punto verde, ámbar o rojo según cuánto se salga. Puedes buscar un acorde por su cifrado y te dice si entra, si cabe como color o si se va fuera.',
  },
  {
    href: '/afinar',
    step: '04',
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
    a: 'El afinador, la rueda, el mástil, el metrónomo, los acordes y grabar lo que tocas son gratis y lo van a seguir siendo: pasan enteros en tu navegador, así que servirlos no cuesta nada. Lo que se paga es la IA —el profesor y las ideas son llamadas a un modelo— y el temario del Grado Profesional, en tres planes desde 4,99 € al mes. Sin pagar nada tienes el Grado Elemental completo y unas preguntas al profesor al día.',
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
    <div className="fondo-sala text-text">
      {/* La barra no existe hasta que se baja: arriba del todo son la marca y
          tres enlaces sobre el hielo, y el velo con su línea aparecen al primer
          scroll. Lo hace `.barra-portada` con `animation-timeline`, sin una
          línea de JavaScript; donde no lo haya, sale la barra opaca de siempre. */}
      <header className="barra-portada sticky top-0 z-20 border-b border-transparent">
        <div className={`${ANCHO} flex items-center gap-4 py-3`}>
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

      {/* El encabezado: el titular a la izquierda y el vídeo en su caja a la
          derecha.

          Iba a sangre, con el vídeo detrás del texto y dos velos encima para
          poder leerlo. Sobre el hielo eso no se sostiene: un velo blanco sobre un
          fotograma oscuro deja una niebla gris, y la mitad de la gracia del tema
          claro es el blanco que se ve. Contenido en un marco, el vídeo es la
          única cosa oscura de la pantalla y se lleva la mirada él solo. */}
      <section className="relative overflow-hidden">
        <div
          className={`${ANCHO} grid items-center gap-12 pt-16 pb-24 sm:pt-24 sm:pb-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16`}
        >
          <div>
            <p className="rotulo entra">Aprender y componer, con la guitarra puesta</p>
            <h1 className="font-display text-fluid-hero entra mt-4 max-w-[15ch] leading-[1.04] tracking-[-0.02em] text-balance [animation-delay:80ms]">
              Toca. Aprende. Y que la canción siga.
            </h1>
            <p className="text-text-muted text-fluid-subtitle entra mt-6 max-w-[46ch] leading-relaxed [animation-delay:160ms]">
              Te enseña la teoría en unidades cortas y, con lo que llevas tocado, te propone por
              dónde puede seguir tu canción. Te oye por el micro: no hace falta escribir nada, ni
              que tu audio salga de aquí.
            </p>

            <div className="entra mt-9 flex flex-wrap gap-3 [animation-delay:240ms]">
              <Link
                href="/componer"
                className="bg-brass text-background hover:bg-brass-bright min-h-tap inline-flex items-center rounded-md px-6 text-base font-medium transition-colors active:translate-y-px"
              >
                Empezar a tocar
              </Link>
              <a
                href="#probar"
                className="border-border text-text hover:border-brass hover:text-brass-bright min-h-tap inline-flex items-center rounded-md border px-6 text-base transition-colors active:translate-y-px"
              >
                Probar el afinador
              </a>
            </div>

            <ul className="text-text-muted entra mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs [animation-delay:320ms]">
              {CLAIMS.map((claim) => (
                <li key={claim} className="flex items-center gap-2">
                  <span aria-hidden="true" className="bg-brass block h-1 w-1 rounded-full" />
                  {claim}
                </li>
              ))}
            </ul>
          </div>

          {/* El halo va por detrás y desenfocado: es la luz del aparato saliendo
              por los cantos del marco, no un borde de color. Sobre el hielo es lo
              único cálido de la mitad derecha. */}
          <div className="entra relative [animation-delay:200ms]">
            <div aria-hidden="true" className="aureola absolute -inset-8 -z-10" />
            <div className="border-border relative aspect-[4/3] overflow-hidden rounded-xl border shadow-[var(--sombra-alta)] sm:aspect-[5/4]">
              <HeroVideo />
            </div>
          </div>
        </div>
      </section>

      {/* `#probar` y no `#afinador`: ese id ya lo lleva el `Panel` del propio
          afinador, que vive dentro de esta sección. Dos elementos con el mismo id
          en el mismo documento es HTML inválido, y el salto del enlace acababa
          donde decidiera el navegador. */}
      <section id="probar" className="border-border border-t">
        <div className={`${ANCHO} ${FRANJA} revelar`}>
          <p className="rotulo">Pruébalo aquí</p>
          <h2 className="font-display text-fluid-title mt-3 tracking-tight">
            Un afinador de verdad, ahora
          </h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Hace falta el micro para escuchar la cuerda y calcular su frecuencia. El sonido se
            analiza en tu equipo: no se graba y no se envía. Es el mismo afinador que hay dentro, no
            una demostración.
          </p>

          <div className="mt-10 max-w-3xl">
            <Tuner />
          </div>

          <p className="text-text-muted mt-4 text-sm">
            Con otra afinación —drop D, DADGAD, open G— entra en{' '}
            <Link href="/afinar" className="enlace">
              la pantalla de afinar
            </Link>
            .
          </p>
        </div>
      </section>

      <section id="pantallas" className="bg-surface">
        <div className={`${ANCHO} ${FRANJA} revelar`}>
          {/* Cuatro, y no tres. Decía «tres pantallas» debajo de cuatro tarjetas
              desde que afinar se separó de componer: quien las cuenta encuentra
              una de más, que es la peor manera de empezar a fiarse de algo. */}
          <h2 className="font-display text-fluid-title tracking-tight">
            Cuatro pantallas, cuatro cosas
          </h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Cada una está hecha para una cosa y trae dentro lo que hace falta para esa cosa. No hay
            que montarse nada ni buscar dónde está lo que quieres.
          </p>

          {/* Cuatro columnas cuando caben, y dos cuando no. En tres, la cuarta
              tarjeta se quedaba sola en una fila con dos tercios de la pantalla
              vacíos al lado. */}
          <div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
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
                <p className="rotulo">
                  <span className="text-brass">{screen.step}</span> — {screen.name}
                </p>
                <h3 className="font-display text-fluid-subtitle mt-2 tracking-tight">
                  {screen.headline}
                </h3>
                <p className="text-text-muted text-fluid-body mt-3 leading-relaxed">
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
        <div
          className={`${ANCHO} ${FRANJA} revelar grid gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`}
        >
          <div>
            <p className="rotulo">La rueda de quintas</p>
            <h2 className="font-display text-fluid-title mt-3 tracking-tight">
              Gira sola hasta tu tonalidad
            </h2>
            <p className="text-text-muted text-fluid-body mt-4 max-w-[60ch] leading-relaxed">
              Mientras tocas, la aplicación acumula las notas que aparecen y calcula en qué
              tonalidad estás. Cuando lo tiene claro, la rueda gira y coloca esa tonalidad arriba
              del todo.
            </p>
            <p className="text-text-muted text-fluid-body mt-3 max-w-[60ch] leading-relaxed">
              A partir de ahí, lo que queda cerca en la rueda es lo que suena natural a
              continuación, y lo que queda lejos es el sitio al que ir cuando quieres que la canción
              se tuerza. Si cambias de tonalidad a mitad de una idea, la rueda vuelve a girar.
            </p>
          </div>

          <LandingWheel />
        </div>
      </section>

      <section className="bg-surface">
        <div className={`${ANCHO} ${FRANJA} revelar`}>
          <p className="rotulo">Grabar lo que tocas</p>
          <h2 className="font-display text-fluid-title mt-3 tracking-tight">
            Dale, tócalo y escúchate
          </h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Desde la pantalla de componer se graba lo que estás tocando sin salir de ella, y al
            parar te suena ahí mismo: lo primero que puedes hacer con una toma es oírla y decidir si
            vale. Si vale, se descarga a tu disco; si no, se tira y se vuelve a intentar. Solo el
            sonido, y no sale de tu equipo.
          </p>
        </div>
      </section>

      <section id="privacidad">
        <div className={`${ANCHO} ${FRANJA} revelar`}>
          <p className="rotulo">Privacidad</p>
          <h2 className="font-display text-fluid-title mt-3 tracking-tight">
            Tu audio no sale de aquí
          </h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            El micrófono se analiza dentro del navegador, en tu ordenador. Nadie escucha lo que
            tocas y no queda ninguna grabación en ningún servidor. Lo que grabas, igual: se guarda
            en la memoria de la pestaña y se descarga desde ahí.
          </p>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Cuando le pides una idea al modelo o le preguntas al profesor, lo único que viaja son
            nombres:
          </p>
          <p className="text-brass-bright mt-4 font-mono text-lg">Am7 · F · C · G</p>
          <p className="text-text-muted text-fluid-body mt-3 max-w-[68ch] leading-relaxed">
            y la tonalidad. Ni un segundo de sonido.
          </p>
        </div>
      </section>

      <section className="bg-surface">
        <div className={`${ANCHO} ${FRANJA} revelar`}>
          <h2 className="font-display text-fluid-title tracking-tight">Preguntas</h2>
          <div className="mt-10 max-w-3xl">
            {QUESTIONS.map((item) => (
              <Disclosure
                key={item.q}
                summary={item.q}
                tone="grande"
                className="border-border border-b py-5"
              >
                <p className="text-text-muted text-fluid-body mt-3 leading-relaxed">{item.a}</p>
              </Disclosure>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className={`${ANCHO} revelar py-28 sm:py-36`}>
          <h2 className="font-display text-fluid-hero max-w-[18ch] leading-[1.05] tracking-[-0.02em] text-balance">
            Coge la guitarra y enciende el micro
          </h2>
          <p className="text-text-muted text-fluid-body mt-6 max-w-[60ch] leading-relaxed">
            Se empieza tocando. Si a los cinco minutos no te aporta nada, cierras la pestaña y no ha
            pasado nada.
          </p>
          <Link
            href="/componer"
            className="bg-brass text-background hover:bg-brass-bright min-h-tap mt-10 inline-flex items-center rounded-md px-7 text-lg font-medium transition-colors active:translate-y-px"
          >
            Empezar a tocar
          </Link>
        </div>
      </section>

      <footer className="border-border text-text-muted border-t">
        {/* Los cinco del pie **también se pulsan con el dedo**. Eran renglones de
            veinte píxeles: en un teléfono, cinco destinos pegados y ninguno con
            alto de dedo es la manera de acabar entrando donde no querías. */}
        <div className={`${ANCHO} flex flex-wrap items-center gap-x-1 gap-y-1 py-6 text-sm`}>
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
