'use client';

import { useState } from 'react';

import { keyName } from '@core/music';
import { LearnPanel, Teacher, TheoryLessons } from '@features/learn';
import { KeyPanel } from '@features/wheel';
import { selectActiveKey, useSessionStore } from '@state/session-store';

/**
 * Aprender: teoría a base de preguntas, con el profesor al lado y la escala
 * para tocarla de verdad.
 *
 * La lección de la izquierda le dice al profesor de qué va la cosa, así que
 * preguntar «¿y esto por qué?» tiene sentido sin escribir el contexto entero.
 */
export function LearnScreen() {
  const activeKey = useSessionStore(selectActiveKey);
  const [topic, setTopic] = useState<string | undefined>(undefined);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-px lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Teoría" className="border-border flex min-h-0 flex-col border-r">
        <TheoryLessons onTopic={setTopic} />
      </section>

      <section aria-label="Profesor y práctica" className="flex min-h-0 flex-col overflow-y-auto">
        <div className="border-border border-b p-3">
          <h2 className="text-text-muted mb-2 font-mono text-[11px] tracking-widest uppercase">
            Profesor
          </h2>
          <Teacher {...(topic === undefined ? {} : { topic })} />
        </div>

        <div className="border-border flex flex-col items-center gap-2 border-b p-3">
          <KeyPanel compact />
          <p className="text-text-muted text-center font-mono text-xs">
            {activeKey === null
              ? 'Elige la tonalidad en la que quieres aprender'
              : keyName(activeKey.tonic, activeKey.mode)}
          </p>
        </div>

        <div className="p-3">
          <LearnPanel />
        </div>
      </section>
    </div>
  );
}
