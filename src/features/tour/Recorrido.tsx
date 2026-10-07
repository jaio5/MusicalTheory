'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';

import {
  guardarPasoDelRecorrido,
  marcarRecorridoVisto,
  marcarTramoVisto,
  type RecorridoEnCurso,
} from '@state/recorrido';
import { Button } from '@ui/Button';

import { cajaIluminada, colocarTarjeta, type Caja, type Sitio } from './colocar';
import { indiceDe, pasosDe } from './pasos';
import { buscarPieza, medirPieza, traerPiezaALaVista } from './pieza';
import { TRAMOS, type Tramo } from './tramos';

/**
 * Cuánto se espera a que aparezca la pieza de un paso.
 *
 * Hay piezas que llegan tarde a propósito —el lienzo se descarga aparte
 * ([adr/0058](../../../docs/adr/0058-componer-se-descarga-por-partes.md))—, y
 * otras que llegan con la pantalla. Pasado el plazo el paso se enseña igual, sin
 * señalar: uno que se queda esperando a una pieza que no viene es peor que uno
 * que la explica sin señalarla.
 */
const ESPERA_MS = 3000;

/**
 * Abrir sin bloquear, o a secas donde no se sabe —jsdom—: los tests miran lo que
 * se dice, y cómo se abre lo pone el navegador.
 */
