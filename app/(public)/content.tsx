"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { BloodTypeExplorer } from '@/components/landing/BloodTypeExplorer';

interface NetworkStats {
    donors: number | null;
    open: number | null;
    fulfilled: number | null;
}

const STEPS = [
    {
        title: 'A request goes up',
        body: 'A patient’s family or a hospital posts the blood group, units needed and the hospital. It takes about a minute.',
    },
    {
        title: 'Nearby donors are alerted',
        body: 'Registered donors in the same city whose blood group is compatible get a push notification and an email straight away.',
    },
    {
        title: 'Someone shows up',
        body: 'A donor offers, gets the family’s contact, and donates at the hospital. The family confirms it with the donor’s PIN.',
    },
];

const PRINCIPLES = [
    { title: 'Nobody is paid.', body: 'Vital is voluntary and non-remunerated. If anyone asks a donor for money, or offers it, that’s a reason to walk away and report it.' },
    { title: 'Donors rest.', body: 'Vital tracks each donor’s recovery window (90 days for men, 120 for women) and shows when they’re ready to give again.' },
    { title: 'Numbers stay private.', body: 'Your phone number is shared only with the family you choose to help, and only after you offer.' },
    { title: 'A check before every offer.', body: 'Before each offer, donors confirm they’re well and haven’t recently had antibiotics, alcohol, a tattoo or an infection.' },
];

const FAQ = [
    { q: 'Who can register as a donor?', a: 'Anyone between 18 and 65 who weighs over 45 kg and is in good health. Registration walks you through the basics.' },
    { q: 'Is my personal data safe?', a: 'Your contact details are never listed publicly. They’re shared only with a family after you offer to donate for their request.' },
    { q: 'How often can I donate?', a: 'Following NBTC guidelines, men can donate every 3 months and women every 4. Vital tracks this for you.' },
    { q: 'Do I get paid for donating?', a: 'No. Vital is fully voluntary. Blood donation in India is non-remunerated by law, and that’s the point.' },
];

const formatCount = (n: number | null) => (n === null ? '—' : n.toLocaleString('en-IN'));

