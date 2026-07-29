import type { Metadata } from 'next';
import Link from 'next/link';

import { Tuner } from '@features/tuner';

import { HeroVideo } from './HeroVideo';
import { LandingWheel } from './LandingWheel';

export const metadata: Metadata = {
  title: 'Caos ordenado — toca y la teoría se ordena sola',
  description:
    'Escucha lo que sale de tu guitarra y te devuelve la nota, el acorde y la tonalidad mientras suenan. En el navegador, sin cuenta y sin mandar tu audio a ninguna parte.',
};

const CLAIMS: readonly string[] = [
  '440 Hz · ±1 cent',
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
    headline: 'Teoría con los acordes que tienes debajo de los dedos',
    body: 'Cinco lecciones que se escriben en la tonalidad en la que estés, no en un C mayor de libro. Cada una pregunta, y al contestar te dice por qué, aciertes o falles. Al lado hay un profesor al que preguntarle lo que sea, y debajo la escala para tocarla de verdad: la aplicación oye si la nota ha sonado limpia antes de pasar a la siguiente.',
  },
  {
    href: '/componer',
    step: '02',
    name: 'Componer',
    headline: 'Guarda la idea antes de que se te olvide',
    body: 'Eliges la tonalidad en la rueda y encadenas acordes. De cada uno ves sus notas, hasta seis formas de hacerlo a lo largo del mástil y a dónde puedes ir desde ahí, con un punto verde, ámbar o rojo según cuánto se salga. Puedes buscar un acorde por su cifrado y te dice si entra, si cabe como color o si se va fuera.',
  },
  {
    href: '/afinar',
    step: '03',
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
    a: 'Lo que escucha el micro es una nota cada vez: el análisis busca una sola altura y con un acorde rasgueado se queda con la más clara. Los acordes los llevas tú, marcándolos al pulsarlos, y con eso la aplicación deduce la tonalidad y te propone por dónde seguir.',
  },
  {
    q: '¿Hace falta saber teoría?',
    a: 'No. Puedes tocar y leer los nombres que van saliendo; la explicación está ahí cuando la quieras y se calla cuando no.',
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
          <nav
            aria-label="Secciones"
            className="text-text-muted ml-auto hidden gap-4 text-sm sm:flex"
          >
            <a href="#afinador" className="hover:text-text">
              Afinador
            </a>
            <a href="#pantallas" className="hover:text-text">
              Pantallas
            </a>
            <a href="#privacidad" className="hover:text-text">
              Privacidad
            </a>
          </nav>
          <Link
            href="/componer"
            className="border-brass-bright text-brass-bright hover:bg-brass-dim/20 border px-3 py-1 font-mono text-xs"
          >
            Abrir
          </Link>
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
            Toca. La teoría se ordena sola.
          </h1>
          <p className="text-text-muted text-fluid-subtitle mt-6 max-w-[42ch] leading-relaxed">
            Escucha lo que sale de tu guitarra y te devuelve la nota, el acorde y la tonalidad
            mientras suenan. En el navegador, sin cuenta y sin mandar tu audio a ninguna parte.
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

          <ul className="text-text-muted mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs">
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
          <p className="text-text-muted font-mono text-xs tracking-widest uppercase">
            Pruébalo aquí
          </p>
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
            <Link href="/afinar" className="text-brass-bright underline underline-offset-4">
              la pantalla de afinar
            </Link>
            .
          </p>
        </div>
      </section>

      <section id="pantallas" className="border-border border-b">
        <div className="mx-auto max-w-[min(90rem,92vw)] px-6 py-20">
          <h2 className="font-display text-fluid-title">Tres pantallas, tres cosas</h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Cada una está hecha para una cosa y trae dentro lo que hace falta para esa cosa. No hay
            que montarse nada ni buscar dónde está lo que quieres.
          </p>

          <div className="mt-10 grid gap-10 lg:grid-cols-3">
            {SCREENS.map((screen) => (
              <article key={screen.href} className="border-border border-t pt-8">
                <p className="text-text-muted font-mono text-xs tracking-widest uppercase">
                  {screen.step} — {screen.name}
                </p>
                <h3 className="font-display text-fluid-subtitle mt-2">{screen.headline}</h3>
                <p className="text-text-muted text-fluid-body mt-3 leading-relaxed">
                  {screen.body}
                </p>
                <Link
                  href={screen.href}
                  className="text-brass-bright mt-4 inline-block underline underline-offset-4"
                >
                  Abrir {screen.name.toLowerCase()}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-border bg-surface border-b">
        <div className="mx-auto grid max-w-[min(90rem,92vw)] gap-10 px-6 py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-text-muted font-mono text-xs tracking-widest uppercase">
              La rueda de quintas
            </p>
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
          <p className="text-text-muted font-mono text-xs tracking-widest uppercase">
            Grabarte tocando
          </p>
          <h2 className="font-display text-fluid-title mt-3">
            Con la cámara puesta, si te apetece
          </h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            Desde la pantalla de componer puedes grabarte mientras tocas. La cámara se pone detrás
            de todo y la interfaz se queda en contorno y letra, así que te ves sin dejar de leer los
            acordes y hacia dónde puedes ir. El archivo se guarda en tu disco cuando pulsas
            descargar; si no lo haces, desaparece al cerrar la pestaña.
          </p>
        </div>
      </section>

      <section id="privacidad" className="border-border bg-surface border-b">
        <div className="mx-auto max-w-[min(90rem,92vw)] px-6 py-20">
          <p className="text-text-muted font-mono text-xs tracking-widest uppercase">Privacidad</p>
          <h2 className="font-display text-fluid-title mt-3">Tu audio no sale de aquí</h2>
          <p className="text-text-muted text-fluid-body mt-4 max-w-[68ch] leading-relaxed">
            El micrófono se analiza dentro del navegador, en tu ordenador. Nadie escucha lo que
            tocas y no queda ninguna grabación en ningún servidor. El vídeo, igual: se compone en tu
            equipo y se descarga desde ahí.
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
              <details key={item.q} className="border-border border-b py-4">
                <summary className="text-text text-fluid-subtitle cursor-pointer">{item.q}</summary>
                <p className="text-text-muted text-fluid-body mt-3 leading-relaxed">{item.a}</p>
              </details>
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
        <div className="mx-auto flex max-w-[min(90rem,92vw)] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 text-sm">
          <span className="font-display text-text">Caos ordenado</span>
          <Link href="/aprender" className="hover:text-text">
            Aprender
          </Link>
          <Link href="/componer" className="hover:text-text">
            Componer
          </Link>
          <Link href="/afinar" className="hover:text-text">
            Afinar
          </Link>
          <span className="ml-auto">Hecho para tocar de noche</span>
        </div>
      </footer>
    </div>
  );
}
