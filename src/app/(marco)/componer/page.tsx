import type { Metadata } from 'next';

import { ComposeScreen } from '../../screens/ComposeScreen';

export const metadata: Metadata = {
  title: 'Componer',
  description:
    'Elige tonalidad, encadena acordes, mira cómo se hacen por todo el mástil y grábate tocando.',
};

export default function Componer() {
  return <ComposeScreen />;
}
