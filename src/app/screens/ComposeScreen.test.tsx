// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pitchClassFromName, writtenBlock } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { selectReparto, useBancoStore } from '@state/banco';
import { useClaqueta } from '@state/claqueta';
import { useSessionStore } from '@state/session-store';
import {
  DEFAULT_BANCO,
  loadPreferences,
  REPARTOS_DE_FABRICA,
  savePreferences,
} from '@state/workspace';

import { ComposeScreen } from './ComposeScreen';

// Tocando llega en diferido (adr/0058): con la suite entera y la cobertura, su trozo
// tarda más que el segundo que `findBy` espera de serie, y el test caía sin fallo.
const LO_DIFERIDO = { timeout: 5_000 };

// **El lienzo de verdad solo lo carga su propio test.** Vitest reutiliza cada
// proceso para varios ficheros, y si en uno caían dos que cargaban
// `ArrangeCanvas.tsx`, V8 tenía dos copias del mismo módulo y al juntar la
// cobertura se quedaba con las cuentas de una: las ramas bajaban al 90 % una
// pasada de cada dos, con todos los tests en verde. Aquí basta con que llegue.
vi.mock('@features/arrange/ArrangeCanvas', async () => {
  const { createElement } = await import('react');
  return {
    ArrangeCanvas: () => createElement('button', { type: 'button' }, 'Escuchar la canción'),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => '/componer',
}));

/**
 * Se limpia el almacenamiento, no solo el estado.
 *
 * Desde que la tonalidad se recuerda, `reset()` no basta: la pantalla llama a
 * `loadWorkspace` al montarse y volvería a poner la que dejó puesta el test
 * anterior. Es el mismo motivo por el que existe la persistencia, visto desde el
 * otro lado.
 */
/** El reparto de fábrica de antes de adr/0109: escribiendo, el acorde abierto. */
const REPARTOS_ANTERIORES = {
  ...REPARTOS_DE_FABRICA,
  escribir: { ...REPARTOS_DE_FABRICA.escribir, plegadas: ['izquierda', 'camino'] as const },
};

beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().actions.reset();
  // Y el reparto, que vive fuera de `localStorage` una vez cargado: sin esto
  // una prueba abre un editor y la siguiente se lo encuentra abierto.
  //
  // **Guardado como lo dejaba la versión de antes**: entrando por tocando y con
  // el acorde abierto al escribir. Casi todas se escribieron así y lo que miran
  // es el banco, no por dónde se entra; eso lo dice «Las areas del banco», que
  // parte de nada guardado. De paso prueba que lo guardado se respeta.
  const banco = { espacio: 'tocando' as const, repartos: REPARTOS_ANTERIORES };
  savePreferences({ ...loadPreferences(), banco });
  useBancoStore.setState(banco);
});

/**
 * Lo que se prueba aquí es **qué se sacrifica en el móvil**, que es una decisión y
 * no un detalle de estilo. jsdom no tiene ancho de pantalla de verdad, así que se
 * comprueba la regla escrita: qué lleva `sm:`/`lg:` y qué no.
 */
describe('Componer en una pantalla estrecha', () => {
  /**
   * **Grabar dejó de ser una herramienta y pasó a ser un papel de la toma.**
   *
   * Primero fue una franja fija arriba, con vídeo; al quedarse en solo sonido bajó
   * a una pastilla de la fila de abajo
   * ([adr/0023](../../../docs/adr/0023-grabar-solo-el-sonido.md)). Y ahí hacía lo
   * mismo que «Tocando» menos transcribir —su reproductor, su descarga y **su
   * propio micrófono**—, así que lo único suyo, no escribir en la canción, se ha
   * ido donde vive lo demás: al papel de la toma
   * ([adr/0056](../../../docs/adr/0056-grabar-es-un-papel-de-la-toma.md)).
   *
   * Lo que se prueba aquí es que **ya no está en la fila de abajo**, que es lo que
   * libera una pastilla de una barra que no cabe en ningún móvil.
   */
  it('grabar ya no es una pastilla de la fila de abajo', () => {
    render(<ComposeScreen />);

    const abajo = screen.getByRole('region', { name: 'Qué se ve abajo' });
    expect(within(abajo).queryByRole('button', { name: 'Grabar' })).not.toBeInTheDocument();
  });

  /**
   * Y está donde se toca, en cualquier ancho: es el tercer papel de la toma.
   *
   * Con tonalidad puesta, porque `/componer` la pide antes que nada: sin ella la
   * pantalla entera es la rueda. Eso es lo único del grabador suelto que **no** se
   * ha podido conservar, y está dicho en
   * [adr/0056](../../../docs/adr/0056-grabar-es-un-papel-de-la-toma.md).
   */
  it('grabar sin escribir es un papel de la toma', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    // Tocando llega en diferido: se entra por escribir (adr/0058, adr/0109).
    expect(
      await screen.findByRole('button', { name: 'Solo grabar' }, LO_DIFERIDO),
    ).toBeInTheDocument();
  });

  /**
   * La rueda ocupa media pantalla de teléfono y se toca una vez, al elegir tono.
   * Plegada deja a la vista lo que se mira todo el rato: el acorde y a dónde ir.
   */
  it('la tonalidad se pliega en móvil y se despliega en pantalla ancha', () => {
    const { container } = render(<ComposeScreen />);

    const plegable = container.querySelector('.lg\\:hidden details');
    expect(plegable, 'falta el plegable de tonalidad del móvil').not.toBeNull();

    const columna = screen.getByLabelText('Tonalidad');
    expect(columna.className, 'la columna de la rueda es solo de pantalla ancha').toContain(
      'lg:flex',
    );
    expect(columna.className).toContain('hidden');
  });

  /**
   * El título y el metrónomo comparten fila.
   *
   * Eran dos franjas fijas de unos 110 px juntas, y en un portátil eso es justo
   * lo que le falta al mástil para verse entero. La pantalla sigue teniendo su
   * `h1` y su línea —que es lo que pide la regla—; lo que se fue es la fila.
   */
  it('el metrónomo va en el encabezado, no en una franja propia', () => {
    const { container } = render(<ComposeScreen />);

    const encabezado = container.querySelector('h1')?.parentElement;
    expect(encabezado?.textContent, 'el metrónomo no está en la fila del título').toContain('bpm');
  });
});

/**
 * El banco de trabajo.
 *
 * Lo que se prueba aquí es **que no hay que elegir**: antes eran dos caras con un
 * conmutador, y ver el acorde mientras escribías la canción costaba un salto y
 * volver a encontrar dónde estabas
 * ([adr/0031](../../../docs/adr/0031-componer-es-un-banco-de-trabajo.md)).
 */
