import React from 'react';
import Image from 'next/image';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full';

  const variantStyles = {
    primary: 'bg-primary-100 text-primary-800',
    secondary: 'bg-secondary-100 text-secondary-800',
    accent: 'bg-accent-100 text-accent-800',
    success: 'bg-success-100 text-success-800',
    warning: 'bg-warning-100 text-warning-800',
    error: 'bg-error-100 text-error-800',
    neutral: 'bg-gray-100 text-gray-800',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base',
  };

  const badgeClasses = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${className}
  `;

  return (
    <span className={badgeClasses}>
      {children}
    </span>
  );
};

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
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className={`
        relative w-16 h-16 rounded-full overflow-hidden mb-2
        ${!unlocked ? 'opacity-40 grayscale' : ''}
      `}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-500">?</span>
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-center">{name}</p>
      <Badge
        variant={unlocked ? "success" : "neutral"}
        size="sm"
        className="mt-1"
      >
        {points} pts
      </Badge>
    </div>
  );
};