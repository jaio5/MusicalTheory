'use client';

import { useMemo, useState } from 'react';

import { can, cheapestPlanWith, MAX_VERSION_DEGREES } from '@core/billing';
import {
  captureProgression,
  DEFAULT_ROLE,
  DUDOSO,
  ROLES,
  degreesFromPath,
  moveById,
  noteName,
  resolveDegree,
  roleInfo,
  scheduleProgression,
  type CapturedStep,
  type PathKind,
  type SectionRole,
} from '@core/music';
import { analyzeRecording } from '@audio/analyze-recording';
import { canRecord } from '@audio/recorder';
import { useListening } from '@state/use-listening';
import type { ProgressionPlayer } from '@audio/progression-player';
import { useAccount } from '@state/account';
import { apuntarHecho } from '@state/hechos-de-componer';
import { useProgressionPlayer } from '@state/use-progression-player';
import { entradaActiva } from '@state/use-listening';
import { apiErrorOf } from '@state/api-error';

import { Salida } from './Salida';
import { useArrangementStore } from '@state/arrangement-store';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { Field } from '@ui/Field';
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
  const montaje = useArrangementStore((state) => state.arrangement);
  const capturing = useSessionStore((state) => state.capturing);
  const captured = useSessionStore((state) => state.captured);
  const captureEndedAt = useSessionStore((state) => state.captureEndedAt);

  /**
   * Para poder abrir el micrófono desde aquí si no lo está.
   *
   * `chords: true` porque lo que este panel quiere oír son acordes: es lo mismo
   * que piden el acorde oído del camino y la pantalla de empezar por tonalidad.
   */
  const { start: abrirMicro } = useListening({ chords: true });
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
  const [kind, setKind] = useState<PathKind>('continuar');
  /**
   * Qué es lo que le mandas, dicho antes de mandarlo.
   *
   * Empieza en `idea` y **no se adivina**. Se podría intentar —cuatro compases
   * que vuelven a la tónica se parecen a un estribillo— y sería adivinar sobre
   * lo único que esta pantalla no puede saber: si eso es el estribillo lo sabe
   * quien lo ha tocado, no el que cuenta los grados.
   */
  const [role, setRole] = useState<SectionRole>(DEFAULT_ROLE);

  const { pedir: player, parar } = useProgressionPlayer(createPlayer);

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
      parar();
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

  /**
   * Lo escrito en la canción, que es de donde salen las salidas cuando no hay
   * nada grabado.
   *
   * Salía del **camino**, y el camino dejó de ser donde se escribe
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)):
   * con tres acordes en la canción, este panel decía «encadena al menos dos
   * acordes» y no dejaba pedir nada. Lo que se manda son los grados y sus
   * pulsos, así que los pulsos salen del bloque y no de un cuatro fijo.
   */
  const delMontaje = useMemo(
    () =>
      montaje.parts.flatMap((part) =>
        part.blocks.map((block) => ({ degree: block.degree, beats: block.beats })),
      ),
    [montaje],
  );

  const delCamino = useMemo(
    () =>
      degreesFromPath(
        path.map((chord) => chord.label),
        activeKey?.mode ?? 'major',
      ).degrees.map((degree) => ({ degree, beats: 4 })),
    [path, activeKey],
  );

  const escrito = delMontaje.length > 0 ? delMontaje : delCamino;
  const progresion = grabado.length > 0 ? grabado : escrito;
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

    if (!capturing) {
      /*
        Si el micrófono no está abierto, lo abre.

        Este botón promete grabar un trozo de lo que tocas, y sin entrada no
        grababa nada: `canRecord(null)` es falso, así que se saltaba la grabación
        **en silencio** y al parar no había acordes. El panel se quedaba diciendo
        «encadena al menos dos acordes» sin que nadie supiera por qué.

        Se abre por el mismo sitio que los demás botones de escuchar —el módulo
        es el dueño del micro, no el componente—, así que no se le quita a nadie
        y se suelta cuando no quede ningún consumidor montado.
      */
      if (getInput() === null) {
        await abrirMicro();
      }
      const recienAbierta = getInput();
      actions.startCapture(now());
      if (canRecord(recienAbierta)) {
        recienAbierta.startRecording();
      }
      return;
    }

    const entrada = getInput();
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
      const acordes = await analyzeRecording(grabacion, {
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
      /**
       * Cada compás dice si lo leyó el micro y nadie lo confirmó.
       *
       * Un compás escrito a mano es lo que alguien quiso poner; uno oído es una
       * lectura que puede estar mal, y el motor lo sabe —tiene su margen y sus
       * alternativas—. Sin la marca, los dos llegaban iguales al modelo.
       */
      progression: progresion.slice(0, MAX_VERSION_DEGREES).map((paso) => ({
        degree: paso.degree,
        beats: paso.beats,
        ...(deLoGrabado && 'confidence' in paso && paso.confidence < DUDOSO ? { heard: true } : {}),
      })),
      kind,
      role,
    };

    try {
      const response = await fetchVersions(request);
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(apiErrorOf<VersionsErrorCode>(payload, ERROR_MESSAGES.model_unavailable));
        setVersions([]);
        return;
      }
      // Se comprueba lo que llega en vez de creérselo. Un 200 con el cuerpo
      // cambiado —un proxy que contesta otra cosa, una ruta y un cliente que se
      // han desincronizado al desplegar— dejaba la pantalla **en blanco**: el
      // panel entero se caía al leer `versions.length` de un `undefined`. Con la
      // comprobación sale el mismo aviso que ya tiene el panel de ideas para
      // esto, que es lo que se puede hacer al respecto.
      const llegadas = (payload as { versions?: unknown }).versions;
      if (!Array.isArray(llegadas)) {
        setError({
          code: 'unparseable_response',
          message: ERROR_MESSAGES.unparseable_response,
        });
        setVersions([]);
        return;
      }
      setVersions(llegadas as readonly Version[]);
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

    // Quedarse con una salida cuenta como practicar. Es **quedársela** y no
    // pedirla: pedir cuatro propuestas y no usar ninguna no es haber compuesto
    // nada, y premiar la petición premiaría gastar IA.
    apuntarHecho('salida');
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
          cargando={pending}
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

        {/* Qué parte es esto, junto a lo que se le pide y no escondido en otro
            sitio: son la misma decisión partida en dos mitades —«qué te mando»
            y «qué quiero»— y tomarlas separadas hace que casi nadie tome la
            primera. La explicación del papel va en el `title`, que es donde ya
            vive la de los compases del lienzo. */}
        <Field
          label="Qué parte es esto"
          compact
          ancho="auto"
          value={role}
          onChange={(event) => setRole(event.target.value as SectionRole)}
          disabled={pending || analizando}
          title={roleInfo(role).what}
        >
          {ROLES.map((candidato) => (
            <option key={candidato.id} value={candidato.id}>
              {candidato.name}
            </option>
          ))}
        </Field>

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
            ? 'Graba un trozo o escribe al menos dos acordes: con uno solo no hay por dónde tirar.'
            : deLoGrabado
              ? `De lo que has grabado: ${progresion.map((step) => step.degree).join(' · ')}.`
              : // De la canción y no «del camino que llevas», que es lo que decía
                // cuando salía del camino. Un rótulo que nombra el sitio
                // equivocado manda a mirar donde no está lo que se va a mandar.
                `De ${delMontaje.length > 0 ? 'lo que llevas escrito' : 'lo que llevas probando'}: ${progresion
                  .map((step) => step.degree)
                  .join(' · ')}.`}
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
            <Salida
              key={`${version.path}-${version.title}`}
              version={version}
              suena={sonando?.title === version.title}
              compas={sonando?.step ?? null}
              onEscuchar={() => void escuchar(version)}
              onQuedarse={() => use(version)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
