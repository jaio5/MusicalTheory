import { ComposePanel } from '@features/compose';
import { FretboardPanel } from '@features/fretboard';
import { IdeasPanel } from '@features/ideas';
import { LearnPanel } from '@features/learn';
import { RecorderPanel } from '@features/recorder';
import { SessionsPanel } from '@features/sessions';
import { Tuner } from '@features/tuner';
import { KeyPanel } from '@features/wheel';

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="border-brass-dim border-b pb-8">
        <p className="text-brass font-mono text-xs tracking-widest uppercase">Caos ordenado</p>
        <h1 className="font-display text-text mt-3 text-4xl">
          Un asistente que escucha la guitarra
        </h1>
        <p className="text-text-muted mt-4 text-lg">
          Afina, detecta la tonalidad de lo que estás tocando y te enseña la escala sobre el mástil.
        </p>
      </header>

      <div className="mt-10 space-y-8">
        <Tuner />
        <KeyPanel />
        <FretboardPanel />
        <LearnPanel />
        <ComposePanel />
        <IdeasPanel />
        <RecorderPanel />
        <SessionsPanel />
      </div>

      <footer className="border-border text-text-muted mt-16 border-t pt-8 text-sm">
        <p>
          La detección de tono es monofónica y necesita señal limpia. Con distorsión los armónicos
          confunden al analizador: pon la guitarra en canal limpio antes de afinar.
        </p>
      </footer>
    </main>
  );
}
