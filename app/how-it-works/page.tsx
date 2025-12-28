import { ArrowRight, Activity, Bell, MapPin, Shield, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export const metadata = {
    title: 'How Vital Works - The Science of Saving Lives',
    description: 'Understand the algorithm and safety protocols behind Vital\'s real-time blood donation network.',
};

export default function HowItWorksPage() {
    return (
        <div className="bg-white text-slate-900 font-sans selection:bg-red-100 selection:text-red-900">

            {/* Hero Section */}
            <section className="pt-32 pb-20 bg-slate-50">
                <div className="container mx-auto px-4 md:px-6 text-center">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
                        Under the Hood of <span className="text-red-600">Saving Lives</span>
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
                        Vital isn't just a list of donors. It's a real-time, hyperlocal logistics engine designed to cut response times from hours to minutes.
                    </p>
                </div>
            </section>

            {/* The Protocol Section */}
            <section className="py-24">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-4xl mx-auto space-y-24">

                        {/* Step 1: The Trigger */}
                        <div className="flex flex-col md:flex-row gap-12 items-center">
                            <div className="flex-1 space-y-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold text-xl mb-4">1</div>
                                <h2 className="text-3xl font-bold text-slate-900">The Trigger</h2>
                                <h3 className="text-xl font-medium text-red-600">A verified need arises.</h3>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    When a hospital or individual posts a request, it isn't broadcast to everyone. That creates noice.
                                    Instead, our system validates the urgency, location, and specific blood component required.
                                </p>
                            </div>
                            <div className="flex-1 bg-slate-50 p-8 rounded-3xl border border-slate-100 shadow-lg">
                                <div className="flex items-center gap-4 mb-4 opacity-50">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    <div className="h-2 bg-slate-200 rounded-full w-24"></div>
                                </div>
                                <div className="space-y-3">
                                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <div className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg shadow-md">Request Verified</div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: The Algorithm */}
                        <div className="flex flex-col md:flex-row-reverse gap-12 items-center">
                            <div className="flex-1 space-y-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl mb-4">2</div>
                                <h2 className="text-3xl font-bold text-slate-900">The Matching Algorithm</h2>
                                <h3 className="text-xl font-medium text-blue-600">Precision over volume.</h3>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    Vital's engine filters our donor database instantly based on 3 criteria:
                                </p>
                                <ul className="space-y-3 mt-4">
                                    <li className="flex items-center gap-3 text-slate-700">
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                        <span><strong>Blood Compatibility:</strong> Only exact matches (e.g. O+ for O+).</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-slate-700">
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                        <span><strong>Hyper-location:</strong> Donors within a 5-10km radius to ensure speed.</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-slate-700">
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                        <span><strong>Eligibility Status:</strong> Donors not in their cooling-off period.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="flex-1 bg-slate-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                <div className="relative z-10 grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                                        <div className="text-xs text-slate-400 mb-1">Distance</div>
                                        <div className="text-xl font-mono text-green-400">3.2 km</div>
                                    </div>
                                    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
                                        <div className="text-xs text-slate-400 mb-1">Blood Group</div>
                                        <div className="text-xl font-mono text-red-400">Match</div>
                                    </div>
                                    <div className="col-span-2 p-4 bg-slate-800 rounded-xl border border-slate-700 flex justify-between items-center">
                                        <div className="text-sm font-bold">Eligibility Check</div>
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                            <div className="text-xs text-green-400">PASSED</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 3: The Connection */}
                        <div className="flex flex-col md:flex-row gap-12 items-center">
                            <div className="flex-1 space-y-4">
                                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xl mb-4">3</div>
                                <h2 className="text-3xl font-bold text-slate-900">The Connection</h2>
                                <h3 className="text-xl font-medium text-emerald-600">Privacy-first handshake.</h3>
                                <p className="text-lg text-slate-600 leading-relaxed">
                                    Donors receive a push notification. They review the case. If they accept, only THEN is contact information exchanged via a secure, temporary bridge.
                                    This prevents spam and harassment.
                                </p>
                            </div>
                            <div className="flex-1 flex justify-center">
                                <div className="relative w-64 h-auto bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-4">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-900 rounded-b-xl"></div>
                                    <div className="mt-8 space-y-4">
                                        <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Bell className="w-5 h-5 text-red-600" />
                                                <span className="text-xs font-bold text-red-800 uppercase">Urgent Request</span>
                                            </div>
                                            <p className="text-sm text-slate-700 font-medium">A+ Blood Needed at City Hospital</p>
                                            <div className="mt-3 flex gap-2">
                                                <div className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-center text-xs font-bold shadow-sm">Decline</div>
                                                <div className="flex-1 py-2 bg-red-600 text-white rounded-lg text-center text-xs font-bold shadow-sm">I can donate</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 bg-slate-900 text-white text-center">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl md:text-5xl font-bold mb-8">Ready to be part of the algorithm?</h2>
                    <Link href="/register">
                        <Button size="xl" className="bg-red-600 hover:bg-red-700 text-white rounded-full px-12 py-6 text-xl font-bold shadow-xl shadow-red-900/20">
                            Join the Network
                        </Button>
                    </Link>
                </div>
            </section>

        </div>
    );
}
