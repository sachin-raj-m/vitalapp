import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

interface AlertProps {
  title?: string;
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  title,
  children,
  variant = 'info',
  onClose,
  className = '',
}) => {
  const baseStyles = 'rounded-md p-4';
  
  const variantStyles = {
    info: 'bg-blue-50 text-blue-800',
    success: 'bg-green-50 text-green-800',
    warning: 'bg-yellow-50 text-yellow-800',
    error: 'bg-red-50 text-red-800',
  };
  
  const icons = {
    info: <Info className="h-5 w-5 text-blue-400" />,
    success: <CheckCircle className="h-5 w-5 text-green-400" />,
    warning: <AlertCircle className="h-5 w-5 text-yellow-400" />,
    error: <AlertCircle className="h-5 w-5 text-red-400" />,
  };

  const alertClasses = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${className}
  `;

  return (
    <div className={alertClasses}>
      <div className="flex">
        <div className="flex-shrink-0">
          {icons[variant]}
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className="text-sm font-medium">
              {title}
            </h3>
          )}
          <div className={`text-sm ${title ? 'mt-2' : ''}`}>
            {children}
          </div>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onClose}
                className={`
                  inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${variant === 'info' ? 'text-blue-500 hover:bg-blue-100 focus:ring-blue-600' : ''}
                  ${variant === 'success' ? 'text-green-500 hover:bg-green-100 focus:ring-green-600' : ''}
                  ${variant === 'warning' ? 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600' : ''}
                  ${variant === 'error' ? 'text-red-500 hover:bg-red-100 focus:ring-red-600' : ''}
                `}
              >
                <span className="sr-only">Dismiss</span>
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};