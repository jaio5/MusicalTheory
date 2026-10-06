'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';

import { useBancoStore } from '@state/banco';
import {
  guardarPasoDelRecorrido,
  marcarRecorridoVisto,
  type LoQuePuso,
  type RecorridoEnCurso,
} from '@state/recorrido';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { useHayBanco } from '@ui/use-hay-banco';

import { cajaIluminada, colocarTarjeta, type Caja, type Sitio } from './colocar';
import { indiceDe, pasosPara, textoDe } from './pasos';
import { buscarPieza, medirPieza, traerPiezaALaVista } from './pieza';

/** La que se pone para enseñar componer cuando no hay ninguna. */
const DO_MAYOR = { tonic: 0, mode: 'major' } as const;

/**
 * Cuánto se espera a que aparezca la pieza de un paso.
 *
 * Hay piezas que llegan tarde a propósito —el lienzo y el ensayo se descargan
 * aparte ([adr/0058](../../../docs/adr/0058-componer-se-descarga-por-partes.md))—,
 * y otras que llegan con la pantalla nueva. Pasado el plazo el paso se enseña
 * igual, con la tarjeta en medio: un recorrido que se queda esperando a una pieza
 * que no viene es peor que uno que la explica sin señalarla.
 */
const ESPERA_MS = 3000;

/**
 * Cómo volver a encontrar lo que tenía el foco si la pantalla se ha vuelto a
 * pintar mientras tanto: por su `data-recorrido`, que lo lleva a propósito el
 * botón de volver a verlo, o por su `id`. Sin ninguno de los dos no se puede, y
 * el foco se queda donde lo deje el navegador.
 */
export function selectorDe(elemento: Element | null): string | null {
  if (!(elemento instanceof HTMLElement) || elemento === document.body) {
    return null;
  }
  const marca = elemento.dataset['recorrido'];
  if (marca !== undefined) {
    return `[data-recorrido="${marca}"]`;
  }
  return elemento.id === '' ? null : `[id="${elemento.id.replaceAll('"', '\\"')}"]`;
}

/**
 * Abrir como modal, o a secas donde no se sabe —jsdom—: los tests miran lo que
 * se dice, y la modalidad la pone el navegador.
 */
function abrirComoModal(elDialogo: HTMLDialogElement): void {
  if (typeof elDialogo.showModal === 'function') {
    elDialogo.showModal();
  } else {
    elDialogo.setAttribute('open', '');
  }
}

function cerrarDialogo(elDialogo: HTMLDialogElement): void {
  if (typeof elDialogo.close === 'function') {
    elDialogo.close();
  } else {
    elDialogo.removeAttribute('open');
  }
}

/** Lo que se pinta, redondeado: si no cambia un píxel, no se repinta. */
function firmaDe(caja: Caja | null, sitio: Sitio): string {
  const numeros = caja === null ? [] : [caja.x, caja.y, caja.ancho, caja.alto];
  return [...numeros, sitio.x, sitio.y].map(Math.round).join(',');
}

interface Vista {
  readonly caja: Caja | null;
  readonly sitio: Sitio | null;
}

/**
 * El recorrido de la primera visita: una tarjeta que va de pieza en pieza por
 * las pantallas de verdad, y las señala encendiéndolas en una sala a oscuras.
 *
 * **Es un `<dialog>` modal del navegador**, y es lo que trae casi toda la
 * accesibilidad hecha: lo de detrás queda inerte —el tabulador no se escapa a
 * los mandos tapados—, Escape lo cierra, y al cerrar el navegador devuelve el
 * foco. Lo que no trae se pone a mano: el título y la descripción con nombre,
 * las flechas para ir y volver, el anuncio de cada paso y de la pieza señalada,
 * y la vuelta del foco cuando la pantalla de antes se ha vuelto a pintar.
 *
 * **La pieza se ve pero no se toca.** Es lo que tiene ser modal: el aro deja ver
 * lo de detrás y nada de ello responde. Dejarla viva obligaría a sacar el foco
 * del diálogo y explicar a un lector de pantalla dónde está.
 *
 * Navega solo entre pantallas y, en componer, cambia de espacio y pone una
 * tonalidad si falta: **lo que toca para enseñarse, lo deshace al acabar**, y lo
 * apunta en el almacenamiento para deshacerlo aunque haya habido una recarga.
 */
