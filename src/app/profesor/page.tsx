import type { Metadata } from 'next';

import { AppShell } from '../AppShell';
import { TeacherScreen } from '../screens';

export const metadata: Metadata = {
  title: 'Profesor · Caos ordenado',
  description: 'Pregunta lo que quieras de teoría y te lo explica con los acordes de tu tonalidad.',
};

export default function Profesor() {
  return (
    <AppShell>
      <TeacherScreen />
    </AppShell>
  );
}
