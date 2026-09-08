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
 */
export default function Portada() {
  return (
    <div className="bg-background text-text">
      <header className="border-border bg-surface/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[min(90rem,92vw)] items-center gap-4 px-6 py-3">
          <span className="font-display text-brass-bright text-lg">Caos ordenado</span>
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
          <div className="ml-auto flex items-center gap-3">
            <nav
              aria-label="Secciones"
              className="text-text-muted hidden items-center gap-1 text-sm sm:flex"
            >
              <a
                href="#afinador"
                className="hover:text-text min-h-tap inline-flex items-center px-3"
              >
                Afinador
              </a>
              <a
                href="#pantallas"
                className="hover:text-text min-h-tap inline-flex items-center px-3"
              >
                Pantallas
              </a>
              <a
                href="#privacidad"
                className="hover:text-text min-h-tap inline-flex items-center px-3"
              >
                Privacidad
              </a>
            </nav>
            <Link
              href="/componer"
              className="border-brass-bright text-brass-bright hover:bg-brass-dim/20 min-h-tap inline-flex items-center rounded-md border px-4 text-sm font-medium"
            >
              Abrir
            </Link>
          </div>
        </div>
      </header>

      <section className="border-border relative flex min-h-[calc(100dvh-3.5rem)] items-center overflow-hidden border-b">
        <HeroVideo />

        {/* Dos velos y no uno: el de lado deja el vídeo a la vista por la
            derecha y oscurece solo donde va el texto, y el de abajo cose la
            imagen con el final de la sección. Con un velo plano encima o no se
            lee el titular o no se ve el vídeo. */}
        <div className="from-background via-background/80 absolute inset-0 bg-gradient-to-r from-25% via-65% to-transparent" />
        <div className="from-background/90 absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent" />

        <div className="relative mx-auto w-full max-w-[min(90rem,92vw)] px-6 py-20">
          <h1 className="font-display text-fluid-hero max-w-[16ch] leading-[1.02] text-balance">
            Toca. Aprende. Y que la canción siga.
          </h1>
          <p className="text-text-muted text-fluid-subtitle mt-6 max-w-[42ch] leading-relaxed">
            Te enseña la teoría en unidades cortas y, con lo que llevas tocado, te propone por dónde
            puede seguir tu canción. Te oye por el micro: no hace falta escribir nada, ni que tu
            audio salga de aquí.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/componer"
              className="bg-brass text-background hover:bg-brass-bright px-5 py-2.5 text-base"
            >
              Empezar a tocar
            </Link>
            <a
              href="#afinador"
              className="border-border text-text hover:border-brass-dim border px-5 py-2.5 text-base"
            >
              Probar el afinador
            </a>
          </div>

          <ul className="text-text-muted mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            {CLAIMS.map((claim) => (
              <li key={claim} className="flex items-center gap-2">
                <span aria-hidden="true" className="bg-brass block h-1 w-1 rounded-full" />
                {claim}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="afinador" className="border-border border-b">
        <div className="mx-auto max-w-[min(90rem,92vw)] px-6 py-20">
          <p className="rotulo">Pruébalo aquí</p>
          <h2 className="font-display text-fluid-title mt-3">Un afinador de verdad, ahora</h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Hace falta el micro para escuchar la cuerda y calcular su frecuencia. El sonido se
            analiza en tu equipo: no se graba y no se envía. Es el mismo afinador que hay dentro, no
            una demostración.
          </p>

          <div className="mt-8 max-w-3xl">
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

      <section id="pantallas" className="border-border border-b">
        <div className="mx-auto max-w-[min(90rem,92vw)] px-6 py-20">
          {/* Cuatro, y no tres. Decía «tres pantallas» debajo de cuatro tarjetas
              desde que afinar se separó de componer: quien las cuenta encuentra
              una de más, que es la peor manera de empezar a fiarse de algo. */}
          <h2 className="font-display text-fluid-title">Cuatro pantallas, cuatro cosas</h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Cada una está hecha para una cosa y trae dentro lo que hace falta para esa cosa. No hay
            que montarse nada ni buscar dónde está lo que quieres.
          </p>

          {/* Cuatro columnas cuando caben, y dos cuando no. En tres, la cuarta
              tarjeta se quedaba sola en una fila con dos tercios de la pantalla
              vacíos al lado. */}
          <div className="mt-10 grid gap-10 sm:grid-cols-2 xl:grid-cols-4">
            {SCREENS.map((screen) => (
              // Columna con el enlace empujado abajo: los cuatro textos miden
              // distinto y los cuatro «Abrir» acababan a cuatro alturas, que en
              // una fila de tarjetas se lee como que están descuadradas.
              <article key={screen.href} className="border-border flex flex-col border-t pt-8">
                <p className="rotulo">
                  {screen.step} — {screen.name}
                </p>
                <h3 className="font-display text-fluid-subtitle mt-2">{screen.headline}</h3>
                <p className="text-text-muted text-fluid-body mt-3 leading-relaxed">
                  {screen.body}
                </p>
                <Link
                  href={screen.href}
                  className="enlace min-h-tap mt-auto -ml-2 inline-flex items-center gap-1 self-start px-2 pt-3"
                >
                  Abrir {screen.name.toLowerCase()}
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-border bg-surface border-b">
        <div className="mx-auto grid max-w-[min(90rem,92vw)] gap-10 px-6 py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="rotulo">La rueda de quintas</p>
            <h2 className="font-display text-fluid-title mt-3">Gira sola hasta tu tonalidad</h2>
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

      <section className="border-border border-b">
        <div className="mx-auto max-w-[min(90rem,92vw)] px-6 py-20">
          <p className="rotulo">Grabar lo que tocas</p>
          <h2 className="font-display text-fluid-title mt-3">Dale, tócalo y escúchate</h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Desde la pantalla de componer se graba lo que estás tocando sin salir de ella, y al
            parar te suena ahí mismo: lo primero que puedes hacer con una toma es oírla y decidir si
            vale. Si vale, se descarga a tu disco; si no, se tira y se vuelve a intentar. Solo el
            sonido, y no sale de tu equipo.
          </p>
        </div>
      </section>

      <section id="privacidad" className="border-border bg-surface border-b">
        <div className="mx-auto max-w-[min(90rem,92vw)] px-6 py-20">
          <p className="rotulo">Privacidad</p>
          <h2 className="font-display text-fluid-title mt-3">Tu audio no sale de aquí</h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            El micrófono se analiza dentro del navegador, en tu ordenador. Nadie escucha lo que
            tocas y no queda ninguna grabación en ningún servidor. Lo que grabas, igual: se guarda
            en la memoria de la pestaña y se descarga desde ahí.
          </p>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Cuando le pides una idea al modelo o le preguntas al profesor, lo único que viaja son
            nombres:
          </p>
          <p className="text-brass-bright mt-3 font-mono text-lg">Am7 · F · C · G</p>
          <p className="text-text-muted text-fluid-body mt-3 max-w-[68ch] leading-relaxed">
            y la tonalidad. Ni un segundo de sonido.
          </p>
        </div>
      </section>

      <section className="border-border border-b">
        <div className="mx-auto max-w-[min(90rem,92vw)] px-6 py-20">
          <h2 className="font-display text-fluid-title">Preguntas</h2>
          <div className="mt-8 max-w-3xl">
            {QUESTIONS.map((item) => (
              <Disclosure
                key={item.q}
                summary={item.q}
                tone="grande"
                className="border-border border-b py-4"
              >
                <p className="text-text-muted text-fluid-body mt-3 leading-relaxed">{item.a}</p>
              </Disclosure>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface">
        <div className="mx-auto max-w-[min(90rem,92vw)] px-6 py-24">
          <h2 className="font-display text-fluid-hero max-w-[18ch] leading-[1.05] text-balance">
            Coge la guitarra y enciende el micro
          </h2>
          <p className="text-text-muted text-fluid-body mt-5 max-w-[60ch] leading-relaxed">
            Se empieza tocando. Si a los cinco minutos no te aporta nada, cierras la pestaña y no ha
            pasado nada.
          </p>
          <Link
            href="/componer"
            className="bg-brass text-background hover:bg-brass-bright mt-8 inline-block px-6 py-3 text-lg"
          >
            Empezar a tocar
          </Link>
        </div>
      </section>

      <footer className="border-border text-text-muted border-t">
        {/* Los cinco del pie **también se pulsan con el dedo**. Eran renglones de
            veinte píxeles: en un teléfono, cinco destinos pegados y ninguno con
            alto de dedo es la manera de acabar entrando donde no querías. */}
        <div className="mx-auto flex max-w-[min(90rem,92vw)] flex-wrap items-center gap-x-1 gap-y-1 px-5 py-6 text-sm">
          <span className="font-display text-text min-h-tap mr-3 inline-flex items-center px-1">
            Caos ordenado
          </span>
          <Link
            href="/aprender"
            className="hover:text-text min-h-tap inline-flex items-center px-3"
          >
            Aprender
          </Link>
          <Link
            href="/profesor"
            className="hover:text-text min-h-tap inline-flex items-center px-3"
          >
            Profesor
          </Link>
          <Link
            href="/componer"
            className="hover:text-text min-h-tap inline-flex items-center px-3"
          >
            Componer
          </Link>
          <Link href="/afinar" className="hover:text-text min-h-tap inline-flex items-center px-3">
            Afinar
          </Link>
          <Link href="/planes" className="hover:text-text min-h-tap inline-flex items-center px-3">
            Planes
          </Link>
          <span className="ml-auto px-1">Hecho para tocar de noche</span>
        </div>
      </footer>
    </div>
  );
}
