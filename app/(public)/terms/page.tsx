import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { GRIEVANCE_EMAIL, LEGAL_UPDATED } from '@/lib/legal';

export const metadata = {
    title: 'Terms',
    description: 'The rules for using Vital as a donor or as someone requesting blood.',
    alternates: { canonical: '/terms' },
};

export default function TermsPage() {
    return (
        <LegalPage
            eyebrow="Terms"
            title={<>The rules, <em>short.</em></>}
            updated={LEGAL_UPDATED}
            intro={<p>By creating an account or posting a request on Vital, you agree to these terms and to our <Link href="/privacy" className="underline decoration-gray-300 underline-offset-4">Privacy notice</Link>.</p>}
            sections={[
                {
                    heading: 'What Vital is, and isn’t',
                    body: (
                        <>
                            <p>Vital is a free, non-commercial way for voluntary donors and people who need blood to find each other.</p>
                            <p><strong>Vital is not a blood bank, hospital or medical service.</strong> We don’t collect, test or supply blood, and we don’t give medical advice. Every donation happens at a hospital or licensed blood bank, under their checks.</p>
                            <p>We can’t guarantee that a donor will be found, will respond, or will turn up. In an emergency, contact the hospital, a blood bank, or call 112 alongside using Vital.</p>
                        </>
                    ),
                },
                {
                    heading: 'Nobody pays, nobody gets paid',
                    body: (
                        <>
                            <p>Blood donation in India is voluntary and non-remunerated. You must not ask for, offer or accept money, gifts or any other reward for blood through Vital.</p>
                            <p>If anyone does, decline and report it to <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>. We remove accounts involved in selling or buying blood.</p>
                        </>
                    ),
                },
                {
                    heading: 'If you’re a donor',
                    body: (
                        <ul>
                            <li>You must be 18–65, weigh at least 45 kg, and answer the health questions honestly.</li>
                            <li>Only offer when you meet the safety checklist that day. Withdraw your offer if things change.</li>
                            <li>Keep your donor PIN to yourself. Share it with the family only after you’ve donated.</li>
                            <li>The hospital or blood bank makes the final decision on whether you can donate.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'If you’re requesting blood',
                    body: (
                        <ul>
                            <li>Only post genuine requests, with accurate hospital and blood-group details.</li>
                            <li>Use donors’ contact details only to coordinate that donation, never for anything else.</li>
                            <li>Confirm a donation with the donor’s PIN only after it has happened, and close the request once you have what you need.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'Things you mustn’t do',
                    body: (
                        <ul>
                            <li>Post fake requests or impersonate someone else.</li>
                            <li>Harass, spam or scrape other users, or try to access data that isn’t yours.</li>
                            <li>Use Vital for anything commercial.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'Accounts and changes',
                    body: (
                        <>
                            <p>You can delete your account at any time from your profile. We may suspend accounts that break these terms or put others at risk.</p>
                            <p>We may update these terms. If a change is significant, we’ll tell you in the app before it takes effect.</p>
                            <p>Vital is provided as-is, without guarantees. To the extent the law allows, we aren’t liable for outcomes of contact between users. These terms are governed by the laws of India.</p>
                        </>
                    ),
                },
                {
                    heading: 'Contact',
                    body: <p>Questions or complaints: <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>.</p>,
                },
            ]}
        />
    );
}
