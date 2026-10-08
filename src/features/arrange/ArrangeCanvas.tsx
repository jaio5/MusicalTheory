'use client';

import { memo, useCallback, useRef, useState } from 'react';

import {
  HARMONIC_ROLES,
  blockChord,
  bloquesEnDuda,
  findBlock,
  findNote,
  isDoubtful,
  type Block,
  type DegreeSymbol,
  type EspecieDeBloque,
  type KeyMode,
  type Part,
  type PitchClass,
} from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { selectActiveKey, selectEscala, useSessionStore } from '@state/session-store';
import { Chip } from '@ui/Chip';
import { EmpezarPorTonalidad } from '@ui/EmpezarPorTonalidad';
import { IconoCanciones } from '@ui/icons';
import { useFuncionEstable } from '@ui/use-funcion-estable';
import { Vacio } from '@ui/Vacio';

import { BarraDelLienzo } from './BarraDelLienzo';
import { ChordEntry } from './ChordEntry';
import { CorregirAcorde } from './CorregirAcorde';
import { FantasmaDeBloque, FantasmaDeSugerencia } from './Fantasmas';
import { LoElegido } from './LoElegido';
import { NotaSiguiente } from './NotaSiguiente';
import { PartRow, type Punteo } from './PartRow';
import { Sugerencias } from './Sugerencias';
import { useArrangementPlayer } from './use-arrangement-player';
import { useArrastreDeBloques } from './use-arrastre-de-bloques';
import { useArrastreDeSugerencias } from './use-arrastre-de-sugerencias';
import { useEleccion } from './use-eleccion';
import { useFocoPendiente } from './use-foco-pendiente';
import { usePorPulso } from './use-por-pulso';
import { useTeclasDelLienzo } from './use-teclas-del-lienzo';

/**
 * El lienzo: la canción como bloques que se arrastran, se estiran y suenan.
 *
 * Es la segunda cara de componer. La primera —la de siempre— responde a «qué
 * acorde tengo delante»: la rueda, sus formas, a dónde ir. Esta responde a «cómo
 * va mi canción», y esa pregunta es horizontal y en el tiempo.
 *
 * ## Qué hace falta saber de música para usarlo
 *
 * Nada. Los bloques traen el cifrado y el grado, el filo de color dice si el
 * acorde reposa, sale o tensa, y la columna de la derecha propone los que suelen
 * venir después **con su porqué en una línea**. Poner un acorde es pulsar el que
 * te gusta de esa lista.
 *
 * ## Cómo está partido
 *
 * Era una sola función de casi mil ochocientas líneas, y cada acorde que sonaba la
 * repintaba entera. Ahora cada pieza se entera de lo suyo: la barra lee el micro
 * y el deshacer, «Lo elegido» lee lo elegido, cada fila lee por dónde va la
 * reproducción (`cabezal.ts`) y los gestos viven en sus ganchos
 * ([adr/0119](../../../docs/adr/0119-la-partitura-llena-su-hueco-y-el-lienzo-se-parte.md)).
 * Aquí queda lo que reparte: la escala, la parte de destino y lo que va a cada
 * fila.
 *
 * ## Lo que no está aquí
 *
 * Ni tonalidad ni tempo: los pone la pantalla, y son los mismos que en la otra
 * cara. Cambiar de tonalidad en la rueda cambia todos los bloques a la vez sin
 * tocar el montaje, porque lo que hay guardado son grados.
 */

/**
 * La leyenda de los papeles armónicos, **con la palabra de `HARMONIC_ROLES`** y
 * no una escrita aquí: la de la subdominante decía «salida», al lado del panel
 * «Salidas», que es otra cosa —lo que propone la IA—.
 */
const LEYENDA_DE_PAPELES: ReadonlyArray<readonly [string, string]> = Object.values(
  HARMONIC_ROLES,
).map(({ short, word }) => [short, word]);

/**
 * Con `memo` y sin props: la pantalla de componer se repinta con cada cambio del
 * banco —cada movimiento de un divisor, cada área que se pliega— y el lienzo se
 * entera de lo suyo por los almacenes, no por quien lo monta.
 */
