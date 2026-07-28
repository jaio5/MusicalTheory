import { Tuner } from '@features/tuner';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="border-brass-dim border-b pb-8">
        <p className="text-brass font-mono text-xs tracking-widest uppercase">Caos ordenado</p>
        <h1 className="font-display text-text mt-3 text-4xl">
          Un asistente que escucha la guitarra
        </h1>
        <p className="text-text-muted mt-4 text-lg">
          Afina, y en las siguientes fases enseña la escala sobre el mástil y detecta la tonalidad
          de lo que estás tocando.
        </p>
      </header>

      <div className="mt-10">
        <Tuner />
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
