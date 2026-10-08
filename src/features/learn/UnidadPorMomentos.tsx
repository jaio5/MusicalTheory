'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';

import { presentacionDe, type Unit, type UnitKind } from '@core/music';
import { Button } from '@ui/Button';
import { IconoAcierto } from '@ui/icons';

import { PresentacionDeUnidad } from './PresentacionDeUnidad';
import { apuntarSitio, useSitioGuardado } from './sitio-en-la-unidad';

/** En qué momento de la unidad se está. */
export type Momento = 'presentacion' | 'teoria' | 'prueba';

/** Los tres, en su orden: lo que se guarda es la posición (`sitio-en-la-unidad.ts`). */
const ORDEN: readonly Momento[] = ['presentacion', 'teoria', 'prueba'];

const NOMBRES: Readonly<Record<Momento, string>> = {
  presentacion: 'Presentación',
  teoria: 'Teoría',
  prueba: 'Prueba',
};

/** Cómo se pone a prueba cada clase de unidad, dicho antes de empezar. */
const QUE_VIENE: Readonly<Record<UnitKind, string>> = {
  theory: 'Primero lo explico y luego te pregunto justo esto, de una pregunta en una.',
  ear: 'Luego suena y lo dices tú: se pregunta justo esto, de oído.',
  play: 'Luego la tocas con la guitarra, y el micrófono te escucha nota a nota.',
};

/** El título del último momento, que no se pone a prueba igual en las tres. */
const TITULO_DE_LA_PRUEBA: Readonly<Record<UnitKind, string>> = {
  theory: 'Compruébalo',
  ear: 'Compruébalo de oído',
  play: 'Tócala',
};

/**
 * Los tres momentos de una unidad: presentación, teoría y prueba.
 *
 * Antes la teoría y las preguntas iban a la vez, una debajo de otra, y se
 * contestaba con la explicación a la vista y a medio leer. Ahora van **de uno en
 * uno y se pasa a mano**: primero de qué va, luego lo que hay que saber y, solo
 * cuando uno dice «ya», las preguntas. Las de oído y las de tocar no tienen
 * teoría escrita —lo que enseñan se aprende oyendo o tocando—, así que van de la
 * presentación a la prueba.
 *
 * Lo comparten las tres clases de unidad para que los momentos se llamen igual,
 * se dibujen igual y muevan el foco igual en todas: tres copias del mismo
 * recorrido acabarían separándose, como ya pasó con el marco de la pantalla.
 *
 * **La prueba, una vez abierta, no se desmonta mientras dura la unidad**: al
 * volver a la teoría se esconde. Lo contestado vive dentro de la pregunta
 * (`Question`, que comparte con el repaso), y desmontarla lo borraba: quien
 * contestaba y se iba a releer antes de pulsar «Siguiente» volvía a la misma
 * pregunta en blanco y sin el porqué. Subir esa respuesta a cada unidad que
 * pregunta era tocar la pregunta y sus dos usos para algo que aquí se arregla
 * no tirándola.
 *
 * **Recargar retoma el momento en el que se estaba** (`sitio-en-la-unidad.ts`).
 * Antes se volvía a la presentación y, desde ella, se ofrecía un atajo a las
 * preguntas: dos pulsaciones y un texto ya leído para seguir donde se estaba.
 * El atajo queda para la unidad ya superada, que se empieza de nuevo y puede
 * querer saltarse la teoría.
 */
