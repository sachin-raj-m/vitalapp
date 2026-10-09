import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { findContactLink } from '@/lib/contact-links';
import { contactSummary } from '@/lib/contact-view';
import { formatBloodGroup } from '@/lib/blood-compatibility';
import { formatNeededBy, placeLabel } from '@/lib/share';
import { ContactReveal } from './ContactReveal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Contact details',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
};

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <header className="mx-auto flex h-16 w-full max-w-xl items-center px-5">
                <Link href="/" aria-label="Vital home" className="-mb-1"><Logo /></Link>
            </header>
            <main id="main" tabIndex={-1} className="mx-auto w-full max-w-xl flex-1 px-5 pb-20 pt-6">{children}</main>
        </div>
    );
}

/**
 * Landing page for the contact links Vital sends on WhatsApp. Shows what the
 * link is about; the phone number appears only after "Show contact details".
 */
export default async function ContactLinkPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const found = await findContactLink(token);
    const summary = 'link' in found ? await contactSummary(found.link) : null;

    if (!summary || !summary.open) {
        const expired = 'reason' in found && found.reason === 'expired';
        return (
            <Shell>
                <h1 className="display text-4xl">{summary && !summary.open ? 'This offer is no longer open' : expired ? 'This link has expired' : 'This link isn’t valid'}</h1>
                <p className="mt-4 text-lg leading-relaxed text-gray-600">
                    {summary && !summary.open
                        ? 'The request has been closed or the offer was withdrawn. Thank you for being ready to help.'
                        : 'Links to contact details only work for a short time, so numbers don’t stay in chats. Reply LINK to Vital on WhatsApp for a new one, or sign in to see it in My donations or My requests.'}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/login" className="inline-flex h-11 items-center rounded-md bg-gray-900 px-5 text-sm font-medium text-white hover:bg-gray-800">Sign in</Link>
                    <Link href="/requests" className="inline-flex h-11 items-center rounded-md border border-gray-300 px-5 text-sm font-medium text-gray-900 hover:border-gray-400">Open requests</Link>
                </div>
            </Shell>
        );
    }

    const place = placeLabel(summary.hospital, summary.city);
    const neededBy = formatNeededBy(summary.dateNeeded);
    return (
        <Shell>
            <p className="text-sm font-medium text-red-700">{formatBloodGroup(summary.bloodGroup)} blood{neededBy ? ` · needed by ${neededBy}` : ''}</p>
            <h1 className="display mt-2 text-4xl">{summary.viewer === 'donor' ? 'Thank you for offering' : 'Someone offered to donate'}</h1>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
                {summary.viewer === 'donor'
                    ? `Call the contact person to arrange your donation${place ? ` at ${place}` : ''}.`
                    : `Call the donor to arrange the donation${place ? ` at ${place}` : ''}.`}
            </p>
            <ContactReveal token={token} viewer={summary.viewer} address={summary.address} />
            <p className="mt-10 border-t border-gray-200 pt-6 text-[13px] leading-relaxed text-gray-500">
                Vital only connects people. It does not arrange, verify or guarantee donations, and is not involved in any payment.
                Please don’t share this page or the number with others.
            </p>
        </Shell>
    );
}
