import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';
import { GRIEVANCE_EMAIL, LEGAL_UPDATED } from '@/lib/legal';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    path: '/privacy',
    title: 'Privacy notice',
    description: 'What Vital collects, who can see it, and how to get it deleted.',
});

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy notice"
            updated={LEGAL_UPDATED}
            intro={
                <p>
                    Vital is a free platform where people can post blood requests and voluntary donors can respond to them. To run it we hold some personal and
                    health-related information about you. This notice explains what, why, who can see it, and how to have it
                    removed. It is written to meet India’s Digital Personal Data Protection Act, 2023.
                </p>
            }
            sections={[
                {
                    heading: 'What we collect',
                    body: (
                        <>
                            <p><strong>When you create an account:</strong> your email address and a password (stored only as a secure hash by our authentication provider), or your Google account email and name if you sign in with Google.</p>
                            <p><strong>When you register as a donor:</strong></p>
                            <ul>
                                <li>name, mobile number, date of birth and gender;</li>
                                <li>blood group;</li>
                                <li>city, district, state and PIN codes (current and permanent);</li>
                                <li>when you’re usually free, the date you last donated, and your own declaration that you’re fit to donate;</li>
                                <li>a 4-digit donor PIN you choose.</li>
                            </ul>
                            <p><strong>When you post a request:</strong> the patient’s blood group, units needed, hospital, its location on a map, the date needed, a contact name and phone number, and any note you add.</p>
                            <p><strong>When you use the app:</strong> your offers to donate and whether they were confirmed; push-notification tokens for devices where you turn alerts on; and a log of key actions (such as creating or deleting a request) for security.</p>
                            <p>Your location is never tracked in the background. The “Use my location” buttons read your position once, when you tap them.</p>
                        </>
                    ),
                },
                {
                    heading: 'Why we use it',
                    body: (
                        <ul>
                            <li>To alert you to requests in your city that match the blood group you entered.</li>
                            <li>To show a donor and a requester each other’s contact details once the donor offers on that request.</li>
                            <li>To show a reminder of when you may be able to donate again (90 days for men, 120 for women), based on dates you enter.</li>
                            <li>To mark a donation as completed in Vital when the requester enters your PIN.</li>
                            <li>To run the service and look into misuse.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'Who can see what',
                    body: (
                        <>
                            <ul>
                                <li><strong>Anyone:</strong> open requests (blood group, units, hospital, city, date, contact name and note). Never the contact’s phone number.</li>
                                <li><strong>Signed-in users, on “Donors nearby”:</strong> your first name and last initial, blood group, PIN code, and a location rounded to about 1 km. Never your phone, email or exact address.</li>
                                <li><strong>A requester whose request you offer on:</strong> your name and phone number, so they can reach you. Nobody else.</li>
                                <li><strong>You, when you offer on a request:</strong> that request’s contact name and phone number.</li>
                                <li><strong>Your public donor card:</strong> off by default. If you turn it on, anyone with the link sees your name, blood group, donor number and donation count.</li>
                                <li><strong>Your donor PIN:</strong> only you. The requester types it in and our server checks it; they never see it.</li>
                                <li><strong>Vital administrators:</strong> account and request details, to run and protect the service.</li>
                            </ul>
                            <p>We never sell your data or share it for advertising.</p>
                        </>
                    ),
                },
                {
                    heading: 'Services we rely on',
                    body: (
                        <>
                            <p>These providers process data on our behalf, only to run Vital:</p>
                            <ul>
                                <li><strong>Supabase</strong> stores the database and handles sign-in.</li>
                                <li><strong>Vercel</strong> hosts the website.</li>
                                <li>Our <strong>email provider</strong> sends alert, welcome and password-reset emails.</li>
                                <li><strong>Google</strong>, only if you choose “Continue with Google”.</li>
                                <li><strong>OpenStreetMap</strong> turns a PIN code into an approximate map position (Nominatim) and serves the map images.</li>
                                <li>Your browser’s push service (for example Google or Apple) delivers notifications you’ve turned on.</li>
                            </ul>
                            <p>Some of these providers may store data outside India.</p>
                        </>
                    ),
                },
                {
                    heading: 'Consent and how long we keep data',
                    body: (
                        <>
                            <p>We ask for your consent when you register, and record when you gave it and which version of this notice it was. You can withdraw it at any time by deleting your account.</p>
                            <p>We keep your data while your account exists. When you delete your account (Profile → Delete account), we delete your profile, PIN, requests, offers and alert subscriptions. Copies in backups are removed as those backups expire.</p>
                        </>
                    ),
                },
                {
                    heading: 'Your rights',
                    body: (
                        <>
                            <p>You can:</p>
                            <ul>
                                <li>see and correct your details in your profile at any time;</li>
                                <li>ask us for a summary of the data we hold about you;</li>
                                <li>delete your account and data yourself, or ask us to;</li>
                                <li>nominate someone to exercise these rights if you can’t;</li>
                                <li>raise a grievance with us, and then with the Data Protection Board of India if you’re not satisfied.</li>
                            </ul>
                            <p>Vital is only for people aged 18 and over.</p>
                        </>
                    ),
                },
                {
                    heading: 'Contact and grievances',
                    body: (
                        <>
                            <p>
                                Write to <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a> with “Privacy” in the subject.
                            </p>
                            <p>See also our <Link href="/terms">Terms</Link> and <Link href="/safety-guidelines">Safety guidelines</Link>.</p>
                        </>
                    ),
                },
            ]}
        />
    );
}
