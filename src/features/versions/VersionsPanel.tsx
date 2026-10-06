'use client';

import { useId, useMemo, useRef, useState } from 'react';

import { can, cheapestPlanWith, MAX_VERSION_DEGREES } from '@core/billing';
import {
  blockChord,
  captureProgression,
  DEFAULT_ROLE,
  MAX_PARTS,
  ROLES,
  degreesFromPath,
  noteName,
  writtenBlock,
  roleInfo,
  MAX_PATH_STEPS,
  scheduleProgression,
  type Arrangement,
  type CapturedStep,
  type Part,
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
import { nuevoId, useArrangementStore } from '@state/arrangement-store';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';
import { Field } from '@ui/Field';
import { PlanLock } from '@ui/PlanLock';
import { TextField } from '@ui/TextField';

import { aplicarSalida, type FuenteDeLasSalidas } from './aplicar-salida';
import {
  ERROR_MESSAGES,
  MAX_DIRECTRICES_LENGTH,
  type Version,
  type VersionsErrorCode,
  type VersionsRequest,
  type VersionStep,
} from './contract';
import { pasosDeLaParte, pasosDeLoGrabado } from './lo-que-se-manda';

/** Lo que se dice cuando quedarse con una salida dejaría la canción con más partes de las que caben. */
export const NO_CABEN_LAS_PARTES = `La canción ya tiene ${MAX_PARTS} partes y no cabe lo que añade esta salida. Quita alguna, o pide «Retocar estos compases».`;

/**
 * Lo que se dice cuando la canción se pasa del tope: se mandan los primeros
 * compases, y se dice cuántos se quedan fuera en vez de cortarlos en silencio.
 */
export function compasesQueNoViajan(tiene: number): string {
  return `Se mandan los primeros ${MAX_VERSION_DEGREES} compases de ${tiene}: los otros ${tiene - MAX_VERSION_DEGREES} no entran en la petición.`;
}

/**
 * Lo que se dice al lado de «Continuar» apagado: con la canción en el tope, detrás
 * no cabe nada.
 *
 * Solo lo dice el panel, que lo sabe contando. Si el servidor no encuentra salidas
 * por otra razón, contesta con la suya (`porQueNoHaySalidas`) y se enseña como
 * cualquier error.
 */
export const NO_CABE_OTRA_PARTE =
  'Ya no cabe otra parte detrás de lo que llevas. Prueba «Retocar estos compases».';

/**
 * Lo más corto que puede ser lo que se añade detrás: **un compás**, la llegada.
 *
 * Eran dos, el `MIN_BARS_PER_SECTION` de `core/music/paths.ts`, porque una parte de
 * un compás no es una parte (adr/0051). Pero la tónica sola que resuelve tu V sí
 * vale (`esLaLlegada`), así que con treinta y un compases todavía puede haber
 * salida, y quien lo sabe es el servidor: si no la hay, lo dice él.
 */
const COMPASES_DE_LA_PARTE_MAS_CORTA = 1;

/** Qué se aplicó la última vez, para que probar otra salida la sustituya. */
interface Aplicada {
  readonly antes: Arrangement;
  readonly despues: Arrangement;
}

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
 * Las salidas de lo que llevas tocado: por dónde puede seguir, o cómo retocarlo.
 *
 * Lo que sube son grados y pulsos, nunca audio. Y lo que baja lo **construyó el
 * dominio**: el modelo solo elige del menú y explica, y su explicación se
 * comprueba contra la salida antes de llegar aquí. Por eso el movimiento se puede
 * enseñar al lado de cada acorde sin miedo: no es lo que dijo el modelo, es lo que
 * se ha hecho.
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
  const accionesMontaje = useArrangementStore((state) => state.actions);
  const bloqueElegido = useArrangementStore((state) => state.selectedBlockId);
  const estilo = useSessionStore((state) => state.styleId);
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
   * Qué es lo que le mandas, cuando no es una parte de la canción: lo grabado o
   * el camino. Una parte ya tiene el suyo, y ése es el que vale.
   *
   * Empieza en `idea` y **no se adivina**. Se podría intentar —cuatro compases
   * que vuelven a la tónica se parecen a un estribillo— y sería adivinar sobre
   * lo único que esta pantalla no puede saber: si eso es el estribillo lo sabe
   * quien lo ha tocado, no el que cuenta los grados.
   */
  const [papelSuelto, setPapelSuelto] = useState<SectionRole>(DEFAULT_ROLE);
  /** La parte que se ha elegido aquí, si se ha elegido alguna. */
  const [parteElegida, setParteElegida] = useState<string | null>(null);
  const [directrices, setDirectrices] = useState('');

  const { pedir: player, parar } = useProgressionPlayer(createPlayer);

  /**
   * Suena esa versión, o la calla si ya sonaba.
   *
   * El mismo botón para las dos cosas: escuchando dos versiones seguidas, lo que
   * se quiere hacer con la que suena es cortarla, y un botón de parar aparte
   * obliga a apuntar a otro sitio.
   */
  async function escuchar(version: Version) {
    /* v8 ignore next 3 -- sin tonalidad el panel enseña que falta elegirla, sin salidas que escuchar */
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
        // Con su especie: un G7 que vuelve tiene que sonar con su séptima.
        const chord = blockChord(
          activeKey.tonic,
          activeKey.mode,
          writtenBlock('', step.degree, step.beats, step.especie),
        );
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
  /**
   * Si las que hay las eligió el dominio porque el modelo no dio nada que valiera,
   * y por qué: no se le pudo hablar, o lo que dijo no se sostenía. Nulo si las
   * eligió el modelo.
   *
   * Se dice en pantalla y no solo en el título de cada una: el cupo ya se ha
   * gastado, y quien lo ha pagado tiene que saber que esto no lo eligió el modelo.
   * **Y el porqué cambia la frase**: con el modelo caído, «no ha dado con nada que
   * se sostenga» manda a pedirlo otra vez contra lo mismo.
   */
  const [delDominio, setDelDominio] = useState<'sin-contacto' | 'no-se-sostiene' | null>(null);
  /** Qué versión suena y por qué compás va, para encenderlo en pantalla. */
  const [sonando, setSonando] = useState<{ title: string; step: number | null } | null>(null);
  const [error, setError] = useState<{ code: VersionsErrorCode | null; message: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  /**
   * De dónde salieron los compases de las salidas que hay en pantalla.
   *
   * Se apunta al pedirlas y no al quedárselas: entre una cosa y otra se puede
   * elegir otro bloque, y la salida habla de la parte que se mandó.
   */
  const [fuente, setFuente] = useState<FuenteDeLasSalidas | null>(null);
  /** Si al quedarse con la última el punteo se quedó encima de acordes nuevos. */
  const [punteoSinRevisar, setPunteoSinRevisar] = useState(false);
  /**
   * La última salida puesta, y cómo estaba la canción antes.
   *
   * En una referencia porque no se pinta: solo sirve para que **probar otra salida
   * sustituya a la anterior** en vez de amontonarse. Sin esto, quedarse con dos
   * continuaciones seguidas dejaba los dos cierres uno detrás de otro.
   */
  const aplicada = useRef<Aplicada | null>(null);

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
            // Todo lo grabado, sin el tope de una parte: lo que no quepa en la
            // petición se dice debajo (`compasesQueNoViajan`) en vez de cortarse
            // aquí sin que nadie lo sepa.
            tope: Number.POSITIVE_INFINITY,
          }).steps,
    [activeKey, captured, captureEndedAt, bpm, beatsPerBar],
  );

  /**
   * La parte de la canción de la que salen las salidas cuando no hay nada grabado.
   *
   * **Una, y no todas juntas.** Se mandaban todas seguidas, y eso no es ninguna
   * parte: el papel no puede ser el de la estrofa y el del estribillo a la vez, un
   * «otro final» cambiaba el final del estribillo diciendo que era el de la
   * canción, y al quedarse con la salida no había manera de saber qué bloque era
   * cuál. Con una parte, el papel es el suyo, lo que vuelve se refiere a ella y se
   * pone en ella.
   *
   * Cuál: la que se elija aquí; si no, en la que está el bloque elegido del
   * lienzo, que es donde se está trabajando; y si no, la última con acordes, que es
   * desde donde se continúa una canción.
   */
  const conAcordes = useMemo(
    () => montaje.parts.filter((part) => part.blocks.length > 0),
    [montaje],
  );
  const parte: Part | null = useMemo(
    () =>
      conAcordes.find((part) => part.id === parteElegida) ??
      conAcordes.find((part) => part.blocks.some((block) => block.id === bloqueElegido)) ??
      conAcordes.at(-1) ??
      null,
    [conAcordes, parteElegida, bloqueElegido],
  );

  /**
   * Lo escrito en esa parte, con lo que el lienzo sabe de cada bloque: la
   * especie, si el micro dudó y las notas del punteo que suenan encima.
   *
   * Salía del **camino**, y el camino dejó de ser donde se escribe
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
   */
  const delMontaje = useMemo(
    () => (parte === null ? [] : pasosDeLaParte(parte, beatsPerBar)),
    [parte, beatsPerBar],
  );
  const delGrabado = useMemo(() => pasosDeLoGrabado(grabado), [grabado]);

  const delCamino: VersionStep[] = useMemo(
    () =>
      degreesFromPath(
        path.map((chord) => chord.label),
        activeKey?.mode ?? 'major',
      ).degrees.map((degree) => ({ degree, beats: 4 })),
    [path, activeKey],
  );

  const deLoGrabado = grabado.length > 0;
  const deLaParte = !deLoGrabado && parte !== null;
  const progresion = deLoGrabado ? delGrabado : deLaParte ? delMontaje : delCamino;
  /**
   * Lo que viaja: hasta el tope. Se cortaba en silencio, y quien grababa cuarenta
   * compases recibía salidas de los treinta y dos primeros sin saberlo; ahora se
   * dice debajo (`compasesQueNoViajan`). Una parte no llega nunca, que tiene el
   * mismo tope.
   */
  const mandados = useMemo(() => progresion.slice(0, MAX_VERSION_DEGREES), [progresion]);

  /**
   * Qué parte es esto. **El de la parte, si es una parte**, y se cambia en ella
   * (`setPartRole`), que es lo mismo que hace el lienzo: había un selector propio
   * del panel que empezaba siempre en «idea», así que el estribillo de la canción
   * viajaba como una idea y el papel que tenía puesto no llegaba nunca.
   */
  const role: SectionRole = deLaParte ? (parte.role ?? DEFAULT_ROLE) : papelSuelto;
  function cambiarPapel(papel: SectionRole) {
    if (deLaParte) {
      accionesMontaje.setPartRole(parte.id, papel);
    } else {
      setPapelSuelto(papel);
    }
  }

  /**
   * La petición sin lo que se elige al pedir. Es lo mismo que se mira para saber
   * si cabe otra parte y lo que se manda: **el mismo contexto en los dos sitios**,
   * o el panel apagaría «Continuar» con un menú y el servidor contestaría con otro.
   */
  const peticion: Omit<VersionsRequest, 'kind'> | null = useMemo(
    () =>
      activeKey === null
        ? null
        : {
            key: { tonic: noteName(activeKey.tonic), mode: activeKey.mode },
            progression: mandados,
            role,
            estilo,
            pulsosPorCompas: beatsPerBar,
          },
    [activeKey, mandados, role, estilo, beatsPerBar],
  );

  // Con un acorde ya se puede pedir: el dominio lo sigue, lo cierra o lo parte. Sin
  // ninguno no, y el contrato lo rechaza; se mira aquí para no gastar una petición.
  const sePuedePedir = activeKey !== null && progresion.length >= 1;

  /**
   * Si detrás de lo que llevas cabe algo más. Con treinta y dos compases ya no, y
   * el servidor lo rechaza: el panel empieza en «Continuar», así que sin mirarlo
   * aquí lo primero que se pedía era un 400.
   *
   * **Se mira contando, no construyendo el menú.** Lo miraba `salidasPosibles`,
   * como el servidor, y desde que el menú lo ordena el juez eso traía al navegador
   * el generador entero y `encaje.ts` —unos 64 KB minificados, 20 comprimidos, en
   * el panel diferido de `/componer`— y los ejecutaba con cada cambio de la
   * canción, para un sí o un no. Lo que dice es lo mismo: otra parte tiene al
   * menos un compás y la canción no pasa de `MAX_PATH_STEPS`. **Quien manda es
   * el servidor**: si el menú se queda vacío por otra razón —con un acorde más no
   * se llega a casa, o el juez lo descarta todo—, contesta por qué
   * (`porQueNoHaySalidas`) y se enseña como cualquier error.
   */
  const cabeOtraParte = mandados.length + COMPASES_DE_LA_PARTE_MAS_CORTA <= MAX_PATH_STEPS;
  /** El porqué de «Continuar» apagado, para que el botón lo lea. */
  const noCabe = useId();
  /** Lo que se pide de verdad: sin sitio para otra parte, solo se puede retocar. */
  const loQueSePide: PathKind = cabeOtraParte ? kind : 'retocar';

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
      /* v8 ignore next 3 -- solo se reanaliza lo que se acaba de grabar, y eso siempre vuelve */
      if (grabacion === null) {
        return;
      }
      const acordes = await analyzeRecording(grabacion, {
        /* v8 ignore next -- lo mismo: sin tonalidad no hay panel que grabe */
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
    /* v8 ignore next 3 -- el boton de pedir va desactivado cuando no se puede, y no se pinta sin tonalidad */
    if (peticion === null || !sePuedePedir) {
      return;
    }
    setPending(true);
    setError(null);
    setPunteoSinRevisar(false);

    /**
     * Cada compás con lo que se sabe de él —si lo leyó el micro y nadie lo
     * confirmó, su especie, las notas que suenan encima—, el papel de la parte, el
     * estilo y el compás. Solo símbolos, y el nombre de la parte se queda aquí.
     */
    const request: VersionsRequest = {
      ...peticion,
      kind: loQueSePide,
      // Vacío es no mandar nada: una línea en blanco en el prompt es una línea
      // que el modelo interpreta, y lo que interpreta es que le falta algo.
      ...(directrices.trim() === '' ? {} : { directrices: directrices.trim() }),
    };
    const deDonde: FuenteDeLasSalidas = deLoGrabado
      ? { tipo: 'grabado', pasos: grabado.slice(0, MAX_VERSION_DEGREES) }
      : deLaParte
        ? { tipo: 'parte', partId: parte.id }
        : { tipo: 'camino' };

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
      // comprobación sale un aviso de respuesta ilegible, que es lo que se puede
      // hacer al respecto.
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
      setFuente(deDonde);
      aplicada.current = null;
      const { origen, motivo } = payload as { origen?: unknown; motivo?: unknown };
      setDelDominio(
        origen !== 'dominio'
          ? null
          : motivo === 'model_unavailable'
            ? 'sin-contacto'
            : 'no-se-sostiene',
      );
    } catch {
      setError({ code: 'model_unavailable', message: ERROR_MESSAGES.model_unavailable });
      setVersions([]);
    } finally {
      setPending(false);
    }
  }

  /**
   * Deja esa salida puesta **en la canción**, en la parte de la que salió.
   *
   * Pisaba la canción entera: todas las partes pasaban a «Lo que llevas» y
   * «Cierre», y con ellas se perdían la especie de cada bloque, la duda, el papel,
   * las vueltas y el punteo. Ahora retocar cambia los bloques de esa parte y
   * continuar mete las nuevas detrás de ella (`aplicarSalida`), y el resto de la
   * canción no se toca.
   *
   * **Un solo paso del deshacer**, como antes: va por `replace`. Y **probar otra
   * salida sustituye a la anterior**: si la canción sigue como la dejó la última
   * que se puso, se deshace esa antes de poner la nueva, así que ir de una a otra
   * no amontona cierres y deshacer vuelve a la canción de antes de todas.
   */
  function use(version: Version) {
    /* v8 ignore next 3 -- sin tonalidad no hay salidas, y sin pedirlas no hay de dónde salieron */
    if (activeKey === null || fuente === null) {
      return;
    }
    const { arrangement: actual, past } = useArrangementStore.getState();
    const previa = aplicada.current;
    const probandoOtra = previa !== null && actual === previa.despues && past[0] === previa.antes;
    const base = probandoOtra ? previa.antes : actual;

    const puesta = aplicarSalida(base, version, fuente, {
      pulsosPorCompas: beatsPerBar,
      nuevoId,
    });
    if (puesta === null) {
      setError({ code: null, message: NO_CABEN_LAS_PARTES });
      return;
    }
    setError(null);
    if (probandoOtra) {
      accionesMontaje.undo();
    }
    accionesMontaje.replace(puesta.montaje);
    aplicada.current = { antes: base, despues: useArrangementStore.getState().arrangement };
    setPunteoSinRevisar(puesta.punteoSinRevisar);

    const { actions } = useSessionStore.getState();
    // El camino ya está en la canción: dejarlo era tener la misma idea en dos
    // sitios ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
    if (fuente.tipo === 'camino') {
      actions.clearPath();
    }
    /* v8 ignore next -- una salida validada trae al menos un compas */
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
              variant={loQueSePide === id ? undefined : 'quiet'}
              aria-pressed={loQueSePide === id}
              onClick={() => setKind(id)}
              disabled={pending || analizando || (id === 'continuar' && !cabeOtraParte)}
              {...(id === 'continuar' && !cabeOtraParte ? { 'aria-describedby': noCabe } : {})}
            >
              {rotulo}
            </Button>
          ))}
        </span>

        {/* De qué parte, cuando hay más de una con acordes: se manda una, y
            quien compone tiene que poder decir cuál sin ir a buscar un bloque
            al lienzo. Los nombres se leen aquí y no viajan. */}
        {deLaParte && conAcordes.length > 1 && (
          <Field
            label="De qué parte"
            compact
            ancho="auto"
            value={parte.id}
            onChange={(event) => setParteElegida(event.target.value)}
            disabled={pending || analizando}
          >
            {conAcordes.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name}
              </option>
            ))}
          </Field>
        )}

        {/* Qué parte es esto, junto a lo que se le pide y no escondido en otro
            sitio: son la misma decisión partida en dos mitades —«qué te mando»
            y «qué quiero»— y tomarlas separadas hace que casi nadie tome la
            primera. **Se queda aunque la parte ya tenga papel**, porque es aquí
            donde se piensa en ello, pero entonces lo cambia en la parte y no en
            una copia. La explicación del papel va en el `title`, que es donde ya
            vive la de los compases del lienzo. */}
        <Field
          label="Qué parte es esto"
          compact
          ancho="auto"
          value={role}
          onChange={(event) => cambiarPapel(event.target.value as SectionRole)}
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

      {/* A qué quieres que suene, con tus palabras. La mitad que faltaba: el
          selector de arriba dice **qué** le mandas y esto dice **qué quieres**, y
          sin ello el modelo continuaba siempre por lo obvio porque nadie le había
          dicho otra cosa.

          Una línea y no un cuadro grande: son una o dos frases, y un cuadro
          grande pide un guion que luego no se lee. Lo escrito a mano llega
          delimitado al prompt y el modelo tiene dicho que es un dato
          (`MARCA_DIRECTRICES`). */}
      <div className="mt-3">
        {/* `ui/TextField` y no un `<input>` a mano: con el borde de separar
            cajas —1,5:1— un campo vacío no se veía dónde se escribe. */}
        <TextField
          label="A qué quieres que suene"
          type="text"
          value={directrices}
          maxLength={MAX_DIRECTRICES_LENGTH}
          onChange={(event) => setDirectrices(event.target.value)}
          disabled={pending || analizando}
          placeholder="Que suene a rock lento, con un punteo en el estribillo"
        />
      </div>

      {/* Lo que se va a mandar, dicho antes de mandarlo: con la guitarra puesta,
          pulsar un botón que gasta cupo sin saber sobre qué es lo que hace que
          no se pulse. */}
      <p className="text-text-muted mt-2 text-sm" role="status">
        {capturing
          ? 'Grabando lo que tocas. Se apuntan los acordes y cuánto dura cada uno, no el sonido.'
          : !sePuedePedir
            ? 'Graba un trozo o escribe algún acorde: sin nada tocado no hay por dónde tirar.'
            : deLoGrabado
              ? `De lo que has grabado: ${progresion.map((step) => step.degree).join(' · ')}.`
              : // De la canción y no «del camino que llevas», que es lo que decía
                // cuando salía del camino. Un rótulo que nombra el sitio
                // equivocado manda a mirar donde no está lo que se va a mandar.
                `De ${deLaParte ? `lo que llevas escrito en «${parte.name}»` : 'lo que llevas probando'}: ${progresion
                  .map((step) => step.degree)
                  .join(' · ')}.`}
      </p>

      {/* Lo que se queda fuera, dicho: se cortaba en silencio y las salidas
          hablaban de una canción más corta que la tuya. */}
      {!capturing && progresion.length > MAX_VERSION_DEGREES && (
        <p className="text-text-muted mt-2 text-sm">{compasesQueNoViajan(progresion.length)}</p>
      )}

      {/* Por qué «Continuar» está apagado, dicho al lado: un botón gris no dice
          por qué, y lo que sí se puede hacer es retocar. */}
      {!cabeOtraParte && (
        <p id={noCabe} className="text-text-muted mt-2 text-sm">
          {NO_CABE_OTRA_PARTE}
        </p>
      )}

      <p className="text-text-muted mt-2 text-sm">
        Se mandan los grados, sus pulsos y lo que se sabe de ellos —la especie, si el micro dudó,
        las notas del punteo—, no el sonido ni los nombres. Las salidas las construye el dominio con
        las reglas de la armonía, y la IA elige las que van con lo que pides y dice por qué.
      </p>

      {error !== null && (
        <p role="alert" className="text-oxblood-bright mt-4 text-sm">
          {error.message}
        </p>
      )}

      {versions.length > 0 && delDominio !== null && (
        <p className="text-text-muted mt-4 text-sm">
          {delDominio === 'sin-contacto'
            ? 'No hemos podido contactar con el modelo; vuelve a intentarlo en un minuto. Mientras, estas'
            : 'El modelo no ha dado con nada que se sostenga, así que estas'}{' '}
          las ha elegido la aplicación sin IA: son las salidas que el dominio construye para tus
          compases, en su orden.
        </p>
      )}

      {/* El punteo se queda —es trabajo, y una nota fuera del acorde puede ser
          la tensión que se quería—, pero nadie lo ha oído con lo de debajo. */}
      {punteoSinRevisar && (
        <p className="text-text-muted mt-4 text-sm">
          El punteo de la parte sigue como estaba, y debajo han cambiado acordes: escúchalo antes de
          darlo por bueno.
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
