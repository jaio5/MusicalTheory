'use client';

import { useState } from 'react';

import { noteName } from '@core/music';
import { selectActiveKey, useSessionStore } from '@state/session-store';
import { Button } from '@ui/Button';

import {
  MAX_QUESTION_LENGTH,
  TEACHER_ERROR_MESSAGES,
  type TeacherAnswer,
} from './teacher-contract';

/** Preguntas para empezar, para quien no sabe ni cómo se llama lo que no sabe. */
const OPENERS: readonly string[] = [
  '¿Por qué el V tira tanto hacia el I?',
  '¿Cuándo puedo meter un acorde de fuera de la tonalidad?',
  '¿Qué diferencia hay entre la pentatónica y la escala entera?',
  '¿Cómo sé en qué tono está una canción de oído?',
];

export interface TeacherProps {
  /** La lección que se está leyendo, para que responda en ese contexto. */
  readonly topic?: string;
}

/**
 * El profesor: preguntas de teoría contestadas en la tonalidad en la que estás.
 *
 * Lo que viaja al modelo es la tonalidad, la escala y lo que escribas. El audio
 * y el vídeo no salen del equipo, y esta pantalla no los toca.
 */
export function Teacher({ topic }: TeacherProps = {}) {
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore((state) => state.scaleId);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<TeacherAnswer | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function ask(text: string): Promise<void> {
    if (activeKey === null || text.trim() === '') {
      return;
    }

    setAsking(true);
    setMessage(null);
    setAnswer(null);

    try {
      const response = await fetch('/api/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: { tonic: noteName(activeKey.tonic), mode: activeKey.mode },
          question: text,
          scale: scaleId,
          ...(topic === undefined ? {} : { topic }),
        }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const error = payload as { error?: { message?: string } };
        setMessage(error.error?.message ?? TEACHER_ERROR_MESSAGES.model_unavailable);
        return;
      }

      setAnswer(payload as TeacherAnswer);
    } catch {
      setMessage(TEACHER_ERROR_MESSAGES.model_unavailable);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="flex flex-wrap gap-2"
      >
        <label className="min-w-48 grow">
          <span className="sr-only">Pregúntale al profesor</span>
          <input
            type="text"
            value={question}
            maxLength={MAX_QUESTION_LENGTH}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Pregunta lo que quieras de teoría"
            className="border-border bg-background text-text placeholder:text-text-muted w-full border px-2 py-1.5 text-sm"
          />
        </label>
        <Button type="submit" disabled={asking || activeKey === null || question.trim() === ''}>
          {asking ? 'Pensando' : 'Preguntar'}
        </Button>
      </form>

      {activeKey === null && (
        <p className="text-text-muted text-xs">
          Elige una tonalidad primero: el profesor responde con los acordes que tienes delante.
        </p>
      )}

      {answer === null && message === null && !asking && (
        <ul className="flex flex-wrap gap-1">
          {OPENERS.map((opener) => (
            <li key={opener}>
              <button
                type="button"
                onClick={() => {
                  setQuestion(opener);
                  void ask(opener);
                }}
                disabled={activeKey === null}
                className="border-border text-text-muted hover:text-text border px-2 py-1 text-left text-xs disabled:opacity-40"
              >
                {opener}
              </button>
            </li>
          ))}
        </ul>
      )}

      {message !== null && (
        <p role="alert" className="text-oxblood-bright text-sm">
          {message}
        </p>
      )}

      {answer !== null && (
        <div className="border-border border-l-2 pl-3">
          <p className="text-text text-sm">{answer.answer}</p>
          {answer.example !== undefined && (
            <p className="text-text-muted mt-1 font-mono text-xs">
              {answer.example.chords.join(' → ')}
              <span className="ml-2">({answer.example.degrees.join(' ')})</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
