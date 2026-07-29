import type { Metadata } from 'next';

import { AppShell } from '../AppShell';
import { LearnScreen } from '../screens';

export const metadata: Metadata = {
  title: 'Aprender · Caos ordenado',
  description:
    'Teoría a base de preguntas en la tonalidad que estás tocando, con un profesor al lado.',
};

export default function Aprender() {
  return (
    <AppShell>
      <LearnScreen />
    </AppShell>
  );
}
