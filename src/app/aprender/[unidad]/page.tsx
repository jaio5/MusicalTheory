import type { Metadata } from 'next';

import { findUnit, UNIT_ORDER } from '@core/music';

import { AppShell } from '../../AppShell';
import { UnitScreen } from '../../screens';

/**
 * Una unidad por dirección.
 *
 * Con dirección propia se puede enlazar, compartir y volver atrás. Lo que **no**
 * hace esta página es decidir si se puede entrar: eso depende del avance, que vive
 * en el navegador, y del plan, que la pantalla ya sabe leer. Aquí solo se comprueba
 * que la unidad existe en el temario.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ unidad: string }>;
}): Promise<Metadata> {
  const { unidad } = await params;
  const found = findUnit(unidad);
  if (found === null) {
    return { title: 'Unidad no encontrada · Caos ordenado' };
  }
  return {
    title: `${found.unit.title} · Caos ordenado`,
    description: `${found.course.title}: ${found.course.summary}`,
  };
}

/** Las unidades del temario se conocen de antemano: son treinta y son fijas. */
export function generateStaticParams(): Array<{ unidad: string }> {
  return UNIT_ORDER.map((unidad) => ({ unidad }));
}

export default async function Unidad({ params }: { params: Promise<{ unidad: string }> }) {
  const { unidad } = await params;

  return (
    <AppShell>
      <UnitScreen unitId={unidad} />
    </AppShell>
  );
}
