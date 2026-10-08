'use client';

import {
  NOTE_LENGTHS,
  PAPELES_DE_TOMA,
  arrangementBeats,
  barsLabel,
  type PapelDeLaToma,
} from '@core/music';
import { apuntarLoTocado } from '@state/apuntar-lo-tocado';
import { selectCanUndo, useArrangementStore } from '@state/arrangement-store';
import { descargarLaCancion } from '@state/descargar-la-cancion';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { Chip } from '@ui/Chip';
import { Segmentado } from '@ui/Segmentado';
import { useTraerALaVista } from '@ui/use-traer-a-la-vista';

import { Figura, nombreDeFigura } from './Figura';
import type { Punteo } from './PartRow';
import type { ArrangementPlayback } from './use-arrangement-player';

/** Lo que se dice al pulsar «Escuchar» o «MIDI» con la canción en blanco. */
const SIN_NADA_QUE_OIR =
  'Todavía no hay nada que escuchar: pon el primer acorde desde «Para empezar».';
const SIN_NADA_QUE_GUARDAR =
  'Todavía no hay nada que guardar: pon el primer acorde desde «Para empezar».';

const PUNTEOS: ReadonlyArray<{ id: Punteo; name: string }> = [
  { id: 'partitura', name: 'Partitura' },
  { id: 'bloques', name: 'Bloques' },
  { id: 'oculto', name: 'Solo acordes' },
];

/**
 * La raya entre dos grupos de la barra del lienzo.
 *
 * La barra son tres filas de cajas con el mismo borde —la vista, las figuras,
 * «Deshacer»— y, sin nada entre ellas, se leía como una sola lista de doce
 * botones. Una raya fina basta para que se lean como tres cosas, y no pide la
 * atención que pediría un rótulo por grupo.
 */
function Separador() {
  return <span aria-hidden="true" data-separador className="bg-border mx-1 w-px self-stretch" />;
}

export interface BarraDelLienzoProps {
  readonly player: ArrangementPlayback;
  readonly punteo: Punteo;
  readonly onPunteo: (punteo: Punteo) => void;
  readonly onlyScale: boolean;
  readonly onOnlyScale: (onlyScale: boolean) => void;
  readonly figura: number;
  readonly onFigura: (length: number) => void;
  readonly onAnadirParte: () => void;
  /** Lo que hay que contar debajo de la barra, o nulo para callarlo. */
  readonly onAviso: (aviso: string | null) => void;
  /** Lo traído de una toma ha caído en esa parte. */
  readonly onTraido: (partId: string) => void;
}

/**
 * Lo que se puede traer de una toma: lo que escribe algo en la canción.
 *
 * «Solo grabar» es un papel de la toma pero **no escribe nada**
 * (`apuntarLoTocado` lo devuelve vacío a propósito), y como pastilla salía
 * «Traer solo grabar»: una frase rota que, pulsada, no hacía nada.
 */
const PAPELES_QUE_ESCRIBEN = (Object.keys(PAPELES_DE_TOMA) as PapelDeLaToma[]).filter(
  (papel) => papel !== 'solo-grabar',
);

/**
 * La barra del lienzo: oír, llevarse, cómo se ve el punteo y lo que se escribe.
 *
 * Se entera de lo suyo por los almacenes —si el micro está abierto, si hay algo
 * grabado, si se puede deshacer— y no por el lienzo: con el micro abierto esas
 * cosas cambian a su ritmo, y repintar el lienzo entero por ellas era repintar
 * todas las filas para encender un botón.
 */
