"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Info, Plus, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { GRIEVANCE_EMAIL } from '@/lib/legal';
import { BloodTypeExplorer } from '@/components/landing/BloodTypeExplorer';
import { LiveRequests } from '@/components/landing/LiveRequests';
import { CountUp } from '@/components/landing/CountUp';
import { HeartbeatLine } from '@/components/landing/HeartbeatLine';
import { Reveal } from '@/components/landing/Reveal';

interface NetworkStats {
    donors: number | null;
    open: number | null;
    fulfilled: number | null;
}

// Static class names so Tailwind generates them.
const STAT_COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

const STEPS = [
    {
        title: 'A request is posted',
        body: 'A patient’s family or the hospital enters the blood group, the number of units, the hospital and the date it is needed by.',
    },
    {
        title: 'Compatible donors nearby see it',
        body: 'Registered donors in the same city whose blood can be given to the patient get a notification and an email.',
    },
    {
        title: 'The two sides talk directly',
        body: 'A donor who wants to help offers, and the donor and the family can then call each other and decide everything between themselves. Blood is given only at a hospital or licensed blood bank.',
    },
];

const ABOUT = [
    {
        title: 'A free platform, nothing more',
        body: 'Anyone can post a blood request, and voluntary donors can see it and choose to respond. Vital does not charge or pay anyone and is not involved in any payment.',
    },
    {
        title: 'No arrangement, no guarantee',
        body: 'Vital does not arrange, supervise, verify, promote or guarantee any donation, donor or request, and makes no promises about any of them.',
    },
    {
        title: 'Your discretion, your responsibility',
        body: 'Any contact, arrangement or donation is entirely between the people involved, at their own discretion and responsibility. Blood is collected only by hospitals and licensed blood banks.',
    },
    {
        title: 'What the app itself does',
        body: 'A donor’s phone number is shown only to the family they offer to help. Before offering, donors tick a short self-declared health checklist, which Vital does not check.',
    },
];

