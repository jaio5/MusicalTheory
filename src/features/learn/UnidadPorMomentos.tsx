'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from 'react';

import { presentacionDe, type Unit, type UnitKind } from '@core/music';
import { Button } from '@ui/Button';
import { IconoAcierto } from '@ui/icons';

import { PresentacionDeUnidad } from './PresentacionDeUnidad';

/** En qué momento de la unidad se está. */
export type Momento = 'presentacion' | 'teoria' | 'prueba';

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
 * Las unidades que se han empezado en esta pestaña.
 *
 * Volver a una unidad empezada —se va uno a afinar a mitad de la teoría, o se
 * recarga— la monta de cero, y obligar a pasar otra vez por la presentación y
 * la teoría para llegar a las preguntas es castigar a quien ya las ha leído. Así
 * que, si ya se empezó, la presentación ofrece ir directo a la prueba. **No
 * salta sola**: la presentación es una pantalla y un botón, y quien vuelve al
 * día siguiente puede querer releerla.
 *
 * En `sessionStorage` y no en el avance: no es algo que se haya ganado ni que
 * deba viajar a la cuenta, es por dónde iba uno hace un rato. Y se lee con
 * `useSyncExternalStore`, que en el servidor contesta «no»: leerlo en el render
 * daría un HTML distinto del de la primera pintura.
 */
const EMPEZADA = (unitId: string) => `caos-ordenado:empezada:${unitId}`;

function fueEmpezada(unitId: string): boolean {
  try {
    return sessionStorage.getItem(EMPEZADA(unitId)) !== null;
  } catch {
    // Sin almacenamiento —navegación privada estricta— no hay atajo, y ya.
    return false;
  }
}

function apuntarEmpezada(unitId: string): void {
  try {
    sessionStorage.setItem(EMPEZADA(unitId), '1');
  } catch {
    // Igual que al leer: no recordarlo solo quita el atajo de la próxima vez.
  }
}

/** Nadie más escribe esto mientras la unidad está montada: no hay a quién avisar. */
const sinAvisos = () => () => {};

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
 */
export function UnidadPorMomentos({
  unit,
  yaHecha = false,
  teoria,
  prueba,
}: {
  readonly unit: Unit;
  /** Si ya se superó alguna vez: entonces se ofrece ir directo a la prueba. */
  readonly yaHecha?: boolean;
  /** Lo que hay que saber. Sin ella, de la presentación se pasa a la prueba. */
  readonly teoria?: ReactNode;
  readonly prueba: ReactNode;
}) {
  const [momento, setMomento] = useState<Momento>('presentacion');
  // Si ya se ha llegado a las preguntas, para que volver de la teoría diga
  // «volver» y no «ponerlo a prueba», que suena a empezar de nuevo.
  const [probada, setProbada] = useState(false);
  const empezadaAntes = useSyncExternalStore(
    sinAvisos,
    () => fueEmpezada(unit.id),
    () => false,
  );

  const momentos: readonly Momento[] =
    teoria === undefined ? ['presentacion', 'prueba'] : ['presentacion', 'teoria', 'prueba'];

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
  }, [momento]);

  function ir(a: Momento): void {
    if (a === 'prueba') {
      setProbada(true);
    }
    setMomento(a);
  }

  function empezar(a: Momento): void {
    apuntarEmpezada(unit.id);
    ir(a);
  }

  return (
    <div className="flex flex-col gap-4">
      <MomentosDeLaUnidad ref={fila} momentos={momentos} actual={momento} />

      {momento === 'presentacion' ? (
        <PresentacionDeUnidad
          titulo={unit.title}
          presentacion={presentacionDe(unit.id)}
          queViene={QUE_VIENE[unit.kind]}
          encabezado={encabezado}
          onEmpezar={() => empezar(momentos[1]!)}
          {...(teoria !== undefined && (yaHecha || empezadaAntes)
            ? {
                atajo: {
                  etiqueta: 'Ir directo a las preguntas',
                  onClick: () => empezar('prueba'),
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
            className={`flex items-center gap-2 text-sm ${
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
