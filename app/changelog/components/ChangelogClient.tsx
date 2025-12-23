'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CHANGELOG_DATA, ChangelogEntry } from '@/lib/changelog-data';
import { Badge } from '@/components/ui/Badge';
import { Calendar, Tag, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

export const ChangelogClient = () => {
    const getVariant = (type: ChangelogEntry['type']) => {
        switch (type) {
            case 'major': return 'primary';
            case 'minor': return 'secondary';
            case 'patch': return 'neutral';
            default: return 'neutral';
        }
    };

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
                {CHANGELOG_DATA.map((entry, index) => (
                    <motion.div
                        key={entry.version}
                        variants={itemVariants}
                        className="relative pl-8 md:pl-12"
                    >
                        {/* Timeline Dot */}
                        <span className={`absolute -left-[9px] top-1 flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white ${entry.type === 'major' ? 'bg-primary-500' :
                                entry.type === 'minor' ? 'bg-secondary-500' : 'bg-gray-400'
                            }`} />

                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-4 gap-2">
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                v{entry.version}
                                <Badge variant={getVariant(entry.type)} size="sm">
                                    {entry.type}
                                </Badge>
                            </h2>
                            <time className="text-sm font-medium text-gray-500 flex items-center">
                                <Calendar className="w-4 h-4 mr-1.5" />
                                {format(parseISO(entry.date), 'MMMM d, yyyy')}
                            </time>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
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
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};
