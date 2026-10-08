import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findUnit, UNIT_ORDER } from '@core/music';

import { UnitScreen } from '../../../screens/UnitScreen';

/**
 * Una unidad por dirección.
 *
 * Con dirección propia se puede enlazar, compartir y volver atrás. Lo que **no**
 * hace esta página es decidir si se puede entrar: eso depende del avance, que vive
 * en el navegador, y del plan, que la pantalla ya sabe leer. Aquí solo se comprueba
 * que la unidad existe en el temario.
 *
 * **Y la que no existe es un 404 de verdad**, con `notFound()`. Antes llegaba
 * hasta la pantalla, que decía «esta unidad no existe» con un 200: para el
 * navegador y para un buscador era una página buena, y un enlace roto no se
 * distinguía de uno que funciona. La pantalla de la dirección que no existe ya
 * dice lo mismo y ofrece el camino.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ unidad: string }>;
}): Promise<Metadata> {
  const { unidad } = await params;
  const found = findUnit(unidad);
  if (found === null) {
    return { title: 'Unidad no encontrada' };
  }
  return {
    title: `${found.unit.title}`,
    description: `${found.course.title}: ${found.course.summary}`,
  };
}

/** Las unidades del temario se conocen de antemano: son treinta y son fijas. */
export function generateStaticParams(): Array<{ unidad: string }> {
  return UNIT_ORDER.map((unidad) => ({ unidad }));
}

export default async function Unidad({ params }: { params: Promise<{ unidad: string }> }) {
  const { unidad } = await params;
  if (findUnit(unidad) === null) {
    notFound();
  }

  return <UnitScreen unitId={unidad} />;
}
