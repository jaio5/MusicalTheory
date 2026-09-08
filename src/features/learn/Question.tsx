'use client';

import { useState } from 'react';

import type { Exercise } from '@core/music';
import { Button } from '@ui/Button';
import { Chip } from '@ui/Chip';
import { IconoAcierto, IconoFallo } from '@ui/icons';

import type { PasoContestable } from './exercise';

/**
 * Una pregunta con sus opciones y su porqué.
 *
 * La usan las dos partes que preguntan cosas —la unidad de teoría y el repaso— y
 * por eso está aparte: dos copias del mismo bloque acabarían dando la
 * retroalimentación de forma distinta, y lo que hace que esto se aprenda es
 * justamente que el porqué salga siempre, y siempre igual.
 *
 * Fallar no bloquea, y esa decisión no ha cambiado con el repaso: se dice por qué
 * era la otra y se sigue. Lo que se pierde al fallar es la medalla de no fallar y
 * que la pregunta vuelva más adelante, no el avance, porque una unidad que hay que
 * repetir desde el principio se abandona.
 *
 * **Y se ve que es una pregunta.** El enunciado iba al mismo tamaño que el texto
 * de la lección que tiene encima, las opciones eran pastillas pequeñas y la
 * corrección un párrafo gris más: lo único que hay que hacer en la pantalla no
 * pesaba más que lo que hay alrededor. Ahora el enunciado se lee de lejos, las
 * respuestas son botones de verdad y la corrección tiene su caja con su color y su
 * forma. Fallar sigue sin bloquear; lo que cambia es que se **entera** uno.
 */
export function Question({
  exercise,
  position,
  total,
  lastLabel,
  onAnswered,
  onNext,
}: { readonly exercise: Exercise } & PasoContestable) {
  const [chosen, setChosen] = useState<string | null>(null);
  const correct = exercise.choices.find((choice) => choice.correct) ?? null;
  const answered = chosen !== null;
  const last = position >= total;

  // Al cambiar de pregunta hay que olvidar la respuesta anterior. Se ajusta
  // durante el render comparando con la de antes, que es lo que React recomienda
  // para esto: hacerlo en un efecto provoca un render en cascada.
  const [tracked, setTracked] = useState(exercise);
  if (tracked !== exercise) {
    setTracked(exercise);
    setChosen(null);
  }

  if (correct === null) {
    return null;
  }

  function answer(text: string): void {
    if (answered) {
      return;
    }
    setChosen(text);
    onAnswered(text === correct!.text);
  }

  const acertada = answered && chosen === correct.text;

  return (
    <fieldset className="mt-3">
      {/*
        Cuántas van y cuántas quedan, **dibujado**.

        Decía «1 de 3» en monoespaciada pequeña en la esquina de la derecha, que
        es información correcta y que no se mira: hay que leerla y hacer la
        cuenta. Con tres barritas se ve de un vistazo si esto se acaba enseguida o
        queda para rato, que es lo que de verdad se pregunta uno al empezar. El
        texto sigue estando para quien no ve el dibujo.
      */}
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex gap-1">
          {Array.from({ length: total }, (_, indice) => (
            <span
              key={indice}
              className={`h-1 w-6 rounded-full ${
                indice < position - 1
                  ? 'bg-brass-dim'
                  : indice === position - 1
                    ? 'bg-brass-bright'
                    : 'bg-border'
              }`}
            />
          ))}
        </span>
        <span className="text-text-muted text-xs">
          Pregunta {position} de {total}
        </span>
      </div>

      <legend className="text-text mt-3 text-lg leading-snug font-medium">{exercise.prompt}</legend>

      <div className="mt-4 flex flex-wrap gap-2">
        {exercise.choices.map((choice) => {
          const picked = chosen === choice.text;
          return (
            <Chip
              key={choice.text}
              onClick={() => answer(choice.text)}
              pressed={picked}
              disabled={answered}
              tone={answered && choice.correct ? 'acierto' : picked ? 'fallo' : 'quiet'}
              className="px-5 text-base"
            >
              {/* La marca solo en las dos que dicen algo: la acertada y la que
                  se eligió. En las demás sería adorno, y encima movería el texto
                  de sitio al contestar. */}
              {answered && choice.correct && <IconoAcierto />}
              {answered && picked && !choice.correct && <IconoFallo />}
              {choice.text}
            </Chip>
          );
        })}
      </div>

      {answered && (
        <div
          className={`mt-4 rounded-md border p-3 ${
            acertada ? 'border-tube bg-tube/10' : 'border-oxblood-bright/50 bg-oxblood/10'
          }`}
        >
          <p className="flex items-start gap-2 text-sm" aria-live="polite">
            <span
              aria-hidden="true"
              className={`mt-0.5 shrink-0 [&_svg]:size-4 ${
                acertada ? 'text-tube-bright' : 'text-oxblood-bright'
              }`}
            >
              {acertada ? <IconoAcierto /> : <IconoFallo />}
            </span>
            <span className="text-text">
              {acertada ? (
                ''
              ) : (
                <strong className="text-oxblood-bright font-medium">Era {correct.text}. </strong>
              )}
              {exercise.why}
            </span>
          </p>
          <div className="mt-3">
            <Button onClick={onNext}>{last ? lastLabel : 'Siguiente'}</Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
