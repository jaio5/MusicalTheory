'use client';

import { memo } from 'react';

import { blockChord, degreesFor, guionDeEnsayo, largoDelEnsayo, writtenBlock } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { useArrangementStore } from '@state/arrangement-store';
import { useBancoStore } from '@state/banco';
import { useEnsayo, type EnsayoDeps } from '@state/use-ensayo';
import { Button } from '@ui/Button';
import { Chip } from '@ui/Chip';
import { IconoComponer, IconoMicro, IconoParar, IconoSonar, IconoTocar } from '@ui/icons';
import { Vacio } from '@ui/Vacio';

/** Una sola, y no un `{}` nuevo en cada pintado que `useEnsayo` recibiría distinto. */
const SIN_DEPS: EnsayoDeps = {};

/**
 * Ensayar lo que has escrito, contra el metrónomo.
 *
 * Es la razón para volver: escribes una progresión y luego la tocas. Lo que se
 * enseña mientras suena son **tres compases y no la canción entera** —el que
 * toca y los dos que vienen—, porque leerse con un compás de antelación es todo
 * el juego: con la partitura completa delante hay que buscar dónde va el cursor
 * en vez de mirar al que viene.
 *
 * **Y no hay castigo.** Fallar ilumina el compás y se sigue: ni vidas, ni volver
 * al principio, ni nada que se pierda. Es la regla que este producto ya tomó en
 * aprender ([adr/0007](../../../docs/adr/0007-elegir-por-donde-empezar.md)).
 *
 * Al final salen los tres números que sirven para volver a intentarlo: cuántos
 * compases salieron, la racha más larga y **cuál se atragantó**. Ese último es
 * el que dice qué practicar, y es el que no se puede saber tocando sin mirar.
 */
/**
 * Con `memo`: la pantalla de componer se repinta con cada cambio del banco, y
 * esto se entera de lo suyo por los almacenes.
 */