export function UnidadPorMomentos({
  unit,
  yaHecha = false,
  teoria,
  prueba,
  queViene = QUE_VIENE[unit.kind],
}: {
  readonly unit: Unit;
  /** Si ya se superó alguna vez: entonces se ofrece ir directo a la prueba. */
  readonly yaHecha?: boolean;
  /** Lo que hay que saber. Sin ella, de la presentación se pasa a la prueba. */
  readonly teoria?: ReactNode;
  readonly prueba: ReactNode;
  /** Cómo se pone a prueba, si la unidad sabe decirlo mejor que su clase. */
  readonly queViene?: string;
}) {
  const [momento, setMomento] = useState<Momento>('presentacion');
  // Si ya se ha llegado a las preguntas, para que volver de la teoría diga
  // «volver» y no «ponerlo a prueba», que suena a empezar de nuevo.
  const [probada, setProbada] = useState(false);
  const momentos: readonly Momento[] =
    teoria === undefined ? ['presentacion', 'prueba'] : ['presentacion', 'teoria', 'prueba'];

  /*
    Lo guardado se aplica una vez, al llegar, y **sin mover el foco**: el foco al
    título es para quien acaba de pulsar, y quien recarga no ha pulsado nada.
    «Al llegar» es hasta que se hace algo, porque lo que se apunta al avanzar
    también cambia lo guardado.
  */
  const guardado = useSitioGuardado(unit.id);
  const [retomado, setRetomado] = useState(false);
  const [sinFoco, setSinFoco] = useState<Momento | null>(null);
  if (!retomado && guardado !== null) {
    setRetomado(true);
    const donde = ORDEN[guardado.momento]!;
    if (momentos.includes(donde) && donde !== 'presentacion') {
      setSinFoco(donde);
      setMomento(donde);
      setProbada(donde === 'prueba' || guardado.pregunta > 0);
    }
  }

  const encabezado = useRef<HTMLHeadingElement>(null);
  const idEncabezado = useId();

  /*
    **Al cambiar de momento, el foco va al título del nuevo.** Lo pulsado
    —«Empezar», «Ponerlo a prueba»— desaparece con el momento que se va, y un
    botón que desaparece suelta el foco al `<body>`: quien no ve la pantalla
    perdía el sitio justo al avanzar (adr/0084). En el título se lee dónde se
    está, y el siguiente tabulador entra en lo nuevo. Se compara con el último
    momento enfocado y no con «es el primer render»: así el doble montaje del
    modo estricto no roba el foco al llegar a la pantalla.
  */
  const enfocado = useRef(momento);
  const fila = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (enfocado.current === momento) {
      return;
    }
    enfocado.current = momento;
    if (momento === sinFoco) {
      return;
    }
    const titulo = encabezado.current;
    /* v8 ignore next 3 -- el título se pinta en todos los momentos */
    if (titulo === null) {
      return;
    }
    /*
      **Enfocar el título no deja fuera la fila de momentos.** El navegador trae
      el título a la vista y, en un teléfono, lo deja pegado al borde de arriba:
      la fila que dice en qué momento estás quedaba recortada por el marco, justo
      cuando se acaba de cambiar de momento. Se reserva su alto más el hueco con
      `scroll-margin-top`, medido en la fila y no escrito a mano (`CLAUDE.md`).
    */
    // La fila se pinta en todos los momentos, igual que el título.
    const alto = fila.current!.getBoundingClientRect().height;
    const hueco = parseFloat(getComputedStyle(titulo.parentElement!.parentElement!).rowGap) || 0;
    titulo.style.scrollMarginTop = `${alto + hueco}px`;
    titulo.focus();
  }, [momento, sinFoco]);

  function ir(a: Momento): void {
    if (a === 'prueba') {
      setProbada(true);
    }
    setRetomado(true);
    setSinFoco(null);
    setMomento(a);
    apuntarSitio(unit.id, { momento: ORDEN.indexOf(a) });
  }

  return (
    <div className="flex flex-col gap-4">
      <MomentosDeLaUnidad ref={fila} momentos={momentos} actual={momento} />

      {momento === 'presentacion' ? (
        <PresentacionDeUnidad
          titulo={unit.title}
          presentacion={presentacionDe(unit.id)}
          queViene={queViene}
          encabezado={encabezado}
          onEmpezar={() => ir(momentos[1]!)}
          {...(teoria !== undefined && yaHecha
            ? {
                atajo: {
                  etiqueta: 'Ir directo a las preguntas',
                  onClick: () => ir('prueba'),
                },
              }
            : {})}
        />
      ) : (
        <section aria-labelledby={idEncabezado}>
          {/* `h2`: cuelga del título de la unidad, que es el `h1` de la cabecera. */}
          <h2 id={idEncabezado} ref={encabezado} tabIndex={-1} className="titulo-apartado">
            {momento === 'teoria' ? 'Lo que hay que saber' : TITULO_DE_LA_PRUEBA[unit.kind]}
          </h2>

          <div className="mt-3">
            {momento === 'teoria' && teoria}
            {/* Antes de abrirla no se pinta: se contestaría con la teoría al
                lado. Después solo se esconde, con lo contestado dentro. */}
            {probada && <div hidden={momento !== 'prueba'}>{prueba}</div>}
          </div>

          {momento === 'teoria' && (
            <div className="mt-6">
              <Button onClick={() => ir('prueba')}>
                {probada ? 'Volver a las preguntas' : 'Ponerlo a prueba'}
              </Button>
            </div>
          )}
          {/* Releer no cuesta nada ni borra lo contestado: la pregunta en la que
              se estaba sigue ahí al volver, contestada o no. */}
          {momento === 'prueba' && teoria !== undefined && (
            <div className="mt-6">
              <Button variant="quiet" onClick={() => ir('teoria')}>
                Repasar la teoría
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Dónde se está, de los momentos que tiene la unidad.
 *
 * No se pulsa: avanzar se hace con el botón de cada momento, que dice qué pasa
 * al pulsarlo. Unas pastillas pulsables aquí serían otra forma de saltarse la
 * teoría sin decir que se la salta.
 */
function MomentosDeLaUnidad({
  ref,
  momentos,
  actual,
}: {
  /** Para medir lo que ocupa: lo que hay que dejar a la vista al enfocar el título. */
  readonly ref: Ref<HTMLOListElement>;
  readonly momentos: readonly Momento[];
  readonly actual: Momento;
}) {
  const indiceActual = momentos.indexOf(actual);
  return (
    <ol
      ref={ref}
      aria-label="Momentos de la unidad"
      className="flex flex-wrap items-center gap-x-5 gap-y-1"
    >
      {momentos.map((momento, indice) => {
        const hecho = indice < indiceActual;
        const ahora = indice === indiceActual;
        return (
          <li
            key={momento}
            aria-current={ahora ? 'step' : undefined}
            className={`flex items-center gap-2 text-base ${
              ahora ? 'text-text font-semibold' : 'text-text-muted'
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex size-6 items-center justify-center rounded-full border text-xs [&_svg]:size-3.5 ${
                ahora
                  ? 'border-brass-bright text-brass-bright'
                  : hecho
                    ? 'border-tube text-tube-bright'
                    : 'border-border'
              }`}
            >
              {hecho ? <IconoAcierto /> : indice + 1}
            </span>
            {NOMBRES[momento]}
            {hecho && <span className="sr-only">, hecho</span>}
          </li>
        );
      })}
    </ol>
  );
}
