import type { Metadata } from 'next';

import { AppShell } from '../../AppShell';
import { ReviewScreen } from '../../screens';

export const metadata: Metadata = {
  title: 'Repaso · Caos ordenado',
  description: 'Lo que fallaste, otra vez y en la tonalidad en la que estés ahora.',
};

export default function Repaso() {
  return (
    <AppShell>
      <ReviewScreen />
    </AppShell>
  );
}
