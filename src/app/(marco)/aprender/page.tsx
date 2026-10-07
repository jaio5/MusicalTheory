import type { Metadata } from 'next';

import { PathScreen } from '../../screens/PathScreen';

export const metadata: Metadata = {
  title: 'Aprender · Caos ordenado',
  description: 'El camino: diez cursos en dos grados, y puedes empezar por el nivel que quieras.',
};

export default function Aprender() {
  return <PathScreen />;
}
