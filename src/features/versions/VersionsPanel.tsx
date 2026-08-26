'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { can, cheapestPlanWith, MAX_VERSION_DEGREES } from '@core/billing';
import {
  captureProgression,
  degreesFromPath,
  moveById,
  noteName,
  pathById,
  resolveDegree,
  scheduleProgression,
  type CapturedStep,
  type SalidaKind,
} from '@core/music';
import { analizarGrabacion } from '@audio/analyze-recording';
import { canRecord } from '@audio/recorder';
import { WebAudioProgressionPlayer, type ProgressionPlayer } from '@audio/progression-player';
import { useAccount } from '@state/account';
import { entradaActiva } from '@state/use-listening';
import { apiErrorOf } from '@state/api-error';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { PlanLock } from '@ui/PlanLock';

import {
  ERROR_MESSAGES,
  type Version,
  type VersionsErrorCode,
  type VersionsRequest,
} from './contract';

export interface VersionsPanelProps {
  /** Se inyecta en los tests para no llamar al servidor de verdad. */
  readonly fetchVersions?: (request: VersionsRequest) => Promise<Response>;
  /**
   * De dónde sale la entrada de audio que está sonando.
   *
   * Se inyecta por lo mismo que el resto: `entradaActiva()` es una referencia de
   * módulo —el micro es uno— y sin poder cambiarla no se podría probar que al
   * parar de grabar se reanaliza.
   */
  readonly getInput?: () => unknown;
  /** El reloj, por parámetro, para poder probar la grabación sin esperar. */
  readonly now?: () => number;
  /** Se inyecta en los tests: jsdom no tiene `AudioContext`. */
  readonly createPlayer?: () => ProgressionPlayer;
}

