import type { Metadata } from 'next';

import { AppShell } from '../AppShell';
import { PathScreen } from '../screens';

export const metadata: Metadata = {
  title: 'Aprender · Caos ordenado',
  description: 'El camino: diez cursos en dos grados, y puedes empezar por el nivel que quieras.',
};

export default function Aprender() {
  return (
    <AppShell>
      <PathScreen />
    </AppShell>
  );
}
