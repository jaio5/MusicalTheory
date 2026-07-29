import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Caos ordenado',
  description:
    'Escucha la guitarra por el micro, afina, enseña la escala sobre el mástil y detecta la tonalidad de lo que estás tocando.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
