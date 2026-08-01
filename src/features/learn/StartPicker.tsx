'use client';

import { isCourseIncluded, type PlanId } from '@core/billing';
import { COURSES, GRADES, startIndex, type Progress } from '@core/music';
import { Field } from '@ui/Field';

/**
 * Por dónde empiezas.
 *
 * Hasta ahora el camino empezaba siempre en «qué es un grado». Para quien no ha
 * tocado nunca eso está bien; para quien lleva diez años tocando y viene a por las
 * sustituciones es un muro de once unidades, y la forma más rápida de que cierre la
 * aplicación.
 *
 * Un `<select>` nativo y no una lista de tarjetas: son diez cursos en dos grados,
 * caben en un desplegable con sus dos grupos, y el desplegable del sistema ya sabe
 * abrirse bien en un móvil con una mano ocupada.
 *
 * Los cursos que el plan no incluye salen deshabilitados y con su llave. Ofrecerlos
 * como si se pudieran elegir sería vender un punto de partida que se cierra en la
 * cara al pulsarlo.
 */
export function StartPicker({
  progress,
  plan,
  onChange,
}: {
  readonly progress: Progress;
  readonly plan: PlanId;
  readonly onChange: (courseId: string | null) => void;
}) {
  const desde = startIndex(progress);
  const empezado = progress.done.length > 0;

  return (
    <div className="flex flex-col gap-1">
      <Field
        label="Empiezo por"
        value={progress.startCourse ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">El principio: 1º de Elemental</option>
        {GRADES.map((grade) => (
          <optgroup key={grade.id} label={grade.name}>
            {COURSES.filter((course) => course.grade === grade.id).map((course) => {
              const incluido = isCourseIncluded(plan, course);
              return (
                <option key={course.id} value={course.id} disabled={!incluido}>
                  {course.year}º · {course.title}
                  {incluido ? '' : ' 🔑'}
                </option>
              );
            })}
          </optgroup>
        ))}
      </Field>

      <p className="text-text-muted text-xs">
        {desde === 0
          ? 'Puedes saltar al curso que quieras. Elegir uno no da por hechas las unidades anteriores: las deja abiertas por si quieres pasar por ellas.'
          : empezado
            ? 'Lo anterior a tu punto de partida sigue abierto, y lo que ya has hecho no se pierde si lo cambias.'
            : 'De aquí en adelante, una unidad detrás de otra. Lo anterior queda abierto por si te hace falta.'}
      </p>
    </div>
  );
}
