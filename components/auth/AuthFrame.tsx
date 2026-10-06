import React from 'react';

interface AuthFrameProps {
    eyebrow: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

/** Shared layout for sign in, sign up and password reset. */
export function AuthFrame({ eyebrow, title, subtitle, children, footer }: AuthFrameProps) {
    return (
        <div className="mx-auto w-full max-w-[400px] px-5 py-14 sm:py-20 animate-fade-up">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display mt-4 text-5xl leading-[1]">{title}</h1>
            {subtitle && <p className="mt-4 leading-relaxed text-gray-600">{subtitle}</p>}
            <div className="mt-10">{children}</div>
            {footer && <div className="mt-10 border-t border-gray-200 pt-6 text-sm text-gray-600">{footer}</div>}
        </div>
    );
}

export const authLinkClass =
    'font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 transition-colors hover:decoration-gray-900';
