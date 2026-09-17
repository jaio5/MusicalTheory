'use client';

import { useState } from 'react';

import { can, cheapestPlanWith } from '@core/billing';
import {
  noteName,
  resolveDegree,
  scheduleProgression,
  SCALES,
  type DegreeSymbol,
  type ScaleId,
} from '@core/music';
import { useAccount } from '@state/account';
import { apiErrorOf } from '@state/api-error';
import { useArrangementStore } from '@state/arrangement-store';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { useProgressionPlayer } from '@state/use-progression-player';
import { Button } from '@ui/Button';
import { Chip } from '@ui/Chip';
import { EscalaMini } from '@ui/EscalaMini';
import { PlanLock } from '@ui/PlanLock';
import { PlansLink, seArreglaConPlan } from '@ui/PlansLink';
import { Aviso } from '@ui/Aviso';

import {
  ERROR_MESSAGES,
  type Idea,
  type IdeaKind,
  type IdeasRequest,
  type IdeasErrorCode,
} from './contract';

const KIND_LABELS: Readonly<Record<IdeaKind, string>> = {
  progression: 'Progresiones',
  twist: 'Un giro para romper el bucle',
  scale: 'Qué escala meter encima',
};

export interface IdeasPanelProps {
  /** Se inyecta en los tests para no llamar al servidor de verdad. */
  readonly fetchIdeas?: (request: IdeasRequest) => Promise<Response>;
  /** Se inyecta en los tests para no abrir el audio de verdad. */
  readonly createPlayer?: Parameters<typeof useProgressionPlayer>[0];
  /**
   * Llevar a la escala que propone una idea: ponerla y abrir el mástil.
   *
   * Lo hace quien monta este panel, porque abrir otra herramienta es cosa de la
   * pantalla y **un feature no importa de otro** (regla 2). Sin esto, la idea de
   * escala era una línea de texto y no había manera de llegar a lo que proponía.
   */
  readonly onIrALaEscala?: (scaleId: ScaleId) => void;
}

