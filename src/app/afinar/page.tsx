import type { Metadata } from 'next';

import { AppShell } from '../AppShell';
import { TuneScreen } from '../screens';

export const metadata: Metadata = {
  title: 'Afinar · Caos ordenado',
  description:
    'Afinador por micrófono con ocho afinaciones: estándar, drop D, DADGAD, open G y más.',
};

export default function Afinar() {
  return (
    <AppShell>
      <TuneScreen />
    </AppShell>
  );
}
