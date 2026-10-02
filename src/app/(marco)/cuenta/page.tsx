import type { Metadata } from 'next';

import { AccountScreen } from '../../screens/AccountScreen';

export const metadata: Metadata = {
  title: 'Tu cuenta · Caos ordenado',
  description:
    'Entra, crea una cuenta o cambia de plan. La guitarra es gratis; lo que cuesta es la IA.',
};

export default function Cuenta() {
  return <AccountScreen />;
}