describe('Las areas del banco', () => {
  /**
   * Con tonalidad y **en `Escribir`**: se entra por `Tocando`, que es donde se
   * empieza una canción, y allí el centro es el micro y no el arreglo.
   */
  function conTonalidad(): void {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
  }

  /**
   * En estrecho, la barra de la tonalidad **flota sobre la pantalla y se abre
   * sola** mientras no hay ninguna puesta, así que en un teléfono el estado
   * vacío de componer —con sus cuatro tonalidades y el micro— quedaba entero
   * detrás del panel: los atajos para quien no sabe cuál elegir eran justo lo
   * inalcanzable. Van dentro de la barra, y se turnan con los ajustes porque el
   * estilo y la escala no deciden nada hasta que hay tonalidad.
   */
  // Dos: el de la barra de estrecho y el del estado vacío del centro, que es el
  // de ancho. Conviven en el árbol y el CSS enseña uno; lo que importa aquí es
  // que el de la barra exista, porque es el que estaba tapado. En estrecho, el
  // otro se apaga mientras el panel lo tapa —más abajo se comprueba—, así que no
  // hay dos juegos vivos a la vez.
  it('sin tonalidad, la barra de estrecho ofrece cuatro con las que empezar', () => {
    render(<ComposeScreen />);

    expect(screen.getAllByRole('group', { name: 'Tonalidades para empezar' })).toHaveLength(2);
  });

  // Y se van en cuanto hay una: entonces el sitio es de los ajustes, que ya
  // deciden sobre algo.
  it('y con tonalidad puesta se quitan de en medio', () => {
    conTonalidad();

    render(<ComposeScreen />);

    expect(screen.queryAllByRole('group', { name: 'Tonalidades para empezar' })).toHaveLength(0);
  });

  /**
   * **Por donde se entra, sin nada guardado: escribiendo, con solo la canción.**
   * Se entraba por tocando, y lo que se apuntaba lo decidía el reconocedor de
   * acordes, que con una guitarra de verdad duda: la primera canción de alguien
   * no puede empezar por un acorde que no tocó (adr/0109). Lo primero que se lee
   * es qué hacer: la canción está en blanco y se pulsa un acorde.
   */
  it('se entra por escribir, con solo la cancion abierta', () => {
    localStorage.clear();
    useBancoStore.setState({ espacio: DEFAULT_BANCO.espacio, repartos: DEFAULT_BANCO.repartos });
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    render(<ComposeScreen />);

    expect(screen.getByLabelText('Arreglo')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tocando' })).not.toBeInTheDocument();
    // El acorde, plegado a su tira: se abre con un clic.
    expect(selectReparto(useBancoStore.getState()).plegadas).toContain('derecha');
  });

  // Tocar sigue a un clic, y con lo guardado se vuelve a donde se estaba.
  it('con tocando guardado, se vuelve a tocando', () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    render(<ComposeScreen />);

    // Por región y no por etiqueta: «Tocando» es a la vez el área y la pastilla
    // que la abre, y las dos tienen ese nombre a propósito.
    expect(screen.getByRole('region', { name: 'Tocando' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Arreglo' })).not.toBeInTheDocument();
  });

  it('y de ahi se pasa a escribir, que es la misma cancion por bloques', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Escribir' }));

    expect(screen.getByLabelText('Arreglo')).toBeInTheDocument();
  });

  it('la cancion y el acorde se ven a la vez', () => {
    conTonalidad();

    render(<ComposeScreen />);

    expect(screen.getByLabelText('Arreglo')).toBeInTheDocument();
    expect(screen.getByLabelText('Acorde')).toBeInTheDocument();
    // La tonalidad viene plegada en este espacio: el tono se elige una vez, y
    // su tira sigue ahí para volver a abrirla de un clic.
    expect(screen.getByRole('button', { name: 'Desplegar Tonalidad' })).toBeInTheDocument();
  });

  /**
   * «A dónde ir» también viene plegada, y ésa no es por sitio: **el lienzo ya
   * lleva su propia lista de acordes**. Abiertas las dos, «Para empezar» y «Por
   * dónde empezar» son la misma lista dos veces en la misma pantalla
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
   */
  it('a donde ir viene plegada, y su tira la devuelve', async () => {
    conTonalidad();

    render(<ComposeScreen />);

    expect(screen.queryByLabelText('A dónde ir')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar A dónde ir' }));

    expect(screen.getByLabelText('A dónde ir')).toBeInTheDocument();
  });

  // Ya no hay conmutador: es lo que se retira, y si volviera sin querer este
  // test lo diría.
  it('no queda conmutador entre dos caras', () => {
    conTonalidad();

    render(<ComposeScreen />);

    expect(screen.queryByRole('group', { name: 'Cómo componer' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Espacio de trabajo' })).toBeInTheDocument();
  });

  /**
   * Cada área lleva su cabecera con su nombre: es lo que sustituye a los rótulos
   * sueltos encima de cada bloque, y lo que hace que los mandos de una cosa vivan
   * en esa cosa.
   */
  it('cada area lleva su cabecera con su nombre', async () => {
    conTonalidad();

    render(<ComposeScreen />);
    // «A dónde ir» viene plegada en este espacio, y una plegada solo enseña su
    // tira: hay que abrirla para mirarle la cabecera.
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar A dónde ir' }));

    for (const nombre of ['Arreglo', 'Acorde', 'A dónde ir']) {
      expect(
        within(screen.getByLabelText(nombre)).getByRole('heading', { name: nombre }),
      ).toBeInTheDocument();
    }
  });

  /**
   * Sin tonalidad no hay nada que inspeccionar, así que la pantalla dice **una
   * sola cosa**. Tres paneles repitiendo cada uno su versión de «elige una
   * tonalidad» se leen como una pantalla rota, no como una que espera.
   */
  it('sin tonalidad, solo se dice por donde empezar', () => {
    useSessionStore.getState().actions.reset();
    useBancoStore.getState().actions.espacio('escribir');

    render(<ComposeScreen />);

    expect(screen.getByLabelText('Arreglo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Acorde')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('A dónde ir')).not.toBeInTheDocument();
  });
});

/**
 * Los divisores.
 *
 * Se prueba el teclado y no el arrastre: jsdom no tiene punteros de verdad, y lo
 * que de verdad se olvida al escribir un divisor es que se pueda mover sin
 * ratón. Un editor que solo se reparte arrastrando es un editor a medias.
 */
/**
 * Lo que la rueda tapa deja de existir para el teclado y para un lector.
 *
 * Por debajo de `lg` la barra de tonalidad flota y se abre ella sola mientras no
 * hay tonalidad: ocupa de la barra al final de la pantalla, y detrás quedan el
 * estado vacío del centro y la barra de herramientas de abajo. No se ven, pero
 * seguían recibiendo el foco —doce paradas seguidas del tabulador sobre
 * controles invisibles, medido en un teléfono de verdad— y anunciándose, con lo
 * que se leían dos veces las mismas cuatro tonalidades.
 *
 * jsdom no tiene ancho, así que el `matchMedia` se dobla para contestar que no
 * hay banco, que es lo que pasa en un teléfono.
 */
/**
 * Las pestañas de estrecho, que enseñan un área cada una.
 *
 * El arreglo y «a dónde ir» viven en la **misma caja**, y esa caja miraba solo a
 * la pestaña del arreglo: al elegir «A dónde ir» se escondía entera y con ella el
 * área que se acababa de pedir. En un teléfono, la pestaña dejaba una pantalla en
 * negro —la región existía, con su lista dentro, en una caja de 0×0—.
 */
describe('Las pestañas de una pantalla estrecha', () => {
  function enEstrecho() {
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('la de «a donde ir» ensena lo suyo, y no una pantalla vacia', async () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'A dónde ir' }));

    const area = screen.getByLabelText('A dónde ir');

    expect(area).toBeInTheDocument();
    // Y lo que hay dentro es la lista, no una caja vacía: el buscador es lo
    // primero que se ve al abrirla.
    expect(within(area).getByRole('combobox', { name: 'Buscar un acorde' })).toBeInTheDocument();
    // La caja que las guarda a las dos no puede estar escondida. En estrecho se
    // esconde con `max-lg:hidden`, para que la primera pintura no espere a
    // saber el ancho.
    expect(area.closest('.hidden, .max-lg\\:hidden')).toBeNull();
  });

  it('y con la del arreglo puesta, el arreglo es el que se ve', async () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    // La pestaña del arreglo se llama como el espacio en el que estés.
    useBancoStore.getState().actions.espacio('escribir');

    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'A dónde ir' }));
    // El espacio es también la pestaña de su área: no hay una «Arreglo» aparte
    // que repita lo que ya dice «Escribir».
    await userEvent.click(screen.getByRole('button', { name: 'Escribir' }));

    expect(screen.getByLabelText('Arreglo').closest('.hidden, .max-lg\\:hidden')).toBeNull();
  });
});