async function defaultFetch(request: IdeasRequest): Promise<Response> {
  return fetch('/api/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function IdeasPanel({
  fetchIdeas = defaultFetch,
  createPlayer,
  onIrALaEscala,
}: IdeasPanelProps = {}) {
  const { account, signedIn } = useAccount();
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const currentDegree = useSessionStore((state) => state.currentDegree);
  const history = useSessionStore((state) => state.noteHistory);
  const bpm = useSessionStore((state) => state.bpm);
  const accionesDelMontaje = useArrangementStore((state) => state.actions);
  const { pedir: reproductor, parar } = useProgressionPlayer(createPlayer);

  // El mismo permiso que comprueba la ruta antes de gastar dinero. Preguntando
  // los dos a `core/billing` no puede pasar que la pantalla enseñe un botón que
  // el servidor va a rechazar.
  const puedePedir = can(account.plan, 'ideas');

  const [ideas, setIdeas] = useState<readonly Idea[]>([]);
  // El código se guarda con la frase, y no solo la frase: es lo que distingue un
  // «no entra en tu plan» —que se arregla en la pantalla de planes— de un modelo
  // caído, que no se arregla en ningún sitio.
  const [error, setError] = useState<{ code: IdeasErrorCode | null; message: string } | null>(null);
  const [pending, setPending] = useState<IdeaKind | null>(null);
  /** Cuál suena y por qué acorde va, para encenderlo mientras suena. */
  const [sonando, setSonando] = useState<{ title: string; paso: number | null } | null>(null);
  /** La última que se metió en la canción, para decir que entró. */
  const [metida, setMetida] = useState<string | null>(null);

  /**
   * Oír una idea, y volver a pulsarla para callarla.
   *
   * Lo que se propone son grados, así que suena en la tonalidad que hay puesta:
   * es la misma progresión que vas a oír si la metes en la canción, y no un
   * ejemplo en Do de un libro.
   */
  async function escuchar(title: string, degrees: readonly DegreeSymbol[]) {
    if (activeKey === null) {
      return;
    }
    if (sonando?.title === title) {
      parar();
      setSonando(null);
      return;
    }

    const pasos = scheduleProgression(
      degrees.map((degree) => {
        const acorde = resolveDegree(activeKey.tonic, activeKey.mode, degree);
        return { root: acorde.root, notes: acorde.notes, beats: 4 };
      }),
      bpm,
    );

    setSonando({ title, paso: null });
    await reproductor().play(pasos, (paso) => {
      setSonando(paso === null ? null : { title, paso });
    });
  }

  /**
   * Meterla en la canción, como una parte nueva.
   *
   * Parte nueva y no encima de lo que haya: una idea es una idea, y machacar
   * media hora de montaje por probar una sugerencia es exactamente lo que nadie
   * espera de un botón que dice «añadir». Si no gusta, se quita la parte.
   */
  function anadir(title: string, degrees: readonly DegreeSymbol[]) {
    const parte = accionesDelMontaje.addPart(title.slice(0, 40));
    for (const degree of degrees) {
      accionesDelMontaje.addBlock(parte, degree, 4);
    }
    setMetida(title);
  }

  async function ask(kind: IdeaKind) {
    if (activeKey === null) {
      return;
    }

    setPending(kind);
    setError(null);

    const request: IdeasRequest = {
      kind,
      key: { tonic: noteName(activeKey.tonic), mode: activeKey.mode },
      scale: scaleId,
      ...(currentDegree === null ? {} : { currentDegree }),
      recentNotes: history.map((note) => noteName(note.pitchClass)),
    };

    try {
      const response = await fetchIdeas(request);
      const payload: unknown = await response.json();

      if (!response.ok) {
        setError(errorFrom(payload));
        setIdeas([]);
        return;
      }

      setIdeas((payload as { ideas: readonly Idea[] }).ideas);
    } catch {
      setError({ code: 'model_unavailable', message: ERROR_MESSAGES.model_unavailable });
      setIdeas([]);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <p className="text-text-muted mt-2 text-sm">
        Le pasamos la tonalidad, la escala y los nombres de las notas. El audio no sale de tu
        equipo.
      </p>

      {!puedePedir ? (
        <div className="mt-6">
          <PlanLock
            needed={cheapestPlanWith('ideas')}
            what="Las ideas de la IA"
            plural
            signedIn={signedIn}
          />
          <p className="text-text-muted mt-2 text-xs">
            Es la parte más cara: cada pulsación son varias progresiones razonadas. Todo lo demás de
            esta pantalla —los acordes, el mástil, a dónde ir, el metrónomo y grabar— es gratis.
          </p>
        </div>
      ) : activeKey === null ? (
        <p className="text-text-muted mt-6">
          Toca unas notas sueltas o elige una tonalidad para poder pedir ideas.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {(Object.keys(KIND_LABELS) as IdeaKind[]).map((kind) => (
              <Button
                key={kind}
                variant={kind === 'progression' ? 'primary' : 'quiet'}
                disabled={pending !== null}
                cargando={pending === kind}
                onClick={() => void ask(kind)}
              >
                {pending === kind ? 'Pensando…' : KIND_LABELS[kind]}
              </Button>
            ))}
          </div>

          {error !== null && (
            <div role="alert" className="mt-4">
              <Aviso mensaje={error.message} anuncio="ninguno" />
              {/* El candado que salta en marcha lleva al mismo sitio que el que
                  se enseña de antemano: la frase dice qué plan hace falta y el
                  enlace lleva a donde se ve qué trae cada uno. */}
              {seArreglaConPlan(error.code, account.plan) && (
                <PlansLink className="mt-1 inline-block" />
              )}
            </div>
          )}

          <ul className="mt-6 space-y-4" aria-live="polite">
            {ideas.map((idea) => (
              <li key={idea.title} className="border-border border-l-2 pl-4">
                <p className="text-text">{idea.title}</p>
                {idea.chords !== undefined && (
                  /*
                    Los acordes, y **el que va sonando encendido**.

                    Eran una línea de texto y nada más: la IA proponía tres
                    progresiones razonadas, se leían, y para probar una había que
                    ir pulsándola a mano en la rueda acorde por acorde. Una idea
                    que no se puede oír no es una idea, es un párrafo.
                  */
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-1 font-mono text-sm">
                    {idea.chords.map((chord, indice) => (
                      <span key={`${chord}-${indice}`}>
                        <span
                          className={
                            sonando?.title === idea.title && sonando.paso === indice
                              ? 'text-brass-bright bg-brass-dim/25 rounded-sm px-1'
                              : 'text-brass-bright'
                          }
                        >
                          {chord}
                        </span>
                        {indice < (idea.chords?.length ?? 0) - 1 && (
                          <span className="text-text-muted" aria-hidden="true">
                            {' '}
                            ·
                          </span>
                        )}
                      </span>
                    ))}
                  </p>
                )}

                {/* El porqué antes que los botones: primero se entiende qué
                    propone y luego se decide si se oye o se mete. Debajo de los
                    botones quedaba separado de los acordes que explica. */}
                <p className="text-text-muted mt-1 text-sm">{idea.why}</p>

                {idea.degrees !== undefined && idea.degrees.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Chip
                      tone="quiet"
                      className="px-3 text-xs"
                      onClick={() => void escuchar(idea.title, idea.degrees ?? [])}
                    >
                      {sonando?.title === idea.title ? 'Parar' : 'Escuchar'}
                    </Chip>
                    {/* «A la canción» y no «añadir»: dice a dónde va, que es lo
                        que hay que saber antes de pulsar. Entra como una parte
                        nueva, así que no se lleva nada por delante. */}
                    <Chip
                      tone="quiet"
                      className="px-3 text-xs"
                      onClick={() => anadir(idea.title, idea.degrees ?? [])}
                    >
                      A la canción
                    </Chip>
                    {metida === idea.title && (
                      <span className="text-tube-bright text-xs" role="status">
                        Puesta en Montar, como parte nueva
                      </span>
                    )}
                  </div>
                )}
                {idea.scale !== undefined &&
                  (onIrALaEscala === undefined ? (
                    <p className="text-brass-bright mt-1 font-mono text-sm">
                      {SCALES[idea.scale].name} de {noteName(activeKey.tonic)}
                    </p>
                  ) : (
                    /*
                      La escala propuesta, dibujada y pulsable.

                      Era una línea de texto —«Pentatónica menor de La»—, que a
                      quien no se sabe las escalas de memoria no le dice nada y a
                      quien sí se las sabe le deja igual: en las dos manos, para
                      probarla había que salir de aquí, abrir el mástil y buscarla
                      en el desplegable. Ahora se ve la forma y se entra de un
                      golpe.

                      Botón y no enlace: no se va a ninguna dirección, se cambia
                      lo que hay puesto en esta misma pantalla.
                    */
                    <button
                      type="button"
                      onClick={() => {
                        onIrALaEscala(idea.scale as ScaleId);
                      }}
                      className="border-border hover:border-brass-dim hover:bg-surface-raised group mt-2 flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-md border p-2 text-left transition-colors"
                    >
                      <EscalaMini tonic={activeKey.tonic} scaleId={idea.scale} />
                      <span className="min-w-0">
                        <span className="text-brass-bright block font-mono text-sm">
                          {SCALES[idea.scale].name} de {noteName(activeKey.tonic)}
                        </span>
                        {/* El porqué de la IA ya explica qué pinta aquí esta
                            escala, así que el carácter de catálogo sobraría: dos
                            renglones grises seguidos diciendo casi lo mismo se
                            leen como uno y no se lee ninguno. Lo que sí hace
                            falta es decir qué pasa al pulsar. */}
                        <span className="text-text-muted group-hover:text-brass-bright mt-1 block text-xs">
                          Ponerla y verla en el mástil{' '}
                          <span aria-hidden="true" className="inline-block">
                            →
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Lo que se enseña cuando la ruta dice que no: la frase y por qué.
 *
 * La frase que gana es la que manda el servidor, si la manda: los códigos de plan
 * y de cupo se responden con el plan y el número concretos —«entra en el plan
 * Básico: 4,99 € al mes»— y la genérica de aquí no sabe eso. Si no viene ninguna,
 * se usa la del contrato por su código, y si tampoco, la de siempre.
 *
 * El código viaja aparte de la frase porque de él depende si hay algo que pulsar
 * debajo, y adivinarlo leyendo el texto sería atarse a cómo está escrito.
 */
function errorFrom(payload: unknown): { code: IdeasErrorCode | null; message: string } {
  const leido = apiErrorOf<IdeasErrorCode>(payload, '');
  if (leido.message !== '') {
    return leido;
  }
  // Sin frase del servidor se usa la del código, y solo entonces la genérica:
  // «no entra en tu plan» explica más que «no hemos podido contactar».
  return {
    code: leido.code,
    message:
      (leido.code === null ? undefined : ERROR_MESSAGES[leido.code]) ??
      ERROR_MESSAGES.model_unavailable,
  };
}
