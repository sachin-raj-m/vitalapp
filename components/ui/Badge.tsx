import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantStyles = {
  primary: 'bg-red-50 text-red-700 ring-red-200',
  error: 'bg-red-50 text-red-700 ring-red-200',
  secondary: 'bg-gray-100 text-gray-700 ring-gray-200',
  accent: 'bg-gray-900 text-gray-50 ring-gray-900',
  success: 'bg-success-50 text-success-700 ring-success-200',
  warning: 'bg-warning-50 text-warning-700 ring-warning-200',
  neutral: 'bg-gray-100 text-gray-600 ring-gray-200',
};

const sizeStyles = {
  sm: 'px-1.5 py-px text-[11px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
      variantStyles[variant],
      sizeStyles[size],
      className,
    )}
  >
    {children}
  </span>
);

interface AchievementBadgeProps {
  name: string;
  imageUrl: string;
  points: number;
  unlocked?: boolean;
  className?: string;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  name,
  imageUrl,
  points,
  unlocked = false,
  className,
}) => (
  <div className={cn('flex flex-col items-center', className)}>
    <div className={cn('relative mb-2 h-16 w-16 overflow-hidden rounded-full', !unlocked && 'opacity-40 grayscale')}>
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill className="object-cover" sizes="64px" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-200">
          <span className="text-gray-500">?</span>
        </div>
      )}
    </div>
    <p className="text-center text-sm font-medium">{name}</p>
    <Badge variant={unlocked ? 'success' : 'neutral'} size="sm" className="mt-1">
      {points} pts
    </Badge>
  </div>
);
