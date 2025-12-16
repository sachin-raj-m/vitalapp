import React from 'react';

interface SkeletonProps {
    className?: string;
    // You can add more props like width, height if you want to control inline styles
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
    return (
        <div
            className={`animate-pulse bg-gray-200 rounded-md ${className || ''}`}
        />
    );
};