export const Ensayo = memo(function Ensayo({ deps = SIN_DEPS }: { readonly deps?: EnsayoDeps }) {
  const activeKey = useSessionStore(selectActiveKey);
  const arrangement = useArrangementStore((state) => state.arrangement);
  // El mismo con el que se arma el guion al ensayar: la vista previa y lo que
  // suena tienen que contar los compases igual.
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);
  const { fase, paso, guion, resultados, resultado, cuenta, empezar, parar } = useEnsayo(
    arrangement,
    activeKey?.tonic ?? null,
    activeKey?.mode ?? 'major',
    deps,
  );

  if (activeKey === null) {
    return (
      // Dentro de una caja que se desplaza, como todo lo que puede no caber: un
      // estado vacío centrado en una caja que recorta se sale por arriba y por
      // abajo en cuanto la ventana es baja.
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <div className="my-auto">
          <Vacio icono={<IconoTocar />} titulo="Elige una tonalidad">
            Lo escrito son grados, y para tocarlos hace falta saber sobre qué tonalidad suenan.
          </Vacio>
        </div>
      </div>
    );
  }

  // Se pregunta **al montaje y no al guion**: el guion no existe hasta que se
  // empieza, así que mirándolo a él la pantalla decía «no hay nada que ensayar»
  // con la canción escrita delante.
  if (largoDelEnsayo(arrangement) === 0 && fase === 'quieto') {
    return (
      // Dentro de una caja que se desplaza, como todo lo que puede no caber: un
      // estado vacío centrado en una caja que recorta se sale por arriba y por
      // abajo en cuanto la ventana es baja.
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <div className="my-auto" data-tour="componer-ensayo">
          {/* **Con la salida puesta, no solo dicha.** Decía «escribe unos
              acordes» sin decir dónde, y los dos sitios donde se escriben son
              dos espacios de esta misma pantalla: la acción es ir a ellos. */}
          <Vacio
            icono={<IconoTocar />}
            titulo="Todavía no hay nada que ensayar"
            accion={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => useBancoStore.getState().actions.espacio('escribir')}>
                  <IconoComponer />
                  Escribirla
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => useBancoStore.getState().actions.espacio('tocando')}
                >
                  <IconoMicro />
                  Tocarla
                </Button>
              </div>
            }
          >
            Escribe unos acordes —tocándolos, por bloques o en la partitura— y vuelve aquí a
            tocarlos contra el metrónomo.
          </Vacio>
        </div>
      </div>
    );
  }

  /**
   * El cifrado de un paso, **con su especie**: lo que se enciende grande tiene
   * que ser lo que hay que tocar. Con `resolveDegree` a secas, un `C5` se
   * enseñaba como `C` y un `Fmaj7` como `F`, y se ensayaba otra cosa.
   */
  const cifrado = (indice: number): string => {
    const paso = guion[indice];
    if (paso === undefined) {
      return '';
    }
    return blockChord(activeKey.tonic, activeKey.mode, {
      ...writtenBlock(paso.blockId, paso.degree, paso.beats, paso.especie),
    }).symbol;
  };

  const ensayando = fase === 'ensayando';
  /** Contando los dos compases de entrada: el micro ya está abierto y nada puntúa. */
  const contando = fase === 'preparando' && cuenta !== null && cuenta > 0;

  return (
    // `my-auto` en el hijo y no `justify-center` aquí, que es la regla de la
    // casa: centrar en una caja que recorta saca lo que no cabe **por los dos
    // lados**, y en una ventana baja el botón se iba por arriba sin manera de
    // alcanzarlo. Así se centra mientras sobra sitio y se desplaza cuando no.
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div
        className="my-auto flex flex-col items-center gap-5 p-4 text-center"
        data-tour="componer-ensayo"
      >
        {ensayando && paso !== null ? (
          <>
            {/* El que toca, grande, y los dos que vienen detrás en pequeño. Leer
              con un compás de antelación es de lo que va tocar con metrónomo. */}
            {/* **Sin región viva**, aunque sea lo que cambia. Anunciaba el acorde
              de cada compás, y la voz del lector sale por el mismo altavoz que
              el clic mientras el croma escucha: cada «La menor» dicho en voz alta
              era un acorde más para el motor, encima del que se estaba tocando
              ([adr/0072](../../../docs/adr/0072-la-claqueta-suena-toda-la-toma.md)).
              El acorde se puede leer aquí cuando se quiera; lo que no se hace es
              decirlo encima de la toma. */}
            <div className="flex items-baseline justify-center gap-6">
              <span className="font-display text-brass-bright text-6xl leading-none">
                {cifrado(paso)}
              </span>
              <span className="text-text-muted font-display text-3xl leading-none opacity-60">
                {cifrado(paso + 1)}
              </span>
              <span className="text-text-muted font-display text-2xl leading-none opacity-30">
                {cifrado(paso + 2)}
              </span>
            </div>

            {/* En la sans y a catorce: es una frase que se lee de lejos mientras
                se toca, no una columna de datos, y a doce en mono se perdía
                debajo del cifrado. */}
            <p className="text-text-muted text-sm">
              {/* v8 ignore start -- el paso siempre esta dentro del guion mientras se ensaya */}
              Compás {guion[paso]?.bar ?? 1} de {guion.length}
              {/* v8 ignore stop */}
            </p>

            {/* Lo que va saliendo, un punto por compás: se lee de un vistazo sin
              apartar la vista del acorde que toca. */}
            <ul
              aria-label="Cómo va saliendo"
              className="flex max-w-lg flex-wrap justify-center gap-1"
            >
              {resultados.map((salio, indice) => (
                <li
                  key={indice}
                  title={`Compás ${indice + 1}: ${salio}`}
                  className={`size-2 rounded-full ${
                    salio === 'acertado'
                      ? 'bg-tube-bright'
                      : salio === 'tarde'
                        ? 'bg-brass'
                        : 'bg-oxblood-bright'
                  }`}
                />
              ))}
            </ul>

            {/* Con el foco puesto al aparecer: quien empezó el ensayo tenía el
              foco en «Empezar el ensayo», que se va de la pantalla al arrancar,
              y sin esto el foco caía en el `<body>`. */}
            <Button onClick={parar} variant="quiet" autoFocus>
              <IconoParar />
              Parar
            </Button>
          </>
        ) : resultado !== null ? (
          <>
            <p className="font-display text-text text-4xl leading-none">
              {resultado.acertados} de {resultado.total}
            </p>
            <p className="text-text-muted text-sm">
              compases a tiempo
              {resultado.tarde > 0 && `, y ${resultado.tarde} que llegaron tarde`}.
            </p>

            <dl className="text-text-muted flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm">
              <div>
                <dt className="text-xs">Racha más larga</dt>
                <dd className="text-text font-mono text-lg">{resultado.rachaMasLarga}</dd>
              </div>
              {resultado.peor !== null && (
                <div>
                  <dt className="text-xs">El que se atragantó</dt>
                  <dd className="text-text font-mono text-lg">
                    {
                      blockChord(activeKey.tonic, activeKey.mode, {
                        ...writtenBlock('peor', resultado.peor.degree, 4, resultado.peor.especie),
                      }).symbol
                    }
                    <span className="text-text-muted ml-2 text-xs">
                      compás {resultado.peor.bar}, {resultado.peor.fallos} de {resultado.peor.veces}
                    </span>
                  </dd>
                </div>
              )}
            </dl>

            {/* Las dos salidas que tienen sentido después de un ensayo, y ninguna
              es un castigo: repetir, o bajar el tempo y repetir. */}
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => void empezar()}>
                <IconoTocar />
                Otra vez
              </Button>
              <Chip
                tone="quiet"
                tamano="compacto"
                onClick={() => {
                  useSessionStore
                    .getState()
                    .actions.setTempo(
                      Math.max(40, useSessionStore.getState().bpm - 10),
                      useSessionStore.getState().beatsPerBar,
                    );
                  void empezar();
                }}
              >
                Diez pulsos más lento
              </Chip>
            </div>
          </>
        ) : (
          <>
            {/* **La canción que vas a ensayar, delante.**
              Aquí había un botón y dos párrafos sobre mil por setecientos de
              negro: medido, el 92 % del área vacío con la canción ya escrita.
              Y hay que fiarse de que lo que se va a ensayar es lo que se
              escribió, sin verlo.

              Es el mismo guion que se va a tocar, pedido al dominio, no una
              lista montada aparte: si lo que se enseña y lo que suena se
              calcularan por caminos distintos, un día dejarían de coincidir. */}
            <ol
              aria-label="Lo que vas a ensayar"
              className="flex max-w-4xl flex-wrap justify-center gap-2"
            >
              {/* **Solo los grados que existen en este modo**, y es una red y
                no el camino. El montaje se traduce al cambiar de modo dentro del
                mismo `set` que cambia la tonalidad, antes de que React pinte, y
                la vigilancia está puesta desde que existe el montaje
                (`state/montaje-en-su-modo.ts`,
                [adr/0030](../../../docs/adr/0030-cambiar-de-modo-traduce-la-cancion.md)).
                Se queda porque `blockChord` no perdona un `I` en menor: cuando
                la traducción dependía de que componer estuviera montada, un
                grado del modo anterior tumbaba la pantalla entera. */}
              {guionDeEnsayo(arrangement, beatsPerBar)
                .filter((sitio) => degreesFor(activeKey.mode).includes(sitio.degree))
                .map((sitio, indice) => (
                  <li
                    key={`${sitio.blockId}-${indice}`}
                    className="border-border bg-surface-raised flex min-w-20 flex-col items-center gap-0.5 rounded-md border px-3 py-2"
                  >
                    {/* En la misma tipografía y con el mismo aire que el acorde
                    que se enciende al ensayar: lo que se mira antes y lo que se
                    mira durante tienen que parecerse, o hay que volver a
                    aprender a leerlo. */}
                    <span className="font-display text-text text-2xl leading-none">
                      {
                        blockChord(activeKey.tonic, activeKey.mode, {
                          ...writtenBlock(sitio.blockId, sitio.degree, sitio.beats, sitio.especie),
                        }).symbol
                      }
                    </span>
                    <span className="text-text-muted font-mono text-xs">c. {sitio.bar}</span>
                  </li>
                ))}
            </ol>

            {/* **«Empezar el ensayo» y no «Ensayar»**: arriba, en la fila de los
              espacios, hay otro «Ensayar» que es el espacio, y con dos botones
              del mismo nombre a la vez el lector no sabe cuál es cuál.

              Mientras se abre el micro, `cargando` y no `disabled`: apagado
              soltaba el foco justo después de pulsarlo. Y **contando, el mismo
              botón la corta**, como en Tocando: dos compases en los que el único
              botón de la pantalla no hiciera nada se leen como que se ha
              colgado. Es el mismo botón en los tres momentos, así que el foco no
              se mueve de él. */}
            <Button
              onClick={() => (contando ? parar() : void empezar())}
              cargando={fase === 'preparando' && !contando}
              variant={contando ? 'quiet' : 'primary'}
              className="min-w-56"
            >
              {contando ? <IconoParar /> : <IconoTocar />}
              {contando
                ? 'Dejarlo'
                : fase === 'preparando'
                  ? 'Abriendo el micro…'
                  : 'Empezar el ensayo'}
            </Button>
            {/* La cuenta, a la vista y **sin anunciarse**: el micro ya está
              abierto, y una voz contando por el altavoz entraría en él. */}
            {contando && (
              <p className="text-center" aria-hidden="true">
                <span className="text-fluid-hero tabular-nums">{cuenta}</span>
                <span className="text-text-muted mt-1 block text-sm">
                  Dos compases de cuenta. El primer acorde se enciende con el último clic.
                </span>
              </p>
            )}
            <p className="text-text-muted max-w-prose text-sm">
              Suena el metrónomo y se enciende el acorde que toca, con los dos siguientes a la
              vista. Te escucho por el micro y al final te digo cuántos salieron y cuál se te
              atragantó.
            </p>
            <p className="text-text-muted flex items-center gap-1 text-xs">
              <IconoSonar />
              Fallar no bloquea nada: se ilumina el compás y se sigue.
            </p>
          </>
        )}
      </div>
    </div>
  );
});
