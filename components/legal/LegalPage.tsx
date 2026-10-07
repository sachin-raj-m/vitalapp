import React from 'react';

interface LegalPageProps {
    title: React.ReactNode;
    updated: string;
    intro?: React.ReactNode;
    sections: { heading: string; body: React.ReactNode }[];
}

const slug = (s: string) =>
    s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Shared layout for privacy, terms and safety pages. */
export function LegalPage({ title, updated, intro, sections }: LegalPageProps) {
    return (
        <article className="mx-auto max-w-6xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
            <header className="max-w-2xl">
                <h1 className="display text-5xl sm:text-6xl">{title}</h1>
                <p className="mt-4 text-sm text-gray-500">Last updated {updated}</p>
                {intro && <div className="mt-8 text-lg leading-relaxed text-gray-700">{intro}</div>}
            </header>

            <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-12 lg:gap-16">
                <nav aria-label="On this page" className="lg:col-span-3">
                    <div className="lg:sticky lg:top-24">
                        <p className="text-sm font-semibold text-gray-900">On this page</p>
                        <ul className="mt-3 space-y-2 text-sm">
                            {sections.map(section => (
                                <li key={section.heading}>
                                    <a href={`#${slug(section.heading)}`} className="text-gray-600 transition-colors hover:text-gray-900">
                                        {section.heading}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </nav>

                <div className="max-w-2xl space-y-12 lg:col-span-9">
                    {sections.map(section => (
                        <section key={section.heading} id={slug(section.heading)} className="scroll-mt-24">
                            <h2 className="font-serif text-2xl font-medium leading-tight text-gray-900 sm:text-[1.75rem]">
                                {section.heading}
                            </h2>
                            <div className="legal-body mt-4 space-y-4 text-[15px] leading-relaxed text-gray-700">
                                {section.body}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </article>
    );
}
