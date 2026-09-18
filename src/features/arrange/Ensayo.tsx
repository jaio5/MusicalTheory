'use client';

import { blockChord, largoDelEnsayo, writtenBlock } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { useArrangementStore } from '@state/arrangement-store';
import { useEnsayo, type EnsayoDeps } from '@state/use-ensayo';
import { Button } from '@ui/Button';
import { Chip } from '@ui/Chip';
import { IconoParar, IconoSonar, IconoTocar } from '@ui/icons';
import { Vacio } from '@ui/Vacio';

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
export function Ensayo({ deps = {} }: { readonly deps?: EnsayoDeps } = {}) {
  const activeKey = useSessionStore(selectActiveKey);
  const arrangement = useArrangementStore((state) => state.arrangement);
  const { fase, paso, guion, resultados, resultado, empezar, parar } = useEnsayo(
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
        <div className="my-auto">
          <Vacio icono={<IconoTocar />} titulo="Todavía no hay nada que ensayar">
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

  return (
    // `my-auto` en el hijo y no `justify-center` aquí, que es la regla de la
    // casa: centrar en una caja que recorta saca lo que no cabe **por los dos
    // lados**, y en una ventana baja el botón se iba por arriba sin manera de
    // alcanzarlo. Así se centra mientras sobra sitio y se desplaza cuando no.
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="my-auto flex flex-col items-center gap-5 p-4 text-center">
        {ensayando && paso !== null ? (
          <>
            {/* El que toca, grande, y los dos que vienen detrás en pequeño. Leer
              con un compás de antelación es de lo que va tocar con metrónomo. */}
            <div className="flex items-baseline justify-center gap-6">
              <span
                className="font-display text-brass-bright text-6xl leading-none"
                aria-live="polite"
              >
                {cifrado(paso)}
              </span>
              <span className="text-text-muted font-display text-3xl leading-none opacity-60">
                {cifrado(paso + 1)}
              </span>
              <span className="text-text-muted font-display text-2xl leading-none opacity-30">
                {cifrado(paso + 2)}
              </span>
            </div>

            <p className="text-text-muted font-mono text-xs">
              Compás {guion[paso]?.bar ?? 1} de {guion.length}
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

            <Button onClick={parar} variant="quiet">
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
                className="px-3 text-xs"
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
            <Button
              onClick={() => void empezar()}
              disabled={fase === 'preparando'}
              className="min-w-56"
            >
              <IconoTocar />
              {fase === 'preparando' ? 'Abriendo el micro…' : 'Ensayar'}
            </Button>
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
}
