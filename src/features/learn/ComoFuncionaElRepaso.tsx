import {
  dueReview,
  findUnit,
  MASTERED_HITS,
  REVIEW_LIMIT,
  type Progress,
  type ReviewItem,
} from '@core/music';

/**
 * Lo que acompaña al repaso: cómo funciona y qué hay hoy en la cola.
 *
 * **Las dos pantallas del repaso eran una columna en un rincón.** Sin plan, tres
 * renglones y un candado: a 1920 px usaban el 34 % del ancho y el resto era negro.
 * Con plan, la pregunta en una columna de 672 px en medio de la pantalla. Lo que
 * llena ese lado no es estirar la pregunta —una pregunta se lee igual de estrecha—
 * sino contestar lo que se pregunta quien está delante: **¿qué es esto, y qué me
 * espera?**
 *
 * Cada frase sale de lo que hace el código, no de lo que sonaría bien: los dos
 * días y el tope salen de `core/music/review.ts`, y lo de tocar y lo de oído, de
 * `ReviewSession`. Si cambian allí, cambian aquí solos.
 */
export function ComoFuncionaElRepaso() {
  const pasos = [
    {
      titulo: 'Fallas una pregunta',
      texto:
        'Se apunta su sitio —la unidad y el número de pregunta—, no la frase. Así puede volver escrita con otros acordes.',
    },
    {
      titulo: 'Vuelve hoy, y otra vez mañana',
      texto:
        'Generada en la tonalidad que tengas puesta. Las notas de tocar vuelven a la guitarra; las de oído, como pregunta escrita.',
    },
    {
      titulo: `Acertada ${MASTERED_HITS} veces seguidas, sale`,
      texto: `Fallarla otra vez la pone a cero. En la cola caben ${REVIEW_LIMIT}; al pasarse, se suelta la más antigua.`,
    },
  ];

  return (
    // Las tarjetas se reparten por el ancho **de su caja**, no de la ventana: van
    // en una columna estrecha junto a la pregunta y en una ancha junto al candado.
    <section aria-label="Cómo funciona el repaso" className="@container flex flex-col gap-4">
      <h2 className="rotulo">Cómo funciona</h2>
      <ol className="grid gap-3 @min-[40rem]:grid-cols-3">
        {pasos.map(({ titulo, texto }, indice) => (
          <li key={titulo} className="superficie flex gap-3 p-4">
            <span aria-hidden="true" className="text-brass-bright shrink-0 font-mono text-base">
              {indice + 1}
            </span>
            <div className="min-w-0">
              <p className="text-text text-base">{titulo}</p>
              <p className="text-text-muted mt-1 text-base">{texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Lo que vuelve hoy, unidad por unidad.
 *
 * El número suelto («hay 3 preguntas») dice cuánto; esto dice **de qué**, que es
 * lo que hace que apetezca empezar: tres de grados no es lo mismo que tres de
 * armaduras. Nada si la cola está vacía, porque una lista vacía con su título es
 * un hueco con rótulo.
 */
export function LaColaDeHoy({
  progress,
  day,
}: {
  readonly progress: Progress;
  readonly day: string | null;
}) {
  if (day === null) {
    return null;
  }
  const porUnidad = agrupar(dueReview(progress.review, day));
  if (porUnidad.length === 0) {
    return null;
  }

  return (
    <section aria-label="Lo que vuelve hoy" className="flex flex-col gap-3">
      <h2 className="rotulo">Lo que vuelve hoy</h2>
      <ul className="border-border divide-border divide-y border-y">
        {porUnidad.map(({ unitId, titulo, cuantas }) => (
          <li key={unitId} className="flex items-baseline justify-between gap-4 py-2 text-base">
            <span className="text-text min-w-0">{titulo}</span>
            <span className="text-brass-bright shrink-0 font-mono tabular-nums">
              {cuantas === 1 ? '1 pregunta' : `${cuantas} preguntas`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Las preguntas de la cola juntas por unidad, en el orden en que salen. */
function agrupar(
  items: readonly ReviewItem[],
): ReadonlyArray<{ unitId: string; titulo: string; cuantas: number }> {
  const cuentas = new Map<string, number>();
  for (const item of items) {
    cuentas.set(item.unitId, (cuentas.get(item.unitId) ?? 0) + 1);
  }
  return [...cuentas].map(([unitId, cuantas]) => ({
    unitId,
    // Lo que ya no está en el temario se descarta al leer el avance
    // (`parseProgress`), así que aquí no llega; si llegara, se nombra sin inventar.
    /* v8 ignore next -- `parseProgress` tira lo que no lleva a una unidad */
    titulo: findUnit(unitId)?.unit.title ?? 'Una unidad de antes',
    cuantas,
  }));
}
