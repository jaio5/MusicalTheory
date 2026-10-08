import type { Metadata } from 'next';

import { PlansScreen } from '../../screens/PlansScreen';

export const metadata: Metadata = {
  title: 'Planes',
  description:
    'Dos planes de pago, Básico y Medio, al mes o al año. La guitarra es gratis; lo que se paga es la IA y el Grado Profesional.',
};

export default function Planes() {
  return <PlansScreen />;
}
