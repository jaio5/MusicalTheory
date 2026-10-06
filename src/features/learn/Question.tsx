'use client';

import { useEffect, useRef, useState } from 'react';

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
  /* v8 ignore next -- toda pregunta del catalogo trae su respuesta buena, y hay prueba que lo vigila */
  const correct = exercise.choices.find((choice) => choice.correct) ?? null;
  const answered = chosen !== null;
  const last = position >= total;

  // Al cambiar de pregunta hay que olvidar la respuesta anterior. Se ajusta
  // durante el render comparando con la de antes, que es lo que React recomienda
  // para esto: hacerlo en un efecto provoca un render en cascada.
  const [tracked, setTracked] = useState(exercise);
  // Si se llega a esta pregunta desde la anterior ya contestada —con «Siguiente»—,
  // el foco tiene que entrar en ella: el botón que lo tenía acaba de desaparecer.
  const [venimosDeOtra, setVenimosDeOtra] = useState(false);
  if (tracked !== exercise) {
    setTracked(exercise);
    setVenimosDeOtra(answered);
    setChosen(null);
  }

  /*
    **El foco no se pierde al contestar.** Las opciones se desactivan al
    corregir, y un botón desactivado suelta el foco: se iba al `body`, y quien
    contestaba con el teclado tenía que volver a recorrer la pantalla entera para
    llegar a «Siguiente». Ahora va a «Siguiente», que es lo único que queda por
    hacer, y la corrección se anuncia por su región viva. Y al pasar de pregunta,
    a la primera opción de la nueva, por la misma razón: «Siguiente» desaparece.
  */
  const siguiente = useRef<HTMLDivElement>(null);
  const opciones = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (answered) {
      siguiente.current?.querySelector('button')?.focus();
    }
  }, [answered]);
  useEffect(() => {
    if (venimosDeOtra) {
      opciones.current?.querySelector('button')?.focus();
    }
  }, [venimosDeOtra, tracked]);

  /* v8 ignore next 3 -- mismo motivo: sin respuesta buena no hay pregunta que pintar */
  if (correct === null) {
    return null;
  }

  function answer(text: string): void {
    /* v8 ignore next 3 -- contestada, las opciones van desactivadas: no se puede pulsar otra */
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

      {/* **Rejilla de ancho igual, y el hueco de la marca reservado.**

          Eran pastillas en fila que envolvían, y al corregir entraba un icono
          dentro de dos de ellas: cada una cambiaba de ancho (una «G» pasaba de 53
          a 79 px), la fila se recolocaba y lo que se iba a pulsar saltaba de sitio
          justo cuando se acababa de pulsar. En un teléfono eran además cuatro
          botones de 50 a 66 px, uno por respuesta y todos distintos.

          **Dos por fila a cualquier ancho, y de 56 px de alto.** Iban en una
          sola fila a partir de `sm`, como pastillas `quiet`: texto gris de 14 px
          sin borde ni fondo, lo más pequeño y apagado de la pantalla, para lo
          único que hay que hacer en ella. Cuatro cajas en 2 × 2 con el borde de
          un control y la letra de leer (`opcion` de `ui/Chip`) se leen como
          opciones desde un metro, y `grande` es lo que las sube de 44 a 58.
          La marca ocupa su sitio desde el principio, invisible hasta que hay
          algo que corregir: el texto no se mueve ni un píxel al contestar. */}
      <div ref={opciones} className="mt-4 grid grid-cols-2 gap-2">
        {exercise.choices.map((choice) => {
          const picked = chosen === choice.text;
          return (
            <Chip
              key={choice.text}
              onClick={() => answer(choice.text)}
              pressed={picked}
              disabled={answered}
              tone={answered && choice.correct ? 'acierto' : picked ? 'fallo' : 'opcion'}
              tamano="grande"
              className="w-full"
            >
              {/* La marca solo en las dos que dicen algo: la acertada y la que
                  se eligió. En las demás el hueco queda vacío, que es lo que
                  evita que el texto se mueva al contestar. */}
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
                {answered && choice.correct ? (
                  <IconoAcierto />
                ) : answered && picked ? (
                  <IconoFallo />
                ) : null}
              </span>
              {choice.text}
            </Chip>
          );
        })}
      </div>

      {/*
        **La región viva está antes que la corrección.** Nacía con el texto dentro,
        y una región que aparece ya llena no la anuncia ningún lector de pantalla
        de forma fiable: se contestaba y no se oía si era buena o mala. Ahora está
        montada desde el principio, vacía y sin ocupar sitio (`empty:sr-only`, como
        `ui/Aviso`), y al contestar se rellena. «Siguiente» va fuera de ella, para
        que no se lea como parte del porqué.
      */}
      <div
        className={
          answered
            ? `mt-4 rounded-md border p-3 ${
                acertada ? 'border-tube bg-tube/10' : 'border-oxblood-bright/50 bg-oxblood/10'
              }`
            : ''
        }
      >
        <p className="flex items-start gap-2 text-sm empty:sr-only" aria-live="polite">
          {answered && (
            <>
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
                  // La marca verde no se oye: sin esto, acertar sonaba igual que
                  // un párrafo cualquiera.
                  <span className="sr-only">Bien. </span>
                ) : (
                  <strong className="text-oxblood-bright font-medium">Era {correct.text}. </strong>
                )}
                {exercise.why}
              </span>
            </>
          )}
        </p>
        {answered && (
          <div ref={siguiente} className="mt-3">
            <Button onClick={onNext}>{last ? lastLabel : 'Siguiente'}</Button>
          </div>
        )}
      </div>
    </fieldset>
  );
}
