import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PLATFORM_DISCLAIMER_LONG } from '@/lib/legal';

export const metadata = {
    alternates: { canonical: '/how-it-works' },
    title: 'How it works',
    description: 'How the Vital app works, from a blood request being posted to a donor responding. Vital only connects people.',
};

const STEPS = [
    {
        heading: 'Posting a request',
        lead: 'Anyone who needs blood for a patient can post a request.',
        body: [
            'The request gives the blood group, the number of units, the hospital, the date it is needed by and a contact person. It can be marked as high, medium or low urgency. The person posting is responsible for these details; Vital does not check them.',
            'Requests are public, so they can be forwarded on WhatsApp. The contact’s phone number is not shown.',
        ],
        figure: (
            <div className="space-y-3 text-sm">
                {[
                    ['Group', 'B+'],
                    ['Units', '2'],
                    ['Hospital', 'General Hospital, Kochi'],
                    ['Needed by', 'Thu, 14 Nov'],
                    ['Urgency', 'High'],
                ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                        <span className="text-gray-500">{k}</span>
                        <span className="text-right font-medium text-gray-900">{v}</span>
                    </div>
                ))}
            </div>
        ),
    },
    {
        heading: 'Alerting matching donors',
        lead: 'Donors whose listed blood group matches are alerted.',
        body: [
            'Vital looks for registered donors in the same city whose listed blood group is compatible with the request. For a B+ patient, for example, that includes O−, O+, B− and B+ donors. Blood groups are entered by donors themselves.',
            'Those donors receive a push notification and an email. Each donor decides for themselves whether to respond.',
        ],
        figure: (
            <div className="grid grid-cols-4 gap-px overflow-hidden rounded-md bg-gray-200 font-serif text-3xl font-medium">
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
        heading: 'Offering to donate',
        lead: 'A donor ticks a self-check, then chooses to offer.',
        body: [
            'Before offering, the donor declares that they are well today and have not recently had antibiotics, alcohol, a tattoo, surgery, or an infection such as malaria or dengue. This is their own declaration; the hospital or blood bank decides who can donate.',
            'Once they offer, the donor and the requester can see each other’s phone number. Numbers are not shown at any earlier point. From here, any contact or arrangement is directly between them, at their own discretion.',
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
        heading: 'Recording the donation',
        lead: 'The requester records each donation with the donor’s PIN.',
        body: [
            'Every donor has a private 4-digit PIN. After donating, they can give it to the requester, who enters it to mark the donation as completed in Vital.',
            'When enough units have been confirmed, the request closes automatically, and Vital starts counting the donor’s recovery period.',
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
            <section className="mx-auto max-w-6xl px-5 pb-12 pt-16 sm:px-8 sm:pt-24 lg:pb-16">
                <h1 className="display max-w-3xl text-5xl sm:text-6xl">What happens after a blood request is posted</h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
                    There are four stages in the app, from a request being posted to a donation being recorded. Each
                    one is described below, along with what information is shown at that point.
                </p>
            </section>

            <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8 lg:pb-32">
                <ol className="space-y-20 lg:space-y-28">
                    {STEPS.map(step => (
                        <li key={step.heading} className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-16">
                            <div className="lg:col-span-7">
                                <h2 className="font-serif text-3xl font-medium leading-tight text-gray-900 sm:text-4xl">{step.heading}</h2>
                                <p className="mt-4 text-lg font-medium leading-snug text-gray-900">{step.lead}</p>
                                <div className="mt-4 max-w-xl space-y-4 text-[17px] leading-relaxed text-gray-600">
                                    {step.body.map(p => <p key={p}>{p}</p>)}
                                </div>
                            </div>
                            <div className="lg:col-span-5">
                                <div className="rounded-lg bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8" aria-hidden>{step.figure}</div>
                            </div>
                        </li>
                    ))}
                </ol>

                <div className="mt-20 max-w-3xl border-t border-gray-200 pt-10 lg:mt-28">
                    <h2 className="font-serif text-2xl font-medium leading-tight text-gray-900 sm:text-3xl">What Vital does not do</h2>
                    <p className="mt-4 text-[17px] leading-relaxed text-gray-600">{PLATFORM_DISCLAIMER_LONG}</p>
                    <p className="mt-4 text-[17px] leading-relaxed text-gray-600">
                        Information shown in the app is self-declared by users and is not checked by Vital. In an emergency,
                        contact the hospital or a blood bank directly, or call 112. See the{' '}
                        <Link href="/terms" className="text-gray-900 underline decoration-gray-300 underline-offset-4">Terms</Link>.
                    </p>
                </div>
            </section>

            <section className="bg-gray-950 text-gray-50">
                <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
                    <h2 className="max-w-2xl font-serif text-4xl font-medium leading-[1.05] sm:text-5xl">
                        Register as a donor
                    </h2>
                    <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-500">
                        If you are between 18 and 65 and in good health, you can register. You will be alerted
                        to requests in your city that match your blood group, and you decide whether to respond.
                    </p>
                    <Link
                        href="/register"
                        className="mt-9 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-red-600 px-6 text-[15px] font-medium text-white transition-colors hover:bg-red-700"
                    >
                        Become a donor <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </section>
        </div>
    );
}
