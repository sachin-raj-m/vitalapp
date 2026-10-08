import React from 'react';
import { ChangelogClient, ChangelogEntry } from './components/ChangelogClient';
import { promises as fs } from 'fs';
import path from 'path';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    path: '/changelog',
    title: 'Changelog',
    description: 'What’s new in Vital.',
});

async function getChangelogData(): Promise<ChangelogEntry[]> {
    const filePath = path.join(process.cwd(), 'content', 'changelog.json');
    try {
        const fileContents = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        console.error('Error reading changelog data:', error);
        return [];
    }
}

export default async function ChangelogPage() {
    const data = await getChangelogData();

    return (
        <ChangelogClient data={data} />
    );
}