/**
 * **En un teléfono el mástil es una hoja, no una franja.** Abajo, en su área,
 * le tocaba el ancho de la pantalla y su proporción lo dejaba en 102 px de alto
 * a 390 —dianas de 9 px y letras de 6—. Como hoja flota encima de todo, con el
 * mismo `popover` que «Más» (adr/0065), y dentro el dibujo va a tamaño de
 * lectura y se arrastra de lado.
 */
describe('El mástil en una pantalla estrecha', () => {
  function enEstrecho() {
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
  });

  it('no vuelve a abrir una hoja que ya está abierta (el doble efecto de desarrollo)', () => {
    enEstrecho();
    const abrir = vi.fn();
    HTMLElement.prototype.showPopover = abrir;
    // Solo se finge el estado abierto; el resto de selectores sigue siendo el
    // de verdad, que es el que usa Testing Library para buscar por papel.
    const deVerdad = Element.prototype.matches;
    const abierta = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ':popover-open' || deVerdad.call(this, selector);
    });
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    const lista = screen.getByRole('region', { hidden: true, name: 'Qué se ve abajo' });
    fireEvent.click(within(lista).getByRole('button', { hidden: true, name: 'Mástil' }));

    expect(document.querySelector('[data-hoja-del-mastil]')).not.toBeNull();
    abierta.mockRestore();
    expect(abrir).not.toHaveBeenCalled();
  });

  it('se abre como hoja flotante, con su escala y su cierre dentro', async () => {
    enEstrecho();
    // Abrirla de verdad: jsdom no trae la API, y desde la 30.1 no deja enfocar
    // nada dentro de un `popover` cerrado —el `display: none` de su hoja de
    // estilos—, igual que el navegador. Sin esto el foco no podría entrar.
    const abrir = vi.fn(function (this: HTMLElement) {
      this.style.display = 'block';
    });
    HTMLElement.prototype.showPopover = abrir;
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    const lista = screen.getByRole('region', { hidden: true, name: 'Qué se ve abajo' });
    fireEvent.click(within(lista).getByRole('button', { hidden: true, name: 'Mástil' }));

    const hoja = document.querySelector<HTMLElement>('[data-hoja-del-mastil]')!;
    expect(hoja).toHaveAttribute('popover', 'auto');
    expect(abrir).toHaveBeenCalled();
    const area = await within(hoja).findByRole('region', { hidden: true, name: 'Mástil' });
    // Los rótulos llegan en diferido con el panel (adr/0058).
    expect(
      await within(area).findByRole('combobox', { hidden: true, name: 'Escala' }),
    ).toBeInTheDocument();
    expect(
      within(area).getByRole('button', { hidden: true, name: 'Cerrar Mástil' }),
    ).toBeInTheDocument();
    // Y el dibujo va a tamaño de lectura y se arrastra de lado, en vez de
    // encogerse al ancho del teléfono.
    const dibujo = await within(area).findByRole('img', { hidden: true, name: /mástil de/i });
    const hueco = dibujo.parentElement!.parentElement!;
    expect(hueco.style.height).toBe('18rem');
    expect(hueco.parentElement).toHaveClass('overflow-x-auto', 'hay-mas-al-lado');
    // Sin clase de `display`: una pisaría el `display: none` del popover cerrado.
    expect([...hoja.classList].some((clase) => /^(flex|block|grid|inline)/.test(clase))).toBe(
      false,
    );
    // El foco entra con la hoja (adr/0084).
    expect(hoja.contains(document.activeElement)).toBe(true);
  });

  it('cerrarla por su cuenta cierra el area, y cerrar el area la quita', async () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);
    const lista = screen.getByRole('region', { hidden: true, name: 'Qué se ve abajo' });
    fireEvent.click(within(lista).getByRole('button', { hidden: true, name: 'Mástil' }));
    const hoja = document.querySelector<HTMLElement>('[data-hoja-del-mastil]')!;

    // Escape o un toque fuera: el navegador la cierra y lo dice con `toggle`.
    fireEvent(hoja, Object.assign(new Event('toggle', { bubbles: false }), { newState: 'closed' }));

    expect(selectReparto(useBancoStore.getState()).abajo).toBeNull();
    expect(document.querySelector('[data-hoja-del-mastil]')).toBeNull();

    fireEvent.click(within(lista).getByRole('button', { hidden: true, name: 'Mástil' }));
    const hoja2 = document.querySelector<HTMLElement>('[data-hoja-del-mastil]')!;
    // Abrirse, sin cerrarse, no toca el reparto.
    fireEvent(hoja2, Object.assign(new Event('toggle'), { newState: 'open' }));
    expect(selectReparto(useBancoStore.getState()).abajo).toBe('mastil');
    await userEvent.click(
      within(hoja2).getByRole('button', { hidden: true, name: 'Cerrar Mástil' }),
    );
    expect(document.querySelector('[data-hoja-del-mastil]')).toBeNull();
  });

  // Lo demás de la bandeja es texto, y el texto se lee en una franja de abajo.
  it('las sesiones siguen abriendose abajo, en su area', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);
    const lista = screen.getByRole('region', { hidden: true, name: 'Qué se ve abajo' });

    fireEvent.click(within(lista).getByRole('button', { hidden: true, name: 'Sesiones' }));

    expect(document.querySelector('[data-hoja-del-mastil]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Sesiones' })).toBeInTheDocument();
  });
});

/**
 * La fila de arriba, en los tres anchos que la cambian.
 */
