import type { Metadata } from 'next';

import { TeacherScreen } from '../../screens/TeacherScreen';

export const metadata: Metadata = {
  title: 'Profesor · Caos ordenado',
  description: 'Pregunta lo que quieras de teoría y te lo explica con los acordes de tu tonalidad.',
};

export default function Profesor() {
  return <TeacherScreen />;
}
