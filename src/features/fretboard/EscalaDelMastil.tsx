'use client';

import { useState } from 'react';

import { SCALE_IDS, SCALES, type ScaleId } from '@core/music';
import { useClaqueta } from '@state/claqueta';
import { useSessionStore } from '@state/session-store';
import { Chevron } from '@ui/Chevron';
import { Field } from '@ui/Field';

/** La de al lado en la lista, dando la vuelta: después de la última viene la primera. */
export function escalaVecina(actual: ScaleId, paso: 1 | -1): ScaleId {
  const indice = SCALE_IDS.indexOf(actual);
  return SCALE_IDS[(indice + paso + SCALE_IDS.length) % SCALE_IDS.length]!;
}

/** Lo que se le dice a quien no ve el mástil cambiar: cuál es y cuántas notas marca. */
export function anuncioDeEscala(id: ScaleId): string {
  return `${SCALES[id].name}: ${SCALES[id].intervals.length} notas`;
}

/**
 * Una flecha: **cuarenta y cuatro de alto siempre, y de ancho mientras quepa.**
 *
 * La cabecera de un teléfono lleva el nombre del área, este selector y el botón
 * de cerrar. Medido: con el desplegable ajustado (abajo), las flechas de 44 caben
 * desde 368 px de ancho y el nombre del área sigue entero. Entre 360 y 368 —el
 * Android más común está en 360— ceden el ancho a 36 y conservan el alto, que es
 * la regla de la casa (`docs/ESTILO.md`). Por debajo de 360 ni así caben, y se
 * van: el desplegable sigue cambiando la escala, y las flechas son un atajo para
 * probar varias seguidas, no la única manera.
 *
 * Lo que dice en `title` es **a cuál lleva**, para quien la mira antes de pulsar;
 * el nombre accesible no cambia con la escala, que un botón que se renombra a
 * cada pulsación se anuncia dos veces.
 */
function Flecha({
  paso,
  destino,
  onElegir,
}: {
  readonly paso: 1 | -1;
  readonly destino: ScaleId;
  readonly onElegir: (id: ScaleId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onElegir(destino)}
      aria-label={paso === 1 ? 'Escala siguiente' : 'Escala anterior'}
      title={`${paso === 1 ? 'Siguiente' : 'Anterior'}: ${SCALES[destino].name}`}
      className="text-text-muted hover:text-brass-bright min-h-tap inline-flex w-9 shrink-0 cursor-pointer items-center justify-center self-stretch max-[22.5rem]:hidden min-[23rem]:w-11"
    >
      {/* La flecha de los desplegables, girada: la misma pieza y no otro dibujo. */}
      <Chevron className={`size-3 ${paso === 1 ? '-rotate-90' : 'rotate-90'}`} />
    </button>
  );
}

/**
 * Por debajo de `sm`, el desplegable con menos relleno y un punto menos de letra:
 * son los píxeles que faltaban para que «Pentatónica menor», la opción más larga
 * y la que manda en su ancho, cupiera al lado del nombre del área sin cortarlo.
 */
const AJUSTE_DEL_DESPLEGABLE = 'max-sm:pr-7 max-sm:pl-2 max-sm:text-[13px]';

/**
 * **Cambiar de escala sin dejar de mirar el mástil**, desde su cabecera.
 *
 * Para ver cómo cambia una escala sobre el mástil había que elegirla en otro
 * sitio: en un teléfono, en la ventana de la tonalidad, que tapa la pantalla
 * entera —se elegía a ciegas y se cerraba para mirar—; en el banco, en el área de
 * la tonalidad, donde con el mástil abierto el desplegable quedaba debajo de la
 * rueda y había que desplazarse para llegar a él.
 *
 * **Es la misma escala de siempre**: `setScale` sobre el almacén de la sesión, la
 * que lee el resto de la aplicación y la que se recuerda de una vez para otra. No
 * hay una escala del mástil aparte: cambiarla aquí la cambia en la tonalidad, en
 * las propuestas del punteo y en el profesor, y al revés.
 *
 * **Va en la cabecera y no encima del dibujo**, porque la cabecera mide lo mismo
 * con algo dentro que vacía: una fila encima del dibujo costaba 45 píxeles, y son
 * justo los que le faltaban al mástil para llenar el ancho
 * ([adr/0046](../../../docs/adr/0046-el-mastil-solo-ocupa-lo-que-dibuja.md)).
 *
 * **Un desplegable entre dos flechas**, y no un segmentado. Son nueve escalas, y
 * nueve botones no caben en ningún ancho de la cabecera; un segmentado con las
 * de siempre y el resto en un desplegable serían dos mandos para una sola
 * elección, y escondería justo las que se quieren comparar —dórico, mixolidio,
 * frigio—. Lo que se hace aquí es **probar varias seguidas**, y para eso las
 * flechas: una pulsación por escala sin abrir nada, y el dedo no se mueve porque
 * el desplegable mide lo que su opción más larga y no lo que la elegida. El
 * desplegable queda para saltar directamente a una.
 *
 * **El cambio se anuncia una vez y nunca durante una toma.** Con las flechas no
 * se entera nadie que no vea el dibujo, así que se dice qué escala es y cuántas
 * notas marca. Pero mientras se graba suena el clic y se está tocando: un lector
 * de pantalla hablando encima tapa el pulso
 * ([adr/0072](../../../docs/adr/0072-la-claqueta-suena-toda-la-toma.md)). Se
 * pregunta a la claqueta en el momento y no se suscribe: que empiece o acabe una
 * toma no tiene por qué repintar la cabecera.
 *
 * La región está montada vacía antes de decir nada, porque una que nace con el
 * texto dentro no la lee todo lector (`docs/ESTILO.md`).
 */
export function EscalaDelMastil() {
  const scaleId = useSessionStore((state) => state.scaleId);
  const actions = useSessionStore((state) => state.actions);
  const [anuncio, setAnuncio] = useState('');

  const elegir = (id: ScaleId) => {
    actions.setScale(id);
    setAnuncio(useClaqueta.getState().enLaToma ? '' : anuncioDeEscala(id));
  };

  return (
    <div role="group" aria-label="Escala" className="flex items-stretch self-stretch">
      <Flecha paso={-1} destino={escalaVecina(scaleId, -1)} onElegir={elegir} />
      <div className="flex items-center">
        <Field
          label="Escala"
          compact
          ancho="auto"
          value={scaleId}
          onChange={(event) => elegir(event.target.value as ScaleId)}
          className={AJUSTE_DEL_DESPLEGABLE}
        >
          {SCALE_IDS.map((id) => (
            <option key={id} value={id}>
              {SCALES[id].name}
            </option>
          ))}
        </Field>
      </div>
      <Flecha paso={1} destino={escalaVecina(scaleId, 1)} onElegir={elegir} />
      <span aria-live="polite" data-anuncio-escala className="sr-only">
        {anuncio}
      </span>
    </div>
  );
}