const FAQ = [
    { q: 'Who can register as a donor?', a: 'Under NBTC guidelines, people aged 18 to 65 who weigh at least 45 kg and are in good health can usually donate. The registration form asks you to confirm this yourself. The hospital or blood bank makes the final decision.' },
    { q: 'Who can see my contact details?', a: 'Your phone number and email are never shown publicly. Your number is shown only to a family after you offer to help with their request.' },
    { q: 'How often can I donate?', a: 'Under NBTC guidelines, men can donate every three months and women every four. Vital shows when you may be eligible again, based on the donation dates you enter.' },
    { q: 'Does Vital check donors or requests?', a: 'No. Vital does not verify, arrange, supervise or guarantee any donor, request or donation. Please use your own judgement and confirm details directly with the hospital or blood bank.' },
    { q: 'Is anyone paid?', a: 'Donation is voluntary, and blood donation in India is non-remunerated by law. Vital does not charge or pay anyone and is not involved in any payment or arrangement between people.' },
    { q: 'Who actually collects the blood?', a: 'Only hospitals and licensed blood banks. Vital is not a blood bank and does not collect, test, store or supply blood.' },
];

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
            text: 'Vital is a free platform where families post blood requests and voluntary donors nearby can see them.',
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
    const networkItems = [
        { label: 'registered donors', value: stats.donors },
        { label: 'requests open now', value: stats.open },
        { label: 'requests fulfilled', value: stats.fulfilled },
    ].filter(item => item.value);

    return (
        <div>
            {/* ---------- Hero ---------- */}
            <section className="bg-white">
                <div className="mx-auto max-w-6xl px-5 pb-14 pt-14 sm:px-8 sm:pt-20 lg:pb-20 lg:pt-24">
                    <p className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-[13px] font-semibold text-red-700 animate-fade-up">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden />
                        Free and voluntary, across India
                    </p>

                    <h1 className="display mt-7 max-w-5xl text-[3.25rem] leading-[0.98] animate-fade-up sm:text-7xl lg:text-[6.75rem]">
                        Someone near you will need blood{' '}
                        <em className="relative inline-block whitespace-nowrap pb-[0.12em] text-red-600">
                            today.
                            <HeartbeatLine className="absolute inset-x-0 bottom-[-0.08em] h-[0.2em] w-full" />
                        </em>
                    </h1>

                    <div className="mt-9 max-w-xl animate-fade-up [animation-delay:120ms] lg:mt-11">
                        <p className="text-lg leading-relaxed text-gray-700 lg:text-xl">
                            Vital is a free platform where families post blood requests and voluntary
                            donors in the same city, with a compatible blood group, can see them and
                            choose to help.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/register"
                                className="press group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-red-600 px-6 text-[15px] font-semibold text-white shadow-md shadow-red-600/25 hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/30"
                            >
                                Become a donor
                                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </Link>
                            <Link
                                href="/requests/new"
                                className="press inline-flex h-12 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-6 text-[15px] font-semibold text-gray-900 hover:border-gray-900"
                            >
                                <Plus className="h-4 w-4" /> Request blood
                            </Link>
                        </div>
                        <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-gray-600">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                            <span>
                                Vital only connects people. It does not arrange, verify or guarantee
                                donations.{' '}
                                <a href="#about-vital" className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">
                                    What this means
                                </a>
                            </span>
                        </p>
                    </div>
                </div>

                <div className="border-t border-red-100 bg-blush-50 py-7">
                    <LiveRequests />
                </div>
            </section>

            {/* ---------- Compatibility ---------- */}
            <section className="bg-gray-900 text-white" id="compatibility">
                <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-12 lg:gap-16 lg:py-28">
                    <Reveal className="lg:col-span-4">
                        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-red-400">Blood compatibility</p>
                        <h2 className="mt-4 font-serif text-4xl font-medium leading-[1.05] sm:text-5xl">
                            Which groups can your blood help?
                        </h2>
                        <p className="mt-6 max-w-sm leading-relaxed text-gray-300">
                            Choose a blood group to see which patients can receive it. Vital uses
                            this same table to decide who sees a request, so you only hear about
                            requests your blood group can answer.
                        </p>
                    </Reveal>
                    <Reveal className="lg:col-span-8" delay={0.1}>
                        <BloodTypeExplorer />
                    </Reveal>
                </div>
            </section>

            {/* ---------- How it works ---------- */}
            <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28" id="how-it-works">
                <Reveal>
                    <h2 className="display max-w-2xl text-4xl sm:text-5xl">How a request reaches a donor</h2>
                </Reveal>

                <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10 lg:gap-14">
                    {STEPS.map((step, i) => (
                        <Reveal as="li" key={step.title} delay={i * 0.08} className="border-t-2 border-red-600 pt-6">
                            <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                            <p className="mt-3 leading-relaxed text-gray-600">{step.body}</p>
                        </Reveal>
                    ))}
                </ol>

                <Link
                    href="/how-it-works"
                    className="group mt-12 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 underline-offset-4 hover:underline"
                >
                    Read the full explanation
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>

                {networkItems.length > 0 && (
                    <dl className={`mt-20 grid gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 ${STAT_COLS[networkItems.length] ?? 'sm:grid-cols-3'}`}>
                        {networkItems.map(item => (
                            <div key={item.label} className="flex flex-col-reverse bg-white px-6 py-7 sm:px-8 sm:py-9">
                                <dt className="mt-2 text-sm font-medium text-gray-600">{item.label}</dt>
                                <dd className="font-serif text-5xl font-semibold leading-none text-red-600 sm:text-6xl">
                                    <CountUp value={item.value as number} />
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </section>

            {/* ---------- What Vital is, and is not ---------- */}
            <section className="border-y border-red-100 bg-blush-50" id="about-vital">
                <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
                    <Reveal className="max-w-2xl">
                        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-red-700">Please read</p>
                        <h2 className="display mt-4 text-4xl sm:text-5xl">Vital connects people. That is all it does.</h2>
                        <p className="mt-5 text-lg leading-relaxed text-gray-700">
                            Vital does not promote or promise anything. Everything that happens after
                            a donor and a family find each other is up to them.
                        </p>
                    </Reveal>
                    <dl className="mt-12 grid gap-4 sm:grid-cols-2 sm:gap-5">
                        {ABOUT.map((p, i) => (
                            <Reveal key={p.title} delay={(i % 2) * 0.08} className="rounded-xl border border-blush-200 bg-white p-6 sm:p-7">
                                <dt className="text-[17px] font-semibold text-gray-900">{p.title}</dt>
                                <dd className="mt-2 leading-relaxed text-gray-600">{p.body}</dd>
                            </Reveal>
                        ))}
                    </dl>
                    <p className="mt-10 max-w-2xl text-[15px] leading-relaxed text-gray-700">
                        Read the{' '}
                        <Link href="/safety-guidelines" className="font-medium text-gray-900 underline decoration-gray-400 underline-offset-4 hover:decoration-gray-900">
                            safety guidelines
                        </Link>{' '}
                        and{' '}
                        <Link href="/terms" className="font-medium text-gray-900 underline decoration-gray-400 underline-offset-4 hover:decoration-gray-900">
                            terms
                        </Link>
                        . If you have a question or concern, you can write to us at{' '}
                        <a href={`mailto:${GRIEVANCE_EMAIL}`} className="font-medium text-gray-900 underline decoration-gray-400 underline-offset-4 hover:decoration-gray-900">
                            {GRIEVANCE_EMAIL}
                        </a>
                        .
                    </p>
                </div>
            </section>

            {/* ---------- FAQ ---------- */}
            <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8 lg:py-28">
                <Reveal>
                    <h2 className="display text-4xl sm:text-5xl">Common questions</h2>
                </Reveal>
                <div className="mt-10 divide-y divide-gray-200 border-b border-gray-200">
                    {FAQ.map(item => (
                        <details key={item.q} className="group">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-semibold text-gray-900 transition-colors hover:text-red-700">
                                {item.q}
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-[transform,background-color,color] duration-200 group-open:rotate-45 group-open:bg-red-600 group-open:text-white">
                                    <Plus className="h-4 w-4" />
                                </span>
                            </summary>
                            <p className="max-w-2xl pb-6 leading-relaxed text-gray-600">{item.a}</p>
                        </details>
                    ))}
                </div>
            </section>

            {/* ---------- Closing ---------- */}
            <section className="bg-red-600 text-white">
                <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
                    <Reveal>
                        <h2 className="max-w-2xl font-serif text-4xl font-medium leading-[1.05] sm:text-6xl">
                            If you are able to give blood, please register.
                        </h2>
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white">
                            You will only be notified when a patient in your city needs a blood group
                            you can give. Whether you respond is always your choice.
                        </p>
                        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/register"
                                className="press group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-[15px] font-semibold text-red-700 shadow-lg shadow-red-900/20 hover:bg-red-50"
                            >
                                Become a donor
                                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </Link>
                            <button
                                onClick={handleShare}
                                className="press inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/60 hover:bg-white/10 hover:ring-white"
                            >
                                <Share2 className="h-4 w-4" /> Share with someone
                            </button>
                        </div>
                    </Reveal>
                </div>
            </section>
        </div>
    );
}
