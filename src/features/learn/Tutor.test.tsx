// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import { pitchClassFromName } from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';
import { moverTutor, SITIO_POR_DEFECTO } from '@state/tutor-spot';

import { Tutor } from './Tutor';

function pintar(nodo: React.ReactNode) {
  return render(
    <AccountProvider account={ANONYMOUS} accounts={false}>
      {nodo}
    </AccountProvider>,
  );
}

/** El ancho de la ventana y si quien mira ha pedido menos movimiento. */
function pantalla({ ancha = true, quieto = false } = {}) {
  vi.stubGlobal('innerWidth', ancha ? 1024 : 390);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: quieto, addEventListener: () => {}, removeEventListener: () => {} })),
  );
}

beforeEach(() => {
  localStorage.clear();
  moverTutor(SITIO_POR_DEFECTO);
  pantalla();
});

describe('El muñeco del profesor', () => {
  // Cerrado no dice nada: un ayudante que habla sin motivo se aprende a cerrar
  // sin leerlo, y el día que dice algo útil ya nadie lo mira.
  it('empieza callado y solo se ve el muñeco', () => {
    pintar(<Tutor />);

    expect(screen.getByRole('button', { name: /preguntarle al profesor/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  /**
   * Lo que se pedía y no había: preguntar sin salirse de la unidad. El formulario
   * del profesor va dentro del globo, no detrás de un enlace a otra pantalla.
   */
  it('al pulsarlo se abre con el formulario de preguntar dentro', async () => {
    // Con cuenta y con tonalidad, que es cuando el formulario existe.
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(
      <AccountProvider account={{ ...ANONYMOUS, email: 'a@b.es' }} accounts>
        <Tutor unitId="e1-grados" />
      </AccountProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /preguntarle al profesor/i }));

    expect(screen.getByRole('button', { name: /preguntar/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pregunta lo que quieras/i)).toBeInTheDocument();
  });

  // Sin cuenta, el globo ofrece entrar y no un campo que acabaría en un 401.
  it('sin cuenta, dentro del globo hay un enlace para entrar y no el campo', async () => {
    pintar(<Tutor unitId="e1-grados" />);

    await userEvent.click(screen.getByRole('button', { name: /preguntarle al profesor/i }));

    expect(screen.getByRole('link', { name: 'Entrar para preguntar' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('se abre solo cuando hay algo que avisar, y con la frase entera para quien no ve', () => {
    pintar(<Tutor aviso="Esa no era." />);

    expect(screen.getByRole('button', { name: /cerrar el profesor/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Esa no era.')).toBeInTheDocument();
  });

  it('se cierra y avisa de que ya se ha visto', async () => {
    const visto = vi.fn();
    pintar(<Tutor aviso="Esa no era." onAvisoVisto={visto} />);

    await userEvent.click(screen.getByRole('button', { name: /^cerrar$/i }));

    expect(visto).toHaveBeenCalledOnce();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  /**
   * El sitio sale del guardado, no de una clase fija: cada pantalla monta su
   * propio muñeco y todos tienen que aparecer donde lo dejaste.
   */
  it('se pinta en el lado y a la altura donde lo dejaste', () => {
    moverTutor({ lado: 'derecha', alto: 35 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.className).toContain('right-3');
    // La fila se invierte para que el globo se abra hacia dentro de la pantalla.
    expect(marco.className).toContain('flex-row-reverse');
    expect(marco.style.top).toBe('35%');
    expect(marco.className).toContain('items-start');
  });

  /**
   * El fallo que tuvo: capturar el puntero al apoyar el dedo redirige todos los
   * eventos al contenedor, y entonces el `click` no llega al botón de dentro. Se
   * movía y no se abría.
   *
   * jsdom no implementa la captura de verdad, así que lo que se vigila es **el
   * momento** en que se pide: al apoyar, nunca; al moverse, sí. Es lo que
   * distingue un toque de un arrastre.
   */
  it('no captura el puntero hasta que te mueves de verdad', () => {
    const capturar = vi.fn();
    const liberar = vi.fn();
    Element.prototype.setPointerCapture = capturar;
    Element.prototype.releasePointerCapture = liberar;
    Element.prototype.hasPointerCapture = () => true;

    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    expect(capturar, 'apoyar el dedo no puede capturar: se come el clic').not.toHaveBeenCalled();

    fireEvent.pointerMove(marco, { clientX: 200, clientY: 400, movementX: 180, pointerId: 1 });
    expect(capturar).toHaveBeenCalledOnce();
  });

  /**
   * El fallo que tuvo: anclado siempre por arriba, al abrirse el globo empujaba
   * al muñeco hacia abajo desde el 78 % y los dos se salían de la pantalla. Se
   * ancla por el borde más cercano, y así el globo crece hacia dentro.
   */
  it('abajo se ancla por abajo, para que el globo suba en vez de empujarlo fuera', () => {
    moverTutor({ lado: 'izquierda', alto: 78 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.style.bottom).toBe('22%');
    expect(marco.style.top).toBe('');
    expect(marco.className).toContain('items-end');
  });

  it('arriba se ancla por arriba, y entonces el globo baja', () => {
    moverTutor({ lado: 'izquierda', alto: 20 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.style.top).toBe('20%');
    expect(marco.style.bottom).toBe('');
    expect(marco.className).toContain('items-start');
  });

  /**
   * De salida vive abajo a la derecha, que es el rincón donde no hay texto: en
   * el camino, la esquina de la izquierda es donde acaba la lista de medallas y
   * allí el muñeco se comía dos renglones.
   */
  it('de salida está a la derecha, y el globo se abre hacia dentro', () => {
    moverTutor(SITIO_POR_DEFECTO);
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.className).toContain('right-3');
    expect(marco.className).toContain('flex-row-reverse');
  });

  /**
   * Moverlo solo arrastrando deja fuera a quien no puede arrastrar (WCAG
   * 2.5.7): un botón lo cambia de lado y conserva la altura.
   */
  it('se cambia de lado con un boton, sin arrastrar', async () => {
    moverTutor({ lado: 'derecha', alto: 70 });
    const { container } = pintar(<Tutor />);
    await userEvent.click(screen.getByRole('button', { name: 'Preguntarle al profesor' }));

    await userEvent.click(screen.getByRole('button', { name: 'Pasar a la izquierda' }));

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.className).toContain('left-3');
    expect(marco.style.bottom).toBe('30%');

    await userEvent.click(screen.getByRole('button', { name: 'Pasar a la derecha' }));
    expect(marco.className).toContain('right-3');
  });

  it('movido a la izquierda, se abre hacia el otro lado', () => {
    moverTutor({ lado: 'izquierda', alto: 90 });
    const { container } = pintar(<Tutor />);

    const marco = container.firstElementChild as HTMLElement;
    expect(marco.className).toContain('left-3');
    expect(marco.className).not.toContain('flex-row-reverse');
  });
});

describe('Arrastrar el muñeco', () => {
  /**
   * Se puede mover porque tapa cosas: en una unidad larga cae justo encima del
   * último ejercicio. Lo que se guarda no es la posición exacta sino **el lado
   * más cercano y la altura**, para que al cambiar de pantalla o girar el móvil
   * siga estando donde tiene sentido y no medio fuera.
   */
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = () => true;
    // El marco no tiene tamaño en jsdom, y de él sale el lado más cercano.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 700,
      top: 150,
      width: 60,
      height: 60,
    } as DOMRect);
    window.innerWidth = 1000;
    window.innerHeight = 600;
  });

  it('soltarlo a la derecha lo deja en ese lado, y a esa altura', () => {
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 730, clientY: 180, movementX: 700, pointerId: 1 });
    fireEvent.pointerUp(marco, { clientX: 730, clientY: 180, pointerId: 1 });

    expect(JSON.parse(localStorage.getItem('caos-ordenado:sitio-del-profesor')!)).toMatchObject({
      lado: 'derecha',
    });
  });

  /**
   * El puntero se captura **una vez**, en cuanto el gesto pasa de ser un toque
   * a ser un arrastre: capturarlo en cada movimiento sería pedirlo veinte veces
   * por gesto, y capturarlo al apoyar el dedo deja al botón de dentro sin su
   * `click`.
   */
  it('el puntero se captura una sola vez, no en cada movimiento', () => {
    const capturar = vi.fn();
    Element.prototype.setPointerCapture = capturar;
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 400, clientY: 300, movementX: 380, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 730, clientY: 180, movementX: 330, pointerId: 1 });
    fireEvent.pointerUp(marco, { clientX: 730, clientY: 180, pointerId: 1 });

    expect(capturar).toHaveBeenCalledTimes(1);
  });

  // Y si el navegador ya lo había soltado, no se le pide que lo suelte otra vez.
  it('si el puntero ya no estaba capturado, no se suelta dos veces', () => {
    const soltarPuntero = vi.fn();
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = soltarPuntero;
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 730, clientY: 180, movementX: 700, pointerId: 1 });
    fireEvent.pointerUp(marco, { clientX: 730, clientY: 180, pointerId: 1 });

    expect(soltarPuntero).not.toHaveBeenCalled();
    // Y el sitio se guarda igual: lo que importa es dónde se soltó.
    expect(localStorage.getItem('caos-ordenado:sitio-del-profesor')).not.toBeNull();
  });

  it('al soltarlo se devuelve el mando a las clases', () => {
    // Dejar el estilo puesto congelaría al muñeco donde lo soltó el dedo, y al
    // cambiar de pantalla aparecería en un sitio que ya no significa nada.
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 730, clientY: 180, movementX: 700, pointerId: 1 });
    fireEvent.pointerUp(marco, { clientX: 730, clientY: 180, pointerId: 1 });

    // El `top` que queda no es el del dedo: es el del sitio guardado, en tanto
    // por ciento, que es lo que sobrevive a girar el móvil.
    expect(marco.style.left).toBe('');
    expect(marco.style.right).toBe('');
    expect(marco.style.top).toMatch(/%$/);
  });

  it('un toque sin arrastre no mueve nada: abre el globo', async () => {
    // Es lo que separa pulsarlo de moverlo, y por eso el `pointerup` sin
    // movimiento se deja pasar para que el navegador dispare el `click`.
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;
    const antes = localStorage.getItem('caos-ordenado:sitio-del-profesor');

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 21, clientY: 400, movementX: 1, pointerId: 1 });
    fireEvent.pointerUp(marco, { clientX: 21, clientY: 400, pointerId: 1 });
    await userEvent.click(screen.getByRole('button', { name: /preguntarle al profesor/i }));

    expect(localStorage.getItem('caos-ordenado:sitio-del-profesor')).toBe(antes);
    expect(screen.getByRole('button', { name: /cerrar el profesor/i })).toBeInTheDocument();
  });

  it('cancelar el gesto —una llamada entrante— tampoco lo deja a medias', () => {
    const { container } = pintar(<Tutor />);
    const marco = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(marco, { clientX: 20, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(marco, { clientX: 730, clientY: 180, movementX: 700, pointerId: 1 });
    fireEvent.pointerCancel(marco, { clientX: 730, clientY: 180, pointerId: 1 });

    expect(marco.style.left).toBe('');
  });
});

describe('Cómo aparece la frase', () => {
  /**
   * La frase se escribe letra a letra, como si el muñeco la estuviera diciendo.
   * Es adorno, así que **quien ha pedido menos movimiento la ve entera de
   * golpe**: para alguien con sensibilidad al movimiento, un texto que se
   * escribe solo es exactamente lo que hace daño.
   *
   * Lo que no cambia en ninguno de los dos casos es la copia para lectores de
   * pantalla, que lleva la frase completa desde el primer momento: leer letra a
   * letra en voz alta no lo aguanta nadie.
   */
  it('con movimiento reducido, entera desde el primer fotograma', () => {
    pantalla({ quieto: true });

    const { container } = pintar(<Tutor aviso="Otra vez esa." />);

    const globo = container.querySelector(
      '[aria-hidden="true"] + .sr-only',
    )?.previousElementSibling;
    expect(globo?.textContent).toBe('Otra vez esa.');
    vi.unstubAllGlobals();
  });

  it('sin movimiento reducido, se escribe sola hasta terminar', () => {
    pantalla({ quieto: false });
    // El reloj de la animación es `performance.now`, y los fotogramas los pide
    // `requestAnimationFrame`: los dos se mueven a mano.
    let ahora = 0;
    const reloj = vi.spyOn(performance, 'now').mockImplementation(() => ahora);
    const pendientes: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      pendientes.push(cb);
      return pendientes.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    const { container } = pintar(<Tutor aviso="Hola." />);
    const globo = container.querySelector('p > span[aria-hidden="true"]');

    // A los 36 ms van dos letras: uno cada 18.
    ahora = 36;
    pendientes.shift()?.(36);
    expect(globo?.textContent).toBe('Ho');

    // Pasado el tiempo de la frase entera, está completa y deja de pedir cuadros.
    ahora = 1000;
    pendientes.shift()?.(1000);
    expect(globo?.textContent).toBe('Hola.');

    // Y la copia que lee un lector de pantalla la tuvo entera desde el principio.
    expect(container.querySelector('.sr-only')?.textContent).toBe('Hola.');

    reloj.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('Un aviso nuevo', () => {
  it('abre al muñeco aunque ya estuviera cerrado', async () => {
    const { rerender } = pintar(<Tutor />);
    await userEvent.click(screen.getByRole('button', { name: /preguntarle al profesor/i }));
    await userEvent.click(screen.getByRole('button', { name: /cerrar el profesor/i }));

    rerender(
      <AccountProvider account={ANONYMOUS} accounts={false}>
        <Tutor aviso="Esa nota se resiste." />
      </AccountProvider>,
    );

    expect(screen.getByRole('button', { name: /cerrar el profesor/i })).toBeInTheDocument();
  });

  /**
   * Pero no en una pantalla donde el globo taparía lo que hay que leer.
   *
   * Abierto mide lo que mide el formulario. En un teléfono, al fallar una
   * pregunta se plantaba encima de la corrección —la respuesta buena, el porqué
   * y el botón de seguir— y no había manera de continuar sin cerrarlo primero.
   * Comprobado en un navegador de verdad: sobre «Siguiente», lo que respondía
   * `elementFromPoint` era el globo.
   *
   * El muñeco sigue ahí, a un dedo, para quien quiera preguntar.
   */
  it('no se abre solo en una pantalla estrecha, donde taparia la correccion', () => {
    pantalla({ ancha: false });

    pintar(<Tutor aviso="Esa no era." />);

    expect(screen.getByRole('button', { name: /preguntarle al profesor/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('la esquina por la que se abre el globo', () => {
  /**
   * El globo sale del muñeco, así que su esquina pegada es la que mira hacia
   * él: arriba y a la derecha, la de arriba a la derecha. Sin esto, el globo
   * parece flotar suelto al lado en vez de salir de la boca.
   */
  async function abrir(lado: 'derecha' | 'izquierda', alto: number) {
    moverTutor({ lado, alto });
    const { container } = pintar(<Tutor />);
    await userEvent.click(screen.getByRole('button', { name: /preguntarle al profesor/i }));
    return container.querySelector('.superficie-alta')!.className;
  }

  it('anclado arriba, la esquina pegada es la de arriba', async () => {
    expect(await abrir('derecha', 20)).toContain('rounded-tr-none');
    cleanup();
    expect(await abrir('izquierda', 20)).toContain('rounded-tl-none');
  });

  it('y anclado abajo, la de abajo', async () => {
    expect(await abrir('derecha', 80)).toContain('rounded-br-none');
    cleanup();
    expect(await abrir('izquierda', 80)).toContain('rounded-bl-none');
  });
});

describe('un aviso que llega con la pantalla estrecha', () => {
  /**
   * Es el mismo motivo que el de no abrirse solo al entrar: en un teléfono el
   * globo se planta encima de la corrección. Que el aviso llegue después no
   * cambia lo que taparía.
   */
  it('no abre el globo, aunque el aviso sea nuevo', () => {
    pantalla({ ancha: false });
    const { rerender } = pintar(<Tutor />);

    rerender(
      <AccountProvider account={ANONYMOUS} accounts={false}>
        <Tutor aviso="Esa nota se resiste." />
      </AccountProvider>,
    );

    expect(screen.queryByRole('button', { name: /cerrar el profesor/i })).not.toBeInTheDocument();
  });
});
