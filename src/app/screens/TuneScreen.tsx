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
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-8 overflow-y-auto p-6">
      <TuningPicker />
      <Tuner />
    </div>
  );
}
