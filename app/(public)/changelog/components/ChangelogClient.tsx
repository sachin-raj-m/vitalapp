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
            <p className="eyebrow">Changelog</p>
            <h1 className="display mt-4 text-5xl leading-none sm:text-7xl">What’s <em>new.</em></h1>

            {entries.length === 0 ? (
                <p className="mt-12 text-gray-600">Nothing logged yet.</p>
            ) : (
                <ol className="mt-16 border-t border-gray-200">
                    {entries.map(entry => (
                        <li key={entry.version} className="grid gap-4 border-b border-gray-200 py-10 sm:grid-cols-4 sm:gap-10">
                            <div className="font-mono text-xs text-gray-500">
                                <span className={entry.type === 'major' ? 'text-red-600' : 'text-gray-900'}>v{entry.version}</span>
                                <br />
                                {format(parseISO(entry.date), 'd MMM yyyy')}
                            </div>
                            <div className="sm:col-span-3">
                                <h2 className="text-xl font-medium tracking-tight text-gray-900">{entry.title}</h2>
                                <p className="mt-2 leading-relaxed text-gray-600">{entry.description}</p>
                                {entry.changes.length > 0 && (
                                    <ul className="mt-5 space-y-2">
                                        {entry.changes.map((change, i) => (
                                            <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-gray-700">
                                                <span className="mt-[0.7em] h-px w-3 shrink-0 bg-gray-400" />
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
