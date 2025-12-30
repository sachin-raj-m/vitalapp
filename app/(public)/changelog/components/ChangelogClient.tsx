'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import { Calendar, CheckCircle2, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    description: string;
    changes: string[];
    type: 'major' | 'minor' | 'patch';
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.4
        }
    }
};

export const ChangelogClient = ({ data }: { data: ChangelogEntry[] }) => {
    const getVariant = (type: ChangelogEntry['type']) => {
        switch (type) {
            case 'major': return 'primary';
            case 'minor': return 'secondary';
            case 'patch': return 'neutral';
            default: return 'neutral';
        }
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="bg-gray-100 p-4 rounded-full mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">No updates yet</h2>
                <p className="text-gray-500 mt-2 max-w-sm">
                    We're working on something great. Check back later for updates!
                </p>
            </div>
        );
    }

    // Group data by date
    const groupedData = data.reduce((acc, entry) => {
        if (!acc[entry.date]) {
            acc[entry.date] = [];
        }
        acc[entry.date].push(entry);
        return acc;
    }, {} as Record<string, ChangelogEntry[]>);

    const sortedDates = Object.keys(groupedData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                    Changelog
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Track our journey as we improve VitalApp to help save more lives.
                </p>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="relative border-l-2 border-gray-100 ml-4 md:ml-6 space-y-12"
            >
                {sortedDates.map((date) => (
                    <div key={date} className="relative pl-8 md:pl-12">
                        {/* Timeline Date Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center mb-6">
                            {/* Timeline Dot */}
                            <span className="absolute -left-[9px] top-1.5 flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white bg-gray-200" />

                            <time className="text-lg font-bold text-gray-900 flex items-center">
                                <Calendar className="w-5 h-5 mr-2 text-gray-500" />
                                {format(parseISO(date), 'MMMM d, yyyy')}
                            </time>
                        </div>

                        {/* Versions for this date */}
                        <div className="space-y-8">
                            {groupedData[date].map((entry) => (
                                <motion.div
                                    key={entry.version}
                                    variants={itemVariants}
                                    className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <h2 className="text-xl font-bold text-gray-900">
                                            v{entry.version}
                                        </h2>
                                        <Badge variant={getVariant(entry.type)} size="sm">
                                            {entry.type}
                                        </Badge>
                                    </div>

                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        {entry.title}
                                    </h3>
                                    <p className="text-gray-600 mb-6">
                                        {entry.description}
                                    </p>

                                    <ul className="grid gap-3">
                                        {entry.changes.map((change, i) => (
                                            <li key={i} className="flex items-start text-gray-700">
                                                <div className="mt-1 mr-3 flex-shrink-0">
                                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                </div>
                                                <span className="text-sm leading-relaxed">{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ))}
            </motion.div>
        </div>
    );
};
