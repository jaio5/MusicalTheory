'use client';

import { useEffect, useState } from 'react';

import { midiToOctave, noteName } from '@core/music';
import { useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';

import {
  EXERCISE_TOLERANCE_CENTS,
  HOLD_MS,
  stepMatches,
  type ExerciseStep,
  type PasoContestable,
} from './exercise';

/**
 * El repaso de una nota que se atragantó: volver a tocarla.
 *
 * Una unidad de tocar no tiene preguntas que fallar —o haces la escala o no la
 * haces— así que lo que se apunta de ella es **qué nota tuviste que buscar
 * varias veces**, y repasarla es exactamente eso: buscarla otra vez.
 *
 * No se contesta con botones. Se contesta con la guitarra, que es lo que
 * distingue saber dónde está el sexto grado de haberlo leído.
 *
 * Reutiliza `stepMatches` y `HOLD_MS` del ejercicio, así que la nota cuenta con
 * el mismo criterio que allí: sostenida y afinada, no rozada.
 */
export function PlayNote({
  step,
  position,
  total,
  lastLabel,
  onAnswered,
  onNext,
}: { readonly step: ExerciseStep } & PasoContestable) {
  /** Nulo mientras se busca; luego, si salió o no. */
  const [resultado, setResultado] = useState<'bien' | 'mal' | null>(null);

  // Al cambiar de nota vuelve a empezar. Se ajusta durante el render comparando
  // con la anterior, como hace `LearnPanel` al cambiar de escala.
  const [seguida, setSeguida] = useState(step);
  if (seguida !== step) {
    setSeguida(step);
    setResultado(null);
  }

  useEffect(() => {
    if (resultado !== null) {
      return;
    }
    let desde: number | null = null;
    // El guardia vive aquí dentro y no en una `ref`: el motor entrega veinte
    // lecturas por segundo y entre la que da la nota por buena y el repintado
    // caben varias, así que sin él se avisaría tres o cuatro veces del mismo
    // acierto. Como el efecto se rehace al cambiar de nota, se reinicia solo.
    let avisado = false;

    // Suscribirse al store en vez de leer la nota con un selector: así esto no
    // se repinta veinte veces por segundo, solo cuando hay algo que decir.
    return useSessionStore.subscribe((state) => {
      if (avisado) {
        return;
      }
      const reading = state.hasSignal ? state.reading : null;
      if (!stepMatches(step, reading, EXERCISE_TOLERANCE_CENTS)) {
        desde = null;
        return;
      }
      desde ??= state.readingAt;
      if (state.readingAt - desde >= HOLD_MS) {
        avisado = true;
        setResultado('bien');
        onAnswered(true);
      }
    });
  }, [step, resultado, onAnswered]);

  const nombre = noteName(step.pitchClass);
  const ultima = position >= total;

  return (
    <div>
      <p className="rotulo">
        {position} de {total} · tócala
      </p>

      {/* La octava al lado y más pequeña: la misma nota está en varios sitios
          del mástil, y decir cuál es lo que distingue buscarla de encontrarla. */}
      <p className="text-text mt-2 text-2xl">
        {nombre}
        <span className="text-text-muted text-base">{midiToOctave(step.midi)}</span>
      </p>
      <p className="text-text-muted mt-1 max-w-prose text-sm">
        {step.descending ? 'Bajando' : 'Subiendo'} la escala, esta te costó. Sostenla afinada un
        momento y cuenta.
      </p>

      {resultado === 'bien' && (
        <p className="text-tube-bright mt-4 text-sm" role="status">
          Ahí está.
        </p>
      )}
      {resultado === 'mal' && (
        <p className="text-text-muted mt-4 max-w-prose text-sm" role="status">
          Sin problema: vuelve mañana. Está en el traste que da {nombre}, y hay varios en el mástil.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {resultado === null ? (
          <Button
            variant="quiet"
            onClick={() => {
              setResultado('mal');
              onAnswered(false);
            }}
          >
            No me sale
          </Button>
        ) : (
          <Button onClick={onNext}>{ultima ? lastLabel : 'Siguiente'}</Button>
        )}
      </div>
    </div>
  );
}
