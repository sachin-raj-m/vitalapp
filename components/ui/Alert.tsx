import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface AlertProps {
  title?: string;
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  onClose?: () => void;
  className?: string;
}

const variantStyles = {
  info: 'border-gray-900 bg-white text-gray-800',
  success: 'border-success-600 bg-success-50 text-success-800',
  warning: 'border-warning-500 bg-warning-50 text-warning-800',
  error: 'border-red-600 bg-red-50 text-red-800',
};

export const Alert: React.FC<AlertProps> = ({
  title,
  children,
  variant = 'info',
  onClose,
  className,
}) => (
  <div
    role={variant === 'error' ? 'alert' : 'status'}
    className={cn('flex items-start gap-3 rounded-md border-l-2 px-4 py-3 text-sm', variantStyles[variant], className)}
  >
    <div className="flex-1 leading-relaxed">
      {title && <p className="font-medium">{title}</p>}
      <div className={title ? 'mt-1 opacity-90' : ''}>{children}</div>
    </div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        className="-mr-1 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);