export default function HomePage() {
    const [stats, setStats] = useState<NetworkStats>({ donors: null, open: null, fulfilled: null });

    useEffect(() => {
        // One RPC so guests get real totals (RLS hides fulfilled requests from them).
        supabase
            .rpc('public_stats')
            .then(({ data, error }) => {
                if (error || !data) return;
                setStats({ donors: data.donors ?? null, open: data.open ?? null, fulfilled: data.fulfilled ?? null });
            });
    }, []);

    const handleShare = async () => {
        const url = window.location.origin;
        const shareData = {
            title: 'Vital',
            text: 'Vital connects blood donors with patients nearby. Free and voluntary. Worth signing up.',
            url,
        };
        if (navigator.share) {
            try { await navigator.share(shareData); } catch { /* dismissed */ }
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            toast.success('Link copied');
        } catch {
            toast.error('Couldn’t copy the link');
        }
    };

    // Only show numbers that exist and aren't zero; a lone "0 fulfilled" undersells the network.
    const showNetwork = !!(stats.donors || stats.open || stats.fulfilled);

    return (
        <div>
            {/* ---------- Hero ---------- */}
            <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:pb-28">
                {stats.open !== null && stats.open > 0 && (
                    <Link
                        href="/requests"
                        className="mb-10 inline-flex items-center gap-2.5 rounded-full border border-gray-300 bg-white py-1.5 pl-3 pr-4 text-[13px] text-gray-700 transition-colors animate-fade-up hover:border-gray-400"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 animate-beat" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                        </span>
                        {stats.open} open {stats.open === 1 ? 'request' : 'requests'} right now
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    </Link>
                )}

                <h1 className="display max-w-5xl text-[3.25rem] leading-[0.95] animate-fade-up sm:text-7xl lg:text-[7.5rem]">
                    Someone near you will need blood <em className="text-red-600">today.</em>
                </h1>

                <div className="mt-10 grid gap-10 animate-fade-up [animation-delay:120ms] lg:mt-14 lg:grid-cols-12">
                    <p className="max-w-xl text-lg leading-relaxed text-gray-600 lg:col-span-6 lg:text-xl">
                        Vital alerts nearby, eligible donors the moment a request goes up, so families
                        aren’t left forwarding messages and calling strangers. It’s free, voluntary, and
                        nobody’s number gets passed around.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row lg:col-span-6 lg:items-end lg:justify-end">
                        <Link
                            href="/register"
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-red-600 px-6 text-[15px] font-medium text-white transition-colors hover:bg-red-700"
                        >
                            Become a donor <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="/requests/new"
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-6 text-[15px] font-medium text-gray-900 transition-colors hover:border-gray-400"
                        >
                            <Plus className="h-4 w-4" /> Request blood
                        </Link>
                    </div>
                </div>
            </section>

            {/* ---------- Compatibility (the pause) ---------- */}
            <section className="bg-gray-950 text-gray-50" id="compatibility">
                <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
                    <div className="lg:col-span-4">
                        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">Compatibility</p>
                        <h2 className="mt-4 font-serif text-5xl leading-[1] tracking-tight sm:text-6xl">
                            Pick your <em className="text-red-500">type.</em>
                        </h2>
                        <p className="mt-6 max-w-sm leading-relaxed text-gray-400">
                            Whatever your blood group, there’s someone only you can help. Vital
                            matches on this table, so you only hear about requests your blood can answer.
                        </p>
                    </div>
                    <div className="lg:col-span-8">
                        <BloodTypeExplorer />
                    </div>
                </div>
            </section>

            {/* ---------- How it works ---------- */}
            <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28" id="how-it-works">
                <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                    <h2 className="display text-5xl leading-none sm:text-6xl">How it works</h2>
                    <Link href="/how-it-works" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                        The details <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                <ol className="mt-14 grid gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 md:grid-cols-3">
                    {STEPS.map((step, i) => (
                        <li key={step.title} className="bg-paper p-6 sm:p-8">
                            <span className="font-mono text-xs text-red-600">0{i + 1}</span>
                            <h3 className="mt-10 text-xl font-medium tracking-tight text-gray-900">{step.title}</h3>
                            <p className="mt-3 leading-relaxed text-gray-600">{step.body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            {/* ---------- Network numbers ---------- */}
            {showNetwork && (
                <section className="border-y border-gray-200 bg-white">
                    <dl className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-gray-200 px-5 sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0 sm:px-8">
                        {[
                            { label: 'Registered donors', value: stats.donors },
                            { label: 'Requests open now', value: stats.open },
                            { label: 'Requests fulfilled', value: stats.fulfilled },
                        ].filter(item => item.value).map(item => (
                            <div key={item.label} className="py-8 sm:px-8 sm:first:pl-0">
                                <dt className="eyebrow">{item.label}</dt>
                                <dd className="mt-3 font-serif text-6xl leading-none tracking-tight text-gray-900">{formatCount(item.value)}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}

            {/* ---------- Principles ---------- */}
            <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28" id="safety">
                <div className="grid gap-12 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <p className="eyebrow">Ground rules</p>
                        <h2 className="display mt-4 text-5xl leading-[1] sm:text-6xl">
                            Built so donors <em>come back.</em>
                        </h2>
                        <Link href="/safety-guidelines" className="mt-6 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
                            Safety guidelines <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <dl className="divide-y divide-gray-200 border-y border-gray-200 lg:col-span-8">
                        {PRINCIPLES.map(p => (
                            <div key={p.title} className="grid gap-2 py-6 sm:grid-cols-3 sm:gap-8">
                                <dt className="font-medium text-gray-900">{p.title}</dt>
                                <dd className="leading-relaxed text-gray-600 sm:col-span-2">{p.body}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            {/* ---------- FAQ ---------- */}
            <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:pb-28">
                <div className="grid gap-12 lg:grid-cols-12">
                    <h2 className="display text-4xl leading-none sm:text-5xl lg:col-span-4">Questions</h2>
                    <div className="divide-y divide-gray-200 border-y border-gray-200 lg:col-span-8">
                        {FAQ.map(item => (
                            <details key={item.q} className="group">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] text-gray-900">
                                    {item.q}
                                    <Plus className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-45" />
                                </summary>
                                <p className="max-w-2xl pb-6 leading-relaxed text-gray-600">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------- Closing ---------- */}
            <section className="bg-red-600 text-white">
                <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-24">
                    <h2 className="max-w-3xl font-serif text-5xl leading-[1] tracking-tight sm:text-7xl">
                        Two minutes to sign up. <span className="text-red-200">An hour, a few times a year, to show up.</span>
                    </h2>
                    <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
                        <Link
                            href="/register"
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-[15px] font-medium text-red-700 transition-colors hover:bg-red-50"
                        >
                            Become a donor <ArrowRight className="h-4 w-4" />
                        </Link>
                        <button
                            onClick={handleShare}
                            className="inline-flex h-12 items-center justify-center rounded-md border border-red-400 px-6 text-[15px] font-medium text-white transition-colors hover:bg-red-700"
                        >
                            Share Vital
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
