import React from 'react';
import { format, parseISO } from 'date-fns';

export interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    description: string;
    changes: string[];
    type: 'major' | 'minor' | 'patch';
}

export const ChangelogClient = ({ data }: { data: ChangelogEntry[] }) => {
    const entries = [...(data || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
            <h1 className="display text-5xl sm:text-6xl">Changelog</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">Changes and improvements to Vital, newest first.</p>

            {entries.length === 0 ? (
                <p className="mt-12 text-gray-600">Nothing logged yet.</p>
            ) : (
                <ol className="mt-16 space-y-14 sm:mt-20 sm:space-y-16">
                    {entries.map(entry => (
                        <li key={entry.version} className="grid gap-3 sm:grid-cols-4 sm:gap-10">
                            <div className="text-sm text-gray-500">
                                <time dateTime={entry.date}>{format(parseISO(entry.date), 'd MMMM yyyy')}</time>
                                <span className="block text-gray-500">Version {entry.version}</span>
                            </div>
                            <div className="sm:col-span-3">
                                <h2 className="font-serif text-2xl font-medium leading-tight text-gray-900">{entry.title}</h2>
                                <p className="mt-2 leading-relaxed text-gray-600">{entry.description}</p>
                                {entry.changes.length > 0 && (
                                    <ul className="mt-5 space-y-2">
                                        {entry.changes.map((change, i) => (
                                            <li key={i} className="relative pl-5 text-[15px] leading-relaxed text-gray-700 before:absolute before:left-0 before:top-[0.75em] before:h-px before:w-2.5 before:bg-gray-400">
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};
