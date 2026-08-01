import type { Metadata } from 'next';

import { AppShell } from '../AppShell';
import { RegisterScreen } from '../screens';

export const metadata: Metadata = {
  title: 'Crear tu cuenta · Caos ordenado',
  description:
    'Crea tu cuenta para llevarte el avance a otro aparato y usar la IA. Sin cuenta la aplicación funciona igual, con el avance guardado en tu navegador.',
};

export default function Registro() {
  return (
    <AppShell>
      <RegisterScreen />
    </AppShell>
  );
}
