import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata = {
    alternates: { canonical: '/how-it-works' },
    title: 'How it works',
    description: 'What happens between a blood request going up and a donor walking into the hospital.',
};

const STEPS = [
    {
        kicker: 'The request',
        title: 'A family posts what they need.',
        body: [
            'Blood group, number of units, the hospital, the date it’s needed by, and a contact person. Requests can be marked high, medium or low urgency.',
            'The request is public, so it can be shared on WhatsApp. Contact details are not.',
        ],
        figure: (
            <div className="space-y-3 font-mono text-[13px]">
                {[
                    ['Group', 'B+'],
                    ['Units', '2'],
                    ['Hospital', 'General Hospital, Kochi'],
                    ['Needed by', 'Thu, 14 Nov'],
                    ['Urgency', 'High'],
                ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-gray-200 pb-3 last:border-0 last:pb-0">
                        <span className="text-gray-500">{k}</span>
                        <span className="text-gray-900">{v}</span>
                    </div>
                ))}
            </div>
        ),
    },
    {
        kicker: 'The match',
        title: 'Only people who can help are told.',
        body: [
            'Vital looks for registered donors in the same city whose blood group is compatible with the patient. That means donors whose red cells the patient can actually receive, not just an exact match.',
            'Those donors get a push notification and an email. Nobody else is pinged.',
        ],
        figure: (
            <div className="grid grid-cols-4 gap-px overflow-hidden rounded-md bg-gray-200 font-serif text-3xl">
                {['O−', 'O+', 'A−', 'A+', 'B−', 'B+', 'AB−', 'AB+'].map(g => {
                    const match = ['O−', 'O+', 'B−', 'B+'].includes(g);
                    return (
                        <div key={g} className={`flex aspect-square items-center justify-center ${match ? 'bg-gray-900 text-white' : 'bg-white text-gray-300'}`}>
                            {g}
                        </div>
                    );
                })}
            </div>
        ),
    },
    {
        kicker: 'The offer',
        title: 'A donor checks themselves, then says yes.',
        body: [
            'Before offering, a donor confirms they’re well today and haven’t recently had antibiotics, alcohol, a tattoo, surgery, or an infection like malaria or dengue.',
            'Once they offer, they see the family’s contact, and the family sees theirs. That’s the only time numbers are exchanged.',
        ],
        figure: (
            <ul className="space-y-3 text-sm">
                {['Feeling well today', 'No antibiotics in 14 days', 'No tattoo or surgery in 12 months', 'No alcohol in 24 hours', 'No recent infection'].map(t => (
                    <li key={t} className="flex items-center gap-3">
                        <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-gray-900">
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" aria-hidden><path d="M2.5 6.5l2.2 2L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                        <span className="text-gray-800">{t}</span>
                    </li>
                ))}
            </ul>
        ),
    },
    {
        kicker: 'The proof',
        title: 'The family confirms with a PIN.',
        body: [
            'Every donor has a private 4-digit PIN. At the hospital they share it with the family, who enter it in Vital to confirm the donation happened.',
            'When enough units are confirmed, the request closes on its own, and the donor’s recovery clock starts.',
        ],
        figure: (
            <div className="flex justify-center gap-2">
                {['4', '7', '1', '9'].map((d, i) => (
                    <span key={i} className="flex h-16 w-12 items-center justify-center rounded-md border border-gray-300 bg-white font-mono text-2xl text-gray-900">
                        {d}
                    </span>
                ))}
            </div>
        ),
    },
];

export default function HowItWorksPage() {
    return (
        <div>
            <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
                <p className="eyebrow">How it works</p>
                <h1 className="display mt-5 max-w-4xl text-5xl leading-[0.98] sm:text-7xl">
                    From a request to a donor at the bedside, <em className="text-red-600">in four steps.</em>
                </h1>
            </section>

            <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
                <ol className="border-t border-gray-200">
                    {STEPS.map((step, i) => (
                        <li key={step.kicker} className="grid gap-10 border-b border-gray-200 py-14 lg:grid-cols-12 lg:gap-16">
                            <div className="lg:col-span-7">
                                <p className="font-mono text-xs text-red-600">
                                    0{i + 1} <span className="ml-2 uppercase tracking-[0.14em] text-gray-500">{step.kicker}</span>
                                </p>
                                <h2 className="mt-5 text-3xl font-medium leading-tight tracking-tight text-gray-900 sm:text-4xl">{step.title}</h2>
                                <div className="mt-5 max-w-xl space-y-4 text-[17px] leading-relaxed text-gray-600">
                                    {step.body.map(p => <p key={p}>{p}</p>)}
                                </div>
                            </div>
                            <div className="lg:col-span-5">
                                <div className="rounded-lg border border-gray-200 bg-gray-100/60 p-6 sm:p-8">{step.figure}</div>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="bg-gray-950 text-gray-50">
                <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
                    <h2 className="max-w-2xl font-serif text-5xl leading-[1] tracking-tight sm:text-6xl">
                        The network is only as good as the people on it.
                    </h2>
                    <Link
                        href="/register"
                        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-red-600 px-6 text-[15px] font-medium text-white transition-colors hover:bg-red-700"
                    >
                        Become a donor <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
