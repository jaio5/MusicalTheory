'use client';

import { Tuner, TuningPicker } from '@features/tuner';

/**
 * Afinar y nada más: eliges la afinación y afinas cuerda a cuerda.
 *
 * Aquí no hay tonalidad, ni acordes, ni sugerencias. Quien viene a afinar viene
 * a eso, y cada cosa de más es una cosa que estorba.
 */
export function TuneScreen() {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">
      <TuningPicker />
      <Tuner />
    </div>
  );
}
