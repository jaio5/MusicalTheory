import type { Metadata } from 'next';

import { ReviewScreen } from '../../../screens/ReviewScreen';

export const metadata: Metadata = {
  title: 'Repaso · Caos ordenado',
  description: 'Lo que fallaste, otra vez y en la tonalidad en la que estés ahora.',
};

export default function Repaso() {
  return <ReviewScreen />;
}
