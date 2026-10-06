/**
 * Una salida, pintada.
 *
 * Sale del panel porque el panel se había comido cuatrocientas veinte líneas en
 * una sola función: grabar, reanalizar, elegir qué se pide, llamar, reproducir y
 * pintar. Pintar una salida es lo único de todo eso que no necesita saber nada
 * del resto, así que es lo primero que se va.
 *
 * Lo que sí necesita es qué está sonando y qué hacer con ella, y entra por props:
 * el componente no sabe de peticiones ni de cupos.
 */

import { moveById, pathById } from '@core/music';
import { Button } from '@ui/Button';

import type { Version, VersionStepOut } from './contract';

/**
 * Lo que se dice de un compás tuyo que sigue siendo el mismo acorde y dura otra
 * cosa. **El V de un ii–V partido** es el caso que lo pidió: mismo grado, misma
 * especie y mismo cifrado, y se pintaba apagado y con «Se queda como estaba» cuando
 * suena la mitad.
 */
function loQueDura(step: VersionStepOut, antes: number): string {
  if (step.move === 'ii-v') {
    return 'Ahora dura la mitad: la otra mitad es su ii, que la prepara';
  }
  if (step.beats * 2 === antes) {
    return 'Ahora dura la mitad que en lo que tocaste';
  }
  if (step.beats === antes * 2) {
    return 'Ahora dura el doble que en lo que tocaste';
  }
  return `Ahora dura ${step.beats} pulsos, y en lo que tocaste ${antes}`;
}

export interface SalidaProps {
  readonly version: Version;
  /** Si es esta la que está sonando. */
  readonly suena: boolean;
  /**
   * Qué compás va sonando **de la salida entera**, o nulo.
   *
   * Contado sobre `version.steps`, que es lo que se toca: el reproductor no sabe
   * de partes.
   *
   * Va aparte de `suena` y no colapsado en uno, que es lo que se intentó
   * primero: una salida puede estar sonando con el compás todavía en nulo —justo
   * al arrancar—, y con un solo campo el botón decía «Escuchar» en mitad de la
   * reproducción. Lo cazó un test.
   */
  readonly compas: number | null;
  readonly onEscuchar: () => void;
  readonly onQuedarse: () => void;
}

export function Salida({ version, suena, compas, onEscuchar, onQuedarse }: SalidaProps) {
  // Dónde empieza cada parte dentro de la salida entera. **El compás que suena se
  // cuenta sobre la salida y cada parte numera los suyos desde cero**: comparando
  // los dos a pelo, con un cierre detrás de lo tuyo se encendía a la vez el
  // primero de cada parte y, pasado lo tuyo, el que no sonaba.
  const empiezas: number[] = [];
  let contados = 0;
  for (const seccion of version.sections) {
    empiezas.push(contados);
    contados += seccion.steps.length;
  }
  return (
    <li className="superficie p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <h3 className="text-text text-base">{version.title}</h3>
          {/* Por dónde ha tirado. Es lo que separa una salida de otra, y
                sin ello tres propuestas parecen tres caprichos. */}
          {/* v8 ignore start -- el camino viene validado contra el catalogo antes de llegar aqui */}
          <span className="rotulo block">{pathById(version.path)?.name ?? version.path}</span>
          {/* v8 ignore stop */}
        </span>
        <span className="flex flex-wrap gap-2">
          {/* Escuchar antes que ponerla: comparar tres versiones
                leyéndolas cuesta, y para cuando has tocado la tercera se
                te ha olvidado cómo sonaba la primera. */}
          <Button variant="quiet" onClick={onEscuchar}>
            {suena ? 'Parar' : 'Escuchar'}
          </Button>
          <Button variant="quiet" onClick={onQuedarse}>
            Quedarme con esta
          </Button>
        </span>
      </div>
      <p className="text-text-muted mt-1 text-sm">{version.why}</p>

      {version.sections.map((seccion, parte) => (
        <div key={`${version.title}-${seccion.name}`} className="mt-3">
          {/* El nombre de la parte solo se pinta cuando hay más de una:
                con una sola sería un rótulo de adorno encima de lo mismo
                de siempre. */}
          {version.sections.length > 1 && (
            <p className="rotulo">
              {seccion.name}
              {seccion.yours && <span className="text-brass-bright"> · lo que tocaste</span>}
            </p>
          )}
          <ol
            aria-label={`${seccion.name} de ${version.title}`}
            className="mt-1 flex flex-wrap gap-2"
          >
            {seccion.steps.map((step, index) => {
              const move = step.move === null ? null : moveById(step.move);
              const sonandoEste = suena && compas === empiezas[parte]! + index;
              // Tres estados y no dos, desde que una salida puede alargar:
              // el compás es nuevo, es tuyo y ha cambiado, o es tuyo y sigue
              // igual. Lo que no es tuyo es lo que hay que mirar primero.
              const nuevo = step.from === null;
              const cambiaDeGrado = !nuevo && step.from !== step.degree;
              // Y cambiar de especie también es cambiar, aunque el grado sea el
              // mismo: un `I` que pasa a `Imaj7` no «se queda como estaba».
              const cambiaDeEspecie =
                !nuevo &&
                !cambiaDeGrado &&
                step.fromSymbol !== undefined &&
                step.fromSymbol !== step.symbol;
              // Y lo que dura: el mismo acorde con la mitad de pulsos ha cambiado.
              const cambiaDeDuracion =
                !nuevo && step.fromBeats !== undefined && step.fromBeats !== step.beats;
              // Un movimiento declarado es un cambio aunque no se vea en lo demás.
              const cambia = cambiaDeGrado || cambiaDeEspecie || cambiaDeDuracion || move !== null;
              return (
                <li
                  key={`${version.title}-${seccion.name}-${index}`}
                  // Lo que se propone se destaca y lo que se queda se apaga:
                  // es lo único que hace falta ver de un vistazo con la
                  // guitarra puesta. Y el que suena lleva halo, que es lo
                  // que deja seguir la progresión con el oído y con la vista
                  // a la vez.
                  className={`rounded-md px-2 py-1 text-center transition-shadow ${
                    nuevo || cambia ? 'superficie-viva' : 'text-text-muted'
                  } ${sonandoEste ? 'ring-brass-bright ring-2' : ''}`}
                  title={
                    nuevo
                      ? 'Compás nuevo: no estaba en lo que tocaste'
                      : !cambia
                        ? 'Se queda como estaba'
                        : !cambiaDeGrado && !cambiaDeEspecie && cambiaDeDuracion
                          ? loQueDura(step, step.fromBeats)
                          : (move?.why ?? 'Cambia respecto a lo que tocaste')
                  }
                  aria-current={sonandoEste ? 'true' : undefined}
                >
                  <span className="text-text block font-mono text-base">{step.symbol}</span>
                  <span className="text-text-muted block text-xs">
                    {cambiaDeGrado
                      ? `${step.from} → ${step.degree}`
                      : cambiaDeEspecie
                        ? `${step.fromSymbol} → ${step.symbol}`
                        : cambiaDeDuracion
                          ? `${step.degree} · ${step.fromBeats} → ${step.beats} pulsos`
                          : step.degree}
                  </span>
                  {nuevo && <span className="text-brass-bright block text-xs">nuevo</span>}
                  {move !== null && (
                    <span className="text-brass-bright block text-xs">{move.name}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </li>
  );
}