export function Recorrido({ estado }: { readonly estado: RecorridoEnCurso }) {
  const hayBanco = useHayBanco();
  const pasos = pasosPara(hayBanco);
  const indice = indiceDe(pasos, estado.paso);
  const paso = pasos[indice]!;
  const ultimo = indice === pasos.length - 1;
  const texto = textoDe(paso, hayBanco);

  const router = useRouter();
  const pathname = usePathname();
  const idTitulo = useId();
  const idTexto = useId();

  const dialogo = useRef<HTMLDialogElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const pieza = useRef<Element | null>(null);
  const firma = useRef('');
  const terminado = useRef(false);
  const previo = useRef<{ elemento: Element | null; selector: string | null }>({
    elemento: null,
    selector: null,
  });

  const [vista, setVista] = useState<Vista>({ caja: null, sitio: null });
  /** El paso cuya pieza ya se ha buscado: hasta entonces no se anuncia nada. */
  const [buscado, setBuscado] = useState<string | null>(null);
  /** Si ya se ha movido de paso: el primero lo lee el diálogo al abrirse. */
  const [movido, setMovido] = useState(false);
  /** A dónde se vuelve al acabar, mientras se llega. */
  const [saliendo, setSaliendo] = useState<string | null>(null);

  // Al abrir: apuntar quién tenía el foco y abrir el diálogo como modal.
  useEffect(() => {
    const activo = document.activeElement;
    previo.current = {
      elemento: activo === document.body ? null : activo,
      selector: selectorDe(activo),
    };
    const elDialogo = dialogo.current!;
    abrirComoModal(elDialogo);
    // A mano y no con `autoFocus`: React lo hace al montar, antes de que el
    // diálogo se abra, y `showModal` se lleva el foco al propio diálogo. Ahí
    // Intro no pulsa nada.
    elDialogo.querySelector<HTMLElement>('[data-recorrido-siguiente]')!.focus();
    return () => cerrarDialogo(elDialogo);
  }, []);

  // Dónde estabas al empezar, para devolverte allí.
  useEffect(() => {
    if (estado.origen === null) {
      guardarPasoDelRecorrido({
        paso: estado.paso ?? pasos[0]!.id,
        origen: pathname,
        puso: estado.puso,
      });
    }
  }, [estado, pathname, pasos]);

  // Ir a la pantalla del paso, preparar lo que haga falta y buscar la pieza.
  useEffect(() => {
    // La del paso anterior ya no vale, aunque siga en pantalla: hasta encontrar
    // la nueva, la sala se queda a oscuras en vez de señalar lo de antes.
    pieza.current = null;
    if (saliendo !== null) {
      return;
    }
    if (paso.ruta !== undefined && pathname !== paso.ruta) {
      router.push(paso.ruta);
      return;
    }

    let puso: LoQuePuso = estado.puso;
    if (pathname === '/componer') {
      const banco = useBancoStore.getState();
      if (paso.espacio !== undefined && banco.espacio !== paso.espacio) {
        // El de antes se apunta la primera vez que se cambia: después, el que hay
        // ya es uno que ha puesto el recorrido.
        if (puso.espacio === null) {
          puso = { ...puso, espacio: banco.espacio };
        }
        banco.actions.espacio(paso.espacio);
      }
      if (paso.necesitaTonalidad === true && selectActiveKey(useSessionStore.getState()) === null) {
        useSessionStore.getState().actions.pinKey(DO_MAYOR);
        puso = { ...puso, tonalidad: true };
      }
    }
    if (puso !== estado.puso) {
      guardarPasoDelRecorrido({ paso: paso.id, origen: estado.origen, puso });
      return;
    }

    let vivo = true;
    const inicio = Date.now();
    let temporizador = 0;
    const buscar = () => {
      /* v8 ignore next 3 -- el temporizador se cancela al desmontar; esto solo cubre la carrera */
      if (!vivo) {
        return;
      }
      const encontrada = paso.objetivo === undefined ? null : buscarPieza(paso.objetivo);
      if (encontrada === null && paso.objetivo !== undefined && Date.now() - inicio < ESPERA_MS) {
        temporizador = window.setTimeout(buscar, 100);
        return;
      }
      if (encontrada !== null) {
        traerPiezaALaVista(encontrada);
      }
      pieza.current = encontrada;
      setBuscado(paso.id);
    };
    temporizador = window.setTimeout(buscar, 0);
    return () => {
      vivo = false;
      window.clearTimeout(temporizador);
    };
  }, [paso, pathname, saliendo, estado.origen, estado.puso, router]);

  /*
    Medir en cada fotograma, y repintar solo si algo se ha movido.

    La pieza se mueve sin avisar: la pantalla termina de llegar, una fila se
    desplaza para enseñarla, la ventana cambia de tamaño o el teléfono se gira.
    Un `ResizeObserver` no ve que algo **cambie de sitio** sin cambiar de tamaño,
    y escuchar cada desplazamiento de cada caja es más código para lo mismo. Son
    dos medidas por fotograma mientras el recorrido está abierto, y el estado
    solo cambia cuando cambia un píxel.
  */
  useEffect(() => {
    let id = 0;
    const medir = () => {
      const ventana = {
        ancho: document.documentElement.clientWidth,
        alto: document.documentElement.clientHeight,
      };
      let elemento = pieza.current;
      // Si la pantalla la ha vuelto a pintar, la de antes ya no está: se busca
      // la nueva por el mismo nombre. Solo hay pieza si el paso tiene objetivo.
      if (elemento !== null && !elemento.isConnected) {
        elemento = buscarPieza(paso.objetivo!);
        pieza.current = elemento;
      }
      const medida = elemento === null ? null : medirPieza(elemento, paso.conLoQueFlota);
      const caja = medida === null ? null : cajaIluminada(medida, ventana);
      const nodo = tarjeta.current!;
      const sitio = colocarTarjeta(
        caja,
        { ancho: nodo.offsetWidth, alto: nodo.offsetHeight },
        ventana,
      );
      const nueva = firmaDe(caja, sitio);
      if (nueva !== firma.current) {
        firma.current = nueva;
        setVista({ caja, sitio });
      }
      id = requestAnimationFrame(medir);
    };
    id = requestAnimationFrame(medir);
    return () => cancelAnimationFrame(id);
  }, [paso]);

  function ir(nuevo: number): void {
    setMovido(true);
    guardarPasoDelRecorrido({ paso: pasos[nuevo]!.id, origen: estado.origen, puso: estado.puso });
  }

  /**
   * Acabar, por donde sea: terminado, saltado o cerrado con Escape. Las tres
   * cuentan como visto —volver a sacarlo en la siguiente carga a quien lo ha
   * cerrado sería no haberle escuchado— y las tres deshacen lo mismo.
   */
  function terminar(): void {
    if (terminado.current) {
      return;
    }
    terminado.current = true;

    const { puso, origen } = estado;
    if (puso.espacio !== null) {
      useBancoStore.getState().actions.espacio(puso.espacio);
    }
    // La tonalidad solo se quita si sigue siendo la que puso el recorrido.
    const sesion = useSessionStore.getState();
    if (
      puso.tonalidad &&
      sesion.pinnedKey?.tonic === DO_MAYOR.tonic &&
      sesion.pinnedKey.mode === DO_MAYOR.mode
    ) {
      sesion.actions.followDetection();
    }

    cerrarDialogo(dialogo.current!);
    /* v8 ignore next -- el origen se apunta al abrir, antes de que se pueda pulsar nada */
    const destino = origen ?? pathname;
    if (destino !== pathname) {
      router.push(destino);
    }
    setSaliendo(destino);
  }

  const siguiente = () => (ultimo ? terminar() : ir(indice + 1));
  const anterior = () => {
    if (indice > 0) {
      ir(indice - 1);
    }
  };

  // Las flechas, siempre con lo último: el escuchador se pone una vez.
  const teclas = useRef({ siguiente, anterior });
  useEffect(() => {
    teclas.current = { siguiente, anterior };
  });

  /*
    Las teclas del diálogo **no salen de él**.

    Componer escucha sus atajos en la ventana y sin modificador —`1`, `2`, `3`,
    los corchetes—, así que con el recorrido abierto un `2` cambiaba de espacio
    por debajo del paso que lo estaba explicando. Se paran aquí, en el propio
    diálogo; Escape no se ve afectado, porque cerrar es lo que el navegador hace
    por defecto, no un escuchador.
  */
  useEffect(() => {
    const elDialogo = dialogo.current!;
    const alPulsar = (evento: KeyboardEvent) => {
      evento.stopPropagation();
      if (evento.key === 'ArrowRight') {
        evento.preventDefault();
        teclas.current.siguiente();
      } else if (evento.key === 'ArrowLeft') {
        evento.preventDefault();
        teclas.current.anterior();
      }
    };
    elDialogo.addEventListener('keydown', alPulsar);
    return () => elDialogo.removeEventListener('keydown', alPulsar);
  }, []);

  // Llegados a donde se estaba, el foco vuelve a su sitio y se da por visto.
  useEffect(() => {
    if (saliendo === null || pathname !== saliendo) {
      return;
    }
    let vivo = true;
    const inicio = Date.now();
    let temporizador = 0;
    const devolver = () => {
      /* v8 ignore next 3 -- el temporizador se cancela al desmontar; esto solo cubre la carrera */
      if (!vivo) {
        return;
      }
      const { elemento, selector } = previo.current;
      const destino =
        elemento !== null && elemento.isConnected
          ? elemento
          : selector === null
            ? null
            : document.querySelector(selector);
      if (destino === null && selector !== null && Date.now() - inicio < 1000) {
        temporizador = window.setTimeout(devolver, 50);
        return;
      }
      if (destino instanceof HTMLElement) {
        destino.focus();
      }
      marcarRecorridoVisto();
    };
    temporizador = window.setTimeout(devolver, 0);
    return () => {
      vivo = false;
      window.clearTimeout(temporizador);
    };
  }, [saliendo, pathname]);

  const nombre = paso.objetivo !== undefined && vista.caja !== null ? paso.nombre : undefined;
  /*
    Lo que se dice al cambiar de paso. El primero no: al abrirse, el diálogo ya
    lee su título y su descripción, y decirlo también aquí lo leería dos veces.
    Espera a que se haya buscado la pieza para poder decir cuál es.
  */
  const anuncio =
    movido && buscado === paso.id
      ? `Paso ${indice + 1} de ${pasos.length}. ${paso.titulo}. ${texto}${
          nombre === undefined ? '' : ` Señalado: ${nombre}.`
        }`
      : '';

  const foco: CSSProperties =
    vista.caja === null
      ? { left: '50%', top: '50%', width: 0, height: 0 }
      : {
          left: vista.caja.x,
          top: vista.caja.y,
          width: vista.caja.ancho,
          height: vista.caja.alto,
        };

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      onCancel={(evento) => {
        evento.preventDefault();
        terminar();
      }}
      // Si el navegador lo cierra sin pasar por `cancel` —Chrome lo hace con el
      // segundo Escape seguido—, se acaba igual. Abierto otra vez es que lo ha
      // cerrado el modo estricto de React al montar dos veces, y no es un cierre.
      onClose={() => {
        if (!terminado.current && !dialogo.current!.open) {
          terminar();
        }
      }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0 backdrop:bg-transparent"
    >
      {/* La sala a oscuras con un agujero encendido: una sombra enorme alrededor
          de la caja de la pieza. Con la pieza sin encontrar, el agujero mide cero
          y la sala entera queda a oscuras. Es adorno: lo que se señala lo dice el
          texto. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed rounded-md motion-safe:transition-[left,top,width,height] motion-safe:duration-200 ${
          vista.caja === null ? '' : 'outline-brass-bright outline-2 outline-offset-0'
        }`}
        style={{
          ...foco,
          boxShadow: '0 0 0 200vmax color-mix(in srgb, var(--color-night) 62%, transparent)',
        }}
      />

      <div
        ref={tarjeta}
        className={`superficie-alta fixed max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto p-4 motion-safe:transition-[left,top] motion-safe:duration-200 ${
          vista.sitio === null ? 'opacity-0' : ''
        }`}
        style={{ left: vista.sitio?.x ?? 0, top: vista.sitio?.y ?? 0 }}
      >
        <p className="rotulo">
          {paso.seccion} · {indice + 1} de {pasos.length}
        </p>
        <h2 id={idTitulo} className="titular text-text mt-1 text-lg">
          {paso.titulo}
        </h2>
        <p id={idTexto} className="text-text-muted mt-2 text-sm">
          {texto}
          {nombre !== undefined && <span className="sr-only"> Señalado: {nombre}.</span>}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={terminar}
            className="text-text-muted hover:text-brass-bright min-h-tap cursor-pointer px-1 text-sm"
          >
            Saltar el recorrido
          </button>
          {/* Ir y volver juntos, para que al partirse la fila en un teléfono
              pequeño bajen los dos a la derecha y no se quede uno solo. */}
          <div className="ml-auto flex gap-2">
            {/* Siempre en su sitio, y apagado en el primero con `aria-disabled`:
                quitarlo o apagarlo con `disabled` soltaría el foco al volver al
                principio, y el foco no puede salir de aquí. */}
            <Button
              variant="quiet"
              tamano="compacto"
              className="aria-disabled:opacity-50"
              onClick={anterior}
              aria-disabled={indice === 0 ? true : undefined}
              aria-keyshortcuts="ArrowLeft"
            >
              Anterior
            </Button>
            {/* El foco empieza aquí —lo que se hace casi siempre es seguir—, y lo
                pone el efecto de abrir. */}
            <Button
              tamano="compacto"
              onClick={siguiente}
              data-recorrido-siguiente
              aria-keyshortcuts="ArrowRight"
            >
              {ultimo ? 'Terminar' : 'Siguiente'}
            </Button>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {anuncio}
        </p>
      </div>
    </dialog>
  );
}
