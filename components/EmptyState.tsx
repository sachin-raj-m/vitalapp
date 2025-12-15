import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './ui/Button';

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
}) => {
    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 text-center bg-white rounded-lg border border-gray-100 shadow-sm ${className || ''}`}>
            <div className="bg-primary-50 p-4 rounded-full mb-4">
                <Icon className="h-8 w-8 text-primary-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {title}
            </h3>
            <p className="text-gray-500 text-sm max-w-sm mb-6 leading-relaxed">
                {description}
            </p>
            {actionLabel && onAction && (
                <Button onClick={onAction} variant="primary">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};
