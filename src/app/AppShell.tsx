'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { AccountMenu } from '@features/account';
import { MicButton } from '@features/workspace';
import { useSessionStore } from '@state/session-store';
import { IconoAfinar, IconoCamino, IconoComponer, IconoProfesor } from '@ui/icons';
import { Mascota } from '@ui/Mascota';
import { ThemeToggle } from '@ui/ThemeToggle';

/**
 * Las pantallas, cada una en su dirección.
 *
 * Cuatro en esta barra desde que aprender se desglosó: el camino, el profesor,
 * componer y afinar. Los planes no están, y no es un olvido: se llega a ellos desde
 * el menú de la cuenta y desde cada candado, que es donde se piensa en pagar, y no
 * es una pantalla en la que se trabaje.
 *
 * Las que tienen partes dentro —`/aprender/una-unidad`, `/aprender/repaso`,
 * `/planes/pro`— también son direcciones propias, así que el botón de atrás del
 * navegador siempre significa lo que parece.
 */
const SCREENS: ReadonlyArray<{
  href: string;
  name: string;
  Icono: () => React.ReactElement;
  summary: string;
}> = [
  {
    href: '/aprender',
    name: 'Aprender',
    Icono: IconoCamino,
    summary: 'El camino: diez cursos, y empiezas por donde quieras.',
  },
  {
    href: '/profesor',
    name: 'Profesor',
    Icono: IconoProfesor,
    summary: 'Pregunta teoría y te la explica con tus acordes.',
  },
  {
    href: '/componer',
    name: 'Componer',
    Icono: IconoComponer,
    summary: 'Tonalidad, acordes, la canción por bloques y grabar lo que tocas.',
  },
  {
    href: '/afinar',
    name: 'Afinar',
    Icono: IconoAfinar,
    summary: 'La afinación que elijas, cuerda a cuerda.',
  },
];

