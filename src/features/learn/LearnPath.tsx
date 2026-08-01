'use client';

import { unitAccess, type PlanId, type UnitAccess } from '@core/billing';
import {
  COURSES,
  GRADES,
  courseCompletion,
  isUnitCracked,
  nextUnit,
  type Progress,
  type Unit,
} from '@core/music';

/**
 * El camino: dos grados, diez cursos y sus unidades, una debajo de otra.
 *
 * Un camino y no una lista. La lista que había antes decía lo mismo y no
 * conseguía que apeteciera seguir: todas las filas pesaban igual, así que no
 * había un «aquí estoy» ni un «esto es lo siguiente», y con nueve de cada diez
 * unidades bloqueadas al empezar, lo que se veía era un muro de candados.
 *
 * El camino resuelve las dos cosas con la misma pieza: los nodos van en zigzag
 * —así se lee como un recorrido y no como una tabla—, el que toca es más grande y
 * lleva su cartel, y lo bloqueado se atenúa hasta quedar de fondo.
 *
 * Cuatro estados y no dos, y esto es lo que la lista no distinguía: **el candado
 * del temario y el candado del plan no se abren igual**. Uno se abre terminando la
 * unidad anterior y el otro pagando. Con el mismo icono, quien va por el cuarto
 * curso del Elemental cree que le falta estudiar cuando lo que le falta es un
 * plan. Y una unidad hecha puede estar **agrietada**: superada, pero con preguntas
 * esperando repaso.
 */
export function LearnPath({
  progress,
  plan,
  day,
  active,
  onPick,
}: {
  readonly progress: Progress;
  readonly plan: PlanId;
  /** Nulo hasta que se lee el reloj en el cliente. */
  readonly day: string | null;
  readonly active: string | null;
  readonly onPick: (unitId: string) => void;
}) {
  // La siguiente del temario, que es la que lleva el cartel de «aquí». Se calcula
  // una vez y no por nodo: es la misma para todos.
  const siguiente = nextUnit(progress);

  return (
    <div className="min-h-0 grow overflow-y-auto">
      {GRADES.map((grade) => (
        <section key={grade.id} aria-label={grade.name}>
          <div className="bg-surface-raised border-border sticky top-0 z-10 border-b px-3 py-2">
            <h2 className="text-text font-mono text-sm">{grade.name}</h2>
            <p className="text-text-muted text-xs">{grade.summary}</p>
          </div>

          <ol>
            {COURSES.filter((course) => course.grade === grade.id).map((course) => {
              const hecho = courseCompletion(progress, course);

              return (
                <li key={course.id} className="border-border border-b px-3 py-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-text-muted shrink-0 font-mono text-xs">
                      {course.year}º
                    </span>
                    <h3 className="text-text text-sm">{course.title}</h3>
                    <span className="text-text-muted ml-auto shrink-0 font-mono text-xs">
                      {Math.round(hecho * 100)}%
                    </span>
                  </div>
                  <p className="text-text-muted mt-0.5 text-xs">{course.summary}</p>

                  <ul className="mt-3 flex flex-col items-start gap-2">
                    {course.units.map((unit, index) => (
                      <li
                        key={unit.id}
                        className="w-full"
                        // El zigzag: cuatro posiciones que van y vuelven, en
                        // porcentaje del ancho para que aguante una columna
                        // estrecha sin salirse.
                        style={{ paddingLeft: `${[0, 12, 22, 12][index % 4]}%` }}
                      >
                        <UnitNode
                          unit={unit}
                          access={unitAccess(progress, plan, unit.id)}
                          cracked={day !== null && isUnitCracked(progress.review, unit.id, day)}
                          here={siguiente === unit.id}
                          active={active === unit.id}
                          onPick={onPick}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Lo que dice el lector de pantalla de cada estado, después del título. */
const COMO_SE_LEE: Readonly<Record<UnitAccess, string>> = {
  hecha: ', superada',
  abierta: '',
  'por-temario': ', bloqueada',
  'por-plan': ', bloqueada por el plan',
};

function UnitNode({
  unit,
  access,
  cracked,
  here,
  active,
  onPick,
}: {
  readonly unit: Unit;
  readonly access: UnitAccess;
  readonly cracked: boolean;
  readonly here: boolean;
  readonly active: boolean;
  readonly onPick: (unitId: string) => void;
}) {
  const entrable = access === 'abierta' || access === 'hecha';

  // La guitarra significa que hay que tocar, y eso cambia si la haces ahora o
  // cuando estés a solas. Se ve antes de entrar, a propósito.
  const icono = unit.kind === 'play' ? '🎸' : '📖';
  const marca =
    access === 'hecha'
      ? cracked
        ? '🩹'
        : '✓'
      : access === 'por-plan'
        ? '🔑'
        : access === 'por-temario'
          ? '🔒'
          : '';

  const anillo = active
    ? 'border-brass-bright bg-surface-raised'
    : access === 'hecha'
      ? cracked
        ? 'border-oxblood-bright bg-surface'
        : 'border-tube bg-surface'
      : access === 'abierta'
        ? 'border-brass-bright bg-surface-raised'
        : 'border-border bg-surface opacity-50';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!entrable}
        onClick={() => onPick(unit.id)}
        aria-current={active}
        aria-label={`${unit.title}${COMO_SE_LEE[access]}${cracked ? ', para repasar' : ''}`}
        title={
          access === 'por-plan'
            ? 'El Grado Profesional entra con el plan Estudiante'
            : access === 'por-temario'
              ? 'Termina la unidad anterior para abrir esta'
              : cracked
                ? 'Superada, pero hay preguntas de esta unidad esperando repaso'
                : unit.title
        }
        className={`flex shrink-0 items-center justify-center rounded-full border-2 disabled:cursor-default ${anillo} ${
          here ? 'h-16 w-16 text-2xl' : 'h-12 w-12 text-lg'
        }`}
      >
        <span aria-hidden="true">{marca === '' ? icono : marca}</span>
      </button>

      <div className="min-w-0">
        <p
          className={`truncate text-sm ${
            entrable || access === 'por-plan' ? 'text-text' : 'text-text-muted'
          }`}
        >
          {unit.title}
        </p>
        <p className="text-text-muted font-mono text-xs">
          {here && <span className="text-brass-bright">aquí · </span>}
          {unit.xp} XP
          {unit.kind === 'play' && <span> · con la guitarra</span>}
        </p>
      </div>
    </div>
  );
}
