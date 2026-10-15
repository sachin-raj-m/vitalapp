"use client";

import React from 'react';
import { CountUp } from '@/components/landing/CountUp';
import { formatCount, type PublicStats } from '@/lib/public-stats';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * "Recorded on Vital so far". Zeros are left out rather than shown, and a
 * figure that would only repeat another one (all donors available, every
 * helped request fulfilled) is skipped, so a young network still reads well.
 */
export function NetworkNumbers({ stats }: { stats: PublicStats }) {
    const s = stats;
    const items = [
        { key: 'fulfilled', value: s.fulfilled, label: plural(s.fulfilled, 'Request fulfilled', 'Requests fulfilled') },
        {
            key: 'helped',
            value: s.requests_helped > s.fulfilled ? s.requests_helped : 0,
            label: plural(s.requests_helped, 'Request helped, fully or in part', 'Requests helped, fully or in part'),
        },
        { key: 'open', value: s.open, label: plural(s.open, 'Request open now', 'Requests open now') },
        { key: 'donors', value: s.donors, label: plural(s.donors, 'Registered donor', 'Registered donors') },
        {
            key: 'available',
            value: s.available_donors < s.donors ? s.available_donors : 0,
            label: plural(s.available_donors, 'Donor available now', 'Donors available now'),
        },
        { key: 'members', value: s.members, label: plural(s.members, 'Member', 'Members') },
        { key: 'cities', value: s.cities, label: plural(s.cities, 'City with donors', 'Cities with donors') },
    ].filter(item => item.value > 0);

    const units = s.units_donated;
    if (!units && items.length === 0) return null;

    return (
        <section aria-labelledby="network-numbers" className="mt-20 border-t border-gray-200 pt-12 lg:pt-14">
            <h2 id="network-numbers" className="display text-3xl sm:text-4xl">Recorded on Vital so far</h2>

            <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-16">
                {units > 0 && (
                    <div className="lg:col-span-5">
                        <p className="font-serif text-7xl font-semibold leading-none text-red-600 sm:text-8xl">
                            <CountUp value={units} />
                        </p>
                        <p className="mt-4 max-w-xs font-serif text-2xl font-medium leading-snug text-gray-900 [text-wrap:balance]">
                            {plural(units, 'unit of blood donated through Vital', 'units of blood donated through Vital')}
                        </p>
                        {s.donations_completed > 0 && (
                            <p className="mt-3 text-sm text-gray-600">
                                From {formatCount(s.donations_completed)}{' '}
                                {plural(s.donations_completed, 'donation', 'donations')} confirmed with the donor’s PIN
                                {s.requests_with_donation > 0 && (
                                    <>
                                        , for {formatCount(s.requests_with_donation)}{' '}
                                        {plural(s.requests_with_donation, 'request', 'requests')}
                                    </>
                                )}
                                .
                            </p>
                        )}
                    </div>
                )}

                {items.length > 0 && (
                    <dl className={`grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 ${units > 0 ? 'lg:col-span-7' : 'lg:col-span-12 lg:grid-cols-4'}`}>
                        {items.map(item => (
                            <div key={item.key} className="flex flex-col-reverse justify-end border-t border-gray-200 pt-4">
                                <dt className="mt-2 text-sm leading-snug text-gray-600">{item.label}</dt>
                                <dd className="font-serif text-4xl font-semibold leading-none text-gray-900 sm:text-5xl">
                                    <CountUp value={item.value} />
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>

            <p className="mt-12 max-w-2xl text-sm leading-relaxed text-gray-600">
                These are totals recorded in the app. A donation is counted when the person who posted the
                request enters the donor’s PIN; Vital does not check donations with the hospital or blood
                bank. Members are accounts that have finished registering. The numbers update every few minutes.
            </p>
        </section>
    );
}
