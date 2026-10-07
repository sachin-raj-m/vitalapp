import React from 'react';

interface AuthFrameProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

/** Shared layout for sign in, sign up and password reset. */
export function AuthFrame({ title, subtitle, children, footer }: AuthFrameProps) {
    return (
        <div className="mx-auto w-full max-w-[400px] px-5 py-14 sm:py-20 animate-fade-up">
            <h1 className="display text-4xl sm:text-[2.75rem]">{title}</h1>
            {subtitle && <p className="mt-3 leading-relaxed text-gray-600">{subtitle}</p>}
            {children && <div className="mt-9">{children}</div>}
            {footer && <div className="mt-8 text-sm text-gray-600">{footer}</div>}
        </div>
    );
}

export const authLinkClass =
    'font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 transition-colors hover:decoration-gray-900';
