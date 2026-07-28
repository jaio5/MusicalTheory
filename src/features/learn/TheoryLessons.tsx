'use client';

import { useMemo, useState } from 'react';

import { LESSONS, lessonNotes, type LessonId } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';

/**
 * Teoría a base de preguntas, en la tonalidad en la que estés.
 *
 * Primero lo que hay que saber, en tres frases, y luego preguntas sobre los
 * acordes que tienes debajo de los dedos. Al contestar se dice por qué, tanto
 * si aciertas como si no: fallar sin saber por qué no enseña nada.
 */
export function TheoryLessons({ onTopic }: { onTopic?: (title: string) => void } = {}) {
  const activeKey = useSessionStore(selectActiveKey);
  const [lessonId, setLessonId] = useState<LessonId>('degrees');
  const [answers, setAnswers] = useState<Readonly<Record<number, string>>>({});

  const notes = useMemo(
    () => (activeKey === null ? null : lessonNotes(lessonId, activeKey.tonic, activeKey.mode)),
    [lessonId, activeKey],
  );

  function choose(lesson: LessonId): void {
    setLessonId(lesson);
    setAnswers({});
    onTopic?.(LESSONS.find((item) => item.id === lesson)?.title ?? '');
  }

  const right = notes?.exercises.filter(
    (exercise, index) =>
      exercise.choices.find((choice) => choice.text === answers[index])?.correct === true,
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul
        aria-label="Lecciones"
        className="border-border flex shrink-0 gap-1 overflow-x-auto border-b px-2"
      >
        {LESSONS.map((lesson) => (
          <li key={lesson.id}>
            <button
              type="button"
              onClick={() => choose(lesson.id)}
              aria-current={lesson.id === lessonId}
              className={`px-3 py-2 text-left font-mono text-sm whitespace-nowrap ${
                lesson.id === lessonId
                  ? 'text-brass-bright border-brass-bright border-b'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {lesson.title}
            </button>
          </li>
        ))}
      </ul>

      {activeKey === null || notes === null ? (
        <p className="text-text-muted p-3 text-sm">
          Elige una tonalidad y te explico la teoría con sus acordes, no con los de un libro.
        </p>
      ) : (
        <div className="min-h-0 grow overflow-y-auto p-4">
          <p className="text-text-muted max-w-prose text-sm">
            {LESSONS.find((lesson) => lesson.id === lessonId)?.summary}
          </p>

          <ul className="mt-4 flex max-w-prose flex-col gap-2">
            {notes.points.map((point) => (
              <li key={point} className="text-text text-base leading-relaxed">
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex max-w-prose items-baseline justify-between">
            <h3 className="text-text-muted font-mono text-xs tracking-widest uppercase">
              Compruébalo
            </h3>
            <span className="text-text-muted font-mono text-xs">
              {right} de {notes.exercises.length}
            </span>
          </div>

          <ol className="mt-3 flex max-w-prose flex-col gap-5">
            {notes.exercises.map((exercise, index) => {
              const answered = answers[index];
              const correct = exercise.choices.find((choice) => choice.correct)!;
              return (
                <li key={exercise.prompt}>
                  <fieldset>
                    <legend className="text-text text-base">{exercise.prompt}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {exercise.choices.map((choice) => {
                        const chosen = answered === choice.text;
                        const reveal = answered !== undefined;
                        return (
                          <button
                            key={choice.text}
                            type="button"
                            onClick={() => setAnswers({ ...answers, [index]: choice.text })}
                            aria-pressed={chosen}
                            className={`border px-3 py-1.5 font-mono text-sm ${
                              reveal && choice.correct
                                ? 'border-tube-bright text-tube-bright'
                                : chosen
                                  ? 'border-oxblood-bright text-oxblood-bright'
                                  : 'border-border text-text-muted hover:text-text'
                            }`}
                          >
                            {choice.text}
                          </button>
                        );
                      })}
                    </div>
                    {answered !== undefined && (
                      <p className="text-text-muted mt-2 text-sm">
                        {answered === correct.text ? '' : `Era ${correct.text}. `}
                        {exercise.why}
                      </p>
                    )}
                  </fieldset>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
