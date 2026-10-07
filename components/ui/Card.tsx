import React from 'react';
import { cn } from '@/lib/cn';

interface SlotProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<SlotProps> = ({ children, className }) => (
  <div className={cn('rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)]', className)}>
    {children}
  </div>
);

export const CardHeader: React.FC<SlotProps> = ({ children, className }) => (
  <div className={cn('border-b border-gray-200 px-5 py-4 sm:px-6', className)}>
    {children}
  </div>
);

export const CardBody: React.FC<SlotProps> = ({ children, className }) => (
  <div className={cn('px-5 py-5 sm:px-6', className)}>
    {children}
  </div>
);

export const CardFooter: React.FC<SlotProps> = ({ children, className }) => (
  <div className={cn('border-t border-gray-200 px-5 py-4 sm:px-6', className)}>
    {children}
  </div>
);
