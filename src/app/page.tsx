import { diatonicTriads, keyName, pitchClassFromName } from '@core/music';

const PHASES: ReadonlyArray<{ readonly title: string; readonly done: boolean }> = [
  { title: 'Dominio musical y documentación', done: true },
  { title: 'Motor de tono y afinador', done: false },
  { title: 'Rueda de quintas y mástil', done: false },
  { title: 'Modo aprender', done: false },
  { title: 'Modo componer', done: false },
  { title: 'Ideas de IA', done: false },
  { title: 'Grabación con cámara', done: false },
  { title: 'Persistencia local de sesiones', done: false },
];

export default function Home() {
  const tonic = pitchClassFromName('A');
  const chords = diatonicTriads(tonic, 'naturalMinor');

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="border-brass-dim border-b pb-8">
        <p className="text-brass font-mono text-xs tracking-widest uppercase">Caos ordenado</p>
        <h1 className="font-display text-text mt-3 text-4xl">
          Un asistente que escucha la guitarra
        </h1>
        <p className="text-text-muted mt-4 text-lg">
          Afina, enseña la escala sobre el mástil y detecta la tonalidad de lo que estás tocando. De
          momento solo está construido el dominio musical: la interfaz llega por fases.
        </p>
      </header>

      <section className="mt-12" aria-labelledby="dominio">
        <h2 id="dominio" className="font-display text-text text-2xl">
          El dominio ya funciona
        </h2>
        <p className="text-text-muted mt-2">
          Estos son los acordes diatónicos de {keyName(tonic, 'minor')}, calculados por{' '}
          <code className="text-brass font-mono text-sm">src/core/music</code> sin tocar el
          navegador.
        </p>
        <ul className="mt-6 flex flex-wrap gap-3">
          {chords.map((chord) => (
            <li key={chord.symbol} className="border-border bg-surface rounded-md border px-4 py-3">
              <span className="text-brass-bright font-mono text-lg">{chord.symbol}</span>
              <span className="text-text-muted ml-3 font-mono text-sm">{chord.roman}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="fases">
        <h2 id="fases" className="font-display text-text text-2xl">
          Por dónde va
        </h2>
        <ol className="mt-6 space-y-2">
          {PHASES.map((phase) => (
            <li key={phase.title} className="flex items-baseline gap-3">
              <span
                className={`font-mono text-xs ${phase.done ? 'text-tube-bright' : 'text-text-muted'}`}
              >
                {phase.done ? 'hecho' : 'pendiente'}
              </span>
              <span className="text-text">{phase.title}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-border text-text-muted mt-16 border-t pt-8 text-sm">
        <p>
          La detección de tono es monofónica y necesita señal limpia. Con distorsión los armónicos
          confunden al analizador: pon la guitarra en canal limpio antes de afinar.
        </p>
      </footer>
    </main>
  );
}
