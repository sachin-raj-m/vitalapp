import React from 'react';
import { cn } from '@/lib/cn';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn('animate-pulse rounded bg-gray-200/80', className)} />
);
