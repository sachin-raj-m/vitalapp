import React from 'react';
import { Metadata } from 'next';
import { ChangelogClient } from './components/ChangelogClient';

export const metadata: Metadata = {
    title: 'Changelog | Vital Blood Donation',
    description: 'See the latest updates, features, and improvements to the VitalApp platform.',
};

export default function ChangelogPage() {
    return (
        <div className="min-h-screen py-10 bg-gray-50/50">
            <ChangelogClient />
        </div>
    );
}
