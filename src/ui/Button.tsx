import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'quiet';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

const BASE =
  'inline-flex items-center justify-center rounded-md px-5 py-2.5 text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brass text-background hover:bg-brass-bright',
  quiet: 'border border-border text-text hover:border-brass-dim hover:text-brass-bright',
};

export function Button({ variant = 'primary', className = '', type, ...props }: ButtonProps) {
  return (
    <button
      // Sin esto, un botón dentro de un formulario lo enviaría sin querer.
      type={type ?? 'button'}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
