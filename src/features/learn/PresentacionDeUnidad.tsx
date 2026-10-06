'use client';

import { useId, type Ref } from 'react';

import type { Presentacion } from '@core/music';
import { Button } from '@ui/Button';
import { CuatroTonalidades } from '@ui/EmpezarPorTonalidad';

/**
 * Lo primero que se ve de una unidad: de qué va y qué va a entrar.
 *
 * Se entraba directo a la teoría con las preguntas debajo, sin saber hacia dónde
 * iba nada. Una clase no empieza así: el profesor dice primero qué se va a ver
 * hoy, y así cada explicación cae en un sitio que ya estaba preparado. Y la
 * lista no es decorativa: `contenidos` es lo que luego se pregunta
 * (`core/music/presentaciones.ts`), así que leerla es saber de antemano qué se va a
 * poner a prueba.
 *
 * **Se ve aunque no haya tonalidad.** Lo que dice no depende de ella —es texto
 * fijo del temario—, y obligar a elegir una antes de saber de qué va la unidad
 * es pedir una decisión a ciegas. Lo que sí se escribe con sus acordes es lo de
 * después, así que sin tonalidad la presentación **ofrece** cuatro a un toque,
 * aquí mismo: decir «elígela arriba» sería señalar en vez de ofrecer. «Empezar»
 * sigue pulsándose —un botón no nace apagado por lo que falta— y el paso
 * siguiente lo vuelve a pedir con su estado vacío.
 */
export function PresentacionDeUnidad({
  titulo,
  presentacion,
  queViene,
  hayTonalidad,
  encabezado,
  onEmpezar,
  atajo,
}: {
  readonly titulo: string;
  readonly presentacion: Presentacion;
  /** Qué pasa después de leer esto, en una frase: cómo se pone a prueba. */
  readonly queViene: string;
  readonly hayTonalidad: boolean;
  /** El título, para que quien la monta pueda llevarle el foco. */
  readonly encabezado: Ref<HTMLHeadingElement>;
  readonly onEmpezar: () => void;
  /** La segunda salida, para quien ya la conoce. */
  readonly atajo?: { readonly etiqueta: string; readonly onClick: () => void };
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="superficie-alta max-w-prose p-5">
      {/* El título se repite aunque esté en la cabecera: allí va pequeño, a la
          altura de una franja que dice dónde estás, y aquí es lo que se lee
          primero. `tabIndex={-1}`: recibe el foco por código sin ser una parada
          más del tabulador. */}
      <h2 id={id} ref={encabezado} tabIndex={-1} className="titular text-text text-2xl">
        {titulo}
      </h2>
      <p className="text-text mt-3 text-base leading-relaxed">{presentacion.resumen}</p>

      <h3 className="rotulo mt-5">En esta unidad</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {presentacion.contenidos.map((contenido) => (
          <li key={contenido} className="text-text flex gap-3 text-base leading-snug">
            <span
              aria-hidden="true"
              className="bg-brass-bright mt-2 size-1.5 shrink-0 rounded-full"
            />
            {contenido}
          </li>
        ))}
      </ul>
      <p className="text-text-muted mt-4 text-sm">{queViene}</p>

      {!hayTonalidad && (
        <div className="mt-5">
          <CuatroTonalidades>
            Lo que viene se escribe con los acordes de una tonalidad. Elige una:
          </CuatroTonalidades>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onEmpezar}>Empezar</Button>
        {atajo !== undefined && (
          <Button variant="quiet" onClick={atajo.onClick}>
            {atajo.etiqueta}
          </Button>
        )}
      </div>
    </section>
  );
}
