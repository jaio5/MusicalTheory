'use client';

import { Tuner, TuningPicker } from '@features/tuner';
import { WorkHeader } from '@ui/Screen';

/**
 * Afinar y nada más: eliges la afinación y afinas cuerda a cuerda.
 *
 * Aquí no hay tonalidad, ni acordes, ni sugerencias. Quien viene a afinar viene
 * a eso, y cada cosa de más es una cosa que estorba.
 */
export function TuneScreen() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkHeader title="Afinar" lead="Cuerda a cuerda, con la afinación que elijas." />
      <div className="mx-auto flex w-full max-w-4xl grow flex-col justify-center gap-8 overflow-y-auto p-6">
        <TuningPicker />
        <Tuner />
      </div>
    </div>
  );
}