export const ArrangeCanvas = memo(function ArrangeCanvas() {
  const activeKey = useSessionStore(selectActiveKey);

  if (activeKey === null) {
    return (
      // Se centra con `my-auto` **en el hijo**, que es lo que pide
      // `docs/ESTILO.md`: con `justify-center` en la caja que se desplaza, lo que
      // no cabe se sale por los dos lados y no hay forma de bajar hasta ello.
      <div className="flex min-h-0 grow flex-col overflow-y-auto p-3">
        <div className="my-auto">
          <EmpezarPorTonalidad />
        </div>
      </div>
    );
  }
  // Una pieza aparte para lo que necesita tonalidad: así ninguno de sus ganchos
  // tiene que preguntar si la hay, y lo que mide su caja empieza a medir cuando
  // la caja existe.
  return <Lienzo tonic={activeKey.tonic} mode={activeKey.mode} />;
});

/**
 * Devuelve la canción a la pantalla después de poner un acorde.
 *
 * En ancho no hace nada, porque el lienzo y el carril de acordes son dos
 * columnas con su propio desplazamiento. En estrecho **son la misma columna**,
 * así que al pulsar un acorde del carril el navegador lo trae a la vista y se
 * lleva la canción por encima del borde: ponías tu primer acorde y no lo veías.
 *
 * Se espera un fotograma porque el bloque nuevo todavía no está pintado, y se
 * mira antes de mover: si ya se ve, no se toca la vista de nadie.
 *
 * **Y «se ve» no es `top >= 0`.** En el móvil, encima de la canción flotan la
 * barra de tonalidad y las tiras de área, así que la parte podía estar en el
 * píxel 116 y **debajo de las barras**. Se pregunta quién hay en su borde de
 * arriba; si no es ella, la tapa algo, y `scroll-margin-top` sale del alto de lo
 * que tapa, no de un número escrito a mano que caducaría al mover una barra.
 */
