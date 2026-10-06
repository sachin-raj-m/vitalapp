import React from 'react';

interface LegalPageProps {
    eyebrow: string;
    title: React.ReactNode;
    updated: string;
    intro?: React.ReactNode;
    sections: { heading: string; body: React.ReactNode }[];
}

/** Shared layout for privacy, terms and safety pages. */
export function LegalPage({ eyebrow, title, updated, intro, sections }: LegalPageProps) {
    return (
        <article className="mx-auto max-w-6xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display mt-4 max-w-3xl text-5xl leading-[1] sm:text-6xl">{title}</h1>
            <p className="mt-4 font-mono text-xs text-gray-500">Last updated {updated}</p>
            {intro && <div className="mt-8 max-w-2xl text-lg leading-relaxed text-gray-700">{intro}</div>}

            <div className="mt-14 border-t border-gray-200">
                {sections.map((section, i) => (
                    <section key={section.heading} className="grid gap-4 border-b border-gray-200 py-10 lg:grid-cols-12 lg:gap-10">
                        <h2 className="text-lg font-medium tracking-tight text-gray-900 lg:col-span-4">
                            <span className="mr-3 font-mono text-xs text-red-600">{String(i + 1).padStart(2, '0')}</span>
                            {section.heading}
                        </h2>
                        <div className="legal-body max-w-2xl space-y-4 text-[15px] leading-relaxed text-gray-700 lg:col-span-8">
                            {section.body}
                        </div>
                    </section>
                ))}
            </div>
        </article>
    );
}