describe('La fila de mandos de arriba', () => {
  function enEstrecho() {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * **En un teléfono, los espacios dicen su nombre.** Iban solo con icono para
   * que asomaran las pestañas, y lo que asomaba eran tres dibujos que nadie
   * sabía nombrar: el de en medio es el mismo que «Componer» en la barra de
   * abajo. Son el concepto central (adr/0034); el icono es lo que se esconde.
   */
  it('los espacios llevan el nombre a la vista en todos los anchos, y el icono desde sm', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);
    const grupo = screen.getByRole('group', { name: 'Espacio de trabajo' });

    for (const nombre of ['Tocando', 'Escribir', 'Ensayar']) {
      const boton = within(grupo).getByRole('button', { name: nombre });
      const texto = [...boton.childNodes].find((nodo) => nodo.nodeType === Node.TEXT_NODE);
      expect(texto?.textContent).toBe(nombre);
      expect(boton.querySelector('svg')!.closest('.max-sm\\:hidden')).not.toBeNull();
      expect(boton).toHaveClass('max-sm:px-2');
    }
  });

  /**
   * **Entre `sm` y `lg`, dos filas y nada que arrastrar**: los espacios y las
   * pestañas arriba; el metrónomo, la tonalidad y «Más» abajo. Desplazándose, la
   * fila se cortaba contra el título sin pista —«Componer ▌nsayar»—.
   */
  it('entre sm y lg la fila se parte en dos, y en un telefono se desplaza', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    const { container } = render(<ComposeScreen />);
    const fila = container.querySelector<HTMLElement>('.hay-mas-al-lado')!;

    expect(fila).toHaveClass('max-sm:overflow-x-auto', 'sm:max-lg:flex-wrap');
    expect(fila).not.toHaveClass('max-lg:overflow-x-auto');
    const salto = container.querySelector('[data-salto]')!;
    expect(salto).toHaveClass('hidden', 'basis-full', 'sm:max-lg:block');
    // El salto va entre las pestañas y el metrónomo, y la raya de en medio
    // sobra donde ya separa la fila.
    expect(salto.previousElementSibling).toBe(
      screen.getByRole('group', { name: 'Espacio de trabajo' }),
    );
    expect(salto.nextElementSibling).toHaveAttribute('data-separador');
    expect(salto.nextElementSibling).toHaveClass('sm:max-lg:hidden');
  });

  /**
   * **La tonalidad y «Más», quietos y a la vista.** Iban dentro de la tira que
   * se desplaza, detrás del metrónomo: a 390 empezaban en x=564, fuera de la
   * pantalla. Lo que mide cuánto se ve es la sonda de `arrancar`; aquí, que no
   * vuelvan a meterse en la tira.
   */
  it('en un telefono, la tonalidad y «Más» van fuera de la tira que se desplaza', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    const { container } = render(<ComposeScreen />);
    const tira = container.querySelector<HTMLElement>('.hay-mas-al-lado')!;
    const mas = screen.getByRole('button', { name: 'Más' });
    // La de la cabecera es la que abre su panel; las otras son de la rueda.
    const tonalidad = screen
      .getAllByRole('button', { name: /C mayor/ })
      .find((boton) => boton.hasAttribute('popovertarget'))!;

    expect(tira).not.toContainElement(mas);
    expect(tira).not.toContainElement(tonalidad);
    expect(mas.parentElement).toBe(tonalidad.parentElement);
    expect(mas.parentElement).toHaveClass('shrink-0');
  });

  /**
   * **Lo tapado por la rueda se ve tapado.** `inert` quitaba el foco y la voz y
   * nada a la vista: los atajos de tonalidad seguían a todo color detrás de la
   * rueda. Va con la variante `inert:`, que es la misma clase con y sin velo:
   * la primera pintura no cambia al hidratar (adr/0083).
   */
  it('lo inerte detras de la rueda va atenuado con una clase que no cambia', () => {
    enEstrecho();
    const { container } = render(<ComposeScreen />);

    const inertes = container.querySelectorAll('[inert]');
    expect(inertes.length).toBeGreaterThan(0);
    for (const caja of inertes) {
      expect(caja).toHaveClass('inert:opacity-50', 'inert:saturate-50');
    }
  });
});

/**
 * **El arreglo tiene suelo de verdad, también con el mástil abierto.** Cedía
 * hasta ocho rem y, con las cinco áreas abiertas, la canción se quedaba en
 * 128 px de 900 —un 14 %— debajo de un cajón de «a dónde ir» de 384: los dos
 * eran `min-height` y el flex no sabe cuál importa. El que cede es el cajón,
 * que se desplaza por dentro.
 */
describe('El reparto con el area de abajo abierta', () => {
  it('el arreglo conserva su suelo y «a donde ir» pierde el suyo', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
    useBancoStore.getState().actions.plegar('camino');
    render(<ComposeScreen />);
    const arreglo = screen.getByRole('region', { name: 'Arreglo' });
    const camino = screen.getByRole('region', { name: 'A dónde ir' });
    // Los tramos por alto de ventana: `[@media(...)]:min-h-…`.
    expect(camino.className).toMatch(/\]:min-h-/);

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));

    expect(screen.getByRole('region', { name: 'Arreglo' })).toHaveClass(
      'lg:min-h-56',
      'xl:min-h-44',
      // En una ventana baja cede él, para que el mástil no baje de sus 14 rem.
      'lg:[@media(max-height:699px)]:min-h-24',
    );
    expect(arreglo).not.toHaveClass('lg:min-h-32');
    // Pierde sus tramos por alto, pero nunca su cabecera.
    expect(screen.getByRole('region', { name: 'A dónde ir' })).toHaveClass(
      'shrink',
      'basis-52',
      'min-h-11',
    );
    expect(screen.getByRole('region', { name: 'A dónde ir' }).className).not.toMatch(/\]:min-h-/);

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar Mástil' }));
    expect(screen.getByRole('region', { name: 'A dónde ir' }).className).toMatch(/\]:min-h-/);
  });
});

describe('Mientras la rueda tapa la pantalla', () => {
  function enEstrecho() {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );
  }

  // Deshacerlo aquí y no al final de cada test: un test que falla antes de
  // llegar a su última línea deja el doble puesto y **tumba al siguiente**, que
  // es justo lo que pasó al escribir esto.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lo de debajo queda apagado', () => {
    enEstrecho();

    const { container } = render(<ComposeScreen />);

    expect(container.querySelectorAll('[inert]').length).toBeGreaterThan(0);
  });

  it('y revive en cuanto hay tonalidad, que es cuando la barra se pliega', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    const { container } = render(<ComposeScreen />);

    expect(container.querySelector('[inert]')).toBeNull();
  });

  // En el banco la barra no existe: ahí la rueda vive en su área y no tapa nada.
  it('en el banco no se apaga nada', () => {
    const { container } = render(<ComposeScreen />);

    expect(container.querySelector('[inert]')).toBeNull();
  });
});

describe('Repartir el banco', () => {
  it('los divisores se mueven con el teclado y dicen cuanto miden', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    const divisor = screen.getByRole('separator', { name: 'Ancho de la tonalidad' });
    const antes = Number(divisor.getAttribute('aria-valuenow'));

    divisor.focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(selectReparto(useBancoStore.getState()).izquierda).toBe(antes + 1);
  });

  it('y el reparto se recuerda de una vez para otra', async () => {
    render(<ComposeScreen />);

    const divisor = screen.getByRole('separator', { name: 'Ancho de la tonalidad' });
    divisor.focus();
    await userEvent.keyboard('{ArrowLeft}');

    const espacio = useBancoStore.getState().espacio;
    expect(loadPreferences().banco.repartos[espacio].izquierda).toBe(
      selectReparto(useBancoStore.getState()).izquierda,
    );
  });

  // `Inicio` y el doble clic hacen lo mismo: devolver la medida de fábrica.
  it('Inicio devuelve la medida de fabrica', async () => {
    render(<ComposeScreen />);
    const divisor = screen.getByRole('separator', { name: 'Ancho de la tonalidad' });

    divisor.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Home}');

    expect(selectReparto(useBancoStore.getState()).izquierda).toBe(
      REPARTOS_DE_FABRICA.tocando.izquierda,
    );
  });
});

describe('La tonalidad que se está usando', () => {
  it('sin elegir se dice, y se dice qué hacer', () => {
    useSessionStore.getState().actions.reset();

    render(<ComposeScreen />);

    expect(screen.getByText('sin elegir')).toBeInTheDocument();
    expect(screen.getByText(/Pulsa una tonalidad para empezar/)).toBeInTheDocument();
  });

  /**
   * Y **se pliega sola en cuanto hay tonalidad**.
   *
   * No lo hacía, y era el peor fallo de la pantalla en un teléfono: la barra es
   * `shrink-0` y la rueda abierta medía seiscientos trece píxeles de ochocientos,
   * así que a lo que crece —el acorde, la lista, la canción— le tocaban cero, y
   * no había forma de desplazarse hasta ello. Elegías el tono y la pantalla
   * parecía vaciarse. Se vio midiendo el reparto de alto en un Chromium de
   * verdad; ningún test lo habría visto mirando texto.
   */
  it('la tonalidad se abre sin elegir y se quita al elegir', () => {
    useSessionStore.getState().actions.reset();
    const { container, rerender } = render(<ComposeScreen />);

    expect(container.querySelector('details')).toHaveAttribute('open');

    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    rerender(<ComposeScreen />);

    // Elegida, la barra de estrecho se va: su sitio es una pastilla de la fila
    // de arriba, y la columna de la rueda en el banco.
    expect(container.querySelector('details')).toBeNull();
  });

  it('elegida, se lee en las dos: la plegada del móvil y la columna de al lado', () => {
    // Las dos existen a la vez en el HTML —una se esconde con `lg:`— y las dos
    // tienen que decir lo mismo: si no, girar el móvil cambiaría la tonalidad a
    // ojos de quien mira.
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });

    render(<ComposeScreen />);

    expect(screen.getAllByText(/A menor/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('sin elegir')).not.toBeInTheDocument();
  });
});

