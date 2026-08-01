import type { Metadata } from 'next';

import { AppShell } from '../AppShell';
import { AccountScreen } from '../screens';

export const metadata: Metadata = {
  title: 'Tu cuenta · Caos ordenado',
  description:
    'Entra, crea una cuenta o cambia de plan. La guitarra es gratis; lo que cuesta es la IA.',
};

export default function Cuenta() {
  return (
    <AppShell>
      <AccountScreen />
    </AppShell>
  );
}