/**
 * El marco: una barra arriba, la navegación abajo en el móvil.
 *
 * **Una barra, no dos.** Componer llegó a tener tres franjas fijas apiladas antes
 * de que empezara la pantalla —la de escuchar, la de grabarse con la cámara y su
 * propio encabezado— y en un portátil eso son ciento setenta píxeles gastados en
 * decir que no está pasando nada. La de la cámara se fue con la cámara
 * ([adr/0023](../../docs/adr/0023-grabar-solo-el-sonido.md)) y la de escuchar es
 * ahora un botón, no una fila.
 *
 * La marca va **a la izquierda**, que es donde se busca el nombre de algo y donde
 * lleva estando desde que hay páginas. Estuvo a la derecha, pegada a la
 * navegación, y allí parecía una pestaña más.
 *
 * Abajo en el móvil porque es donde llega el pulgar, y porque es lo que hace que
 * esto se sienta una aplicación y no una web con un menú. En pantalla grande sube
 * a la cabecera: allí abajo estorbaría y hay sitio de sobra.
 *
 * Lo que suena es de esta pestaña, no de la aplicación entera.
 *
 * **Lo monta una vez el layout de `(marco)`, no cada página.** Montado en cada
 * `page.tsx`, navegar lo desmontaba entero, y con él el botón del micro: el micro
 * se cerraba con la barra diciendo que seguía escuchando. Ahora la barra, el
 * micro abierto y lo cargado del espacio de trabajo pasan de una pantalla a otra.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const actions = useSessionStore((state) => state.actions);
  const pathname = usePathname();

  // La configuración guardada se recupera después de pintar: leerla durante el
  // render daría un HTML distinto en servidor y en cliente. Una vez por carga, y
  // no al cambiar de pantalla: el marco ya no se vuelve a montar.
  useEffect(() => {
    actions.loadWorkspace();
  }, [actions]);

  return (
    // `relative` no es decoración: es lo que impide que la página crezca por
    // debajo de la pantalla.
    //
    // Las etiquetas `sr-only` de Tailwind son `position: absolute`, y un
    // absoluto sin ancestro posicionado se ancla al **documento**. Las de la
    // lista de acordes viven dentro de un contenedor con scroll, así que su
    // posición estática está muy por debajo de lo que se ve: se escapaban del
    // `overflow-hidden` y estiraban el documento casi mil píxeles. La aplicación
    // se iba hacia arriba y debajo quedaba una franja negra vacía.
    //
    // Con esto, cualquier absoluto de dentro se ancla aquí, y aquí se recorta.
    // Vale para los que hay y para los que se escriban.
    //
    // Y se recorta con `overflow-clip`, **no con `overflow-hidden`**, que son
    // dos cosas distintas y la diferencia se paga cara. `hidden` esconde la
    // barra de desplazamiento pero la caja **sigue siendo desplazable por
    // código**: cualquier `scrollIntoView` de dentro —el que trae a la vista el
    // acorde que acabas de poner, por ejemplo— sube el marco entero y no lo baja
    // nadie. Medido en una ventana de 700×600 con una canción escrita: la sala
    // se iba 183 px, la cabecera y la barra de pantallas desaparecían por arriba
    // y debajo quedaba una franja negra. `clip` no es un contenedor de
    // desplazamiento, así que no hay nada que subir.
    <div className="fondo-sala relative flex h-dvh flex-col overflow-clip pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      {/* Lo primero que se tabula, y no se ve hasta que hace falta.

          Antes de esto, llegar al contenido con el teclado costaba ocho paradas
          —el micro, la portada, las cuatro pantallas, el tema y la cuenta—, y se
          repetían en cada página. El destino es `<main>`, que lleva `tabIndex`
          de -1 porque sin eso el foco no se mueve de verdad: salta el scroll y
          la siguiente pulsación sigue en la cabecera.

          Se aparta subiéndolo y no con `sr-only`: el `not-sr-only` que lo trae
          de vuelta al enfocarlo pone `padding: 0`, se comía el relleno y dejaba
          un rótulo de 20 px de alto. Aquí el alto es el de todo lo demás, y lo
          que lo esconde es el `overflow-hidden` del marco. */}
      <a
        href="#contenido"
        className="bg-brass text-background min-h-tap absolute top-2 left-2 z-50 inline-flex -translate-y-20 items-center rounded-md px-4 text-sm font-medium focus:translate-y-0"
      >
        Saltar al contenido
      </a>

      {/* La barra deja ver la sala por detrás, con el velo justo para leer: un
          rectángulo opaco encima de la luz de la bombilla la cortaba en recto. */}
      {/* `@container`: el nombre de la marca se calla por **el ancho de la barra
          medido en rem**, no por el de la ventana. Una consulta de ventana mide
          en los rem de partida del navegador, y con la letra al 200 % la barra
          seguía creyendo que cabía: a 390 px el micro y el tema se salían por la
          derecha. Medida en la caja, la marca se calla cuando de verdad no cabe. */}
      <header className="border-border bg-surface/80 @container flex shrink-0 items-center gap-2 border-b px-3 py-2 backdrop-blur-md sm:gap-3 md:px-4">
        {/* **La marca lleva al profesor delante**, a 32 px —un píxel de pantalla
            por cada uno del dibujo—: es lo que une cada pantalla con la sala de la
            portada, y la válvula es más reconocible de reojo que dos palabras. El
            nombre lo dice el texto, así que el muñeco va decorativo.

            **Y el nombre se calla donde no cabe**, que son dos tramos: por debajo
            de 360 —21 rem de barra sin su relleno, medidos en ella y no en la
            ventana, para que la letra grande también cuente—, con los tres
            botones redondos al lado, y entre 768 y 1023, donde
            sube la navegación entera. En los dos, con la cuenta configurada, la
            barra pedía 44 px más de los que había y se llevaba el botón de la
            cuenta por la derecha —el marco recorta y no desplaza—. Ahí queda el
            muñeco solo, y el nombre sigue siendo el del enlace para quien no ve. */}
        <Link
          href="/"
          className="group text-text hover:text-brass-bright min-h-tap mr-1 inline-flex shrink-0 items-center gap-2 whitespace-nowrap transition-colors"
          title="Volver a la portada"
        >
          <Mascota decorativa className="size-8 shrink-0 drop-shadow-none" />
          <span className="titular text-[0.9375rem] sm:text-base md:max-lg:sr-only @max-[21rem]:sr-only">
            Caos ordenado
          </span>
        </Link>

        {/* Desde 768 y no desde 640, que es donde estaba y no cabía.

            Entre los dos, la barra de arriba salía entera —marca, cuatro
            pantallas con su rótulo y los tres botones redondos— y pedía unos
            setecientos cincuenta píxeles. Lo que sobraba se iba por la derecha,
            y como el marco de la aplicación recorta y no desplaza, **el botón de
            la cuenta dejaba de existir**: en todo el tramo de 640 a 750 no había
            manera de abrir tu cuenta ni de cerrar la sesión. Cae ahí una tableta
            en vertical o media pantalla de un portátil, y también un 1280 con el
            zoom al 200%, que en píxeles CSS son 640.

            No hacía falta inventar nada: la barra de abajo ya es la navegación
            de lo estrecho. Solo estaba cediéndole el sitio demasiado pronto. */}
        <nav aria-label="Pantallas" className="hidden items-center gap-1 md:flex">
          {SCREENS.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              aria-current={isHere(pathname, screen.href) ? 'page' : undefined}
              title={screen.summary}
              // La pantalla en la que estás lleva su piloto encendido, como una
              // pastilla marcada: el mismo «esto es lo que hay ahora» en toda la
              // aplicación, y no un fondo de latón que se confundía con un botón.
              className={`min-h-tap inline-flex items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-150 ${
                isHere(pathname, screen.href)
                  ? 'bg-surface-raised text-brass-bright piloto'
                  : 'text-text-muted hover:bg-surface-raised hover:text-text'
              }`}
            >
              <screen.Icono />
              {screen.name}
            </Link>
          ))}
        </nav>

        {/* Reconocer acordes solo donde sirve: en componer. Y anunciar la nota
            donde nadie más lo hace: el afinador ya la dice con su consejo. */}
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <MicButton chords={pathname === '/componer'} anuncia={pathname !== '/afinar'} />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      {/* **Por debajo de 500 px de alto, el contenido se deja desplazar.** Cada
          pantalla reparte su alto por dentro y aquí no hace falta, salvo en una
          ventana tan baja que lo que flota no cabe: el panel de la tonalidad
          tiene suelo (`ui/Disclosure`) y a 320×256 —un 1280×1024 al 400 %— pasa
          del borde. Recortado, la rueda estaba abierta y no se podía alcanzar;
          desplazable, se baja hasta ella. Por encima de 500 sigue recortando,
          que es lo que hace que cada pantalla mida lo que mide la ventana. */}
      <main
        id="contenido"
        tabIndex={-1}
        className="min-h-0 grow overflow-hidden [@media(max-height:500px)]:overflow-y-auto"
      >
        {children}
      </main>

      {/* La misma navegación, abajo y con icono, solo en pantalla estrecha. Va en un
          `nav` distinto con su propio nombre para que un lector de pantalla no
          anuncie dos veces la misma lista. */}
      {/* **Se pliega a solo iconos en dos casos**, y en los dos el rótulo se
          sigue leyendo para quien no ve (`sr-only`):

          - **Una ventana de menos de 500 px de alto**, que es un teléfono
            tumbado o un zoom grande. La barra medía 65 px de los 256 que quedan a
            320×256, y con el rótulo debajo de cada icono era la cuarta parte de
            la pantalla diciendo dónde ir. Plegada mide lo de un dedo, 44.
          - **La barra con menos de 16 rem de ancho**, que solo pasa con la letra
            grande: al 200 %, a 390 px, los cuatro rótulos no cabían y «Afinar»
            se salía por la derecha. Se mide en la barra (`@container`) y no en
            la ventana por lo mismo que la marca de arriba: la consulta de ventana
            no se entera de la letra. */}
      <nav
        aria-label="Pantallas, abajo"
        className="border-border bg-surface/90 @container flex shrink-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        {SCREENS.map((screen) => (
          <Link
            key={screen.href}
            href={screen.href}
            aria-current={isHere(pathname, screen.href) ? 'page' : undefined}
            className={`min-h-tap flex grow basis-0 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors duration-150 [@media(max-height:500px)]:py-0 ${
              isHere(pathname, screen.href) ? 'text-brass-bright piloto' : 'text-text-muted'
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex min-h-7 items-center rounded-full px-4 transition-colors duration-150 @max-[16rem]:px-2 ${
                isHere(pathname, screen.href) ? 'bg-surface-raised' : ''
              }`}
            >
              <screen.Icono />
            </span>
            <span className="@max-[16rem]:sr-only [@media(max-height:500px)]:sr-only">
              {screen.name}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/**
 * Si estamos en esa pantalla o en algo de dentro.
 *
 * Comparar la dirección entera dejaría «Aprender» apagado mientras se hace una
 * unidad, que es justo cuando más falta hace saber dónde estás.
 */
function isHere(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
