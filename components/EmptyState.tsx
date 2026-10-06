import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    className
}) => (
    <div className={cn('flex flex-col items-center rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center', className)}>
        <Icon className="mb-4 h-5 w-5 text-gray-400" strokeWidth={1.75} />
        <h3 className="text-[15px] font-medium text-gray-900">{title}</h3>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-gray-500">{description}</p>
        {actionLabel && onAction && (
            <Button onClick={onAction} variant="secondary" size="sm" className="mt-5">
                {actionLabel}
            </Button>
        )}
    </div>
);
