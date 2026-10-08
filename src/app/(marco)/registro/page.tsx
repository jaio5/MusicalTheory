import type { Metadata } from 'next';

import { RegisterScreen } from '../../screens/RegisterScreen';

export const metadata: Metadata = {
  title: 'Crear tu cuenta',
  description:
    'Crea tu cuenta para llevarte el avance a otro aparato y usar la IA. Sin cuenta la aplicación funciona igual, con el avance guardado en tu navegador.',
};

export default function Registro() {
  return <RegisterScreen />;
}
