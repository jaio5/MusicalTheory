import type { Metadata } from 'next';

import { TuneScreen } from '../../screens/TuneScreen';

export const metadata: Metadata = {
  title: 'Afinar · Caos ordenado',
  description:
    'Afinador por micrófono con ocho afinaciones: estándar, drop D, DADGAD, open G y más.',
};

export default function Afinar() {
  return <TuneScreen />;
}
