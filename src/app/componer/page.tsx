import type { Metadata } from 'next';

import { AppShell } from '../AppShell';
import { ComposeScreen } from '../screens';

export const metadata: Metadata = {
  title: 'Componer · Caos ordenado',
  description:
    'Elige tonalidad, encadena acordes, mira cómo se hacen por todo el mástil y grábate tocando.',
};

export default function Componer() {
  return (
    <AppShell>
      <ComposeScreen />
    </AppShell>
  );
}