function traerLaCancionALaVista(caja: HTMLElement | null): void {
  requestAnimationFrame(() => {
    /* v8 ignore next 3 -- se llama al poner un acorde, y para eso el lienzo esta pintado */
    if (caja === null) {
      return;
    }
    const { top, left, width } = caja.getBoundingClientRect();
    const enSuBorde = document.elementFromPoint(left + width / 2, top + 2);
    const tapa = enSuBorde !== null && !caja.contains(enSuBorde) ? enSuBorde : null;

    if (top >= 0 && tapa === null) {
      return;
    }
    caja.style.scrollMarginTop =
      tapa === null ? '' : `${Math.ceil(tapa.getBoundingClientRect().bottom)}px`;
    caja.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

/** Dónde está un acorde dicho como se busca: «Estrofa, compás 3». */
function dondeEsta(sitio: { part: Part; index: number }, beatsPerBar: number): string {
  const inicio = sitio.part.blocks
    .slice(0, sitio.index)
    .reduce((suma, block) => suma + block.beats, 0);
  return `${sitio.part.name}, compás ${Math.floor(inicio / beatsPerBar) + 1}`;
}

function Lienzo({ tonic, mode }: { readonly tonic: PitchClass; readonly mode: KeyMode }) {
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const scaleId = useSessionStore(selectEscala);
  const arrangement = useArrangementStore((state) => state.arrangement);
  const acciones = useArrangementStore((state) => state.actions);

  const { selectedBlockId, selectedNoteId, elegirBloque, elegirNota, soltarTodo } = useEleccion();
  const [activePartId, setActivePartId] = useState<string | null>(null);
  /**
   * La partitura es lo primero que se ve: es donde se escribe, los acordes van
   * encima y las notas dentro. Quien no la lea tiene los bloques a un toque.
   */
  const [punteo, setPunteo] = useState<Punteo>('partitura');
  /** Lo que hay que contar de la última grabación traída, o de un botón sin nada. */
  const [aviso, setAviso] = useState<string | null>(null);
  // Encendida se dibujan solo las notas de la escala, y no hay manera de escribir
  // una que desafine. Es el mismo eje que separa los bloques de la partitura.
  const [onlyScale, setOnlyScale] = useState(true);
  /**
   * Con qué figura se escribe la nota siguiente. Elegir antes de escribir es
   * como se monta un punteo: se decide la duración y se pone, no se pone y se
   * arregla. Y con una nota elegida, le cambia la duración.
   */
  const [figura, setFigura] = useState<number>(1);

  const listaRef = useRef<HTMLDivElement | null>(null);
  const { anchoRef, porPulso } = usePorPulso(arrangement, beatsPerBar);
  const apuntarFoco = useFocoPendiente(listaRef);
  const { teclaEnPunteo, teclaEnBloque } = useTeclasDelLienzo({
    selectedNoteId,
    elegirBloque,
    elegirNota,
    apuntarFoco,
  });
  const { drag, fantasma, cogerBloque } = useArrastreDeBloques({
    listaRef,
    porPulso,
    alSoltar: setActivePartId,
  });

  const player = useArrangementPlayer(arrangement, tonic, mode, bpm);
  /*
    Lo que reciben las filas, **las mismas funciones en cada pintado**: van con
    `memo`, y una flecha nueva escrita aquí lo anula sin que falle nada
    (adr/0059). Cada fila recibe la parte como argumento y la ata a la suya; lo
    vigila `PartRow.test.tsx` contando pintados.
  */
  const tocarParte = useFuncionEstable((partId: string) => player.toggle(partId));
  const ponerCompases = useCallback(
    (partId: string, bars: number) => acciones.setBars(partId, bars, beatsPerBar),
    [acciones, beatsPerBar],
  );
  const elegirBloqueDeLaParte = useCallback(
    (partId: string, blockId: string) => {
      elegirBloque(blockId);
      setActivePartId(partId);
    },
    [elegirBloque],
  );
  // La acción del estado recibe `(bloque, parte, sitio)` y la fila manda
  // `(parte, bloque, sitio)`. Los tres son del mismo tipo, así que cambiarlos de
  // orden compila y no mueve nada.
  const moverBloqueDeLaParte = useCallback(
    (partId: string, blockId: string, to: number) => acciones.moveBlock(blockId, partId, to),
    [acciones],
  );
  /** Escribir una nota con la figura puesta, y dejarla elegida para alterarla. */
  const escribirNota = useCallback(
    (partId: string, offset: number, start: number) => {
      elegirNota(acciones.addNote(partId, offset, start, figura));
      setActivePartId(partId);
    },
    [acciones, elegirNota, figura],
  );

  const elegirFigura = (length: number) => {
    setFigura(length);
    if (selectedNoteId !== null) {
      acciones.resizeNote(selectedNoteId, length);
    }
  };

  /**
   * La parte a la que van los acordes que se pulsan: la última tocada, y si no
   * la última que haya. Sin esto habría que elegir parte antes de cada acorde, y
   * montando se encadenan cinco seguidos.
   */
  const parteDestino =
    arrangement.parts.find((part) => part.id === activePartId) ?? arrangement.parts.at(-1) ?? null;

  /**
   * Mete un acorde: detrás del que esté elegido, o al final si no hay ninguno.
   *
   * Con una partitura delante, elegir un compás y escribir un acorde solo puede
   * significar «aquí». Escribiendo seguido, cada acorde queda elegido y el
   * siguiente entra detrás: se encadena sin tener que apuntar a nada. Por eso
   * **escribir no sustituye**: cambiar un acorde es «Cambiar por…», en lo
   * elegido (adr/0119).
   */
  const ponerAcorde = (degree: DegreeSymbol, especie?: EspecieDeBloque) => {
    const donde = selectedBlockId === null ? null : findBlock(arrangement, selectedBlockId);
    const partId = donde?.part.id ?? parteDestino?.id ?? acciones.addPart('Estrofa');
    elegirBloque(
      acciones.addBlock(
        partId,
        degree,
        beatsPerBar,
        donde === null ? null : donde.index + 1,
        especie,
      ),
    );
    setActivePartId(partId);
    traerLaCancionALaVista(listaRef.current);
  };

  const soltarSugerencia = useCallback(
    (partId: string, degree: DegreeSymbol, at: number | null) => {
      elegirBloque(acciones.addBlock(partId, degree, beatsPerBar, at));
      setActivePartId(partId);
    },
    [acciones, beatsPerBar, elegirBloque],
  );
  const sugerencias = useArrastreDeSugerencias(soltarSugerencia);

  /**
   * Una parte nueva, y **pasa a ser la de destino**; se suelta lo elegido, o el
   * acorde siguiente caería detrás de un bloque de la parte de la que se acaba
   * de salir. La piden la barra y el hueco del final de la canción.
   */
  const anadirParte = () => {
    setActivePartId(acciones.addPart());
    elegirBloque(null);
  };

  /**
   * De qué acorde se pregunta: el elegido si es dudoso, y si no, **el primero que
   * lo sea** —uno, y cuántos quedan—. Preguntar solo del elegido obligaba a ir a
   * buscarlos, y quien no supiera que están marcados no los arreglaba nunca
   * ([adr/0048](../../../docs/adr/0048-una-toma-dice-lo-que-es.md)).
   */
  const cola = bloquesEnDuda(arrangement);
  const bloqueElegido = selectedBlockId === null ? null : findBlock(arrangement, selectedBlockId);
  const enDuda: Block | null =
    bloqueElegido !== null &&
    isDoubtful(bloqueElegido.block) &&
    bloqueElegido.block.alternatives.length > 0
      ? bloqueElegido.block
      : (cola[0] ?? null);
  const sitioEnDuda = enDuda === null ? null : findBlock(arrangement, enDuda.id);

  /*
    Lo elegido, lo que se corrige y lo que se arrastra, **solo a la fila donde
    está**. Pasar el mismo identificador a todas las filas hacía que elegir un
    acorde las repintara todas. Lo que suena ni siquiera pasa por aquí: cada fila
    lo lee del cabezal.
  */
  const parteElegida = bloqueElegido?.part.id ?? null;
  const parteDeLaNota =
    selectedNoteId === null ? null : (findNote(arrangement, selectedNoteId)?.part.id ?? null);
  const arrastrado = drag === null ? null : findBlock(arrangement, drag.blockId);
  const destinoDeSugerencia = sugerencias.soltando?.destino ?? null;

  return (
    <div className="flex min-h-0 grow flex-col">
      <BarraDelLienzo
        player={player}
        punteo={punteo}
        onPunteo={setPunteo}
        onlyScale={onlyScale}
        onOnlyScale={setOnlyScale}
        figura={figura}
        onFigura={elegirFigura}
        onAnadirParte={anadirParte}
        onAviso={setAviso}
        onTraido={setActivePartId}
      />

      {/*
        La caja de fuera va siempre, aunque no haya nada que contar: un lector
        anuncia lo que **entra** en una región que ya estaba, y no siempre una
        región que nace con el texto dentro. Vacía no ocupa.
      */}
      <div aria-live="polite">
        {aviso !== null && (
          <p className="border-border text-text-muted flex items-start gap-3 border-b px-3 py-2 text-xs">
            <span className="min-w-0 grow">{aviso}</span>
            <Chip
              onClick={() => setAviso(null)}
              tone="quiet"
              tamano="compacto"
              className="shrink-0"
            >
              Vale
            </Chip>
          </p>
        )}
      </div>

      {/*
        En pantalla estrecha se desplaza la caja entera; en ancha, cada columna.
        Apilado, la columna de propuestas no se deja encoger y se comía el alto:
        la partitura no llegaba a dibujarse.
      */}
      <div className="flex min-h-0 grow flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Las teclas del punteo se escuchan en la caja entera y no en cada nota:
            en el pentagrama la nota es un `<g>` de SVG, y un grupo de SVG no
            recibe el foco igual en todos los navegadores. */}
        <div
          ref={(nodo) => {
            listaRef.current = nodo;
            anchoRef.current = nodo;
          }}
          className="min-h-0 shrink-0 grow lg:shrink lg:overflow-y-auto"
          onKeyDown={teclaEnPunteo}
          role="presentation"
        >
          {/* **Con las letras de los bloques, su leyenda**, con las mismas
              palabras que «A dónde ir», que en Escribir viene plegada. */}
          {punteo === 'bloques' && arrangement.parts.length > 0 && (
            <p className="text-text-muted flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 text-xs">
              {LEYENDA_DE_PAPELES.map(([letra, palabra]) => (
                <span key={letra} className="flex items-center gap-1">
                  <span className="border-border rounded-sm border px-1 font-mono">{letra}</span>
                  {palabra}
                </span>
              ))}
            </p>
          )}
          {arrangement.parts.length === 0 ? (
            // «De «Para empezar»» y no «de la lista»: la lista está a la derecha
            // en el banco y debajo en un teléfono, y el rótulo se encuentra en
            // los dos sitios.
            <Vacio icono={<IconoCanciones />} titulo="La canción está en blanco">
              Pulsa un acorde de «Para empezar» y con él se crea la primera parte. Después se
              arrastra para moverlo, se estira por los bordes para que dure más y se pulsa Escuchar
              para oírla entera.
            </Vacio>
          ) : (
            arrangement.parts.map((part) => (
              <PartRow
                key={part.id}
                part={part}
                tonic={tonic}
                mode={mode}
                beatsPerBar={beatsPerBar}
                porPulso={porPulso}
                playing={player.playing && player.playingPartId === part.id}
                cabezal={player.cabezal}
                selectedBlockId={parteElegida === part.id ? selectedBlockId : null}
                corrigiendoBlockId={sitioEnDuda?.part.id === part.id ? sitioEnDuda.block.id : null}
                draggingBlockId={arrastrado?.part.id === part.id ? arrastrado.block.id : null}
                dropIndex={drag?.target?.partId === part.id ? drag.target.index : null}
                punteo={punteo}
                dropPart={destinoDeSugerencia?.partId === part.id}
                dropAt={destinoDeSugerencia?.partId === part.id ? destinoDeSugerencia.at : null}
                scaleId={scaleId}
                onlyScale={onlyScale}
                selectedNoteId={parteDeLaNota === part.id ? selectedNoteId : null}
                onPlay={tocarParte}
                onRename={acciones.renamePart}
                onSetRole={acciones.setPartRole}
                onRemove={acciones.removePart}
                onSetBars={ponerCompases}
                onBlockPointerDown={cogerBloque}
                onBlockClick={elegirBloqueDeLaParte}
                onBlockKeyDown={teclaEnBloque}
                onResizeBlock={acciones.resizeBlock}
                onMoveBlock={moverBloqueDeLaParte}
                onAddNote={escribirNota}
                onSelectNote={elegirNota}
                onMoveNote={acciones.moveNote}
                onResizeNote={acciones.resizeNote}
                onGestureStart={acciones.beginGesture}
                onGestureEnd={acciones.endGesture}
              />
            ))
          )}

          {/*
            El hueco del final, que dice que la canción sigue: con una sola parte
            quedaban quinientos píxeles de negro debajo del pentagrama, y ese
            vacío no decía que una canción se hace de partes. Al final de la
            lista, que es donde continúa, y en trazo discontinuo porque es un
            sitio por llenar y no una parte más.
          */}
          {arrangement.parts.length > 0 && (
            <div className="p-3">
              <button
                type="button"
                onClick={anadirParte}
                className="border-border text-text-muted hover:border-brass-dim hover:text-brass-bright hover:bg-surface min-h-tap flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm transition-colors"
              >
                <span aria-hidden="true" className="text-base">
                  +
                </span>
                Añadir otra parte
              </button>
            </div>
          )}
        </div>

        {/* Lo que puede venir después. En pantalla ancha es una columna a la
            derecha; apilado, va debajo, porque lo que se mira todo el rato es la
            canción. Una región y no un `aside`: vive dentro del área del arreglo,
            que ya es una región con nombre, y axe lo marcaba como complementario
            anidado. */}
        <section
          aria-label="Qué poner ahora"
          data-tour="componer-que-poner"
          className="border-border shrink-0 border-t p-3 lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          {/* Lo elegido va arriba del todo: cuando hay algo elegido, lo que se
              quiere hacer es con eso. */}
          <LoElegido
            tonic={tonic}
            mode={mode}
            beatsPerBar={beatsPerBar}
            selectedNoteId={selectedNoteId}
            onSoltar={soltarTodo}
            onLlevado={setActivePartId}
          />

          <CorregirAcorde
            enDuda={enDuda}
            cuantos={cola.length}
            donde={sitioEnDuda === null ? '' : dondeEsta(sitioEnDuda, beatsPerBar)}
            tonic={tonic}
            mode={mode}
            onCorregir={acciones.fixBlock}
            onConfirmar={acciones.confirmBlock}
          />

          {/* Escribir va antes que elegir: quien sabe cómo se llama el acorde no
              tiene por qué buscarlo en una lista. */}
          <ChordEntry tonic={tonic} mode={mode} onPick={ponerAcorde} />

          <Sugerencias
            tonic={tonic}
            mode={mode}
            parteDestino={parteDestino}
            enBlanco={arrangement.parts.length === 0}
            onPoner={ponerAcorde}
            onArrastrar={sugerencias.arrastrarSugerencia}
            fueArrastre={sugerencias.fueArrastre}
          />

          {parteDestino !== null && (
            <NotaSiguiente
              tonic={tonic}
              mode={mode}
              scaleId={scaleId}
              parteDestino={parteDestino}
              selectedNoteId={selectedNoteId}
              onEscrita={elegirNota}
            />
          )}
        </section>
      </div>

      {sugerencias.soltando !== null && (
        <FantasmaDeSugerencia
          nodo={sugerencias.fantasma}
          symbol={sugerencias.soltando.symbol}
          cae={sugerencias.soltando.destino !== null}
        />
      )}
      {arrastrado !== null && (
        <FantasmaDeBloque
          nodo={fantasma}
          symbol={blockChord(tonic, mode, arrastrado.block).symbol}
          beats={arrastrado.block.beats}
          porPulso={porPulso}
        />
      )}
    </div>
  );
}
