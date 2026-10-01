'use client';

import { useState } from 'react';

import { cheapestPlanWith, unitAccess, type PlanId, type UnitAccess } from '@core/billing';
import { IconoCandado, IconoGrieta, IconoLlave, IconoTeoria, IconoTocar } from '@ui/icons';
import { PlansLink } from '@ui/PlansLink';
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
 * El plan que abre el Grado Profesional, por su nombre de verdad.
 *
 * Lo decía el `title` de cada nodo con un nombre escrito a mano —«Estudiante»— que
 * ya no existe: los planes son Básico, Medio y Pro. Sale de `core/billing`, así
 * que un renombrado no lo deja mintiendo otra vez. Siempre hay uno: es la
 * definición de la tabla de planes.
 */
const PLAN_DEL_PROFESIONAL = cheapestPlanWith('grado-profesional')!.name;

/**
 * Dónde cae el centro de cada nodo del zigzag: un tanto por ciento del ancho de la
 * fila y la mitad del círculo, que en el nodo de «aquí» es mayor.
 *
 * Lo comparten el sangrado de la fila y el tramo de camino que la une con la
 * anterior: si cada uno tuviera su tabla, la línea acabaría un poco al lado del
 * nodo en cuanto alguien tocara una.
 */
const ZIGZAG = [0, 14, 26, 14] as const;
const MITAD_NODO = 24;
const MITAD_NODO_AQUI = 32;

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
  // La unidad cerrada que se acaba de tocar, para decir debajo qué la abre. Una
  // sola a la vez: la nueva sustituye a la anterior en vez de apilarse.
  const [explicada, setExplicada] = useState<string | null>(null);

  return (
    <div className="min-h-0 grow overflow-y-auto">
      {/* El camino es **uno y vertical**. Llegó a partirse en dos columnas para
          llenar el ancho de un portátil y dejó de ser un camino: dos rutas
          paralelas no se recorren, se comparan. El ancho se llena centrando la
          cinta y dejándola respirar a los lados, no cortándola. */}
      <div className="mx-auto w-full max-w-2xl">
        {/* La leyenda de los dos candados. Se distinguían solo en el `title`, que
            en una pantalla táctil no existe, y con el nombre del nodo a un lado
            nada decía qué era cada icono. Dos frases y los mismos iconos que los
            nodos, a la vista y antes del primero. */}
        <ul className="text-text-muted flex flex-wrap gap-x-4 gap-y-1 px-3 pt-3 text-xs">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="[&_svg]:size-4">
              <IconoCandado />
            </span>
            Se abre terminando la anterior
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="[&_svg]:size-4">
              <IconoLlave />
            </span>
            Se abre con un plan
          </li>
        </ul>

        {GRADES.map((grade) => (
          <section key={grade.id} aria-label={grade.name}>
            {/* La cabecera se queda pegada arriba mientras recorres el grado, y
              lleva un filo de latón: es el rótulo de la sección, no una fila
              más de la lista.

              **Con el mismo sangrado que las tarjetas.** Iba de lado a lado de la
              columna y las tarjetas doce píxeles más adentro, así que los bordes
              no casaban por ningún lado y la franja parecía de otra pantalla.
              El sangrado lo pone una caja del color del fondo, y no un margen,
              porque es pegajosa: con margen, las tarjetas que pasan por debajo
              asomarían por los dos lados. */}
            <div className="bg-background sticky top-0 z-10 px-3 pt-3">
              <div className="bg-surface-raised border-border rounded-md border px-4 py-2.5">
                <div className="border-brass-dim border-l-2 pl-3">
                  <h2 className="text-text text-sm font-semibold">{grade.name}</h2>
                  <p className="text-text-muted text-xs">{grade.summary}</p>
                </div>
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
                        <p className="rotulo">{course.year}º curso</p>
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
                            className={`relative w-full ${index > 0 ? 'pt-8' : ''}`}
                            // El zigzag: cuatro posiciones que van y vuelven, en
                            // porcentaje del ancho para que aguante una columna
                            // estrecha sin salirse.
                            style={{ paddingLeft: `${ZIGZAG[index % 4]}%` }}
                          >
                            {/* El tramo de camino que llega a este nodo: **une el
                            centro del anterior con el de este**. Eran trazos
                            verticales cortos en la columna del nodo de abajo, y
                            con los nodos en zigzag no tocaban al de arriba. Sale
                            del estado de la unidad, así que el sendero se enciende
                            por donde has pasado y queda de puntos por donde no.
                            El primero no lo lleva: no viene de ningún sitio. */}
                            {index > 0 && (
                              <Tramo
                                desde={{
                                  pct: ZIGZAG[(index - 1) % 4]!,
                                  mitad:
                                    siguiente === course.units[index - 1]!.id
                                      ? MITAD_NODO_AQUI
                                      : MITAD_NODO,
                                }}
                                hasta={{
                                  pct: ZIGZAG[index % 4]!,
                                  mitad: siguiente === unit.id ? MITAD_NODO_AQUI : MITAD_NODO,
                                }}
                                access={acceso}
                              />
                            )}
                            <UnitNode
                              unit={unit}
                              access={acceso}
                              cracked={day !== null && isUnitCracked(progress.review, unit.id, day)}
                              here={siguiente === unit.id}
                              active={active === unit.id}
                              explained={explicada === unit.id}
                              onPick={onPick}
                              onExplain={setExplicada}
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

/**
 * Un tramo del sendero: una diagonal del centro de un nodo al del siguiente.
 *
 * Una caja absoluta que cubre el ancho de la fila y deja ocho de alto sobre el
 * nodo, y dentro un SVG que se estira de un extremo al otro. Las posiciones
 * mezclan tanto por ciento y píxeles, que un trazo suelto no puede sumar: por eso
 * la caja del SVG se coloca con `calc` y lo que se dibuja dentro es solo una
 * diagonal en coordenadas de 0 a 1. `non-scaling-stroke` mantiene el grosor y el
 * punteado en píxeles de pantalla aunque la caja se estire.
 */
function Tramo({
  desde,
  hasta,
  access,
}: {
  readonly desde: { readonly pct: number; readonly mitad: number };
  readonly hasta: { readonly pct: number; readonly mitad: number };
  readonly access: UnitAccess;
}) {
  // Los dos extremos están siempre en columnas distintas —la tabla del zigzag no
  // repite una posición seguida—, así que el sentido sale del porcentaje.
  const haciaLaDerecha = hasta.pct > desde.pct;
  const izquierda = haciaLaDerecha ? desde : hasta;
  const derecha = haciaLaDerecha ? hasta : desde;

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-8">
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-y-0 overflow-visible"
        style={{
          left: `calc(${izquierda.pct}% + ${izquierda.mitad}px)`,
          width: `calc(${derecha.pct - izquierda.pct}% + ${derecha.mitad - izquierda.mitad}px)`,
          height: '100%',
        }}
      >
        <line
          x1={haciaLaDerecha ? 0 : 1}
          y1={0}
          x2={haciaLaDerecha ? 1 : 0}
          y2={1}
          vectorEffect="non-scaling-stroke"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={access === 'hecha' || access === 'abierta' ? undefined : '2 5'}
          className={
            access === 'hecha'
              ? 'stroke-tube'
              : access === 'abierta'
                ? 'stroke-brass'
                : 'stroke-border-strong'
          }
        />
      </svg>
    </span>
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
  explained,
  onPick,
  onExplain,
}: {
  readonly unit: Unit;
  readonly access: UnitAccess;
  readonly cracked: boolean;
  readonly here: boolean;
  readonly active: boolean;
  /** Si se acaba de tocar y toca decir qué la abre. */
  readonly explained: boolean;
  readonly onPick: (unitId: string) => void;
  readonly onExplain: (unitId: string) => void;
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
  //
  // «Se hunde» con el color y el candado, **no con media opacidad encima**. La
  // llevaba —un 45 %— y eso multiplica el contraste de un gris que ya era el
  // suave: en el tema claro, el nombre de una unidad cerrada se quedaba en 2,6:1.
  // Y son las que hay que poder leer para saber a dónde lleva el camino.
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
        : 'border-border bg-surface text-text-muted';

  const idAviso = `${unit.id}-aviso`;

  return (
    <div>
      <div className="flex items-center gap-2">
        {/* **`aria-disabled` y no `disabled`.** Un nodo cerrado no hacía nada al
            pulsarlo, y en táctil, sin `title`, quien lo tocaba no tenía forma de
            saber por qué. Con `aria-disabled` sigue en el orden del tabulador y
            recibe el toque, y lo que hace es decir debajo qué lo abre. */}
        <button
          type="button"
          aria-disabled={!entrable}
          aria-describedby={explained ? idAviso : undefined}
          onClick={() => (entrable ? onPick(unit.id) : onExplain(unit.id))}
          aria-current={active}
          aria-label={`${unit.title}${COMO_SE_LEE[access]}${cracked ? ', para repasar' : ''}`}
          title={
            access === 'por-plan'
              ? `El Grado Profesional entra con el plan ${PLAN_DEL_PROFESIONAL}`
              : access === 'por-temario'
                ? 'Termina la unidad anterior para abrir esta'
                : cracked
                  ? 'Superada, pero hay preguntas de esta unidad esperando repaso'
                  : unit.title
          }
          className={`relative flex shrink-0 items-center justify-center rounded-full border-2 transition-transform duration-150 ${
            entrable ? 'cursor-pointer hover:scale-105 active:scale-100' : 'cursor-default'
          } ${anillo} ${here ? 'h-16 w-16 text-2xl' : 'h-12 w-12 text-lg'}`}
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
          <p className="text-text-muted flex flex-wrap items-center gap-x-2 text-xs">
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

      {/* Lo que abre esta unidad, en una línea visible. Solo la de la unidad
          tocada, y alineada con el texto del nodo y no con el círculo. */}
      {explained && !entrable && (
        <p id={idAviso} className="text-text-muted mt-1 pl-14 text-xs">
          {access === 'por-plan' ? (
            <>
              Se abre con el plan {PLAN_DEL_PROFESIONAL} ·{' '}
              <PlansLink tono="enlace" label="Ver planes" />
            </>
          ) : (
            'Termina la anterior para abrirla.'
          )}
        </p>
      )}
    </div>
  );
}
