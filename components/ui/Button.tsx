import React from 'react';
import { cn } from '@/lib/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'ghost' | 'outline' | 'ink';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles = {
  primary: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  ink: 'bg-gray-900 text-gray-50 hover:bg-gray-800 active:bg-gray-950',
  secondary: 'bg-white text-gray-900 border border-gray-300 hover:border-gray-400 hover:bg-gray-100',
  outline: 'bg-transparent text-gray-900 border border-gray-300 hover:border-gray-400 hover:bg-gray-100',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-200/60 hover:text-gray-900',
  accent: 'bg-gray-900 text-gray-50 hover:bg-gray-800',
  success: 'bg-success-600 text-white hover:bg-success-700',
  warning: 'bg-warning-500 text-white hover:bg-warning-600',
  error: 'bg-red-600 text-white hover:bg-red-700',
};

const sizeStyles = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-[15px] gap-2',
  xl: 'h-14 px-7 text-base gap-2.5',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium tracking-[-0.01em] transition-colors duration-150 select-none',
        'disabled:pointer-events-none disabled:opacity-45',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" aria-hidden />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
