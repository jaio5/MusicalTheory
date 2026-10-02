import type { Metadata } from 'next';

import { PlansScreen } from '../../screens/PlansScreen';

export const metadata: Metadata = {
  title: 'Planes · Caos ordenado',
  description:
    'Tres planes: Básico, Medio y Pro. La guitarra es gratis; lo que se paga es la IA y el Grado Profesional.',
};

export default function Planes() {
  return <PlansScreen />;
}
