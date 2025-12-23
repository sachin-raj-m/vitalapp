import React from 'react';
import { Metadata } from 'next';
import { ChangelogClient, ChangelogEntry } from './components/ChangelogClient';
import { promises as fs } from 'fs';
import path from 'path';

export const metadata: Metadata = {
    title: 'Changelog | Vital Blood Donation',
    description: 'See the latest updates, features, and improvements to the VitalApp platform.',
};

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
        <div className="min-h-screen py-10 bg-gray-50/50">
            <ChangelogClient data={data} />
        </div>
    );
}
