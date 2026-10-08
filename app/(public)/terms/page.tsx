import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { GRIEVANCE_EMAIL, LEGAL_UPDATED, PLATFORM_DISCLAIMER_LONG } from '@/lib/legal';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    path: '/terms',
    title: 'Terms',
    description: 'The terms for using Vital, a free platform that only lets people post blood requests and lets voluntary donors respond.',
});

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of use"
            updated={LEGAL_UPDATED}
            intro={
                <>
                    <p>By creating an account or posting a request on Vital, you agree to these terms and to our <Link href="/privacy" className="underline decoration-gray-300 underline-offset-4">Privacy notice</Link>.</p>
                    <p className="mt-4 rounded-md bg-gray-100 px-4 py-3 text-base text-gray-800">{PLATFORM_DISCLAIMER_LONG}</p>
                </>
            }
            sections={[
                {
                    heading: 'What Vital is, and isn’t',
                    body: (
                        <>
                            <p><strong>Vital is only a platform.</strong> It is a free, non-commercial website where people can post blood requests and where voluntary donors can see and respond to them. That is all it does.</p>
                            <p><strong>Vital does not arrange, supervise, verify, promote or guarantee any donation, donor, request or outcome</strong>, and makes no promises or representations about any of them. We don’t check who users are, whether a request is genuine, or whether a donor is eligible.</p>
                            <p><strong>Everything after that is between the people involved.</strong> Any contact, arrangement or donation is entirely between the donor and the requester, at their own discretion and responsibility.</p>
                            <p><strong>Vital is not a blood bank, hospital or medical service.</strong> We don’t collect, test, store or supply blood, and we don’t give medical advice. Blood is collected only by hospitals and licensed blood banks, which carry out their own checks and decide who can donate.</p>
                            <p><strong>Information is self-declared.</strong> Blood groups, eligibility answers, checklists and request details are entered by users themselves and are not checked by Vital.</p>
                            <p>A donor may not be found, may not respond, or may not turn up. In an emergency, contact the hospital or a blood bank directly, or call 112. Don’t rely on Vital alone.</p>
                        </>
                    ),
                },
                {
                    heading: 'Vital is not involved in any payment',
                    body: (
                        <>
                            <p>Vital is free to use. It does not charge anyone, does not pay anyone, and is not involved in any payment between users.</p>
                            <p>Blood donation in India is voluntary and non-remunerated. You must not use Vital to ask for, offer or accept money, gifts or any other reward for blood.</p>
                            <p>If you come across this, you can tell us at <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>. We may suspend accounts that misuse the platform.</p>
                        </>
                    ),
                },
                {
                    heading: 'If you’re a donor',
                    body: (
                        <ul>
                            <li>You must be 18–65, weigh at least 45 kg, and answer the health questions honestly. Your answers are your own declaration.</li>
                            <li>Only offer when you meet the checklist that day, and withdraw your offer if things change.</li>
                            <li>Whether and how you contact a requester, and whether you donate, is your own decision.</li>
                            <li>Keep your donor PIN to yourself. Share it with the requester only after you’ve donated.</li>
                            <li>The hospital or blood bank makes the final decision on whether you can donate.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'If you’re requesting blood',
                    body: (
                        <ul>
                            <li>You are responsible for your request: post only genuine requests, with accurate hospital and blood-group details.</li>
                            <li>Any donor who responds is not checked by Vital. Deal with them directly and at your own discretion.</li>
                            <li>Use donors’ contact details only to coordinate that donation, never for anything else.</li>
                            <li>Enter a donor’s PIN only after the donation has happened, and close the request once you have what you need.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'Things you mustn’t do',
                    body: (
                        <ul>
                            <li>Post fake requests or impersonate someone else.</li>
                            <li>Harass, spam or scrape other users, or try to access data that isn’t yours.</li>
                            <li>Use Vital for anything commercial, including buying or selling blood.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'No guarantees and liability',
                    body: (
                        <>
                            <p>Vital is provided as-is and as-available, without warranties or guarantees of any kind. We don’t guarantee that the service will be available, that information on it is accurate, or that any request will be met.</p>
                            <p>Because Vital does not arrange or take part in any donation, you use it and deal with other users at your own risk. To the extent the law allows, Vital and the people who run it are not liable for any loss, harm or outcome arising from contact, arrangements or donations between users, or from relying on information users have entered.</p>
                        </>
                    ),
                },
                {
                    heading: 'Accounts and changes',
                    body: (
                        <>
                            <p>You can delete your account at any time from your profile. We may suspend accounts that misuse the platform or break these terms.</p>
                            <p>We may update these terms. If a change is significant, we’ll tell you in the app before it takes effect.</p>
                            <p>These terms are governed by the laws of India.</p>
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