describe('El area de abajo', () => {
  it('pulsar la que esta abierta la cierra', async () => {
    // El mismo botón para las dos cosas: con el área abierta, lo que se quiere
    // hacer con la pestaña que está puesta es cerrarla.
    render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));
    expect(screen.getByLabelText('Mástil')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));

    expect(screen.queryByLabelText('Mástil')).not.toBeInTheDocument();
  });

  it('y tambien se cierra desde su propia cabecera', async () => {
    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Sesiones' }));

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar Sesiones' }));

    expect(screen.queryByLabelText('Sesiones')).not.toBeInTheDocument();
  });

  // Qué editor había abierto es reparto, y el reparto se recuerda.
  it('que editor habia abierto se recuerda', async () => {
    render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Sesiones' }));

    expect(loadPreferences().banco.repartos[useBancoStore.getState().espacio].abajo).toBe(
      'sesiones',
    );
  });
});

/**
 * El aviso de lo ganado sale **por encima del editor de abajo**, no dentro.
 *
 * Estaba anclado a la barra de herramientas y salía hacia arriba desde ella, que
 * es lo correcto con el área de abajo cerrada. Con un editor abierto, «encima de
 * la barra» es **dentro** del editor: al guardar una canción el aviso caía sobre
 * su fila y tapaba «Renombrar» y «Borrar» durante los cuatro segundos en que se
 * está mirando justo eso. Se vio guardando una canción de verdad.
 */
describe('el aviso de lo ganado', () => {
  it('sale desde una caja que envuelve tambien al editor de abajo', () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
    useBancoStore.getState().actions.abrirAbajo('mastil');

    render(<ComposeScreen />);

    const editor = screen.getByRole('region', { name: 'Mástil' });
    const barra = screen.getByRole('region', { name: 'Qué se ve abajo' });
    // El ancla es la caja `relative` desde la que sale el aviso: tiene que
    // contener a los dos, o volverá a caer dentro del editor.
    const ancla = barra.closest('.relative');

    expect(ancla).not.toBeNull();
    expect(ancla!.contains(editor)).toBe(true);
  });
});

describe('Los otros dos divisores, y devolverlo todo', () => {
  function enEscribir(): void {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
  }

  it('el del acorde tambien se mueve, y vuelve con Inicio', async () => {
    enEscribir();
    render(<ComposeScreen />);
    const divisor = screen.getByRole('separator', { name: 'Ancho del acorde' });

    divisor.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(selectReparto(useBancoStore.getState()).derecha).toBe(
      REPARTOS_DE_FABRICA.escribir.derecha + 1,
    );

    await userEvent.keyboard('{Home}');
    expect(selectReparto(useBancoStore.getState()).derecha).toBe(
      REPARTOS_DE_FABRICA.escribir.derecha,
    );
  });

  // El de abajo solo existe con un editor abierto: es lo que reparte.
  it('el de abajo aparece con el editor, y reparte el alto', async () => {
    enEscribir();
    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Sesiones' }));

    const divisor = screen.getByRole('separator', { name: 'Alto de Sesiones' });
    divisor.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(selectReparto(useBancoStore.getState()).alto).toBe(
      REPARTOS_DE_FABRICA.escribir.alto + 1,
    );

    await userEvent.keyboard('{Home}');
    expect(selectReparto(useBancoStore.getState()).alto).toBe(REPARTOS_DE_FABRICA.escribir.alto);
  });

  /**
   * El mástil no trae divisor, y es a propósito
   * ([adr/0037](../../../docs/adr/0037-el-mastil-pide-su-alto.md)): su alto
   * sale de su proporción, así que arrastrarlo no repartiría nada. Un mando que
   * no mueve nada es peor que no tenerlo.
   */
  it('el mastil no trae divisor, porque su alto no se reparte', async () => {
    enEscribir();
    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));

    expect(screen.getByRole('region', { name: 'Mástil' })).toBeInTheDocument();
    expect(screen.queryByRole('separator', { name: 'Alto de Mástil' })).not.toBeInTheDocument();
  });

  /**
   * Y un botón que lo devuelve todo de golpe: repartir a mano es fácil de dejar
   * inservible, y volver área por área es peor que no haber tocado nada.
   */
  it('un boton devuelve el reparto entero', async () => {
    enEscribir();
    render(<ComposeScreen />);
    // El de la tonalidad no está: en «escribir» viene plegada, y un área
    // plegada no trae divisor que mover.
    const divisor = screen.getByRole('separator', { name: 'Ancho del acorde' });
    divisor.focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');

    // «Áreas como venían» y no «Reordenar»: no ordena nada, devuelve el de
    // fábrica, y el nombre tiene que decir lo que se pierde.
    await userEvent.click(screen.getByRole('button', { name: 'Áreas como venían' }));

    expect(selectReparto(useBancoStore.getState()).derecha).toBe(
      REPARTOS_DE_FABRICA.escribir.derecha,
    );
  });

  // La tira de un área plegada la devuelve, y la cabecera la vuelve a plegar.
  it('la tonalidad se pliega y se despliega desde su tira', async () => {
    enEscribir();
    render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Desplegar Tonalidad' }));
    expect(selectReparto(useBancoStore.getState()).plegadas).not.toContain('izquierda');

    await userEvent.click(screen.getByRole('button', { name: 'Plegar Tonalidad' }));
    expect(selectReparto(useBancoStore.getState()).plegadas).toContain('izquierda');
  });

  // Y el acorde igual, que es la otra que se pliega desde su cabecera.
  it('el acorde se pliega desde su cabecera', async () => {
    enEscribir();
    render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Plegar Acorde' }));

    expect(selectReparto(useBancoStore.getState()).plegadas).toContain('derecha');
  });
});

describe('Poner un acorde en la cancion desde fuera del lienzo', () => {
  /**
   * «A dónde ir» y el acorde que se oye son los dos sitios desde los que se
   * pone un acorde sin arrastrarlo, y los dos escriben en la misma canción
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
   * Sin partes todavía, el primero crea la primera.
   */
  it('desde «a donde ir», y crea la parte si no habia ninguna', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
    useArrangementStore.setState({ arrangement: { parts: [] }, past: [] });
    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar A dónde ir' }));

    const panel = within(screen.getByLabelText('A dónde ir'));
    await userEvent.click(panel.getByRole('button', { name: /^C, I\./ }));

    const partes = useArrangementStore.getState().arrangement.parts;
    expect(partes).toHaveLength(1);
    expect(partes[0]!.blocks.map((b) => b.degree)).toEqual(['I']);
  });
});

