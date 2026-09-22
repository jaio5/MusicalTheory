// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '@core/billing';
import { pitchClassFromName } from '@core/music';
import { AccountProvider } from '@state/account';
import { useArrangementStore } from '@state/arrangement-store';
import { selectReparto, useBancoStore } from '@state/banco';
import { useSessionStore } from '@state/session-store';
import { DEFAULT_BANCO, loadPreferences, REPARTOS_DE_FABRICA } from '@state/workspace';

import { ComposeScreen } from './ComposeScreen';

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
beforeEach(() => {
  localStorage.clear();
  useSessionStore.getState().actions.reset();
  // Y el reparto, que vive fuera de `localStorage` una vez cargado: sin esto
  // una prueba abre un editor y la siguiente se lo encuentra abierto.
  useBancoStore.setState({ espacio: DEFAULT_BANCO.espacio, repartos: DEFAULT_BANCO.repartos });
});

/**
 * Lo que se prueba aquí es **qué se sacrifica en el móvil**, que es una decisión y
 * no un detalle de estilo. jsdom no tiene ancho de pantalla de verdad, así que se
 * comprueba la regla escrita: qué lleva `sm:`/`lg:` y qué no.
 */
describe('Componer en una pantalla estrecha', () => {
  /**
   * Grabar dejó de ser una franja fija arriba.
   *
   * Cuando grababa vídeo tenía que esconderse en el móvil: se llevaba un renglón
   * entero para algo que pide trípode y pantalla grande. Grabando solo el sonido
   * ya no hay franja que esconder —es una herramienta más de la fila de abajo—,
   * así que la pregunta cambia: **que esté disponible en cualquier ancho**, que
   * es justo lo contrario de lo que se defendía antes
   * ([adr/0023](../../../docs/adr/0023-grabar-solo-el-sonido.md)).
   */
  it('grabar es una herramienta más, y está también en el movil', async () => {
    render(<ComposeScreen />);

    const pestana = screen.getByRole('button', { name: 'Grabar' });
    expect(pestana.className, 'la pestaña de grabar no se esconde en móvil').not.toContain(
      'hidden',
    );

    await userEvent.click(pestana);

    expect(screen.getByRole('button', { name: /grabar lo que tocas/i })).toBeInTheDocument();
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

  // Por donde se entra: componer tocando estaba construido y escondido detrás de
  // dos pasos, y ahora es la primera puerta.
  it('se entra por tocando, que es por donde se empieza una cancion', () => {
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
    // La caja que las guarda a las dos no puede estar escondida.
    expect(area.closest('.hidden')).toBeNull();
  });

  it('y con la del arreglo puesta, el arreglo es el que se ve', async () => {
    enEstrecho();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    // La pestaña del arreglo se llama como el espacio en el que estés.
    useBancoStore.getState().actions.espacio('escribir');

    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'A dónde ir' }));
    await userEvent.click(screen.getByRole('button', { name: 'Arreglo' }));

    expect(screen.getByLabelText('Arreglo').closest('.hidden')).toBeNull();
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
  it('la tonalidad se abre sin elegir y se pliega al elegir', () => {
    useSessionStore.getState().actions.reset();
    const { container, rerender } = render(<ComposeScreen />);

    expect(container.querySelector('details')).toHaveAttribute('open');

    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    rerender(<ComposeScreen />);

    expect(container.querySelector('details')).not.toHaveAttribute('open');
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
    await userEvent.click(screen.getByRole('button', { name: 'Ideas' }));

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar Ideas' }));

    expect(screen.queryByLabelText('Ideas')).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: 'Ideas' }));

    const divisor = screen.getByRole('separator', { name: 'Alto de Ideas' });
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

    await userEvent.click(screen.getByRole('button', { name: 'Reordenar' }));

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

/**
 * Una idea con escala se entra de un golpe.
 *
 * Era una línea de texto —«Pentatónica menor de La»—, y para probarla había que
 * salir de Ideas, abrir el mástil y buscarla en el desplegable. Las dos cosas y
 * en este orden: ponerla, y abrir el mástil, que es donde una escala se ve.
 */
describe('Ir a la escala que propone una idea', () => {
  const CON_PLAN: Account = {
    email: 'javier@example.com',
    name: null,
    plan: 'medio',
    aiModel: 'claude-opus-5',
    aiLeftToday: 30,
    aiLeftMonth: 30,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('la pone y abre el mastil a la vez', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            ideas: [{ title: 'Prueba el dórico', why: 'Sube la sexta.', scale: 'dorian' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    render(
      <AccountProvider account={CON_PLAN} accounts>
        <ComposeScreen />
      </AccountProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Ideas' }));
    await userEvent.click(screen.getByRole('button', { name: /qué escala meter encima/i }));
    const escala = await screen.findByText('Dórico de A');
    await userEvent.click(escala.closest('button')!);

    expect(useSessionStore.getState().scaleId).toBe('dorian');
    expect(selectReparto(useBancoStore.getState()).abajo).toBe('mastil');
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
 * Ver el mástil grande, que existe porque en una ventana baja no caben la
 * canción y un mástil legible a la vez
 * ([adr/0037](../../../docs/adr/0037-el-mastil-pide-su-alto.md)). Medido en una
 * de 606 px de alto: el dibujo se quedaba en 166 y se pintaba al 40 % del
 * ancho, centrado entre dos franjas muertas.
 */
describe('ver el mastil grande', () => {
  function conElMastil(): void {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
    useBancoStore.getState().actions.abrirAbajo('mastil');
  }

  /** La ventana de jsdom son 768, que ya es «baja» para el mástil. */
  function ventanaDe(alto: number): void {
    window.innerHeight = alto;
  }

  /** Si la caja que lleva la canción está apartada. */
  function laCancionApartada(): boolean {
    const arreglo = screen.getByRole('region', { name: 'Arreglo' });
    return arreglo.closest('.hidden') !== null;
  }

  it('aparta la cancion, y la devuelve', async () => {
    ventanaDe(900);
    conElMastil();
    render(<ComposeScreen />);

    expect(laCancionApartada()).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Ver grande' }));

    expect(screen.getByRole('button', { name: 'Volver al banco' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(laCancionApartada()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Volver al banco' }));

    expect(laCancionApartada()).toBe(false);
  });

  // Solo el mástil: lo de dentro de los demás se desplaza, así que verlo grande
  // no enseña más.
  it('los demas paneles no lo traen', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');
    useBancoStore.getState().actions.abrirAbajo('sesiones');

    render(<ComposeScreen />);

    expect(screen.getByRole('region', { name: 'Sesiones' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver grande' })).not.toBeInTheDocument();
  });

  /**
   * Cambiar de panel lo deshace: es un modo de mirar **una** cosa, y mirando
   * otra no significa nada. Sin esto, abrir Sesiones desde el mástil grande
   * dejaba la canción apartada y ningún botón para devolverla.
   */
  it('cambiar de panel lo deshace', async () => {
    ventanaDe(900);
    conElMastil();
    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver grande' }));
    expect(laCancionApartada()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Sesiones' }));

    expect(laCancionApartada()).toBe(false);
    expect(screen.queryByRole('button', { name: 'Volver al banco' })).not.toBeInTheDocument();
  });

  /**
   * En una ventana baja se abre ya grande, que es lo que haría uno al
   * encontrárselo diminuto. Medido a 1314 × 606: dentro del banco el dibujo se
   * queda en el 40 % del ancho, y apartando la canción llega al 92 %.
   */
  it('en una ventana baja se abre ya grande', async () => {
    ventanaDe(600);
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');

    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));

    expect(screen.getByRole('button', { name: 'Volver al banco' })).toBeInTheDocument();
    expect(laCancionApartada()).toBe(true);
  });

  it('en una ventana alta se abre dentro del banco', async () => {
    ventanaDe(900);
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    useBancoStore.getState().actions.espacio('escribir');

    render(<ComposeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Mástil' }));

    expect(screen.getByRole('button', { name: 'Ver grande' })).toBeInTheDocument();
    expect(laCancionApartada()).toBe(false);
  });
});
