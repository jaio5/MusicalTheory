'use client';

import { unitAccess, type PlanId, type UnitAccess } from '@core/billing';
import { IconoCandado, IconoGrieta, IconoLlave, IconoTeoria, IconoTocar } from '@ui/icons';
import { ProgressRing } from '@ui/ProgressRing';
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
      {/* El camino es **uno y vertical**. Llegó a partirse en dos columnas para
          llenar el ancho de un portátil y dejó de ser un camino: dos rutas
          paralelas no se recorren, se comparan. El ancho se llena centrando la
          cinta y dejándola respirar a los lados, no cortándola. */}
      <div className="mx-auto w-full max-w-2xl">
        {GRADES.map((grade) => (
          <section key={grade.id} aria-label={grade.name}>
            {/* La cabecera se queda pegada arriba mientras recorres el grado, y
              lleva un filo de latón: es el rótulo de la sección, no una fila
              más de la lista. */}
            <div className="bg-surface-raised border-border sticky top-0 z-10 border-b px-4 py-2.5">
              <div className="border-brass-dim border-l-2 pl-3">
                <h2 className="text-text font-mono text-sm tracking-wide">{grade.name}</h2>
                <p className="text-text-muted text-xs">{grade.summary}</p>
              </div>
            </div>

            <ol>
              {COURSES.filter((course) => course.grade === grade.id).map((course) => {
                const hecho = courseCompletion(progress, course);
                const porcentaje = Math.round(hecho * 100);

                return (
                  <li key={course.id} className="px-3 py-4">
                    {/* El curso es una parada del camino, no un encabezado: tarjeta
                      con su anillo de avance, para saber de un vistazo cuánto te
                      queda de este tramo antes de meterte en él. */}
                    <div
                      className={`flex items-center gap-3 p-3 ${
                        hecho > 0 && hecho < 1 ? 'superficie-viva' : 'superficie'
                      }`}
                    >
                      <ProgressRing
                        part={hecho}
                        size={48}
                        ancho={4}
                        label={`${course.title}: ${porcentaje}% hecho`}
                      >
                        <span className={hecho >= 1 ? 'text-tube-bright' : 'text-text-muted'}>
                          {hecho >= 1 ? '✓' : porcentaje}
                        </span>
                      </ProgressRing>

                      <div className="min-w-0">
                        <p className="text-text-muted font-mono text-xs tracking-widest uppercase">
                          {course.year}º curso
                        </p>
                        <h3 className="text-text text-base">{course.title}</h3>
                        <p className="text-text-muted mt-0.5 text-xs">{course.summary}</p>
                      </div>
                    </div>

                    <ul className="mt-2 flex flex-col items-start">
                      {course.units.map((unit, index) => {
                        // Una sola vez por unidad: `unitAccess` recorre los diez
                        // cursos y el orden entero de unidades, y se llamaba tres
                        // veces por nodo con los mismos argumentos.
                        const acceso = unitAccess(progress, plan, unit.id);

                        return (
                          <li
                            key={unit.id}
                            className="w-full"
                            // El zigzag: cuatro posiciones que van y vuelven, en
                            // porcentaje del ancho para que aguante una columna
                            // estrecha sin salirse.
                            style={{ paddingLeft: `${[0, 14, 26, 14][index % 4]}%` }}
                          >
                            {/* El tramo de camino que llega a este nodo. Sale del
                            estado de la unidad, así que el sendero se enciende
                            por donde has pasado y queda de puntos por donde no.
                            El primero no lo lleva: no viene de ningún sitio. */}
                            {index > 0 && (
                              <span
                                aria-hidden="true"
                                className={`ml-6 block h-4 w-0.5 ${
                                  acceso === 'hecha'
                                    ? 'bg-tube'
                                    : acceso === 'abierta'
                                      ? 'bg-brass'
                                      : 'bg-border'
                                }`}
                              />
                            )}
                            <UnitNode
                              unit={unit}
                              access={acceso}
                              cracked={day !== null && isUnitCracked(progress.review, unit.id, day)}
                              here={siguiente === unit.id}
                              active={active === unit.id}
                              onPick={onPick}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
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
  const Icono = unit.kind === 'play' ? IconoTocar : IconoTeoria;
  const Marca =
    access === 'hecha'
      ? cracked
        ? IconoGrieta
        : null
      : access === 'por-plan'
        ? IconoLlave
        : access === 'por-temario'
          ? IconoCandado
          : null;

  // El relieve va con el estado, y es lo que hace que el camino se lea de un
  // vistazo sin contar nada: lo hecho es verde y macizo, lo que toca brilla en
  // latón con su halo, y lo cerrado se hunde en el fondo.
  const anillo = active
    ? 'border-brass-bright bg-surface-raised halo-latón'
    : access === 'hecha'
      ? cracked
        ? 'border-oxblood-bright bg-surface text-oxblood-bright'
        : 'border-tube bg-tube/15 text-tube-bright'
      : access === 'abierta'
        ? here
          ? 'border-brass-bright bg-surface-raised text-brass-bright halo-aquí'
          : 'border-brass-dim bg-surface-raised text-text'
        : 'border-border bg-surface text-text-muted opacity-45';

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
        className={`relative flex shrink-0 items-center justify-center rounded-full border-2 transition-transform duration-150 enabled:hover:scale-105 enabled:active:scale-100 disabled:cursor-default ${anillo} ${
          here ? 'h-16 w-16 text-2xl' : 'h-12 w-12 text-lg'
        }`}
      >
        <span aria-hidden="true">
          {access === 'hecha' && !cracked ? '✓' : Marca === null ? <Icono /> : <Marca />}
        </span>
      </button>

      <div className="min-w-0">
        <p
          className={`truncate text-sm ${
            entrable || access === 'por-plan' ? 'text-text' : 'text-text-muted'
          }`}
        >
          {unit.title}
        </p>
        <p className="text-text-muted flex flex-wrap items-center gap-x-2 font-mono text-xs">
          {here && (
            <span className="border-brass-bright text-brass-bright rounded-full border px-2 py-0.5">
              aquí
            </span>
          )}
          <span>{unit.xp} XP</span>
          {unit.kind === 'play' && <span>· con la guitarra</span>}
          {cracked && <span className="text-oxblood-bright">· para repasar</span>}
        </p>
      </div>
    </div>
  );
}