describe('El espacio de ensayar', () => {
  it('trae la cancion para tocarla contra el metronomo, con su nombre', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Ensayar' }));

    // El área central se llama como el espacio: es lo único que dice en qué
    // estás, y las tres son la misma canción vista de otra manera.
    expect(screen.getByLabelText('Ensayo')).toBeInTheDocument();
    expect(screen.getByText(/Tócala contra el metrónomo/)).toBeInTheDocument();
  });

  // Y en estrecho, su pestaña también se llama así.
  it('y en estrecho su pestaña tambien', async () => {
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('ensayar');

    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Acorde' }));

    // Sin banco, el área del acorde va sin cabecera: en un teléfono la pestaña
    // ya dice cuál es, y una cabecera más es un renglón menos de contenido.
    expect(screen.queryByRole('button', { name: 'Plegar Acorde' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Acorde')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

/**
 * Lo que no se ve al entrar llega después
 * ([adr/0058](../../../docs/adr/0058-componer-se-descarga-por-partes.md)).
 *
 * En jsdom el `import()` se resuelve enseguida, así que lo que se prueba es que
 * lo diferido **acaba llegando** a su sitio y que mientras tanto hay algo que lo
 * dice, no el peso: eso lo mide `peso-de-las-rutas.mjs` del skill `arrancar`.
 */
describe('Lo que llega en diferido', () => {
  function conTonalidad(): void {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
  }

  /**
   * **El lienzo va en el paquete de entrada**, porque se entra por escribir
   * (adr/0109): estuvo en diferido, y quien volvía veía la pantalla vacía,
   * «Abriendo el lienzo…» y el lienzo, tres pantallas seguidas.
   */
  it('el lienzo se pinta a la primera, sin esperar a nada', () => {
    conTonalidad();
    useBancoStore.getState().actions.espacio('escribir');
    render(<ComposeScreen />);

    expect(screen.getByRole('button', { name: 'Escuchar la canción' })).toBeInTheDocument();
    expect(screen.queryByText(/Abriendo/)).not.toBeInTheDocument();
  });

  it('tocando llega al pasar a tocar', async () => {
    conTonalidad();
    useBancoStore.getState().actions.espacio('escribir');
    render(<ComposeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Tocando' }));

    expect(
      await screen.findByRole('button', { name: 'Solo grabar' }, LO_DIFERIDO),
    ).toBeInTheDocument();
  });

  it('el ensayo tambien', async () => {
    conTonalidad();
    useBancoStore.getState().actions.espacio('ensayar');
    useArrangementStore.setState({ arrangement: { parts: [] }, past: [] });
    render(<ComposeScreen />);

    expect(await screen.findByText('Todavía no hay nada que ensayar')).toBeInTheDocument();
  });

  it('y cada panel de abajo, con sus rotulos si los tiene', async () => {
    conTonalidad();
    render(<ComposeScreen />);

    for (const nombre of ['Mástil', 'Salidas', 'Canciones', 'Sesiones']) {
      await userEvent.click(
        within(screen.getByRole('region', { name: 'Qué se ve abajo' })).getByRole('button', {
          name: nombre,
        }),
      );
      const area = screen.getByRole('region', { name: nombre });
      await waitFor(() => expect(within(area).queryByRole('status')).not.toBeInTheDocument());
    }
  });

  // Pasar por encima de los espacios o de la fila de abajo, o llegar con el
  // tabulador, pide el código antes de pulsar. No se puede ver qué se descargó;
  // se comprueba que no rompe nada y que la pantalla sigue ahí.
  it('pasar por encima precarga sin cambiar nada', () => {
    conTonalidad();
    render(<ComposeScreen />);
    const espacios = screen.getByRole('group', { name: 'Espacio de trabajo' });
    const abajo = screen.getByRole('region', { name: 'Qué se ve abajo' }).firstElementChild!;

    fireEvent.pointerOver(espacios);
    fireEvent.focus(espacios);
    fireEvent.pointerOver(abajo);
    fireEvent.focus(abajo);

    expect(useBancoStore.getState().espacio).toBe('tocando');
  });

  /**
   * Y en reposo se piden tocando y el ensayo, que son a donde se pasa desde el
   * lienzo. Con `requestIdleCallback` donde lo hay, y con un plazo donde no.
   */
  it('en reposo se piden tocando y el ensayo', () => {
    const pedir = vi.fn((traer: () => void) => {
      traer();
      return 7;
    });
    const cancelar = vi.fn();
    vi.stubGlobal('requestIdleCallback', pedir);
    vi.stubGlobal('cancelIdleCallback', cancelar);

    const { unmount } = render(<ComposeScreen />);
    unmount();

    expect(pedir).toHaveBeenCalled();
    expect(cancelar).toHaveBeenCalledWith(7);
    vi.unstubAllGlobals();
  });

  it('y sin requestIdleCallback, con un plazo que se cancela al salir', () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(<ComposeScreen />);
      vi.advanceTimersByTime(300);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Repartir sin arrastrar (WCAG 2.5.7): cada área del banco trae «Estrechar» y
 * «Ensanchar» en su cabecera, y el área de abajo «Bajar» y «Subir».
 */
describe('Repartir sin arrastrar', () => {
  function enEscribir(): void {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
  }

  it('el acorde se ensancha y se estrecha desde su cabecera, y se guarda', async () => {
    enEscribir();
    render(<ComposeScreen />);
    const antes = selectReparto(useBancoStore.getState()).derecha;

    await userEvent.click(screen.getByRole('button', { name: 'Ensanchar Acorde' }));
    expect(selectReparto(useBancoStore.getState()).derecha).toBe(antes + 2);
    expect(loadPreferences().banco.repartos.escribir.derecha).toBe(antes + 2);

    await userEvent.click(screen.getByRole('button', { name: 'Estrechar Acorde' }));
    expect(selectReparto(useBancoStore.getState()).derecha).toBe(antes);
  });

  it('en su tope, el boton se apaga', async () => {
    enEscribir();
    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar Tonalidad' }));
    act(() => useBancoStore.getState().actions.mover('izquierda', 0));

    expect(screen.getByRole('button', { name: 'Estrechar Tonalidad' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ensanchar Tonalidad' })).toBeEnabled();
  });

  it('el area de abajo sube y baja, y el mastil no, que su alto no se reparte', async () => {
    enEscribir();
    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Sesiones' }));
    const antes = selectReparto(useBancoStore.getState()).alto;

    await userEvent.click(screen.getByRole('button', { name: 'Subir Sesiones' }));
    expect(selectReparto(useBancoStore.getState()).alto).toBe(antes + 2);

    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));
    expect(screen.queryByRole('button', { name: 'Subir Mástil' })).not.toBeInTheDocument();
  });

  /**
   * **Arrastrando no se repinta componer.** Cada movimiento iba al almacén, y
   * la pantalla entera lee el reparto: sesenta repintados por segundo para mover
   * una raya. Ahora se mueve la variable CSS de la caja, y el almacén —y lo
   * guardado— se enteran al soltar.
   */
  it('arrastrando un divisor se mueve su variable, y el reparto cambia al soltar', () => {
    enEscribir();
    act(() => useBancoStore.getState().actions.abrirAbajo('sesiones'));
    act(() => useBancoStore.getState().actions.plegar('izquierda'));
    const { container } = render(<ComposeScreen />);
    const caja = container.firstElementChild as HTMLElement;

    for (const [nombre, variable] of [
      ['Ancho de la tonalidad', '--banco-izquierda'],
      ['Ancho del acorde', '--banco-derecha'],
      ['Alto de Sesiones', '--banco-alto'],
    ] as const) {
      const divisor = screen.getByRole('separator', { name: nombre });
      Object.assign(divisor, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });
      const repartoAntes = selectReparto(useBancoStore.getState());
      const guardadoAntes = JSON.stringify(loadPreferences().banco);
      const medidaAntes = caja.style.getPropertyValue(variable);

      fireEvent.pointerDown(divisor, { clientX: 100, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(divisor, { clientX: 132, clientY: 132, pointerId: 1 });
      expect(selectReparto(useBancoStore.getState())).toBe(repartoAntes);
      expect(JSON.stringify(loadPreferences().banco)).toBe(guardadoAntes);
      const arrastrada = caja.style.getPropertyValue(variable);
      expect(arrastrada).not.toBe(medidaAntes);

      fireEvent.pointerUp(divisor, { clientX: 132, clientY: 132, pointerId: 1 });
      expect(JSON.stringify(loadPreferences().banco)).not.toBe(guardadoAntes);
      // Lo que queda escrito es lo mismo que se veía al soltar.
      expect(caja.style.getPropertyValue(variable)).toBe(arrastrada);
    }
  });
});

describe('Componer en un telefono', () => {
  function enEstrecho() {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Los espacios son también las pestañas: la fila aparte repetía el espacio
   * elegido con otro nombre, y costaba unos cincuenta píxeles antes de la
   * canción.
   */
  it('no hay fila de pestanas aparte: los espacios la hacen', async () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    expect(screen.queryByRole('group', { name: 'Qué se ve' })).not.toBeInTheDocument();
    const espacios = within(screen.getByRole('group', { name: 'Espacio de trabajo' }));
    await userEvent.click(espacios.getByRole('button', { name: 'Acorde' }));

    // Con otra pestaña delante, el espacio no sale marcado: no es lo que se ve.
    expect(espacios.getByRole('button', { name: 'Tocando' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await userEvent.click(espacios.getByRole('button', { name: 'Tocando' }));
    expect(espacios.getByRole('button', { name: 'Tocando' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  /**
   * **El marco, en una fila.** Eran la cabecera de dos filas, la línea de la
   * tonalidad y la bandeja de abajo: 365 píxeles de 844 antes de la canción.
   * Ahora la tonalidad elegida y la bandeja son dos pastillas de la fila de
   * arriba, y lo que abren flota en un `popover` que la fila no recorta.
   */
  it('con tonalidad, ni linea de tonalidad ni bandeja: dos pastillas en la fila', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    const { container } = render(<ComposeScreen />);

    expect(container.querySelector('details')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Qué se ve abajo' })).not.toBeInTheDocument();

    const fila = container.querySelector('h1')!.parentElement!;
    const tonalidad = within(fila).getByRole('button', { name: /Do mayor|C mayor/ });
    const mas = within(fila).getByRole('button', { name: 'Más' });
    expect(document.getElementById(tonalidad.getAttribute('popovertarget')!)).toHaveAttribute(
      'popover',
    );
    expect(document.getElementById(mas.getAttribute('popovertarget')!)).toContainElement(
      screen.getByRole('region', { hidden: true, name: 'Qué se ve abajo' }),
    );
    // Sin la línea, que en un teléfono eran cuatro letras y unos puntos: la
    // esconde la clase, que es lo que el servidor sabe pintar sin saber el ancho.
    expect(fila.querySelector(':scope > p')).toHaveClass('max-lg:hidden');
    // Y sin «Áreas como venían», que es del banco.
    expect(screen.queryByRole('button', { name: 'Áreas como venían' })).not.toBeInTheDocument();
  });

  it('elegir en «Mas» abre lo elegido abajo y cierra el panel', async () => {
    enEstrecho();
    const cerrar = vi.fn();
    HTMLElement.prototype.hidePopover = cerrar;
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    const lista = screen.getByRole('region', { hidden: true, name: 'Qué se ve abajo' });
    fireEvent.pointerOver(lista.firstElementChild!);
    fireEvent.click(within(lista).getByRole('button', { hidden: true, name: 'Sesiones' }));

    expect(screen.getByRole('region', { name: 'Sesiones' })).toBeInTheDocument();
    expect(cerrar).toHaveBeenCalled();
    delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
  });

  /**
   * **Los paneles de la fila parecen modales y no lo son**: llevan velo, y el
   * tabulador salía de ellos por detrás hasta los controles tapados. Salir con
   * el foco los cierra, a los dos.
   */
  it('«Mas» y la tonalidad se cierran cuando el foco sale de ellos', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    const { container } = render(<ComposeScreen />);
    const fila = container.querySelector('h1')!.parentElement!;
    const fuera = within(fila).getByRole('button', { name: 'Tocando' });

    for (const nombre of ['Más', /Do mayor|C mayor/] as const) {
      const boton = within(fila).getByRole('button', { name: nombre });
      const panel = document.getElementById(boton.getAttribute('popovertarget')!)!;
      const cerrar = vi.fn();
      Object.assign(panel, { hidePopover: cerrar });

      fireEvent.blur(panel.querySelector('button')!, { relatedTarget: fuera });

      expect(cerrar).toHaveBeenCalled();
    }
  });

  /**
   * **Lo que recibe el foco en la fila se trae entero.** El navegador solo lo
   * hace asomar: a 390, «Tempo» enseñaba 13 de sus 82 píxeles.
   */
  it('lo que recibe el foco en la fila que se desplaza se trae a la vista', () => {
    enEstrecho();
    const traido = vi.fn();
    Element.prototype.scrollIntoView = traido;
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);
    const ensayar = screen.getByRole('button', { name: 'Ensayar' });
    const tira = ensayar.closest<HTMLElement>('.hay-mas-al-lado')!;
    Object.defineProperty(tira, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(tira, 'clientWidth', { value: 390, configurable: true });

    fireEvent.focus(ensayar);

    expect(traido).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
  });

  /**
   * **El estado vacío no se centra en un teléfono.** Centrado con `my-auto`,
   * bajaba mientras llegaba el HTML —cada trozo lo hacía crecer y el margen lo
   * recolocaba— y la pantalla saltaba antes de hidratar. Arriba no salta.
   */
  it('sin tonalidad, lo que se ve no se centra en vertical por debajo de lg', () => {
    enEstrecho();
    render(<ComposeScreen />);

    const vacio = screen
      .getAllByText(/Empieza eligiendo la tonalidad/)
      .map((nodo) => nodo.closest('.lg\\:my-auto'))
      .find((caja) => caja !== null);
    expect(vacio).toBeTruthy();
    expect(vacio).not.toHaveClass('my-auto');
  });

  // jsdom no trae la API: sin ella se abre igual y no revienta al cerrar.
  it('y sin la API de popover, abre igual', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    const lista = screen.getByRole('region', { hidden: true, name: 'Qué se ve abajo' });
    fireEvent.click(within(lista).getByRole('button', { hidden: true, name: 'Canciones' }));

    expect(screen.getByRole('region', { name: 'Canciones' })).toBeInTheDocument();
  });

  // Los espacios y el metrónomo eran pastillas iguales una detrás de otra.
  it('entre los espacios y el metronomo hay una raya', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    const { container } = render(<ComposeScreen />);

    // Una delante de las pestañas, y otra entre los espacios y el metrónomo.
    expect(container.querySelectorAll('[data-separador]')).toHaveLength(2);
  });

  /**
   * Sin cabecera, el área sigue teniendo su título para quien navega por
   * títulos: sin él, lo de dentro saltaba del `h1` a un `h3` (axe,
   * `heading-order`).
   */
  it('las areas sin cabecera siguen teniendo su titulo', () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(<ComposeScreen />);

    expect(
      within(screen.getByRole('region', { name: 'Tocando' })).getByRole('heading', {
        level: 2,
        name: 'Tocando',
      }),
    ).toHaveClass('sr-only');
  });
});

/**
 * Con la canción en blanco manda un solo vacío, el del lienzo: el área del
 * acorde decía además «Elige el primer acorde», y eran tres a la vez.
 */
describe('Un solo vacio que mande', () => {
  it('sin cancion ni acorde probado, el acorde no dice nada; con ellos, si', () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
    useArrangementStore.setState({ arrangement: { parts: [] }, past: [] });
    const { rerender } = render(<ComposeScreen />);

    expect(screen.queryByText('Elige el primer acorde')).not.toBeInTheDocument();

    act(() => {
      const acciones = useArrangementStore.getState().actions;
      acciones.addBlock(acciones.addPart('Estrofa'), 'I', 4, null);
    });
    rerender(<ComposeScreen />);

    expect(screen.getByText('Pulsa un acorde de tu canción')).toBeInTheDocument();
  });
});

/**
 * **Lo que un cambio de modo deja fuera se dice.** Traducir la canción a menor
 * quita los grados que allí no existen, y se quitaban en silencio: la canción
 * tenía un acorde menos sin que nadie supiera por qué.
 */
describe('Lo que se quita al cambiar de modo', () => {
  function seQuito(bloques = [writtenBlock('x', 'V/ii', 4)]) {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'minor' });
    useArrangementStore.setState({ quitadosAlCambiarDeModo: { hacia: 'minor', bloques } });
  }

  afterEach(() => {
    useArrangementStore.setState({ quitadosAlCambiarDeModo: null });
    useClaqueta.setState({ enLaToma: false });
  });

  it('se dice con el cifrado del modo de antes, y se cierra', async () => {
    seQuito();
    render(<ComposeScreen />);

    expect(
      screen.getByText('Al pasar a menor se ha quitado A (V/ii): en menor no tiene sitio.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Vale' }));

    expect(useArrangementStore.getState().quitadosAlCambiarDeModo).toBeNull();
    expect(screen.queryByText(/se ha quitado/)).not.toBeInTheDocument();
  });

  it('varios, en plural y en una lista', () => {
    seQuito([writtenBlock('x', 'V/ii', 4), writtenBlock('y', 'V/vi', 4)]);
    render(<ComposeScreen />);

    expect(
      screen.getByText(
        'Al pasar a menor se han quitado A (V/ii) y E (V/vi): en menor no tienen sitio.',
      ),
    ).toBeInTheDocument();
  });

  // Y al revés, de menor a mayor, se dice igual.
  it('hacia mayor tambien', () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'major' });
    useArrangementStore.setState({
      quitadosAlCambiarDeModo: { hacia: 'major', bloques: [writtenBlock('x', 'V/iv', 4)] },
    });
    render(<ComposeScreen />);

    // El V/iv de La menor es un La mayor: el dominante del Re menor.
    expect(screen.getByText(/Al pasar a mayor se ha quitado A \(V\/iv\)/)).toBeInTheDocument();
  });

  /**
   * **Durante una toma se calla**: la voz del lector sale por el mismo altavoz
   * que el clic, con el micro abierto. La región sigue montada y vacía, para que
   * lo que entre después se anuncie.
   */
  it('durante una toma no sale, y la region sigue montada', () => {
    seQuito();
    useClaqueta.setState({ enLaToma: true });
    const { container } = render(<ComposeScreen />);

    expect(screen.queryByText(/se ha quitado/)).not.toBeInTheDocument();
    expect(container.querySelector('p[aria-live="polite"]:empty')).not.toBeNull();
  });
});

/**
 * La tonalidad elegida, **también en el banco cuando su columna está plegada**,
 * que es como viene Escribir: no había ningún sitio donde leerla.
 */
describe('La tonalidad en la cabecera del banco', () => {
  const pastilla = () =>
    screen
      .queryAllByRole('button', { name: /A menor/ })
      .find((boton) => boton.hasAttribute('popovertarget'));

  beforeEach(() => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    useBancoStore.getState().actions.espacio('escribir');
  });

  it('con la columna plegada, la cabecera la dice y la abre', () => {
    render(<ComposeScreen />);

    expect(pastilla()).toBeInTheDocument();
  });

  it('con la columna abierta no se repite', () => {
    act(() => useBancoStore.getState().actions.plegar('izquierda'));
    render(<ComposeScreen />);

    expect(pastilla()).toBeUndefined();
  });
});

/**
 * Un solo campo para escribir un acorde por su nombre a la vista: escribiendo,
 * el del lienzo; «A dónde ir» lleva el suyo solo donde no hay lienzo.
 */
describe('Un solo buscador de acordes', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
  });

  it('escribiendo, «a donde ir» no trae el suyo', () => {
    useBancoStore.getState().actions.espacio('escribir');
    act(() => useBancoStore.getState().actions.plegar('camino'));
    render(<ComposeScreen />);

    const camino = screen.getByRole('region', { name: 'A dónde ir' });
    expect(within(camino).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('tocando, donde no hay lienzo, sí', () => {
    act(() => useBancoStore.getState().actions.plegar('camino'));
    render(<ComposeScreen />);

    const camino = screen.getByRole('region', { name: 'A dónde ir' });
    expect(within(camino).getByLabelText('Buscar un acorde')).toBeInTheDocument();
  });
});

/**
 * Salidas sin plan **lleva a su versión gratis**: «A dónde ir», en el mismo
 * sitio. Era solo un candado.
 */
describe('Salidas sin plan', () => {
  it('lleva a «a donde ir», que se abre con lo de abajo cerrado', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
    act(() => useBancoStore.getState().actions.abrirAbajo('salidas'));
    render(<ComposeScreen />);

    await userEvent.click(await screen.findByRole('button', { name: 'Abrir «A dónde ir»' }));

    expect(screen.queryByRole('region', { name: 'Salidas' })).not.toBeInTheDocument();
    const camino = screen.getByRole('region', { name: 'A dónde ir' });
    await waitFor(() =>
      expect(within(camino).getAllByRole('button')).toContain(document.activeElement),
    );
  });
});

/**
 * **La canción cambiada en otra pestaña se dice.** Llega con su deshacer, y el
 * aviso ofrece volver a la de esta pestaña.
 */
describe('Lo que llega de otra pestaña', () => {
  const aviso = /se ha cambiado en otra pestaña/;

  beforeEach(() => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useArrangementStore.setState({
      arrangement: { parts: [] },
      past: [],
      llegoDeOtraPestana: false,
    });
  });

  it('se dice, y «Vale» lo cierra', async () => {
    render(<ComposeScreen />);
    expect(screen.queryByText(aviso)).not.toBeInTheDocument();

    act(() =>
      useArrangementStore.getState().actions.traerDeOtraPestana({
        parts: [
          { id: 'p', name: 'Otra', blocks: [writtenBlock('b', 'IV', 4)], notes: [], bars: 1 },
        ],
      }),
    );
    expect(screen.getByText(aviso)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Vale' }));
    expect(screen.queryByText(aviso)).not.toBeInTheDocument();
    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(1);
  });

  it('«Volver a la de aquí» deshace lo que llegó', async () => {
    render(<ComposeScreen />);
    act(() =>
      useArrangementStore.getState().actions.traerDeOtraPestana({
        parts: [
          { id: 'p', name: 'Otra', blocks: [writtenBlock('b', 'IV', 4)], notes: [], bars: 1 },
        ],
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Volver a la de aquí' }));

    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(0);
    expect(screen.queryByText(aviso)).not.toBeInTheDocument();
  });

  it('durante una toma se calla', () => {
    useClaqueta.getState().acciones.marcarToma(true);
    useArrangementStore.setState({ llegoDeOtraPestana: true });
    render(<ComposeScreen />);

    expect(screen.queryByText(aviso)).not.toBeInTheDocument();
    useClaqueta.getState().acciones.marcarToma(false);
  });
});