async function defaultFetch(request: VersionsRequest): Promise<Response> {
  return fetch('/api/versiones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

/**
 * Versiones de lo que llevas tocado: los mismos compases con otros acordes.
 *
 * Lo que sube son grados y pulsos, nunca audio. Y lo que baja ya viene
 * **comprobado contra el dominio** por el contrato: cada compás cambiado dice qué
 * movimiento se le ha hecho, y una versión que declara un movimiento falso no
 * llega hasta aquí. Por eso el porqué se puede enseñar al lado de cada acorde sin
 * miedo: no es lo que dijo el modelo, es lo que se ha verificado.
 */
export function VersionsPanel({
  fetchVersions = defaultFetch,
  now = () => performance.now(),
  createPlayer,
  getInput = entradaActiva,
}: VersionsPanelProps = {}) {
  const { account, signedIn } = useAccount();
  const activeKey = useSessionStore(selectActiveKey);
  const path = useSessionStore((state) => state.path);
  const capturing = useSessionStore((state) => state.capturing);
  const captured = useSessionStore((state) => state.captured);
  const captureEndedAt = useSessionStore((state) => state.captureEndedAt);
  const bpm = useSessionStore((state) => state.bpm);
  const beatsPerBar = useSessionStore((state) => state.beatsPerBar);

  // El mismo permiso que comprueba la ruta antes de gastar dinero.
  const puedePedir = can(account.plan, 'versiones');

  // Mientras se reanaliza la grabación, el botón de pedir espera: lo que se
  // mandaría hasta que termine son los acordes que el motor oyó en vivo, que son
  // justo los que se están corrigiendo.
  const [analizando, setAnalizando] = useState(false);
  /**
   * Qué se le pide. Se elige antes y no lo decide el modelo: de ello depende el
   * esquema que se le manda, y con el esquema exacto pasa de cero salidas
   * válidas a tres de tres. El porqué está en `core/music/paths.ts`.
   */
  const [kind, setKind] = useState<SalidaKind>('continuar');

  const playerRef = useRef<ProgressionPlayer | null>(null);
  const factoryRef = useRef(createPlayer);
  useEffect(() => {
    factoryRef.current = createPlayer;
  });

  // Al salir de la pantalla se calla y se suelta el contexto de audio. Sin esto,
  // cambiar de pantalla en mitad de una versión la deja sonando.
  useEffect(() => {
    return () => {
      void playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  function player(): ProgressionPlayer {
    playerRef.current ??= factoryRef.current?.() ?? new WebAudioProgressionPlayer();
    return playerRef.current;
  }

  /**
   * Suena esa versión, o la calla si ya sonaba.
   *
   * El mismo botón para las dos cosas: escuchando dos versiones seguidas, lo que
   * se quiere hacer con la que suena es cortarla, y un botón de parar aparte
   * obliga a apuntar a otro sitio.
   */
  async function escuchar(version: Version) {
    if (activeKey === null) {
      return;
    }
    if (sonando?.title === version.title) {
      player().stop();
      setSonando(null);
      return;
    }

    const pasos = scheduleProgression(
      version.steps.map((step) => {
        const chord = resolveDegree(activeKey.tonic, activeKey.mode, step.degree);
        return { root: chord.root, notes: chord.notes, beats: step.beats };
      }),
      bpm,
    );

    setSonando({ title: version.title, step: null });
    await player().play(pasos, (step) => {
      if (step === null) {
        setSonando(null);
      } else {
        setSonando({ title: version.title, step });
      }
    });
  }

  const [versions, setVersions] = useState<readonly Version[]>([]);
  /** Qué versión suena y por qué compás va, para encenderlo en pantalla. */
  const [sonando, setSonando] = useState<{ title: string; step: number | null } | null>(null);
  const [error, setError] = useState<{ code: VersionsErrorCode | null; message: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  /**
   * De dónde sale la progresión: de lo grabado si hay algo, y si no del camino.
   *
   * Lo grabado manda porque es lo que se acaba de tocar, y además trae los
   * pulsos de verdad: cuánto duró cada acorde. El camino no tiene duraciones
   * —es una lista de acordes encadenados a mano— así que ahí todos los compases
   * valen cuatro. Cuando hay grabación, esa diferencia deja de existir.
   */
  // Los dos con `useMemo`, y no por costumbre: `captureProgression` recorre el
  // buffer entero de lo grabado, y este panel se repinta con cada compás que
  // suena al escuchar una versión. Sin esto, oír ocho compases recalcula ocho
  // veces una grabación de trescientos acordes para llegar al mismo resultado.
  const grabado: readonly CapturedStep[] = useMemo(
    () =>
      activeKey === null || captured.length === 0 || captureEndedAt === 0
        ? []
        : captureProgression(captured, {
            tonic: activeKey.tonic,
            mode: activeKey.mode,
            bpm,
            beatsPerBar,
            endedAt: captureEndedAt,
          }).steps,
    [activeKey, captured, captureEndedAt, bpm, beatsPerBar],
  );

  const delCamino = useMemo(
    () =>
      degreesFromPath(
        path.map((chord) => chord.label),
        activeKey?.mode ?? 'major',
      ).degrees.map((degree) => ({ degree, beats: 4 })),
    [path, activeKey],
  );

  const progresion = grabado.length > 0 ? grabado : delCamino;
  const deLoGrabado = grabado.length > 0;

  // Con un acorde no hay nada que rearmonizar, y el contrato ya lo rechaza. Se
  // comprueba también aquí para no gastar una petición en que la rechacen.
  const sePuedePedir = activeKey !== null && progresion.length >= 2;

  /**
   * Grabar, y al parar volver a escucharlo con calma.
   *
   * Lo que el motor oye en vivo arrastra sus limitaciones —ventana corta, sin
   * poder mirar hacia delante, decidiendo acorde a acorde—. Con el sonido
   * guardado se puede analizar entero: ventana cuatro veces más larga, el ruido
   * de la sala medido en la propia grabación y la secuencia elegida de una vez
   * con el grafo del dominio.
   *
   * Si no se pudo grabar —el navegador no sabe, o el micro está cerrado— se
   * queda lo que oyó en vivo. Se pierde la mejora, no la función.
   */
  async function grabar(): Promise<void> {
    const { actions } = useSessionStore.getState();
    const entrada = getInput();

    if (!capturing) {
      actions.startCapture(now());
      if (canRecord(entrada)) {
        entrada.startRecording();
      }
      return;
    }

    actions.stopCapture(now());
    if (!canRecord(entrada)) {
      return;
    }

    setAnalizando(true);
    try {
      const grabacion = await entrada.stopRecording();
      if (grabacion === null) {
        return;
      }
      const acordes = await analizarGrabacion(grabacion, {
        key: activeKey === null ? undefined : { tonic: activeKey.tonic, mode: activeKey.mode },
      });
      // Solo se pisa lo oído en vivo si el análisis ha sacado algo. Un análisis
      // vacío —micro mudo, una grabación de dos segundos— no puede borrar lo que
      // sí se oyó.
      if (acordes.length > 0) {
        useSessionStore.getState().actions.replaceCapture(acordes);
      }
    } finally {
      setAnalizando(false);
    }
  }

  async function ask() {
    if (activeKey === null || !sePuedePedir) {
      return;
    }
    setPending(true);
    setError(null);

    const request: VersionsRequest = {
      key: { tonic: noteName(activeKey.tonic), mode: activeKey.mode },
      progression: progresion.slice(0, MAX_VERSION_DEGREES),
      kind,
    };

    try {
      const response = await fetchVersions(request);
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(apiErrorOf<VersionsErrorCode>(payload, ERROR_MESSAGES.model_unavailable));
        setVersions([]);
        return;
      }
      setVersions((payload as { versions: readonly Version[] }).versions);
    } catch {
      setError({ code: 'model_unavailable', message: ERROR_MESSAGES.model_unavailable });
      setVersions([]);
    } finally {
      setPending(false);
    }
  }

  /** Deja esa versión puesta en el camino, para poder tocarla. */
  function use(version: Version) {
    if (activeKey === null) {
      return;
    }
    const { actions } = useSessionStore.getState();
    actions.clearPath();

    for (const step of version.steps) {
      const move = step.move === null ? null : moveById(step.move);
      // La fundamental y las notas se resuelven aquí y no se copian del paso:
      // son las que usan el mástil y las formas del acorde, y mandarlas vacías
      // dejaría la columna del medio sin nada que dibujar.
      const chord = resolveDegree(activeKey.tonic, activeKey.mode, step.degree);

      actions.pushChord({
        symbol: chord.symbol,
        label: step.degree,
        root: chord.root,
        notes: chord.notes,
        // El porqué es el del movimiento que lo puso ahí, que dice más que el
        // papel del grado: cuenta qué ha cambiado respecto a lo que tocabas.
        why: move === null ? chord.role : move.why,
      });
    }
    actions.setCurrentDegree(version.steps.at(-1)?.degree ?? null);
  }

  if (!puedePedir) {
    return (
      <PlanLock
        needed={cheapestPlanWith('versiones')}
        what="Las salidas de lo que tocas"
        plural
        signedIn={signedIn}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={analizando}
          onClick={() => {
            void grabar();
          }}
        >
          {analizando
            ? 'Escuchándolo otra vez…'
            : capturing
              ? 'Parar de grabar'
              : 'Grabar un trozo'}
        </Button>

        <Button
          onClick={() => void ask()}
          disabled={pending || !sePuedePedir || capturing || analizando}
        >
          {pending ? 'Buscando salidas…' : 'Salidas de esto'}
        </Button>

        {/* Qué se le pide, elegido antes de pedirlo. No es un adorno: de esto
            depende que el esquema pueda exigir lo que el validador comprueba. */}
        <span className="flex flex-wrap gap-2">
          {(
            [
              ['continuar', 'Continuar la canción'],
              ['retocar', 'Retocar estos compases'],
            ] as const
          ).map(([id, rotulo]) => (
            <Button
              key={id}
              variant={kind === id ? undefined : 'quiet'}
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
              disabled={pending || analizando}
            >
              {rotulo}
            </Button>
          ))}
        </span>

        {deLoGrabado && !capturing && (
          <Button variant="quiet" onClick={() => useSessionStore.getState().actions.clearCapture()}>
            Olvidar lo grabado
          </Button>
        )}
      </div>

      {/* Lo que se va a mandar, dicho antes de mandarlo: con la guitarra puesta,
          pulsar un botón que gasta cupo sin saber sobre qué es lo que hace que
          no se pulse. */}
      <p className="text-text-muted mt-2 text-sm" role="status">
        {capturing
          ? 'Grabando lo que tocas. Se apuntan los acordes y cuánto dura cada uno, no el sonido.'
          : !sePuedePedir
            ? 'Graba un trozo o encadena al menos dos acordes: con uno solo no hay por dónde tirar.'
            : deLoGrabado
              ? `De lo que has grabado: ${progresion.map((step) => step.degree).join(' · ')}.`
              : `Del camino que llevas: ${progresion.map((step) => step.degree).join(' · ')}.`}
      </p>

      <p className="text-text-muted mt-2 text-sm">
        Se mandan los grados y sus pulsos, no el sonido. Cada salida dice por dónde tira, y se
        comprueba contra el dominio: la que no cuadra se descarta antes de llegar aquí.
      </p>

      {error !== null && (
        <p role="alert" className="text-oxblood-bright mt-4 text-sm">
          {error.message}
        </p>
      )}

      {versions.length > 0 && (
        <ul className="mt-6 space-y-4">
          {versions.map((version) => (
            <li key={version.title} className="superficie p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <h3 className="text-text text-base">{version.title}</h3>
                  {/* Por dónde ha tirado. Es lo que separa una salida de otra, y
                      sin ello tres propuestas parecen tres caprichos. */}
                  <span className="text-text-muted block font-mono text-xs uppercase">
                    {pathById(version.path)?.name ?? version.path}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  {/* Escuchar antes que ponerla: comparar tres versiones
                      leyéndolas cuesta, y para cuando has tocado la tercera se
                      te ha olvidado cómo sonaba la primera. */}
                  <Button variant="quiet" onClick={() => void escuchar(version)}>
                    {sonando?.title === version.title ? 'Parar' : 'Escuchar'}
                  </Button>
                  <Button variant="quiet" onClick={() => use(version)}>
                    Quedarme con esta
                  </Button>
                </span>
              </div>
              <p className="text-text-muted mt-1 text-sm">{version.why}</p>

              {version.sections.map((seccion) => (
                <div key={`${version.title}-${seccion.name}`} className="mt-3">
                  {/* El nombre de la parte solo se pinta cuando hay más de una:
                      con una sola sería un rótulo de adorno encima de lo mismo
                      de siempre. */}
                  {version.sections.length > 1 && (
                    <p className="text-text-muted font-mono text-xs uppercase">
                      {seccion.name}
                      {seccion.tuya && <span className="text-brass-bright"> · lo que tocaste</span>}
                    </p>
                  )}
                  <ol
                    aria-label={`${seccion.name} de ${version.title}`}
                    className="mt-1 flex flex-wrap gap-2"
                  >
                    {seccion.steps.map((step, index) => {
                      const move = step.move === null ? null : moveById(step.move);
                      const suena = sonando?.title === version.title && sonando.step === index;
                      // Tres estados y no dos, desde que una salida puede alargar:
                      // el compás es nuevo, es tuyo y ha cambiado, o es tuyo y sigue
                      // igual. Lo que no es tuyo es lo que hay que mirar primero.
                      const nuevo = step.from === null;
                      const cambia = !nuevo && step.from !== step.degree;
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
                          } ${suena ? 'ring-brass-bright ring-2' : ''}`}
                          title={
                            nuevo
                              ? 'Compás nuevo: no estaba en lo que tocaste'
                              : cambia
                                ? (move?.why ?? 'Cambia respecto a lo que tocaste')
                                : 'Se queda como estaba'
                          }
                          aria-current={suena ? 'true' : undefined}
                        >
                          <span className="text-text block font-mono text-base">{step.symbol}</span>
                          <span className="text-text-muted block font-mono text-xs">
                            {cambia ? `${step.from} → ${step.degree}` : step.degree}
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
          ))}
        </ul>
      )}
    </div>
  );
}
