'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import {
  guardarPasoDelRecorrido,
  marcarRecorridoVisto,
  marcarTramosVistos,
  type RecorridoEnCurso,
} from '@state/recorrido';
import { Button } from '@ui/Button';

import { indiceDe, pasosDe } from './pasos';
import { seguirLaPieza, type Vista } from './seguir';
import { TRAMOS, type Tramo } from './tramos';

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

/** Mover con `transform`, que no cuenta como desplazamiento de la página. */
function trasladar(x: number, y: number): string {
  return `translate(${x}px, ${y}px)`;
}

/** Lo pintado, y si ya estaba en otro sitio: la primera vez se pone, no se desliza. */
interface Colocada extends Vista {
  readonly movida: boolean;
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
 * **Sale lo que toca en la pantalla en la que se está**, y nada más —la
 * bienvenida y el tramo de la pantalla, en la misma tarjeta—: no navega ni
 * cambia nada de la aplicación para enseñarse, así que no hay nada que deshacer
 * al acabar. Se acaba de tres maneras: «Entendido» en el último paso, Escape con
 * el foco dentro —las dos dan sus tramos por vistos—, o «Saltar el recorrido»,
 * que lo da por visto entero.
 *
 * **Y no mueve la página.** Se colocaba animando `left` y `top`, y cada
 * fotograma de ese deslizamiento era un desplazamiento de la página: 0,23 a 0,32
 * de CLS en un teléfono, en seis pantallas. Ahora se mueve con `transform`, que
 * no cuenta; la primera vez se pone en su sitio sin deslizarse, y no se pinta
 * hasta tenerlo ([adr/0120](../../../docs/adr/0120-la-primera-visita-no-se-mueve-y-cada-pantalla-trae-lo-suyo.md)).
 */
export function Recorrido({
  tramos,
  estado,
}: {
  readonly tramos: readonly Tramo[];
  readonly estado: RecorridoEnCurso;
}) {
  const pasos = tramos.flatMap(pasosDe);
  const indice = indiceDe(pasos, estado.paso);
  const paso = pasos[indice]!;
  const ultimo = indice === pasos.length - 1;

  const idTitulo = useId();
  const idTexto = useId();

  const dialogo = useRef<HTMLDialogElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);

  const [vista, setVista] = useState<Colocada | null>(null);
  /** El paso cuya pieza ya se ha buscado: hasta entonces no se anuncia nada. */
  const [buscado, setBuscado] = useState<string | null>(null);

  // Al montar se abre, sin modal y sin llevarse el foco.
  useEffect(() => {
    const elDialogo = dialogo.current!;
    abrir(elDialogo);
    return () => elDialogo.removeAttribute('open');
  }, []);

  // De maquetación y no de efecto: si la pieza ya está, la tarjeta se coloca
  // antes de que el navegador pinte el fotograma en el que aparece.
  useLayoutEffect(
    () =>
      seguirLaPieza(paso, tarjeta.current!, (nueva) => {
        setVista((antes) => ({ ...nueva, movida: antes !== null }));
        setBuscado(paso.id);
      }),
    [paso],
  );

  function ir(nuevo: number): void {
    guardarPasoDelRecorrido({ vistos: estado.vistos, paso: pasos[nuevo]!.id });
  }

  /** Lo de esta tarjeta, visto: el tramo de otra pantalla sale al llegar a ella. */
  function terminarElTramo(): void {
    marcarTramosVistos(tramos, TRAMOS);
  }

  const siguiente = () => (ultimo ? terminarElTramo() : ir(indice + 1));

  const caja = vista?.caja ?? null;
  const nombre = caja !== null ? paso.nombre : undefined;
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

  // Solo se desliza lo que ya estaba puesto, y solo para quien no pide quietud.
  const desliza = vista?.movida === true;
  const aro: CSSProperties | null =
    caja === null
      ? null
      : { transform: trasladar(caja.x, caja.y), width: caja.ancho, height: caja.alto };
  const sitioDeLaTarjeta: CSSProperties =
    vista === null
      ? { visibility: 'hidden' }
      : { transform: trasladar(vista.sitio.x, vista.sitio.y) };

  return (
    <>
      {/* El aro alrededor de la pieza. Es adorno —lo que se señala lo dice el
          texto— y no se interpone: los clics pasan a la pieza de debajo. */}
      {aro !== null && (
        <div
          aria-hidden="true"
          data-aro-del-recorrido
          className={`outline-brass-bright pointer-events-none fixed top-0 left-0 z-40 rounded-md outline-2 ${
            desliza
              ? 'motion-safe:transition-[transform,width,height] motion-safe:duration-200'
              : ''
          }`}
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
        className={`superficie-alta fixed top-0 left-0 z-50 m-0 max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border-0 p-0 ${
          desliza ? 'motion-safe:transition-transform motion-safe:duration-200' : ''
        }`}
        style={sitioDeLaTarjeta}
      >
        <div ref={tarjeta} className="p-4">
          <p className="rotulo">
            {pasos.length > 1 ? `${indice + 1} de ${pasos.length}` : 'Recorrido'}
          </p>
          <h2 id={idTitulo} className="titular text-text mt-1 text-lg">
            {paso.titulo}
          </h2>
          <p id={idTexto} className="text-text-muted mt-2">
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