export function BarraDelLienzo({
  player,
  punteo,
  onPunteo,
  onlyScale,
  onOnlyScale,
  figura,
  onFigura,
  onAnadirParte,
  onAviso,
  onTraido,
}: BarraDelLienzoProps) {
  const pulsos = useArrangementStore((state) => arrangementBeats(state.arrangement));
  const hayAlgo = useArrangementStore((state) => state.arrangement.parts.length > 0);
  const puedeDeshacer = useArrangementStore(selectCanUndo);
  const deshacer = useArrangementStore((state) => state.actions.undo);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const capturing = useSessionStore((state) => state.capturing);
  const listening = useSessionStore((state) => state.listening);
  /**
   * Si hay algo que traer: acordes **o** punteo.
   *
   * Miraba solo los acordes, y eso dejaba fuera el caso de puntear sin rasguear
   * —que es la mitad de lo que se hace con una guitarra—.
   *
   * **Y se pide el sí o el no, no las listas.** El historial de notas crece con
   * cada nota que oye el motor: suscrito a la lista, con el micro abierto todo se
   * repintaba veinte veces por segundo sin que cambiara nada de lo que enseña.
   */
  const hayGrabado = useSessionStore(
    (state) =>
      !state.capturing &&
      state.captureEndedAt > 0 &&
      (state.captured.length > 0 ||
        state.noteHistory.some(
          (nota) => nota.at >= state.captureStartedAt && nota.at <= state.captureEndedAt,
        )),
  );
  /** La barra se desplaza de lado en un teléfono: lo enfocado se trae entero. */
  const traerALaVista = useTraerALaVista();

  /**
   * Empieza o para de apuntar lo que suena.
   *
   * **Vive aquí y no solo en Salidas.** Apuntar acordes no cuesta IA ni gasta
   * cupo: lo hace el motor de croma en el propio equipo. El muro de plan es para
   * pedirle salidas a un modelo, no para escribir en tu canción lo que acabas de
   * tocar.
   *
   * **`performance.now` y no `Date.now`**: es el reloj con el que se apuntan los
   * acordes que llegan del motor y las notas del historial, y mezclarlos deja los
   * instantes a mil millones de distancia.
   */
  function apuntar(): void {
    const acciones = useSessionStore.getState().actions;
    if (capturing) {
      acciones.stopCapture(performance.now());
    } else {
      onAviso(null);
      acciones.startCapture(performance.now());
    }
  }

  /**
   * Trae al lienzo lo que se acaba de tocar, con las duraciones que se midieron.
   *
   * La conversión vive en `state/apuntar-lo-tocado.ts` porque la comparten dos
   * entradas: este botón y el espacio de tocar. **Y el papel se dice aquí
   * también**: los dos motores corren a la vez sobre la misma entrada, así que
   * traer «lo grabado» sin decir qué era escribía acordes encima de un punteo.
   */
  function traerGrabado(papel: PapelDeLaToma): void {
    const sesion = useSessionStore.getState();
    const activeKey = selectActiveKey(sesion);
    /* v8 ignore next 3 -- la barra solo se pinta con tonalidad */
    if (activeKey === null) {
      return;
    }
    const { partId, aviso } = apuntarLoTocado({
      tonic: activeKey.tonic,
      mode: activeKey.mode,
      bpm: sesion.bpm,
      beatsPerBar: sesion.beatsPerBar,
      papel,
    });
    if (partId !== null) {
      onTraido(partId);
    }
    onAviso(aviso);
  }

  return (
    /*
      En pantalla ancha se envuelve; en estrecha **se desplaza a lo largo**.

      Envolviéndose siempre, esta barra crecía hacia abajo, y el hueco del lienzo
      en un teléfono son doscientos y pico píxeles: con las figuras dentro, la
      barra medía 235 en una caja de 203 y la última fila se metía debajo del
      cajón de herramientas. Al no envolverse mide una fila y siempre cabe, y lo
      que no entra se alcanza arrastrando. `shrink-0` para que la fila no ceda su
      altura.
    */
    <div
      onFocus={traerALaVista}
      className="border-border hay-mas-al-lado flex shrink-0 items-center gap-2 overflow-x-auto border-b px-3 py-2 sm:flex-wrap sm:overflow-x-visible [&>*]:shrink-0 sm:[&>*]:shrink"
    >
      {/* **Un botón no nace apagado** (`docs/ESTILO.md`): con la canción en
          blanco va en `quiet`, se pulsa siempre, y lo que falta se dice con el
          aviso de debajo. El latón vuelve con el primer acorde, que es cuando
          escuchar es la acción. */}
      <Button
        onClick={() => (pulsos === 0 ? onAviso(SIN_NADA_QUE_OIR) : player.toggle(null))}
        variant={pulsos === 0 ? 'quiet' : 'primary'}
        className="px-4 py-1.5 text-sm"
      >
        {player.playing && player.playingPartId === null ? 'Parar' : 'Escuchar la canción'}
      </Button>

      {/* **Lo que saca la canción de aquí**, al lado de «escuchar» porque las dos
          hacen lo mismo con la canción entera: una para oírla y otra para
          llevársela a un secuenciador. */}
      <Button
        variant="quiet"
        // Sin pulsos no hay nada que guardar; con ellos hay parte, y la barra
        // solo se pinta con tonalidad, así que la descarga siempre sale.
        onClick={() => (pulsos === 0 ? onAviso(SIN_NADA_QUE_GUARDAR) : descargarLaCancion())}
        title="Guardar la canción como fichero MIDI"
        className="px-3 py-1.5 text-sm"
      >
        MIDI
      </Button>

      {/* La monoespaciada solo cuando es un dato que se compara —«4 compases»—;
          «sin nada todavía» es una frase, y va en la sans (adr/0024). */}
      <span className={`text-text-muted text-xs ${pulsos === 0 ? '' : 'font-mono'}`}>
        {pulsos === 0 ? 'sin nada todavía' : barsLabel(pulsos, beatsPerBar)}
      </span>

      {/* Sin envolver en estrecho, por lo mismo que la barra; **a la izquierda,
          no con `ml-auto`**, o la segunda fila salía pegada al otro borde; y
          **desde `sm`, sin caja** (`contents`), para que las filas se llenen de
          corrido y «Deshacer» no se quede solo en la tercera. */}
      <span className="flex gap-1 sm:contents">
        {/* Un segmentado y no tres pastillas sueltas: son tres maneras de ver
            lo mismo y se excluyen. */}
        <Segmentado
          etiqueta="Cómo llevar el punteo"
          opciones={PUNTEOS.map((candidato) => ({ valor: candidato.id, texto: candidato.name }))}
          valor={punteo}
          onCambiar={onPunteo}
        />
        <Separador />

        {/* Apuntar solo tiene sentido con el micro abierto: sin él no llega un
            acorde y el botón sería una promesa que no se cumple. */}
        {listening === 'listening' && (
          <Chip
            onClick={apuntar}
            pressed={capturing}
            tone="quiet"
            tamano="compacto"
            title="Apunta los acordes que vayas tocando"
          >
            {capturing ? 'Parar de apuntar' : 'Apuntar lo que toco'}
          </Chip>
        )}
        {hayGrabado &&
          PAPELES_QUE_ESCRIBEN.map((papel) => (
            <Chip
              key={papel}
              onClick={() => traerGrabado(papel)}
              tone="quiet"
              tamano="compacto"
              title={PAPELES_DE_TOMA[papel].what}
            >
              Traer {PAPELES_DE_TOMA[papel].name.toLowerCase()}
            </Chip>
          ))}
        <Chip onClick={onAnadirParte} tone="quiet" tamano="compacto">
          + Parte
        </Chip>

        {punteo === 'bloques' && (
          <Chip
            onClick={() => onOnlyScale(!onlyScale)}
            pressed={onlyScale}
            tone="quiet"
            tamano="compacto"
            title="Solo las notas de la escala que tienes puesta"
          >
            Solo la escala
          </Chip>
        )}

        {/* Las figuras que el modelo sabe escribir, que son siete, y no se
            enseñan hasta que hay canción: sin partes no hay nota que medir. */}
        {punteo !== 'oculto' && hayAlgo && <Separador />}
        {punteo !== 'oculto' && hayAlgo && (
          <span
            role="group"
            aria-label="Duración de la nota"
            className="border-border flex items-center gap-1 rounded-md border px-1"
          >
            {NOTE_LENGTHS.map((length) => (
              <button
                key={length}
                type="button"
                onClick={() => onFigura(length)}
                aria-pressed={figura === length}
                aria-label={nombreDeFigura(length)}
                title={nombreDeFigura(length)}
                // **Cuarenta y cuatro de ancho, no treinta**: en una fila de
                // siete pegadas, estrechas es justo la forma de pulsar la de al
                // lado. Lo canta la sonda de componer, que mide el rectángulo.
                className={`focus-visible:outline-brass-bright min-h-tap min-w-tap cursor-pointer rounded-sm px-1 focus-visible:outline-2 ${
                  figura === length ? 'text-brass-bright' : 'text-text-muted hover:text-text'
                }`}
              >
                <Figura length={length} />
              </button>
            ))}
          </span>
        )}

        {/* Con canción, o con algo que deshacer aunque ya no quede nada: borrar
            la última parte deja la canción vacía, y es justo cuando más falta
            hace volver atrás. */}
        {(hayAlgo || puedeDeshacer) && <Separador />}
        {(hayAlgo || puedeDeshacer) && (
          <Chip onClick={deshacer} tone="quiet" disabled={!puedeDeshacer} tamano="compacto">
            Deshacer
          </Chip>
        )}
      </span>
    </div>
  );
}