function abrir(elDialogo: HTMLDialogElement): void {
  if (typeof elDialogo.show === 'function') {
    elDialogo.show();
  } else {
    elDialogo.setAttribute('open', '');
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
 * Un tramo del recorrido de la primera visita: una tarjeta junto a la pieza que
 * explica, con un aro de latón alrededor de ella.
 *
 * **No bloquea nada.** Era un `<dialog>` modal con la sala a oscuras, veintiún
 * pasos seguidos que navegaban solos de pantalla en pantalla: hasta acabarlo o
 * saltarlo no se podía tocar la aplicación, y lo primero que veía quien llegaba
 * era «Bienvenida · 1 de 21». Ahora es un `<dialog>` **sin modal**: la pantalla
 * de detrás sigue viva, la pieza señalada se puede pulsar mientras se lee lo que
 * hace, y el foco no se mueve —quien está escribiendo no pierde el sitio—. Por
 * eso cada paso se anuncia en una región viva, que es como se entera quien no ve
 * la tarjeta aparecer
 * ([adr/0108](../../../docs/adr/0108-el-recorrido-sale-por-pantallas.md)).
 *
 * **Sale el tramo de la pantalla en la que se está**, y nada más: no navega ni
 * cambia nada de la aplicación para enseñarse, así que no hay nada que deshacer
 * al acabar. Se acaba de tres maneras: «Entendido» en el último paso, Escape con
 * el foco dentro —las dos dan el tramo por visto—, o «Saltar el recorrido», que
 * lo da por visto entero.
 */
export function Recorrido({
  tramo,
  estado,
}: {
  readonly tramo: Tramo;
  readonly estado: RecorridoEnCurso;
}) {
  const pasos = pasosDe(tramo);
  const indice = indiceDe(pasos, estado.paso);
  const paso = pasos[indice]!;
  const ultimo = indice === pasos.length - 1;

  const idTitulo = useId();
  const idTexto = useId();

  const dialogo = useRef<HTMLDialogElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const pieza = useRef<Element | null>(null);
  /** Mientras la primera búsqueda espera a la pieza, el fotograma no busca. */
  const buscando = useRef(true);
  const firma = useRef('');

  const [vista, setVista] = useState<Vista>({ caja: null, sitio: null });
  /** El paso cuya pieza ya se ha buscado: hasta entonces no se anuncia nada. */
  const [buscado, setBuscado] = useState<string | null>(null);

  // Al montar se abre, sin modal y sin llevarse el foco.
  useEffect(() => {
    const elDialogo = dialogo.current!;
    abrir(elDialogo);
    return () => elDialogo.removeAttribute('open');
  }, []);

  // Buscar la pieza del paso, esperando un poco a la que llegue tarde.
  useEffect(() => {
    // La del paso anterior ya no vale, aunque siga en pantalla.
    pieza.current = null;
    buscando.current = true;
    let vivo = true;
    const inicio = Date.now();
    let temporizador = 0;
    const buscar = () => {
      /* v8 ignore next 3 -- el temporizador se cancela al desmontar; esto solo cubre la carrera */
      if (!vivo) {
        return;
      }
      const encontrada = buscarPieza(paso.objetivo);
      if (encontrada === null && Date.now() - inicio < ESPERA_MS) {
        temporizador = window.setTimeout(buscar, 100);
        return;
      }
      if (encontrada !== null) {
        traerPiezaALaVista(encontrada);
      }
      pieza.current = encontrada;
      buscando.current = false;
      setBuscado(paso.id);
    };
    temporizador = window.setTimeout(buscar, 0);
    return () => {
      vivo = false;
      window.clearTimeout(temporizador);
    };
  }, [paso]);

  /*
    Medir en cada fotograma, y repintar solo si algo se ha movido.

    La pieza se mueve sin avisar: la pantalla termina de llegar, una fila se
    desplaza, la ventana cambia de tamaño o el teléfono se gira. Y ahora que la
    pantalla sigue viva, **la pieza puede cambiar por otra**: en componer, elegir
    tonalidad quita los cuatro botones de salida y pone la lista de acordes, y el
    paso es el mismo. Si la que se señalaba ya no está, se busca otra vez por el
    mismo objetivo. Son dos medidas por fotograma mientras la tarjeta está abierta,
    y el estado solo cambia cuando cambia un píxel.
  */
  useEffect(() => {
    let id = 0;
    let fotogramas = 0;
    const medir = () => {
      const ventana = {
        ancho: document.documentElement.clientWidth,
        alto: document.documentElement.clientHeight,
      };
      fotogramas += 1;
      let elemento = pieza.current;
      // Si se fue, se busca la que la sustituye; y si no hay ninguna, se vuelve a
      // mirar cada cuarto de segundo, porque la nueva puede llegar tarde —la
      // lista de acordes viene con el lienzo, que se descarga aparte—.
      const perdida = elemento !== null && !elemento.isConnected;
      const sinEncontrar = elemento === null && buscando.current === false;
      if (perdida || (sinEncontrar && fotogramas % 15 === 0)) {
        elemento = buscarPieza(paso.objetivo);
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
    guardarPasoDelRecorrido({ vistos: estado.vistos, paso: pasos[nuevo]!.id });
  }

  /** Este tramo, visto: el de la siguiente pantalla sale al llegar a ella. */
  function terminarElTramo(): void {
    marcarTramoVisto(tramo, TRAMOS);
  }

  const siguiente = () => (ultimo ? terminarElTramo() : ir(indice + 1));

  const nombre = vista.caja !== null ? paso.nombre : undefined;
  /*
    Lo que se dice en cada paso, **también en el primero**: sin modal la tarjeta
    no se lleva el foco, así que nadie la lee al abrirse. La región está montada
    vacía antes —una que nace con el texto dentro no la lee todo lector— y espera
    a que se haya buscado la pieza para poder decir cuál es.
  */
  const anuncio =
    buscado === paso.id
      ? `Recorrido, paso ${indice + 1} de ${pasos.length}. ${paso.titulo}. ${paso.texto}${
          nombre === undefined ? '' : ` Señalado: ${nombre}.`
        }`
      : '';

  const aro: CSSProperties | null =
    vista.caja === null
      ? null
      : {
          left: vista.caja.x,
          top: vista.caja.y,
          width: vista.caja.ancho,
          height: vista.caja.alto,
        };

  return (
    <>
      {/* El aro alrededor de la pieza. Es adorno —lo que se señala lo dice el
          texto— y no se interpone: los clics pasan a la pieza de debajo. */}
      {aro !== null && (
        <div
          aria-hidden="true"
          data-aro-del-recorrido
          className="outline-brass-bright pointer-events-none fixed z-40 rounded-md outline-2 motion-safe:transition-[left,top,width,height] motion-safe:duration-200"
          style={aro}
        />
      )}

      {/* Escape con el foco dentro cierra el tramo. Sin modal, el navegador no
          lo hace solo: un `<dialog>` abierto con `show` no recibe `cancel`. */}
      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        onKeyDown={(evento) => {
          // Las teclas de la tarjeta no salen de ella: componer escucha sus
          // atajos en la ventana, y un `2` pulsado aquí cambiaba de espacio.
          evento.stopPropagation();
          if (evento.key === 'Escape') {
            evento.preventDefault();
            terminarElTramo();
          }
        }}
        className="superficie-alta fixed z-50 m-0 max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border-0 p-0 motion-safe:transition-[left,top] motion-safe:duration-200"
        style={{
          left: vista.sitio?.x ?? 0,
          top: vista.sitio?.y ?? 0,
          visibility: vista.sitio === null ? 'hidden' : undefined,
        }}
      >
        <div ref={tarjeta} className="p-4">
          <p className="rotulo">
            {pasos.length > 1 ? `${indice + 1} de ${pasos.length}` : 'Recorrido'}
          </p>
          <h2 id={idTitulo} className="titular text-text mt-1 text-lg">
            {paso.titulo}
          </h2>
          <p id={idTexto} className="text-text-muted mt-2 text-sm">
            {paso.texto}
            {nombre !== undefined && <span className="sr-only"> Señalado: {nombre}.</span>}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {/* Un clic y no sale más, en ninguna pantalla. Se retoma desde
                Aprender, y la bienvenida lo dice. */}
            <button
              type="button"
              onClick={marcarRecorridoVisto}
              className="text-text-muted hover:text-brass-bright min-h-tap cursor-pointer px-1 text-sm"
            >
              Saltar el recorrido
            </button>
            <div className="ml-auto flex gap-2">
              {indice > 0 && (
                <Button variant="quiet" tamano="compacto" onClick={() => ir(indice - 1)}>
                  Anterior
                </Button>
              )}
              <Button tamano="compacto" onClick={siguiente}>
                {ultimo ? 'Entendido' : 'Siguiente'}
              </Button>
            </div>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {anuncio}
        </p>
      </dialog>
    </>
  );
}
