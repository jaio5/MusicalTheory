'use client';

import { useEffect } from 'react';

import { SCALE_IDS, SCALES, STYLE_IDS, STYLES, type ScaleId, type StyleId } from '@core/music';
import { useSessionStore } from '@state/session-store';
import { Field } from '@ui/Field';

import { NotasDeLaEscala } from './NotasDeLaEscala';

/**
 * Estilo y escala, debajo de la rueda.
 *
 * Van aquí y no en la barra de arriba porque son de la misma familia que la
 * tonalidad: los tres deciden qué propone la aplicación, y la tonalidad ya se
 * elige en la rueda que tienen encima.
 *
 * Y **debajo, las notas que salen de elegir eso**. Elegir una escala en un
 * desplegable y que no pase nada visible es lo que hacía que ese control
 * pareciera un ajuste escondido en vez de una decisión musical: ahora la fila de
 * notas cambia delante, que es la respuesta.
 */
export function Settings() {
  const scaleId = useSessionStore((state) => state.scaleId);
  const styleId = useSessionStore((state) => state.styleId);
  const actions = useSessionStore((state) => state.actions);

  // La configuración guardada se recupera después de pintar: leerla durante el
  // render daría un HTML distinto en servidor y en cliente.
  useEffect(() => {
    actions.loadWorkspace();
  }, [actions]);

  return (
    <div className="flex w-full flex-col gap-1">
      <Field
        label="Estilo"
        compact
        value={styleId}
        onChange={(event) => actions.setStyle(event.target.value as StyleId)}
      >
        {STYLE_IDS.map((id) => (
          <option key={id} value={id}>
            {STYLES[id].name}
          </option>
        ))}
      </Field>

      <Field
        label="Escala"
        compact
        value={scaleId}
        onChange={(event) => actions.setScale(event.target.value as ScaleId)}
      >
        {SCALE_IDS.map((id) => (
          <option key={id} value={id}>
            {SCALES[id].name}
          </option>
        ))}
      </Field>

      <div className="mt-2">
        <NotasDeLaEscala />
      </div>
    </div>
  );
}
