import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', 'reference/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    // Regla 1 de ARCHITECTURE.md: el dominio no conoce el navegador ni las
    // capas de arriba. Si un import de core/ apunta fuera de core/, la pieza
    // está en el sitio equivocado.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@audio/*', '@media/*', '@state/*', '@features/*', '@ui/*', '@/app/*'],
              message: 'src/core/ no puede importar de otras capas: es TypeScript puro.',
            },
          ],
        },
      ],
    },
  },
  {
    // Regla 3: un feature no importa de otro feature.
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@features/*/*'],
              message:
                'Un feature no importa de otro feature. Lo compartido sube a core/, ui/ o state/.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
